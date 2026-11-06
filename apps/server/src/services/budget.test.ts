// Budget service (build-schedule C5): checkout row, exactly-once credit across webhook + poller, mismatch refusals.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Program } from '@tapat/shared';
import type { Db } from '../db/index';
import { openDb } from '../db/index';
import { ApiError } from '../errors';
import {
  BUDGET_POLL_WINDOW_MS,
  createBudgetCheckout,
  creditBudgetIntent,
  handleVeloDelivery,
  pollBudgetOnce,
  type BudgetDeps,
} from './budget';
import { createSseBus } from './sse';
import { INTENT_ID, PUBLIC_BASE_URL, WEBHOOK_SECRET, fakeVelo, intent, paymentEventBody, type FakeVelo } from './test-velo';
import { T0, fakeLog, seedProgram } from './test-fakes';

let db: Db;
let fake: FakeVelo;
let deps: BudgetDeps;
let published: Array<{ event: string; data: unknown }>;

interface IntentRow {
  status: string;
  amount: string;
  asset: string;
  checkout_url: string | null;
  tx_hash: string | null;
  payer_address: string | null;
  paid_at: number | null;
  purpose: string;
}

beforeEach(() => {
  db = openDb(':memory:');
  seedProgram(db);
  fake = fakeVelo();
  const bus = createSseBus();
  published = [];
  bus.subscribe((event, data) => published.push({ event, data }));
  deps = {
    db,
    velo: fake.velo,
    bus,
    config: { PHP_PER_XLM: 10, PUBLIC_BASE_URL, VELO_WEBHOOK_SECRET: WEBHOOK_SECRET },
    log: fakeLog(),
    now: () => T0,
  };
});

afterEach(() => {
  db.close();
});

function verified(): string {
  return String(db.prepare('SELECT budget_verified_stroops AS v FROM program').get<{ v: number }>()?.v);
}

function intentRow(id = INTENT_ID): IntentRow | undefined {
  return db.prepare('SELECT * FROM velo_intents WHERE id = ?').get<IntentRow>(id);
}

function insertIntent(id: string, createdAt: number, amount = '1000.00'): void {
  db.prepare(
    `INSERT INTO velo_intents (id, purpose, amount, asset, status, checkout_url, created_at)
     VALUES (?, 'budget', ?, 'XLM', 'created', 'https://pay/x', ?)`,
  ).run(id, amount, createdAt);
}

describe('createBudgetCheckout', () => {
  it('creates the session with the XLM amount string and stores the intent row', async () => {
    const response = await createBudgetCheckout(deps, { amountPhp: 10000 });

    expect(response).toEqual({ checkoutUrl: 'https://pay.velo-build.dev/checkout/pi_budget_1', paymentIntentId: INTENT_ID });
    expect(fake.create).toHaveBeenCalledWith(
      {
        amount: '1000.00',
        asset: 'native',
        description: 'TAPat fuel program budget',
        successUrl: `${PUBLIC_BASE_URL}/?budget=success`,
        cancelUrl: `${PUBLIC_BASE_URL}/?budget=cancel`,
      },
      { idempotencyKey: 'budget:prog_test:1' },
    );
    expect(intentRow()).toMatchObject({
      purpose: 'budget',
      amount: '1000.00',
      asset: 'XLM',
      status: 'created',
      checkout_url: 'https://pay.velo-build.dev/checkout/pi_budget_1',
    });
  });

  it('numbers the idempotency key from the count of budget intents', async () => {
    insertIntent('pi_old', T0 - 1);
    await createBudgetCheckout(deps, { amountPhp: 500 });
    expect(fake.create.mock.calls[0]?.[1]).toEqual({ idempotencyKey: 'budget:prog_test:2' });
    expect(fake.create.mock.calls[0]?.[0]).toMatchObject({ amount: '50.00' });
  });

  it('answers 404 without a program and 409 for an ending program', async () => {
    db.prepare(`UPDATE program SET status = 'ending'`).run();
    await expect(createBudgetCheckout(deps, { amountPhp: 100 })).rejects.toMatchObject({
      statusCode: 409,
      code: 'INVALID_STATE',
    });
    db.prepare('DELETE FROM program').run();
    await expect(createBudgetCheckout(deps, { amountPhp: 100 })).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
    expect(fake.create).not.toHaveBeenCalled();
  });

  it('maps an SDK failure to 502 CHAIN_ERROR VELO_CALL_FAILED and stores no row', async () => {
    fake.create.mockRejectedValueOnce(new Error('velo is down'));
    const error: unknown = await createBudgetCheckout(deps, { amountPhp: 100 }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ statusCode: 502, code: 'CHAIN_ERROR', message: 'VELO_CALL_FAILED: velo is down' });
    expect(db.prepare('SELECT COUNT(*) AS n FROM velo_intents').get<{ n: number }>()?.n).toBe(0);
  });
});

