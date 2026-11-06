// Tranche Agent (build-schedule TR, docs/algorithms.md §6): the real price fixture, fake chain, injected ticker.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Keypair } from '@stellar/stellar-sdk';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Bocpd, bocpdRun, trancheShouldFire, type NoirOperation } from '@tapat/agent';
import type { AgentDecision, PricePoint } from '@tapat/shared';
import type { Db } from '../db/index';
import { openDb } from '../db/index';
import { reconcileOnce, type ChainDeps } from './chain';
import { createSseBus } from './sse';
import { createTrancheService, fundedStroops, type TrancheService } from './tranche';
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
  unsignedXdr,
  type FakeNoir,
} from './test-fakes';

const PRICE_FIXTURE = fileURLToPath(new URL('../../../../fixtures/prices/doe-diesel-sim.json', import.meta.url));
interface PriceFixtureFile {
  points: Array<{ price_php: number }>;
}
const priceFile = JSON.parse(readFileSync(PRICE_FIXTURE, 'utf8')) as PriceFixtureFile;
const FIXTURE_PRICES = priceFile.points.map((point) => point.price_php);

let db: Db;
let fake: FakeNoir;
let chain: ChainDeps;
let wallet: Keypair;
let service: TrancheService;
let published: Array<{ event: string; data: unknown }>;
let cardHashes: Record<string, string>;

const TRANCHE = 1_500_000_000n;

async function seedCards(): Promise<void> {
  const agent = Keypair.random();
  cardHashes = {};
  // Enrollment order D1, D2, D3, D5 (equal created_at, so rowid decides). D3's policy has already expired.
  for (const [id, uid, expiresAtS] of [
    ['D1', 'TAPATVIRTUAL01', 1_796_054_399],
    ['D2', 'TAPATVIRTUAL02', 1_796_054_399],
    ['D3', 'TAPATVIRTUAL03', Math.floor(T0 / 1000) - 10],
    ['D5', 'TAPATVIRTUAL05', 1_796_054_399],
  ] as const) {
    seedBeneficiary(db, { id: `ben_${id}` });
    cardHashes[id] = await seedCard(db, {
      id: `card_${id}`,
      beneficiaryId: `ben_${id}`,
      uid,
      agent,
      secretEnc: 'v1:unused',
      expiresAtS,
    });
  }
}

beforeEach(async () => {
  db = openDb(':memory:');
  seedProgram(db);
  db.prepare('UPDATE program SET budget_verified_stroops = 10000000000').run();
  await seedCards();
  fake = fakeNoir();
  chain = makeChainDeps(db, fake.noir, fakeLog());
  wallet = Keypair.random();
  const bus = createSseBus();
  published = [];
  bus.subscribe((event, data) => published.push({ event, data }));
  service = createTrancheService({
    db,
    chain,
    bus,
    programWallet: wallet,
    config: { XLM_SAC_ID, PRICE_TICK_MS: 700 },
    now: () => T0,
    id: () => 'dec_test',
    // The test drives `tick()` itself, so no timer is ever armed.
    schedule: () => () => undefined,
  });
});

afterEach(() => {
  service.stop();
  db.close();
});

/** Ticks until the run ends (it stops itself on fire or at the end of the series). */
async function runToEnd(): Promise<void> {
  for (let i = 0; i < FIXTURE_PRICES.length + 2; i += 1) await service.tick();
}

interface ProgramCounters {
  fired: number;
  funded: number;
  verified: number;
}

function program(): ProgramCounters | undefined {
  return db
    .prepare(
      'SELECT tranche_fired AS fired, budget_funded_stroops AS funded, budget_verified_stroops AS verified FROM program',
    )
    .get<ProgramCounters>();
}

interface DecisionRow {
  id: string;
  agent: string;
  decision: string;
  inputs_json: string;
  outputs_json: string;
  tx_ids_json: string;
}

function decisions(): DecisionRow[] {
  return db.prepare('SELECT * FROM agent_decisions').all<DecisionRow>();
}

