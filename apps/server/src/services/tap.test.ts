// Tap service (docs/test-plan.md §2.2 `apps/server/src/services/tap.test.ts`): mocked RPC, no network, no money.
import { Keypair } from '@stellar/stellar-sdk';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NoirContractError, encryptSecret, type NoirOperation } from '@tapat/agent';
import type { Db } from '../db/index';
import { openDb } from '../db/index';
import type { ChainDeps } from './chain';
import { createSseBus, type SseBus } from './sse';
import { recordTap, type TapDeps } from './tap';
import {
  KEY_ENCRYPTION_SECRET,
  T0,
  XLM_SAC_ID,
  fakeLog,
  fakeNoir,
  makeChainDeps,
  seedBeneficiary,
  seedCard,
  seedProgram,
  seedStation,
  unsignedXdr,
  type FakeNoir,
} from './test-fakes';

const D1_UID = '04A21F9C9C7E';

let db: Db;
let fake: FakeNoir;
let chain: ChainDeps;
let bus: SseBus;
let deps: TapDeps;
let cardAgent: Keypair;
let deviceHashValue: string;

interface TapRow {
  id: string;
  card_id: string | null;
  station_id: string;
  amount_stroops: number;
  nonce: number | null;
  status: string;
  reason_code: string | null;
  chain_tx_id: string | null;
}

function taps(): TapRow[] {
  return db.prepare('SELECT * FROM taps ORDER BY rowid').all<TapRow>();
}

function chainStatuses(): string[] {
  return db.prepare('SELECT status FROM chain_txs ORDER BY rowid').all<{ status: string }>().map((row) => row.status);
}

function lastNonce(): number {
  return db.prepare('SELECT last_nonce FROM cards').get<{ last_nonce: number }>()?.last_nonce ?? -1;
}

beforeEach(async () => {
  db = openDb(':memory:');
  seedProgram(db);
  seedBeneficiary(db, { id: 'ben_D1' });
  seedStation(db, { id: 'A', name: 'Petron San Roque' });
  seedStation(db, { id: 'B', name: 'Rotonda Fuels' });
  cardAgent = Keypair.random();
  deviceHashValue = await seedCard(db, {
    id: 'card_D1',
    beneficiaryId: 'ben_D1',
    uid: D1_UID,
    agent: cardAgent,
    secretEnc: encryptSecret(cardAgent.secret(), KEY_ENCRYPTION_SECRET),
  });
  fake = fakeNoir();
  chain = makeChainDeps(db, fake.noir, fakeLog());
  bus = createSseBus();
  deps = { db, chain, bus, config: { KEY_ENCRYPTION_SECRET, XLM_SAC_ID, PHP_PER_XLM: 10 }, now: () => T0 };
});

afterEach(() => {
  db.close();
});

/** The contract refuses `authorize` with `code`, exactly as the SDK reports a failed simulation. */
function refuseAuthorize(code: number, errorName: string): void {
  fake.prepare.mockImplementation(async (source: string, op: NoirOperation) => {
    if (op.kind === 'authorize') throw new NoirContractError('paymentEscrow', code, errorName, 'authorize');
    return unsignedXdr(source);
  });
}

