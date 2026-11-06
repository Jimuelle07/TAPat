// GET /api/dashboard (api-and-data.md §5.2 #18, SDD §6.10): the demo's closing snapshot, seeded row by row so the
// invariant is checked against known numbers, plus the 5 s escrow cache and the privacy of the card list.
import { Keypair } from '@stellar/stellar-sdk';
import { afterEach, describe, expect, it } from 'vitest';
import type { Db } from '../db/index';
import { openDb } from '../db/index';
import { insertDecision } from './decisions';
import { reconcileOnce } from './chain';
import { ESCROW_CACHE_MS, MIDAS_THRESHOLD_FALLBACK, createDashboardService, loadMidasThreshold } from './dashboard';
import { seedBeneficiary, seedCard, seedProgram, seedStation, fakeLog, fakeNoir, XLM_SAC_ID, T0 } from './test-fakes';

const NOW = 1_793_810_000_000; // the demo's closing clock, seconds 1793810000
const CLAIM_AT = 1_793_809_000_000;
const A_TAP_AT = 1_793_808_200_000;
const B_TAP_AT = 1_793_808_450_000;

interface TapSeed {
  id: string;
  cardId: string | null;
  cardRef?: string | null;
  stationId: string;
  amountStroops: number;
  status: 'authorized' | 'rejected' | 'refused' | 'failed';
  reasonCode?: string | null;
  createdAt: number;
  simulated?: boolean;
}

function insertTap(db: Db, tap: TapSeed): void {
  db.prepare(
    `INSERT INTO taps (id, card_id, card_ref, station_id, amount_stroops, nonce, status, reason_code, chain_tx_id,
                       simulated, midas_score, tick, created_at)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?, NULL, ?, NULL, NULL, ?)`,
  ).run(
    tap.id,
    tap.cardId,
    tap.cardRef ?? null,
    tap.stationId,
    tap.amountStroops,
    tap.status,
    tap.reasonCode ?? null,
    tap.simulated === true ? 1 : 0,
    tap.createdAt,
  );
}