describe('creditBudgetIntent', () => {
  beforeEach(() => {
    insertIntent(INTENT_ID, T0);
  });

  it('credits 10,000,000,000 stroops once for a paid ₱10,000 intent and publishes the program', async () => {
    fake.retrieve.mockResolvedValue(intent({ status: 'paid', payerAddress: 'GPAYER' }));

    expect(await creditBudgetIntent(deps, INTENT_ID, { txHash: 'abc123' })).toBe('credited');

    expect(verified()).toBe('10000000000');
    expect(intentRow()).toMatchObject({ status: 'paid', paid_at: T0, tx_hash: 'abc123', payer_address: 'GPAYER' });
    const budget = published.filter((entry) => entry.event === 'budget');
    expect(budget).toHaveLength(1);
    expect((budget[0]?.data as Program).budgetVerifiedStroops).toBe('10000000000');
  });

  it('never credits twice: a second call returns already_paid without asking Velo again', async () => {
    fake.retrieve.mockResolvedValue(intent({ status: 'paid' }));
    await creditBudgetIntent(deps, INTENT_ID);
    fake.retrieve.mockClear();

    expect(await creditBudgetIntent(deps, INTENT_ID)).toBe('already_paid');
    expect(fake.retrieve).not.toHaveBeenCalled();
    expect(verified()).toBe('10000000000');
  });

  it('credits once when two calls race past the retrieve', async () => {
    fake.retrieve.mockResolvedValue(intent({ status: 'paid' }));
    const outcomes = await Promise.all([creditBudgetIntent(deps, INTENT_ID), creditBudgetIntent(deps, INTENT_ID)]);

    expect(outcomes.sort()).toEqual(['already_paid', 'credited']);
    expect(verified()).toBe('10000000000');
    expect(published.filter((entry) => entry.event === 'budget')).toHaveLength(1);
  });

  it('does not credit an intent Velo reports as unpaid', async () => {
    fake.retrieve.mockResolvedValue(intent({ status: 'pending' }));
    expect(await creditBudgetIntent(deps, INTENT_ID)).toBe('not_paid');
    expect(verified()).toBe('0');
    expect(intentRow()?.status).toBe('created');
  });

  it('refuses an amount mismatch', async () => {
    fake.retrieve.mockResolvedValue(intent({ status: 'paid', amount: '999.99' }));
    expect(await creditBudgetIntent(deps, INTENT_ID)).toBe('mismatch');
    expect(verified()).toBe('0');
    expect(intentRow()?.status).toBe('created');
    expect(deps.log.warn).toHaveBeenCalled();
  });

  it('refuses an asset mismatch but accepts either echo of XLM', async () => {
    fake.retrieve.mockResolvedValue(intent({ status: 'paid', asset: 'USDC' }));
    expect(await creditBudgetIntent(deps, INTENT_ID)).toBe('mismatch');
    expect(verified()).toBe('0');

    fake.retrieve.mockResolvedValue(intent({ status: 'paid', asset: 'XLM', amount: '1000.0000000' }));
    expect(await creditBudgetIntent(deps, INTENT_ID)).toBe('credited');
    expect(verified()).toBe('10000000000');
  });

  it('ignores an intent id this server never created, without calling Velo', async () => {
    expect(await creditBudgetIntent(deps, 'pi_stranger')).toBe('unknown_intent');
    expect(fake.retrieve).not.toHaveBeenCalled();
    expect(verified()).toBe('0');
  });

  it('adds to a balance that is already verified', async () => {
    db.prepare('UPDATE program SET budget_verified_stroops = 500000000').run();
    fake.retrieve.mockResolvedValue(intent({ status: 'paid' }));
    await creditBudgetIntent(deps, INTENT_ID);
    expect(verified()).toBe('10500000000');
  });
});