describe('recordTap', () => {
  it('authorizes ₱350 at Station A: tap row, chain tx, balance and receipt sentence', async () => {
    const events: string[] = [];
    bus.subscribe((event) => events.push(event));
    fake.getEscrowBalance.mockResolvedValue(1_150_000_000n);

    const response = await recordTap(deps, { stationId: 'A', amountPhp: 350, uid: D1_UID });

    expect(response.tap.status).toBe('authorized');
    expect(response.tap.reasonCode).toBeNull();
    expect(response.tap.amountStroops).toBe('350000000');
    expect(response.tap.cardId).toBe('card_D1');
    expect(response.tap.simulated).toBe(false);
    expect(response.tap.chainTxId).not.toBeNull();
    expect(response.balanceStroops).toBe('1150000000');
    expect(response.message).toBe('Paid ₱350.00 at Petron San Roque — escrow balance ₱1,150.00.');

    expect(chainStatuses()).toEqual(['succeeded']);
    expect(taps()[0]?.status).toBe('authorized');
    expect(events).toEqual(['chain_tx', 'tap']);
    // The authorize signs with the card's own agent and the merchant is the station.
    const op = fake.prepare.mock.calls[0]?.[1] as NoirOperation | undefined;
    expect(op).toMatchObject({
      kind: 'authorize',
      deviceHash: deviceHashValue,
      amount: 350_000_000n,
      nonce: BigInt(T0),
    });
  });

  it('declines ₱800 as OVER_CAP with no chain tx and the cap sentence', async () => {
    refuseAuthorize(3, 'AgentNotAuthorized');
    fake.checkPayment.mockResolvedValue({ ok: false, reason: 'over_limit' });

    const response = await recordTap(deps, { stationId: 'A', amountPhp: 800, uid: D1_UID });

    expect(response.tap.status).toBe('rejected');
    expect(response.tap.reasonCode).toBe('OVER_CAP');
    expect(response.tap.chainTxId).toBeNull();
    expect(response.balanceStroops).toBeNull();
    expect(response.message).toBe(
      'Declined: ₱800.00 is over the ₱500.00 per-tap cap — rejected by the Noir contract (simulation of `authorize` returned Error #3); no tx submitted.',
    );
    // runChainTx wrote its audit row before the simulation refused the call; a declined tap leaves no row behind.
    expect(chainStatuses()).toEqual([]);
    expect(taps()[0]).toMatchObject({ status: 'rejected', reason_code: 'OVER_CAP', chain_tx_id: null });
    expect(fake.submit).not.toHaveBeenCalled();
    expect(fake.getEscrowBalance).not.toHaveBeenCalled();
  });

  it('publishes only the tap event for a decline (there is no chain tx to announce)', async () => {
    const events: string[] = [];
    bus.subscribe((event) => events.push(event));
    refuseAuthorize(3, 'AgentNotAuthorized');
    fake.checkPayment.mockResolvedValue({ ok: false, reason: 'over_limit' });

    await recordTap(deps, { stationId: 'A', amountPhp: 800, uid: D1_UID });

    expect(events).toEqual(['tap']);
  });

  it('maps an expired policy to EXPIRED', async () => {
    refuseAuthorize(3, 'AgentNotAuthorized');
    fake.checkPayment.mockResolvedValue({ ok: false, reason: 'expired' });

    const response = await recordTap(deps, { stationId: 'B', amountPhp: 200, cardId: 'card_D1', simulated: true });

    expect(response.tap.reasonCode).toBe('EXPIRED');
    expect(response.tap.simulated).toBe(true);
    expect(response.message).toContain('card expired');
    expect(taps()[0]).toMatchObject({ status: 'rejected', reason_code: 'EXPIRED', chain_tx_id: null });
    expect(chainStatuses()).toEqual([]);
  });

  it('maps the policy refusals (no_agent, wrong_agent, wrong_asset, invalid_amount) to POLICY_DENIED', async () => {
    for (const reason of ['no_agent', 'wrong_agent', 'wrong_asset', 'invalid_amount'] as const) {
      refuseAuthorize(3, 'AgentNotAuthorized');
      fake.checkPayment.mockResolvedValue({ ok: false, reason });
      const response = await recordTap(deps, { stationId: 'A', amountPhp: 100, uid: D1_UID });
      expect(response.tap.reasonCode).toBe('POLICY_DENIED');
      expect(response.tap.status).toBe('rejected');
    }
  });

  it('maps contract code 2 to INSUFFICIENT_ESCROW', async () => {
    refuseAuthorize(2, 'InsufficientBalance');

    const response = await recordTap(deps, { stationId: 'A', amountPhp: 100, uid: D1_UID });

    expect(response.tap.status).toBe('rejected');
    expect(response.tap.reasonCode).toBe('INSUFFICIENT_ESCROW');
    expect(response.tap.chainTxId).toBeNull();
    expect(response.message).toContain('Error #2');
    expect(fake.checkPayment).not.toHaveBeenCalled();
    expect(chainStatuses()).toEqual([]);
  });

  it('answers 502 CHAIN_ERROR for any other contract code, with the tx audited and no reason code', async () => {
    refuseAuthorize(6, 'DuplicateAuth');

    await expect(recordTap(deps, { stationId: 'A', amountPhp: 100, uid: D1_UID })).rejects.toMatchObject({
      statusCode: 502,
      code: 'CHAIN_ERROR',
      message: 'CONTRACT_DuplicateAuth',
    });

    const row = taps()[0];
    expect(row).toMatchObject({ status: 'failed', reason_code: null });
    expect(row?.chain_tx_id).not.toBeNull();
    const tx = db
      .prepare('SELECT status, error_code FROM chain_txs WHERE id = ?')
      .get<{ status: string; error_code: string | null }>(row?.chain_tx_id ?? '');
    expect(tx).toEqual({ status: 'failed', error_code: 'CONTRACT_DuplicateAuth' });
  });

  it('refuses at a frozen station before signing: 423 STATION_FROZEN and no chain tx', async () => {
    db.prepare(`UPDATE stations SET status = 'frozen' WHERE id = 'A'`).run();

    await expect(recordTap(deps, { stationId: 'A', amountPhp: 350, uid: D1_UID })).rejects.toMatchObject({
      statusCode: 423,
      code: 'STATION_FROZEN',
    });

    expect(fake.prepare).not.toHaveBeenCalled();
    expect(db.prepare('SELECT COUNT(*) AS n FROM chain_txs').get<{ n: number }>()?.n).toBe(0);
    expect(taps()[0]).toMatchObject({
      status: 'refused',
      reason_code: 'STATION_FROZEN',
      card_id: null,
      nonce: null,
      chain_tx_id: null,
    });
    expect(lastNonce()).toBe(0);
  });

  it('answers 404 CARD_NOT_ENROLLED for an unknown UID and records the refused tap', async () => {
    await expect(recordTap(deps, { stationId: 'A', amountPhp: 350, uid: '04A21F9C0000' })).rejects.toMatchObject({
      statusCode: 404,
      code: 'CARD_NOT_ENROLLED',
    });
    expect(taps()[0]).toMatchObject({ status: 'refused', reason_code: 'CARD_NOT_ENROLLED', card_id: null });
    expect(db.prepare('SELECT COUNT(*) AS n FROM chain_txs').get<{ n: number }>()?.n).toBe(0);
  });

  it('answers 404 NOT_FOUND for an unknown station', async () => {
    db.prepare(`DELETE FROM stations WHERE id = 'B'`).run();
    await expect(
      recordTap(deps, { stationId: 'B', amountPhp: 350, cardId: 'card_D1', simulated: true }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
    expect(taps()).toHaveLength(0);
  });

  it('persists a strictly increasing nonce before signing, also across a decline', async () => {
    refuseAuthorize(3, 'AgentNotAuthorized');
    fake.checkPayment.mockResolvedValue({ ok: false, reason: 'over_limit' });
    await recordTap(deps, { stationId: 'A', amountPhp: 800, uid: D1_UID });
    expect(lastNonce()).toBe(T0);
    expect(taps()[0]?.nonce).toBe(T0);

    fake.prepare.mockImplementation(async (source: string, op: NoirOperation) => {
      expect(op.kind).toBe('authorize');
      return unsignedXdr(source);
    });
    await recordTap(deps, { stationId: 'A', amountPhp: 350, uid: D1_UID });
    const nonces = taps().map((tap) => tap.nonce);
    expect(nonces[1]).toBeGreaterThan(nonces[0] ?? 0);
    expect(lastNonce()).toBe(nonces[1]);
  });

  it('resolves a simulated tap by cardId, and refuses a card that is no longer active', async () => {
    const response = await recordTap(deps, { stationId: 'B', amountPhp: 480, cardId: 'card_D1', simulated: true });
    expect(response.tap.cardId).toBe('card_D1');
    expect(response.tap.simulated).toBe(true);

    db.prepare(`UPDATE cards SET status = 'swept'`).run();
    await expect(
      recordTap(deps, { stationId: 'B', amountPhp: 480, cardId: 'card_D1', simulated: true }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'CARD_NOT_ENROLLED' });
  });
});