describe('createTrancheService.start', () => {
  it('returns the 202 body and deletes prior price points', () => {
    db.prepare(`INSERT INTO price_points (program_id, idx, price_php, simulated) VALUES ('prog_test', 1, 50, 1)`).run();
    expect(service.start()).toEqual({ started: true, points: 45, tickMs: 700 });
    expect(db.prepare('SELECT COUNT(*) AS n FROM price_points').get<{ n: number }>()?.n).toBe(0);
    expect(service.state().running).toBe(true);
  });

  it('409s a second start while running', () => {
    service.start();
    expect(() => service.start()).toThrowError(expect.objectContaining({ statusCode: 409, code: 'INVALID_STATE', message: 'tranche already running' }));
  });

  it('409s with no verified budget and never starts a ticker', () => {
    db.prepare('UPDATE program SET budget_verified_stroops = 0').run();
    expect(() => service.start()).toThrowError(expect.objectContaining({ statusCode: 409, code: 'INVALID_STATE' }));
    expect(service.state().running).toBe(false);
  });

  it('404s without a program and 409s an ended one', () => {
    db.prepare(`UPDATE program SET status = 'ended'`).run();
    expect(() => service.start()).toThrowError(expect.objectContaining({ statusCode: 409 }));
    db.prepare('DELETE FROM cards').run();
    db.prepare('DELETE FROM beneficiaries').run();
    db.prepare('DELETE FROM program').run();
    expect(() => service.start()).toThrowError(expect.objectContaining({ statusCode: 404, code: 'NOT_FOUND' }));
  });
});