describe('pollBudgetOnce', () => {
  it('credits a paid intent the webhook never delivered, and a later pass does nothing', async () => {
    insertIntent(INTENT_ID, T0 - 1000);
    fake.retrieve.mockResolvedValue(intent({ status: 'paid' }));

    expect(await pollBudgetOnce(deps)).toBe(1);
    expect(verified()).toBe('10000000000');
    fake.retrieve.mockClear();
    expect(await pollBudgetOnce(deps)).toBe(0);
    expect(fake.retrieve).not.toHaveBeenCalled();
    expect(verified()).toBe('10000000000');
  });

  it('skips intents older than 30 minutes and logs a failing retrieve instead of throwing', async () => {
    insertIntent('pi_stale', T0 - BUDGET_POLL_WINDOW_MS - 1);
    insertIntent('pi_flaky', T0 - 1000);
    fake.retrieve.mockRejectedValue(new Error('timeout'));

    expect(await pollBudgetOnce(deps)).toBe(0);
    expect(fake.retrieve).toHaveBeenCalledTimes(1);
    expect(fake.retrieve.mock.calls[0]?.[0]).toBe('pi_flaky');
    expect(deps.log.warn).toHaveBeenCalledWith({ intentId: 'pi_flaky', cause: 'timeout' }, 'budget poll failed');
  });

  it('shares the credit path with the webhook: delivery first, then a poll pass, credits once', async () => {
    insertIntent(INTENT_ID, T0 - 1000);
    fake.retrieve.mockResolvedValue(intent({ status: 'paid' }));
    const event = { id: 'evt_1', type: 'payment.succeeded', paymentIntent: { id: INTENT_ID, txHash: 'abc123' } };
    await handleVeloDelivery(deps, { id: 'dlv_1', rawBody: paymentEventBody('payment.succeeded'), event });
    await pollBudgetOnce(deps);

    expect(verified()).toBe('10000000000');
  });
});

describe('handleVeloDelivery', () => {
  const succeeded = { id: 'evt_1', type: 'payment.succeeded', paymentIntent: { id: INTENT_ID, txHash: 'abc123' } };

  beforeEach(() => {
    insertIntent(INTENT_ID, T0);
  });

  it('records the delivery and credits the intent', async () => {
    fake.retrieve.mockResolvedValue(intent({ status: 'paid' }));
    const rawBody = paymentEventBody('payment.succeeded');
    await handleVeloDelivery(deps, { id: 'dlv_1', rawBody, event: succeeded });

    expect(verified()).toBe('10000000000');
    expect(
      db.prepare('SELECT type, payload_json FROM webhook_deliveries WHERE delivery_id = ?').get('dlv_1'),
    ).toEqual({ type: 'payment.succeeded', payload_json: rawBody });
  });

  it('short-circuits a repeated delivery id', async () => {
    fake.retrieve.mockResolvedValue(intent({ status: 'paid' }));
    await handleVeloDelivery(deps, { id: 'dlv_1', rawBody: '{}', event: succeeded });
    fake.retrieve.mockClear();
    await handleVeloDelivery(deps, { id: 'dlv_1', rawBody: '{}', event: succeeded });

    expect(fake.retrieve).not.toHaveBeenCalled();
    expect(verified()).toBe('10000000000');
    expect(db.prepare('SELECT COUNT(*) AS n FROM webhook_deliveries').get<{ n: number }>()?.n).toBe(1);
  });

  it('keeps the delivery and swallows the error when the handler throws', async () => {
    fake.retrieve.mockRejectedValue(new Error('velo timeout'));
    await expect(handleVeloDelivery(deps, { id: 'dlv_1', rawBody: '{}', event: succeeded })).resolves.toBeUndefined();

    expect(db.prepare('SELECT COUNT(*) AS n FROM webhook_deliveries').get<{ n: number }>()?.n).toBe(1);
    expect(deps.log.error).toHaveBeenCalled();
    expect(verified()).toBe('0');
  });

  it('marks the intent failed on payment.failed but never a paid one', async () => {
    await handleVeloDelivery(deps, {
      id: 'dlv_f',
      rawBody: '{}',
      event: { id: 'evt_f', type: 'payment.failed', paymentIntent: { id: INTENT_ID } },
    });
    expect(intentRow()?.status).toBe('failed');

    db.prepare(`UPDATE velo_intents SET status = 'paid'`).run();
    await handleVeloDelivery(deps, {
      id: 'dlv_f2',
      rawBody: '{}',
      event: { id: 'evt_f2', type: 'payment.failed', paymentIntent: { id: INTENT_ID } },
    });
    expect(intentRow()?.status).toBe('paid');
  });

  it('stores payment.created and contract.event without touching money', async () => {
    await handleVeloDelivery(deps, { id: 'dlv_c', rawBody: '{}', event: { id: 'e1', type: 'payment.created', paymentIntent: { id: INTENT_ID } } });
    await handleVeloDelivery(deps, { id: 'dlv_e', rawBody: '{}', event: { id: 'e2', type: 'contract.event' } });

    expect(db.prepare('SELECT COUNT(*) AS n FROM webhook_deliveries').get<{ n: number }>()?.n).toBe(2);
    expect(fake.retrieve).not.toHaveBeenCalled();
    expect(verified()).toBe('0');
  });
});