async function seedDemoEndState(db: Db): Promise<{ hashes: string[] }> {
  seedProgram(db);
  db.prepare(
    `UPDATE program SET status = 'ended', budget_verified_stroops = ?, budget_funded_stroops = ?`,
  ).run(10_000_000_000, 4_500_000_000);

  const cards = [
    { id: 'D1', first: 'Juan', last: 'Dela Cruz', status: 'enrolled', returned: 1_150_000_000 },
    { id: 'D2', first: 'Pedro', last: 'Reyes', status: 'enrolled', returned: 540_000_000 },
    { id: 'D3', first: 'Ramon', last: 'Bautista', status: 'enrolled', returned: 0 },
    { id: 'D4', first: 'Ana', last: 'Villanueva', status: 'enrolled', returned: 0 },
    { id: 'D5', first: 'Lito', last: 'Garcia', status: 'enrolled', returned: 1_500_000_000 },
  ] as const;
  for (const card of cards) {
    seedBeneficiary(db, { id: `ben_${card.id}`, firstName: card.first, lastName: card.last, status: card.status });
  }
  // The four buckets are disjoint: 3 approved + 2 uncertain + 5 enrolled + 2 rejected = 12.
  for (const id of ['ben_A1', 'ben_A2', 'ben_A3']) seedBeneficiary(db, { id, status: 'approved' });
  for (const id of ['ben_U1', 'ben_U2']) seedBeneficiary(db, { id, status: 'uncertain' });
  for (const id of ['ben_R1', 'ben_R2']) seedBeneficiary(db, { id, status: 'rejected' });

  const hashes: string[] = [];
  for (const card of cards) {
    hashes.push(
      await seedCard(db, {
        id: `card_${card.id}`,
        beneficiaryId: `ben_${card.id}`,
        uid: `04A1B2C3${card.id}B0`,
        agent: Keypair.random(),
        secretEnc: 'v1:unused',
        status: 'swept',
      }),
    );
    db.prepare('UPDATE cards SET returned_stroops = ?, virtual = ? WHERE id = ?').run(
      card.returned,
      card.id === 'D5' ? 1 : 0,
      `card_${card.id}`,
    );
  }
  // D3's policy expired on stage; everybody else's runs past the program.
  db.prepare('UPDATE cards SET expires_at_s = ? WHERE id = ?').run(1_793_808_600, 'card_D3');

  const stationA = seedStation(db, { id: 'A', name: 'Petron San Roque' });
  seedStation(db, { id: 'B', name: 'Rotonda Fuels', status: 'frozen' });
  db.prepare('UPDATE stations SET frozen_reason = ?, frozen_at = ? WHERE id = ?').run(
    'MIDAS 2.31 >= 1.78 (NEAR_CAP_STREAK)',
    1_793_808_400_000,
    'B',
  );

  // A claimed ₱350 before the close; B's two ₱480 taps are still pending and the station is frozen.
  db.prepare(
    `INSERT INTO chain_txs (id, kind, contract_id, method, source_public, status, gas_mode, created_at, updated_at)
     VALUES ('ctx_claim_a', 'claim', ?, 'claim', ?, 'succeeded', 'direct', ?, ?)`,
  ).run(XLM_SAC_ID, stationA.publicKey(), CLAIM_AT, CLAIM_AT);
  insertTap(db, {
    id: 'tap_a1',
    cardId: 'card_D1',
    stationId: 'A',
    amountStroops: 350_000_000,
    status: 'authorized',
    createdAt: A_TAP_AT,
  });
  for (const [index, cardId] of ['card_D2', 'card_D2'].entries()) {
    insertTap(db, {
      id: `tap_b${index}`,
      cardId,
      stationId: 'B',
      amountStroops: 480_000_000,
      status: 'authorized',
      createdAt: B_TAP_AT + index,
      simulated: true,
    });
  }
  for (const index of [1, 2]) {
    insertTap(db, {
      id: `tap_r${index}`,
      cardId: 'card_D1',
      stationId: 'A',
      amountStroops: 800_000_000,
      status: 'rejected',
      reasonCode: 'OVER_CAP',
      createdAt: A_TAP_AT + index,
    });
  }
  for (let index = 0; index < 30; index += 1) {
    insertTap(db, {
      id: `tap_edge${index}`,
      cardId: null,
      cardRef: `virtual${String(index + 1).padStart(2, '0')}`,
      stationId: 'B',
      amountStroops: 480_000_000,
      status: 'refused',
      reasonCode: 'SIMULATED_EDGE',
      simulated: true,
      createdAt: B_TAP_AT + 1_000 + index,
    });
  }

  db.prepare(
    `INSERT INTO velo_intents (id, purpose, amount, asset, status, checkout_url, tx_hash, payer_address, created_at, paid_at)
     VALUES ('pi_test_7f21', 'budget', '1000.00', 'XLM', 'paid', ?, 'abc', 'GPAYER', ?, ?)`,
  ).run('https://pay.velo-build.dev/cs_test_7f21', CLAIM_AT - 10_000, CLAIM_AT - 5_000);

  // The tranche's three fund txs, plus the per-card amounts its decision recorded: `fundedStroops` (SDD §6.10) joins
  // the two, so a row the reconciler settles late still counts exactly once.
  const fundCards = ['card_D1', 'card_D2', 'card_D5'] as const;
  const fundTxIds = ['ctx_f1', 'ctx_f2', 'ctx_f3'] as const;
  for (const txId of fundTxIds) {
    db.prepare(
      `INSERT INTO chain_txs (id, kind, contract_id, method, source_public, status, gas_mode, created_at, updated_at)
       VALUES (?, 'fund', ?, 'fund_escrow', 'GPROGRAMWALLET', 'succeeded', 'direct', ?, ?)`,
    ).run(txId, XLM_SAC_ID, B_TAP_AT - 2_000, B_TAP_AT - 2_000);
  }

  insertDecision(db, {
    agent: 'tranche',
    decision: 'FUNDED',
    inputs: { pricePhp: 71.2, segmentMeanPhp: 70.9, thresholdPhp: 65, cpRecent: 0.94, mapR: 5 },
    outputs: {
      budgetAfterStroops: '5500000000',
      funded: fundCards.map((cardId, index) => ({
        cardId,
        deviceHashPrefix: (hashes[cards.findIndex((card) => `card_${card.id}` === cardId)] as string).slice(0, 8),
        amountStroops: '1500000000',
        chainTxId: fundTxIds[index],
      })),
    },
    txIds: [...fundTxIds],
    createdAt: B_TAP_AT - 1_000,
  });

  return { hashes };
}