describe('the price replay and the fire', () => {
  it('fires once inside the algorithms.md window, never at the day-15 spike, and funds D1, D2 and D5', async () => {
    service.start();
    await runToEnd();

    const expected = trancheShouldFire(bocpdRun(FIXTURE_PRICES), 65);
    expect(expected.fire).toBe(true);
    const firedIdx = (expected.at as number) + 1; // 1-based fixture idx
    expect(expected.at).toBeGreaterThanOrEqual(33);
    expect(expected.at).toBeLessThanOrEqual(36);
    expect(expected.at).not.toBe(14);

    // The stream stopped at the fire point: points 1..firedIdx exist, nothing after.
    const prices = published.filter((entry) => entry.event === 'price').map((entry) => entry.data as PricePoint);
    expect(prices).toHaveLength(firedIdx);
    expect(prices.every((point) => point.simulated)).toBe(true);
    expect(prices.at(-1)?.idx).toBe(firedIdx);
    expect(db.prepare('SELECT COUNT(*) AS n, MIN(simulated) AS s FROM price_points').get()).toEqual({ n: firedIdx, s: 1 });

    // Three fund_escrow transactions, signed by the Program Wallet, 1,500 XLM-equivalent each.
    const ops = fake.prepare.mock.calls.map(([source, op]) => [source, op] as [string, NoirOperation]);
    expect(ops).toHaveLength(3);
    expect(ops.map(([source]) => source)).toEqual([wallet.publicKey(), wallet.publicKey(), wallet.publicKey()]);
    expect(ops.map(([, op]) => op)).toEqual(
      ['D1', 'D2', 'D5'].map((tag) => ({ kind: 'fundEscrow', deviceHash: cardHashes[tag], token: XLM_SAC_ID, amount: TRANCHE })),
    );
    const txs = db.prepare(`SELECT id, kind, method, status, source_public FROM chain_txs ORDER BY rowid`).all<{
      id: string;
      kind: string;
      method: string;
      status: string;
      source_public: string;
    }>();
    expect(txs.map((tx) => [tx.kind, tx.method, tx.status, tx.source_public])).toEqual(
      Array(3).fill(['fund', 'fund_escrow', 'succeeded', wallet.publicKey()]),
    );

    // One decision row, with the documented inputs and outputs.
    const rows = decisions();
    expect(rows).toHaveLength(1);
    const decision = rows[0];
    expect(decision).toMatchObject({ id: 'dec_test', agent: 'tranche', decision: 'FUNDED' });
    const point = new Bocpd(undefined, FIXTURE_PRICES.slice(0, 10));
    const scored = FIXTURE_PRICES.slice(0, firedIdx).map((price) => point.push(price)).at(-1);
    const inputs = JSON.parse(decision?.inputs_json ?? '{}') as Record<string, unknown>;
    expect(inputs).toEqual({
      pricePhp: FIXTURE_PRICES[firedIdx - 1],
      segmentMeanPhp: scored?.segmentMean,
      thresholdPhp: 65,
      cpRecent: scored?.cpRecent,
      mapR: scored?.mapRunLength,
      budgetBeforeStroops: '10000000000',
    });
    expect(inputs.segmentMeanPhp as number).toBeGreaterThanOrEqual(65);
    expect(inputs.cpRecent as number).toBeGreaterThanOrEqual(0.9);
    expect(inputs.mapR as number).toBeGreaterThanOrEqual(3);

    const outputs = JSON.parse(decision?.outputs_json ?? '{}') as {
      budgetAfterStroops: string;
      funded: Array<{ cardId: string; deviceHashPrefix: string; amountStroops: string; chainTxId: string }>;
      skipped: Array<{ cardId: string; reason: string }>;
    };
    expect(outputs.budgetAfterStroops).toBe('5500000000');
    expect(outputs.funded).toEqual(
      ['D1', 'D2', 'D5'].map((tag, i) => ({
        cardId: `card_${tag}`,
        deviceHashPrefix: (cardHashes[tag] as string).slice(0, 8),
        amountStroops: '1500000000',
        chainTxId: txs[i]?.id,
      })),
    );
    expect(outputs.skipped).toEqual([{ cardId: 'card_D3', reason: 'EXPIRED' }]);
    expect(JSON.parse(decision?.tx_ids_json ?? '[]')).toEqual(txs.map((tx) => tx.id));

    // Program counters and SSE.
    expect(program()).toEqual({ fired: 1, funded: 4_500_000_000, verified: 10_000_000_000 });
    // The derived total (SDD §6.10) counts each synchronous success exactly once.
    expect(fundedStroops(db)).toBe(4_500_000_000n);
    expect(published.filter((entry) => entry.event === 'tranche')).toHaveLength(1);
    expect(published.filter((entry) => entry.event === 'chain_tx')).toHaveLength(3);
    const tranche = published.find((entry) => entry.event === 'tranche')?.data as AgentDecision;
    expect(tranche).toMatchObject({ id: 'dec_test', agent: 'tranche', decision: 'FUNDED', txIds: txs.map((tx) => tx.id) });

    // State after the run.
    const state = service.state();
    expect(state).toMatchObject({
      running: false,
      fired: true,
      idx: firedIdx,
      total: 45,
      thresholdPhp: 65,
      budgetVerifiedStroops: '10000000000',
      budgetFundedStroops: '4500000000',
      lastPricePhp: FIXTURE_PRICES[firedIdx - 1],
    });
    expect(state.points).toHaveLength(firedIdx);
    expect(state.funds).toEqual([
      { cardId: 'card_D1', beneficiaryId: 'ben_D1', amountStroops: '1500000000', txId: txs[0]?.id, status: 'succeeded', reason: null },
      { cardId: 'card_D2', beneficiaryId: 'ben_D2', amountStroops: '1500000000', txId: txs[1]?.id, status: 'succeeded', reason: null },
      { cardId: 'card_D3', beneficiaryId: 'ben_D3', amountStroops: '0', txId: null, status: 'skipped', reason: 'EXPIRED' },
      { cardId: 'card_D5', beneficiaryId: 'ben_D5', amountStroops: '1500000000', txId: txs[2]?.id, status: 'succeeded', reason: null },
    ]);
  });

  it('does not fire a second time: start answers 409 "tranche already fired" and ticks do nothing', async () => {
    service.start();
    await runToEnd();
    const before = fake.prepare.mock.calls.length;

    expect(() => service.start()).toThrowError(
      expect.objectContaining({ statusCode: 409, code: 'INVALID_STATE', message: 'tranche already fired; run reset-demo.ts to replay' }),
    );
    await service.tick();
    expect(fake.prepare.mock.calls.length).toBe(before);
    expect(decisions()).toHaveLength(1);
  });

  it('streams one point per tick with cp_recent and map_r on the row', async () => {
    service.start();
    await service.tick();
    await service.tick();

    expect(service.state()).toMatchObject({ running: true, fired: false, idx: 2, lastPricePhp: FIXTURE_PRICES[1] });
    const rows = db.prepare('SELECT idx, price_php, simulated, cp_recent, map_r FROM price_points ORDER BY idx').all<{
      idx: number;
      price_php: number;
      simulated: number;
      cp_recent: number | null;
      map_r: number | null;
    }>();
    expect(rows.map((row) => [row.idx, row.price_php, row.simulated])).toEqual([
      [1, FIXTURE_PRICES[0], 1],
      [2, FIXTURE_PRICES[1], 1],
    ]);
    expect(rows.every((row) => typeof row.cp_recent === 'number' && typeof row.map_r === 'number')).toBe(true);
    expect(decisions()).toHaveLength(0);
    expect(fake.prepare).not.toHaveBeenCalled();
  });

  it('writes no decision when the threshold is never reached, and can be started again', async () => {
    db.prepare('UPDATE program SET price_threshold_php = 500').run();
    service.start();
    await runToEnd();

    expect(decisions()).toHaveLength(0);
    expect(program()?.fired).toBe(0);
    expect(service.state()).toMatchObject({ running: false, fired: false, idx: 45 });
    expect(service.start()).toMatchObject({ started: true });
  });
});

