// POST /api/webhooks/velo (docs/api-and-data.md §5.5): raw-body HMAC, delivery dedupe, always-200 after recording.
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../db/index';
import { openDb } from '../db/index';
import { buildServer } from '../server';
import type { BudgetDeps } from '../services/budget';
import { pollBudgetOnce } from '../services/budget';
import { createSseBus } from '../services/sse';
import { T0, fakeLog, seedProgram } from '../services/test-fakes';
import {
  INTENT_ID,
  PUBLIC_BASE_URL,
  WEBHOOK_SECRET,
  fakeVelo,
  intent,
  paymentEventBody,
  signBody,
  type FakeVelo,
} from '../services/test-velo';
import { registerWebhookRoutes } from './webhooks';

let app: FastifyInstance;
let db: Db;
let fake: FakeVelo;
let deps: BudgetDeps;

beforeEach(async () => {
  db = openDb(':memory:');
  seedProgram(db);
  db.prepare(
    `INSERT INTO velo_intents (id, purpose, amount, asset, status, checkout_url, created_at)
     VALUES (?, 'budget', '1000.00', 'XLM', 'created', 'https://pay/x', ?)`,
  ).run(INTENT_ID, T0);
  fake = fakeVelo();
  deps = {
    db,
    velo: fake.velo,
    bus: createSseBus(),
    config: { PHP_PER_XLM: 10, PUBLIC_BASE_URL, VELO_WEBHOOK_SECRET: WEBHOOK_SECRET },
    log: fakeLog(),
    now: () => T0,
  };
  app = await buildServer();
  registerWebhookRoutes(app, deps);
  // A sibling route proves the raw-Buffer parser stays inside the webhook plugin.
  app.post('/api/echo', async (request) => ({ isBuffer: Buffer.isBuffer(request.body), body: request.body }));
});

afterEach(async () => {
  await app.close();
  db.close();
});

function verified(): string {
  return String(db.prepare('SELECT budget_verified_stroops AS v FROM program').get<{ v: number }>()?.v);
}

function deliveries(): number {
  return db.prepare('SELECT COUNT(*) AS n FROM webhook_deliveries').get<{ n: number }>()?.n ?? 0;
}

function post(body: string, headers: Record<string, string>) {
  return app.inject({
    method: 'POST',
    url: '/api/webhooks/velo',
    headers: { 'content-type': 'application/json', ...headers },
    payload: body,
  });
}

describe('POST /api/webhooks/velo', () => {
  it('credits a paid ₱10,000 intent exactly once; a replayed delivery and a poller pass add nothing', async () => {
    fake.retrieve.mockResolvedValue(intent({ status: 'paid' }));
    const body = paymentEventBody('payment.succeeded');
    const headers = { 'x-velo-delivery': 'dlv_1', 'x-velo-signature': signBody(body) };

    const first = await post(body, headers);
    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({ received: true });
    expect(verified()).toBe('10000000000');

    const replay = await post(body, headers);
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual({ received: true });
    expect(verified()).toBe('10000000000');

    // A fresh delivery id for the same intent (Velo retry with a new id) is also a no-op credit.
    const second = await post(body, { 'x-velo-delivery': 'dlv_2', 'x-velo-signature': signBody(body) });
    expect(second.statusCode).toBe(200);
    expect(verified()).toBe('10000000000');

    expect(await pollBudgetOnce(deps)).toBe(0);
    expect(verified()).toBe('10000000000');
    expect(deliveries()).toBe(2);
  });

  it('answers 400 WEBHOOK_SIGNATURE_INVALID for a bad signature and stores nothing', async () => {
    const body = paymentEventBody('payment.succeeded');
    const response = await post(body, {
      'x-velo-delivery': 'dlv_1',
      'x-velo-signature': signBody(body, 'whsec_the_wrong_secret_value'),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: { code: 'WEBHOOK_SIGNATURE_INVALID', message: 'webhook signature verification failed' },
    });
    expect(deliveries()).toBe(0);
    expect(verified()).toBe('0');
    expect(fake.retrieve).not.toHaveBeenCalled();
  });

  it('verifies the raw bytes: a body edited after signing is refused', async () => {
    const body = paymentEventBody('payment.succeeded');
    const signature = signBody(body);
    const response = await post(body.replace('1000.00', '9999.00'), { 'x-velo-delivery': 'dlv_1', 'x-velo-signature': signature });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('WEBHOOK_SIGNATURE_INVALID');
    expect(verified()).toBe('0');
  });

  it('refuses a missing signature header and a stale timestamp', async () => {
    const body = paymentEventBody('payment.succeeded');
    const missing = await post(body, { 'x-velo-delivery': 'dlv_1' });
    expect(missing.statusCode).toBe(400);
    expect(missing.json().error.code).toBe('WEBHOOK_SIGNATURE_INVALID');

    const stale = await post(body, {
      'x-velo-delivery': 'dlv_2',
      'x-velo-signature': signBody(body, WEBHOOK_SECRET, Math.floor(Date.now() / 1000) - 3600),
    });
    expect(stale.statusCode).toBe(400);
    expect(stale.json().error.code).toBe('WEBHOOK_SIGNATURE_INVALID');
    expect(deliveries()).toBe(0);
  });

  it('answers 400 VALIDATION_ERROR when x-velo-delivery is missing', async () => {
    const body = paymentEventBody('payment.succeeded');
    const response = await post(body, { 'x-velo-signature': signBody(body) });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    expect(deliveries()).toBe(0);
  });

  it('does not credit when Velo reports a different amount or asset', async () => {
    const body = paymentEventBody('payment.succeeded');

    fake.retrieve.mockResolvedValue(intent({ status: 'paid', amount: '500.00' }));
    const amount = await post(body, { 'x-velo-delivery': 'dlv_a', 'x-velo-signature': signBody(body) });
    expect(amount.statusCode).toBe(200);

    fake.retrieve.mockResolvedValue(intent({ status: 'paid', asset: 'USDC' }));
    const asset = await post(body, { 'x-velo-delivery': 'dlv_b', 'x-velo-signature': signBody(body) });
    expect(asset.statusCode).toBe(200);

    expect(verified()).toBe('0');
    expect(db.prepare('SELECT status FROM velo_intents').get<{ status: string }>()?.status).toBe('created');
  });

  it('acknowledges 200 and keeps the delivery when the handler throws', async () => {
    fake.retrieve.mockRejectedValue(new Error('velo timeout'));
    const body = paymentEventBody('payment.succeeded');
    const response = await post(body, { 'x-velo-delivery': 'dlv_1', 'x-velo-signature': signBody(body) });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ received: true });
    expect(deliveries()).toBe(1);
    expect(verified()).toBe('0');

    // The poller then credits it once Velo answers.
    fake.retrieve.mockResolvedValue(intent({ status: 'paid' }));
    expect(await pollBudgetOnce(deps)).toBe(1);
    expect(verified()).toBe('10000000000');
  });

  it('stores payment.created without crediting', async () => {
    const body = paymentEventBody('payment.created');
    const response = await post(body, { 'x-velo-delivery': 'dlv_1', 'x-velo-signature': signBody(body) });

    expect(response.statusCode).toBe(200);
    expect(deliveries()).toBe(1);
    expect(verified()).toBe('0');
  });

  it('keeps normal JSON parsing on every other route', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/echo',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ a: 1 }),
    });
    expect(response.json()).toEqual({ isBuffer: false, body: { a: 1 } });
  });
});