let db: Db | undefined;

afterEach(() => {
  db?.close();
  db = undefined;
});

describe('createDashboardService', () => {
  it('reproduces the demo end state and the invariant', async () => {
    db = openDb(':memory:');
    const { hashes } = await seedDemoEndState(db);
    const fake = fakeNoir();
    const service = createDashboardService({
      db,
      noir: fake.noir,
      config: { PHP_PER_XLM: 10 },
      midasThreshold: 1.78,
      now: () => NOW,
    });

    const dashboard = await service.get();

    expect(dashboard).toMatchObject({
      phpPerXlm: 10,
      midasThreshold: 1.78,
      fundedStroops: '4500000000',
      spentStroops: '350000000',
      heldStroops: '960000000',
      pendingStroops: '0',
      escrowRemainingStroops: '0',
      returnedStroops: '3190000000',
      invariantOk: true,
    });
    expect(dashboard.program.status).toBe('ended');
    expect(dashboard.budget).toEqual({
      state: 'verified',
      verifiedStroops: '10000000000',
      fundedStroops: '4500000000',
      remainingStroops: '5500000000',
      checkoutUrl: 'https://pay.velo-build.dev/cs_test_7f21',
      paymentIntentId: 'pi_test_7f21',
    });
    expect(dashboard.counts).toEqual({
      beneficiaries: 12,
      approved: 3,
      uncertain: 2,
      enrolled: 5,
      cardsActive: 0,
      tapsAuthorized: 3,
      tapsRejected: 2,
      tapsRefused: 30,
    });
    expect(dashboard.cards.map((card) => [card.displayName, card.uidLast4, card.status])).toEqual([
      ['Juan D.', 'D1B0', 'swept'],
      ['Pedro R.', 'D2B0', 'swept'],
      ['Ramon B.', 'D3B0', 'swept'],
      ['Ana V.', 'D4B0', 'swept'],
      ['Lito G.', 'D5B0', 'swept'],
    ]);
    expect(dashboard.cards.find((card) => card.id === 'card_D3')?.expired).toBe(true);
    expect(dashboard.cards.find((card) => card.id === 'card_D1')?.expired).toBe(false);
    expect(dashboard.cards.find((card) => card.id === 'card_D5')?.virtual).toBe(true);
    expect(dashboard.cards[0]?.returnedStroops).toBe('1150000000');

    expect(dashboard.stations).toMatchObject([
      { id: 'A', status: 'active', pendingStroops: '0', spentStroops: '350000000' },
      {
        id: 'B',
        status: 'frozen',
        frozenReason: 'MIDAS 2.31 >= 1.78 (NEAR_CAP_STREAK)',
        pendingStroops: '960000000',
        spentStroops: '0',
      },
    ]);

    // Privacy: no full device hash and no full name anywhere in the payload.
    const payload = JSON.stringify(dashboard);
    for (const hash of hashes) expect(payload).not.toContain(hash);
    for (const name of ['Dela Cruz', 'Bautista', 'Villanueva', 'Garcia', 'Reyes']) {
      expect(payload).not.toContain(name);
    }
    expect(dashboard.cards.every((card) => /^[0-9a-f]{8}$/.test(card.deviceHashPrefix))).toBe(true);

    expect(dashboard.recentTaps).toHaveLength(35);
    expect(dashboard.recentTaps[0]?.createdAt).toBeGreaterThanOrEqual(dashboard.recentTaps[1]?.createdAt ?? 0);
    expect(dashboard.recentDecisions).toHaveLength(1);
    expect(dashboard.recentDecisions[0]).toMatchObject({ agent: 'tranche', decision: 'FUNDED' });
  });

  it('counts a fund tx the reconciler settles late exactly once, so the invariant holds', async () => {
    db = openDb(':memory:');
    seedProgram(db);
    db.prepare(
      `UPDATE program SET status = 'active', tranche_fired = 1, budget_verified_stroops = ?, budget_funded_stroops = ?`,
    ).run(10_000_000_000, 1_500_000_000);
    seedBeneficiary(db, { id: 'ben_D1', status: 'enrolled' });
    seedBeneficiary(db, { id: 'ben_D2', status: 'enrolled' });
    const hashD1 = await seedCard(db, {
      id: 'card_D1',
      beneficiaryId: 'ben_D1',
      uid: '04A1B2C3D1',
      agent: Keypair.random(),
      secretEnc: 'v1:unused',
    });
    const hashD2 = await seedCard(db, {
      id: 'card_D2',
      beneficiaryId: 'ben_D2',
      uid: '04A1B2C3D2',
      agent: Keypair.random(),
      secretEnc: 'v1:unused',
    });

    // D1's fund succeeded synchronously; D2's hand-off was uncertain and only the chain can settle it.
    for (const [txId, status, innerHash] of [
      ['ctx_f1', 'succeeded', 'inner_f1'],
      ['ctx_f2', 'submission_unknown', 'inner_f2'],
    ] as const) {
      db.prepare(
        `INSERT INTO chain_txs (id, kind, contract_id, method, source_public, status, gas_mode, inner_hash,
                                created_at, updated_at)
         VALUES (?, 'fund', ?, 'fund_escrow', 'GPROGRAMWALLET', ?, 'direct', ?, ?, ?)`,
      ).run(txId, XLM_SAC_ID, status, innerHash, NOW - 2_000, NOW - 2_000);
    }
    insertDecision(db, {
      agent: 'tranche',
      decision: 'FUNDED',
      outputs: {
        budgetAfterStroops: '7000000000',
        funded: [
          { cardId: 'card_D1', deviceHashPrefix: hashD1.slice(0, 8), amountStroops: '1500000000', chainTxId: 'ctx_f1' },
          { cardId: 'card_D2', deviceHashPrefix: hashD2.slice(0, 8), amountStroops: '1500000000', chainTxId: 'ctx_f2' },
        ],
      },
      txIds: ['ctx_f1', 'ctx_f2'],
      createdAt: NOW - 2_500,
    });

    const fake = fakeNoir();
    fake.getEscrowBalance.mockImplementation(async () => 1_500_000_000n);
    const service = createDashboardService({
      db,
      noir: fake.noir,
      config: { PHP_PER_XLM: 10 },
      midasThreshold: 1.78,
      now: () => NOW,
    });

    // Before the reconciler settles it, only the synchronous fund counts: 3,000 escrowed vs 1,500 funded.
    const before = await service.get();
    expect(before.fundedStroops).toBe('1500000000');
    expect(before.budget.fundedStroops).toBe('1500000000');
    expect(before.invariantOk).toBe(false);

    const server = fake.noir.server as unknown as { getTransaction: (hash: string) => Promise<{ status: string }> };
    server.getTransaction = async () => ({ status: 'SUCCESS' });
    await expect(reconcileOnce({ db, noir: fake.noir, gas: null, log: fakeLog(), now: () => NOW })).resolves.toBe(1);

    const after = await service.get();
    expect(after.fundedStroops).toBe('3000000000');
    expect(after.budget.fundedStroops).toBe('3000000000');
    expect(after.invariantOk).toBe(true);
    // The dashboard reads the chain rows, not the running column: the column only ever saw the synchronous fund.
    expect(db.prepare('SELECT budget_funded_stroops AS funded FROM program').get<{ funded: number }>()?.funded).toBe(
      1_500_000_000,
    );

    // Exactly once: a second pass finds nothing left to settle and the total does not move.
    await expect(reconcileOnce({ db, noir: fake.noir, gas: null, log: fakeLog(), now: () => NOW })).resolves.toBe(0);
    expect((await service.get()).fundedStroops).toBe('3000000000');
  });

  it('reads the active cards escrow once per 5 s window and shares it with the total', async () => {
    db = openDb(':memory:');
    seedProgram(db);
    db.prepare(`UPDATE program SET status = 'active'`).run();
    seedBeneficiary(db, { id: 'ben_A', status: 'enrolled' });
    const active = await seedCard(db, {
      id: 'card_active',
      beneficiaryId: 'ben_A',
      uid: '04A1B2C3AAAA',
      agent: Keypair.random(),
      secretEnc: 'v1:unused',
    });
    await seedCard(db, {
      id: 'card_swept',
      beneficiaryId: 'ben_A',
      uid: '04A1B2C3BBBB',
      agent: Keypair.random(),
      secretEnc: 'v1:unused',
      status: 'swept',
    });

    const fake = fakeNoir();
    fake.getEscrowBalance.mockImplementation(async (hash: string) => (hash === active ? 1_000_000n : 0n));
    let clock = NOW;
    const service = createDashboardService({
      db,
      noir: fake.noir,
      config: { PHP_PER_XLM: 10 },
      midasThreshold: 1.78,
      now: () => clock,
    });

    const first = await service.get();
    expect(first.escrowRemainingStroops).toBe('1000000');
    expect(first.cards.find((card) => card.id === 'card_active')?.escrowStroops).toBe('1000000');
    // A swept card has nothing in escrow: it is never read.
    expect(first.cards.find((card) => card.id === 'card_swept')?.escrowStroops).toBe('0');
    expect(fake.getEscrowBalance).toHaveBeenCalledTimes(1);
    // funded 0 vs escrow 1: the invariant is a cross-check, not a tautology.
    expect(first.invariantOk).toBe(false);

    clock += ESCROW_CACHE_MS - 1;
    await service.get();
    expect(fake.getEscrowBalance).toHaveBeenCalledTimes(1);

    clock += 1;
    await service.get();
    expect(fake.getEscrowBalance).toHaveBeenCalledTimes(2);

    // A refreshed window reads the chain again and serves the new value, not the cached one.
    clock += ESCROW_CACHE_MS;
    fake.getEscrowBalance.mockImplementation(async () => 2_000_000n);
    const refreshed = await service.get();
    expect(refreshed.escrowRemainingStroops).toBe('2000000');
    expect(fake.getEscrowBalance).toHaveBeenCalledTimes(3);
  });

  it('single-flights concurrent escrow refreshes into one read per active card', async () => {
    db = openDb(':memory:');
    seedProgram(db);
    db.prepare(`UPDATE program SET status = 'active'`).run();
    seedBeneficiary(db, { id: 'ben_A', status: 'enrolled' });
    for (const uid of ['04A1B2C3AAAA', '04A1B2C3CCCC']) {
      await seedCard(db, {
        id: `card_${uid.slice(-4)}`,
        beneficiaryId: 'ben_A',
        uid,
        agent: Keypair.random(),
        secretEnc: 'v1:unused',
      });
    }

    const fake = fakeNoir();
    fake.getEscrowBalance.mockImplementation(async () => {
      // Both loads are already in flight before either chain read settles.
      await Promise.resolve();
      return 1_000_000n;
    });
    const service = createDashboardService({
      db,
      noir: fake.noir,
      config: { PHP_PER_XLM: 10 },
      midasThreshold: 1.78,
      now: () => NOW,
    });

    const [first, second] = await Promise.all([service.get(), service.get()]);
    // Two active cards read once each, not one full round per request.
    expect(fake.getEscrowBalance).toHaveBeenCalledTimes(2);
    expect(first.escrowRemainingStroops).toBe('2000000');
    expect(second.escrowRemainingStroops).toBe('2000000');
  });

  it('times out a slow escrow read and falls back to the cached balance', async () => {
    db = openDb(':memory:');
    seedProgram(db);
    db.prepare(`UPDATE program SET status = 'active'`).run();
    seedBeneficiary(db, { id: 'ben_A', status: 'enrolled' });
    await seedCard(db, {
      id: 'card_active',
      beneficiaryId: 'ben_A',
      uid: '04A1B2C3AAAA',
      agent: Keypair.random(),
      secretEnc: 'v1:unused',
    });

    const fake = fakeNoir();
    fake.getEscrowBalance.mockImplementation(async () => 1_000_000n);
    let clock = NOW;
    const service = createDashboardService({
      db,
      noir: fake.noir,
      config: { PHP_PER_XLM: 10 },
      midasThreshold: 1.78,
      now: () => clock,
      escrowReadTimeoutMs: 10,
    });

    expect((await service.get()).escrowRemainingStroops).toBe('1000000');

    clock += ESCROW_CACHE_MS;
    fake.getEscrowBalance.mockImplementation(() => new Promise<bigint>(() => undefined));
    const started = Date.now();
    const stale = await service.get();
    expect(Date.now() - started).toBeLessThan(1_000);
    expect(stale.escrowRemainingStroops).toBe('1000000');
    expect(stale.cards.find((card) => card.id === 'card_active')?.escrowStroops).toBe('1000000');
  });

  it('propagates a failed read when the card has no cached balance, without poisoning the cache', async () => {
    db = openDb(':memory:');
    seedProgram(db);
    db.prepare(`UPDATE program SET status = 'active'`).run();
    seedBeneficiary(db, { id: 'ben_A', status: 'enrolled' });
    await seedCard(db, {
      id: 'card_active',
      beneficiaryId: 'ben_A',
      uid: '04A1B2C3AAAA',
      agent: Keypair.random(),
      secretEnc: 'v1:unused',
    });

    const fake = fakeNoir();
    fake.getEscrowBalance.mockImplementation(async () => {
      throw new Error('rpc down');
    });
    const service = createDashboardService({
      db,
      noir: fake.noir,
      config: { PHP_PER_XLM: 10 },
      midasThreshold: 1.78,
      now: () => NOW,
    });

    // Never read before: no value to fall back to, so the error surfaces instead of a made-up 0.
    await expect(service.get()).rejects.toThrow('rpc down');

    fake.getEscrowBalance.mockImplementation(async () => 1_000_000n);
    expect((await service.get()).escrowRemainingStroops).toBe('1000000');
    expect(fake.getEscrowBalance).toHaveBeenCalledTimes(2);
  });

  it('lists recent chain txs newest first with both hashes, so the UI can resolve a ctx_ id', async () => {
    db = openDb(':memory:');
    seedProgram(db);
    const insert = db.prepare(
      `INSERT INTO chain_txs (id, kind, contract_id, method, source_public, status, gas_mode, inner_hash, outer_hash,
                              created_at, updated_at)
       VALUES (?, 'authorize', 'C', 'authorize', 'G', 'succeeded', 'velo', ?, ?, ?, ?)`,
    );
    insert.run('ctx_old', 'inner_old', null, T0, T0);
    insert.run('ctx_new', 'inner_new', 'outer_new', T0 + 1, T0 + 1);
    const { noir } = fakeNoir();
    const dashboard = await createDashboardService({ db, noir, config: { PHP_PER_XLM: 10 }, midasThreshold: 2.2 }).get();
    expect(dashboard.recentChainTxs.map((tx) => [tx.id, tx.innerHash, tx.outerHash])).toEqual([
      ['ctx_new', 'inner_new', 'outer_new'],
      ['ctx_old', 'inner_old', null],
    ]);
  });

  it('always lists every fund, claim and sweep tx, even past the recent-N window, without duplicates', async () => {
    db = openDb(':memory:');
    seedProgram(db);
    const insert = db.prepare(
      `INSERT INTO chain_txs (id, kind, contract_id, method, source_public, status, gas_mode, inner_hash, outer_hash,
                              created_at, updated_at)
       VALUES (?, ?, 'C', 'm', 'G', 'succeeded', 'velo', ?, NULL, ?, ?)`,
    );
    insert.run('ctx_fund', 'fund', 'h_fund', T0, T0);
    insert.run('ctx_claim', 'claim', 'h_claim', T0 + 1, T0 + 1);
    insert.run('ctx_sweep', 'sweep', 'h_sweep', T0 + 2, T0 + 2);
    for (let i = 0; i < 250; i += 1) insert.run(`ctx_a${i}`, 'authorize', `h_${i}`, T0 + 10 + i, T0 + 10 + i);
    const { noir } = fakeNoir();
    const dashboard = await createDashboardService({ db, noir, config: { PHP_PER_XLM: 10 }, midasThreshold: 2.2 }).get();
    const ids = dashboard.recentChainTxs.map((tx) => tx.id);
    expect(ids).toHaveLength(203);
    expect(new Set(ids).size).toBe(203);
    expect(ids.slice(-3)).toEqual(['ctx_sweep', 'ctx_claim', 'ctx_fund']);
    expect(ids[0]).toBe('ctx_a249');
  });

  it('answers 404 NOT_FOUND without a program', async () => {
    db = openDb(':memory:');
    const service = createDashboardService({
      db,
      noir: fakeNoir().noir,
      config: { PHP_PER_XLM: 10 },
      midasThreshold: 1.78,
    });
    await expect(service.get()).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });

  it('shows the waiting budget state while the intent is unpaid', async () => {
    db = openDb(':memory:');
    seedProgram(db);
    db.prepare(`UPDATE program SET status = 'active'`).run();
    db.prepare(
      `INSERT INTO velo_intents (id, purpose, amount, asset, status, checkout_url, created_at)
       VALUES ('pi_waiting', 'budget', '1000.00', 'XLM', 'created', 'https://pay.velo-build.dev/cs_waiting', ?)`,
    ).run(T0);

    const service = createDashboardService({
      db,
      noir: fakeNoir().noir,
      config: { PHP_PER_XLM: 10 },
      midasThreshold: 1.78,
    });
    const dashboard = await service.get();
    expect(dashboard.budget).toEqual({
      state: 'waiting',
      verifiedStroops: '0',
      fundedStroops: '0',
      remainingStroops: '0',
      checkoutUrl: 'https://pay.velo-build.dev/cs_waiting',
      paymentIntentId: 'pi_waiting',
    });
    expect(dashboard.budget.state).not.toBe('verified');
  });

  it('reports no budget intent as none and falls back to the calibrated MIDAS threshold', async () => {
    db = openDb(':memory:');
    seedProgram(db);
    const service = createDashboardService({
      db,
      noir: fakeNoir().noir,
      config: { PHP_PER_XLM: 10 },
      midasThreshold: loadMidasThreshold('Z:/no/such/midas.json'),
    });
    const dashboard = await service.get();
    expect(dashboard.budget).toMatchObject({ state: 'none', checkoutUrl: null, paymentIntentId: null });
    // Matches the Freeze Agent's fallback, so the chart line and the agent agree without the generated file.
    expect(dashboard.midasThreshold).toBe(MIDAS_THRESHOLD_FALLBACK);
  });
});