describe('funding rules', () => {
  it('funds the remaining budget to the last card and logs BUDGET_EXHAUSTED when less than a tranche is left', async () => {
    db.prepare('UPDATE program SET budget_verified_stroops = 4000000000').run();
    service.start();
    await runToEnd();

    const amounts = fake.prepare.mock.calls.map(([, op]) => (op.kind === 'fundEscrow' ? op.amount : 0n));
    expect(amounts).toEqual([TRANCHE, TRANCHE, 1_000_000_000n]);
    const decision = decisions()[0];
    expect(decision?.decision).toBe('BUDGET_EXHAUSTED');
    const outputs = JSON.parse(decision?.outputs_json ?? '{}') as { budgetAfterStroops: string; skipped: unknown[] };
    expect(outputs.budgetAfterStroops).toBe('0');
    expect(outputs.skipped).toEqual([{ cardId: 'card_D3', reason: 'EXPIRED' }]);
    expect(program()?.funded).toBe(4_000_000_000);
  });

  it('skips every later card as BUDGET_EXHAUSTED once nothing is left', async () => {
    db.prepare('UPDATE program SET budget_verified_stroops = 1500000000').run();
    service.start();
    await runToEnd();

    expect(fake.prepare).toHaveBeenCalledTimes(1);
    const decision = decisions()[0];
    expect(decision?.decision).toBe('BUDGET_EXHAUSTED');
    expect(JSON.parse(decision?.outputs_json ?? '{}')).toMatchObject({
      skipped: [
        { cardId: 'card_D2', reason: 'BUDGET_EXHAUSTED' },
        { cardId: 'card_D3', reason: 'EXPIRED' },
        { cardId: 'card_D5', reason: 'BUDGET_EXHAUSTED' },
      ],
    });
    expect(service.state().funds.map((fund) => [fund.cardId, fund.status, fund.reason])).toEqual([
      ['card_D1', 'succeeded', null],
      ['card_D2', 'skipped', 'BUDGET_EXHAUSTED'],
      ['card_D3', 'skipped', 'EXPIRED'],
      ['card_D5', 'skipped', 'BUDGET_EXHAUSTED'],
    ]);
  });

  it('continues past a failed fund_escrow and keeps its chain tx id; the failed card is not counted as funded', async () => {
    let call = 0;
    fake.prepare.mockImplementation(async (source: string) => {
      call += 1;
      if (call === 2) throw new Error('simulation failed');
      return unsignedXdr(source);
    });
    service.start();
    await runToEnd();

    expect(call).toBe(3);
    const failed = db.prepare(`SELECT id, status, error_code FROM chain_txs WHERE status = 'failed'`).all<{ id: string; status: string; error_code: string }>();
    expect(failed).toHaveLength(1);
    const outputs = JSON.parse(decisions()[0]?.outputs_json ?? '{}') as { funded: Array<{ cardId: string; chainTxId: string }>; budgetAfterStroops: string };
    expect(outputs.funded.map((entry) => entry.cardId)).toEqual(['card_D1', 'card_D2', 'card_D5']);
    expect(outputs.funded[1]?.chainTxId).toBe(failed[0]?.id);
    expect(outputs.budgetAfterStroops).toBe('7000000000');
    expect(program()?.funded).toBe(3_000_000_000);
    expect(service.state().funds.find((fund) => fund.cardId === 'card_D2')).toMatchObject({ status: 'failed', txId: failed[0]?.id });
  });

  it('keeps a submission_unknown fund against the budget, never resubmits it, and counts it once the reconciler settles it', async () => {
    db.prepare('UPDATE program SET budget_verified_stroops = 4000000000').run();
    let submit = 0;
    fake.submit.mockImplementation(async () => {
      submit += 1;
      // Not a terminal network failure: the row freezes as `submission_unknown` and only the chain decides.
      if (submit === 2) throw new Error('socket hang up');
      return 'direct_inner_hash';
    });
    service.start();
    await runToEnd();

    // D2's unknown fund still consumed its tranche: D5 takes only the 1,000,000,000 stroops left, never a full one.
    const amounts = fake.prepare.mock.calls.map(([, op]) => (op.kind === 'fundEscrow' ? op.amount : 0n));
    expect(amounts).toEqual([TRANCHE, TRANCHE, 1_000_000_000n]);
    expect(decisions()[0]?.decision).toBe('BUDGET_EXHAUSTED');
    expect(JSON.parse(decisions()[0]?.outputs_json ?? '{}')).toMatchObject({ budgetAfterStroops: '0' });
    expect(fake.submit).toHaveBeenCalledTimes(3);

    const unknown = db
      .prepare(`SELECT id, error_code FROM chain_txs WHERE status = 'submission_unknown'`)
      .all<{ id: string; error_code: string }>();
    expect(unknown).toHaveLength(1);
    expect(unknown[0]?.error_code).toBe('DIRECT_UNKNOWN');
    // Only the two synchronous successes are on the program row; the derived total (SDD §6.10) matches them.
    expect(program()?.funded).toBe(2_500_000_000);
    expect(fundedStroops(db)).toBe(2_500_000_000n);
    expect(service.state().budgetFundedStroops).toBe('2500000000');

    // The reconciler settles the uncertain row from the chain; the derived total then counts it exactly once.
    const server = fake.noir.server as unknown as { getTransaction: (hash: string) => Promise<{ status: string }> };
    server.getTransaction = async () => ({ status: 'SUCCESS' });
    await expect(reconcileOnce({ db, noir: fake.noir, gas: null, log: fakeLog(), now: () => T0 })).resolves.toBe(1);
    expect(fundedStroops(db)).toBe(4_000_000_000n);
    expect(service.state().budgetFundedStroops).toBe('4000000000');
    expect(service.state().funds.find((fund) => fund.cardId === 'card_D2')).toMatchObject({ status: 'succeeded' });
    await expect(reconcileOnce({ db, noir: fake.noir, gas: null, log: fakeLog(), now: () => T0 })).resolves.toBe(0);
    expect(fundedStroops(db)).toBe(4_000_000_000n);
  });

  it('still marks the program fired when funding throws unexpectedly, so a restart cannot fund twice', async () => {
    fake.prepare.mockRejectedValue(new Error('rpc down'));
    service.start();
    await runToEnd();

    expect(program()?.fired).toBe(1);
    expect(program()?.funded).toBe(0);
    expect(() => service.start()).toThrowError(expect.objectContaining({ statusCode: 409 }));
  });
});
