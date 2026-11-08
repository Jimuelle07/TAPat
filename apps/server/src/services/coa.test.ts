// COA export (build-schedule CSV, api-and-data.md §5.2 #19): the documented header, one row per money event.
import { Keypair } from '@stellar/stellar-sdk';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../db/index';
import { openDb } from '../db/index';
import { COA_COLUMNS, COA_HEADER, buildCoaCsv, coaRows, escapeCsvField, formatCoaTimestamp } from './coa';
import { T0, seedBeneficiary, seedCard, seedProgram, seedStation } from './test-fakes';

const HEADER = 'timestamp,event,card_hash_prefix,station,amount_php,amount_xlm,tx_hash,agent_decision_id';
const CONTRACT_ID = 'CC7EAW5FNJEDBS7THM5IT6XIOHO4AOYMLXT3KSZ3HWUIKEACTW7E5BFS';

let db: Db;
let stationA: Keypair;
let deviceHashValue: string;

interface ChainTxSeed {
  id: string;
  kind: string;
  sourcePublic: string;
  status?: 'succeeded' | 'failed';
  innerHash?: string | null;
  outerHash?: string | null;
  at?: number;
}

function insertChainTx(seed: ChainTxSeed): void {
  db.prepare(
    `INSERT INTO chain_txs
       (id, kind, contract_id, method, source_public, status, gas_mode, velo_request_id,
        inner_hash, outer_hash, error_code, error, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'direct', NULL, ?, ?, NULL, NULL, ?, ?)`,
  ).run(
    seed.id,
    seed.kind,
    CONTRACT_ID,
    seed.kind,
    seed.sourcePublic,
    seed.status ?? 'succeeded',
    seed.innerHash ?? `${seed.id}_inner`,
    seed.outerHash ?? null,
    seed.at ?? T0,
    seed.at ?? T0,
  );
}

interface TapSeed {
  id: string;
  cardId: string | null;
  stationId: string;
  amountStroops: number;
  status: 'authorized' | 'rejected' | 'refused' | 'failed';
  reasonCode?: string | null;
  chainTxId?: string | null;
  simulated?: boolean;
  at: number;
}

function insertTap(seed: TapSeed): void {
  db.prepare(
    `INSERT INTO taps (id, card_id, card_ref, station_id, amount_stroops, nonce, status, reason_code, chain_tx_id,
                       simulated, midas_score, tick, created_at)
     VALUES (?, ?, NULL, ?, ?, NULL, ?, ?, ?, ?, NULL, NULL, ?)`,
  ).run(
    seed.id,
    seed.cardId,
    seed.stationId,
    seed.amountStroops,
    seed.status,
    seed.reasonCode ?? null,
    seed.chainTxId ?? null,
    seed.simulated === true ? 1 : 0,
    seed.at,
  );
}

interface DecisionSeed {
  id: string;
  agent: 'intake' | 'tranche' | 'freeze' | 'settlement' | 'sweep';
  decision: string;
  outputs?: Record<string, unknown>;
  txIds?: string[];
  at: number;
}

function insertDecision(seed: DecisionSeed): void {
  db.prepare(
    `INSERT INTO agent_decisions (id, agent, decision, inputs_json, outputs_json, tx_ids_json, created_at)
     VALUES (?, ?, ?, '{}', ?, ?, ?)`,
  ).run(seed.id, seed.agent, seed.decision, JSON.stringify(seed.outputs ?? {}), JSON.stringify(seed.txIds ?? []), seed.at);
}

function insertPaidIntent(id: string, amount: string, txHash: string, at: number): void {
  db.prepare(
    `INSERT INTO velo_intents (id, purpose, amount, asset, status, checkout_url, tx_hash, payer_address, created_at, paid_at)
     VALUES (?, 'budget', ?, 'XLM', 'paid', NULL, ?, NULL, ?, ?)`,
  ).run(id, amount, txHash, at, at);
}

/** The scripted demo's money events: funding, a paid and a declined tap, both settlements, the sweep, the budget. */
function seedScriptedRun(): void {
  insertChainTx({ id: 'ctx_fund', kind: 'fund', sourcePublic: 'GPROGRAMWALLET', at: T0 + 1_000, outerHash: 'fund_outer' });
  insertChainTx({ id: 'ctx_tap', kind: 'authorize', sourcePublic: 'GSTATIONA', at: T0 + 2_000 });
  insertChainTx({
    id: 'ctx_claim',
    kind: 'claim',
    sourcePublic: stationA.publicKey(),
    at: T0 + 4_000,
    innerHash: 'claim_inner',
  });
  insertChainTx({
    id: 'ctx_sweep',
    kind: 'sweep',
    sourcePublic: stationA.publicKey(),
    at: T0 + 6_000,
    outerHash: 'sweep_outer',
  });

  insertTap({
    id: 'tap_paid',
    cardId: 'card_D1',
    stationId: 'A',
    amountStroops: 350_000_000,
    status: 'authorized',
    chainTxId: 'ctx_tap',
    at: T0 + 2_000,
  });
  insertTap({
    id: 'tap_declined',
    cardId: 'card_D1',
    stationId: 'A',
    amountStroops: 800_000_000,
    status: 'rejected',
    reasonCode: 'OVER_CAP',
    at: T0 + 3_000,
  });

  insertDecision({
    id: 'dec_tranche',
    agent: 'tranche',
    decision: 'FUNDED',
    outputs: {
      budgetAfterStroops: '4500000000',
      funded: [
        {
          cardId: 'card_D1',
          deviceHashPrefix: deviceHashValue.slice(0, 8),
          amountStroops: '1500000000',
          chainTxId: 'ctx_fund',
        },
      ],
      skipped: [],
    },
    txIds: ['ctx_fund'],
    at: T0 + 1_000,
  });
  insertDecision({
    id: 'dec_claim',
    agent: 'settlement',
    decision: 'CLAIMED',
    outputs: { stationId: 'A' },
    txIds: ['ctx_claim'],
    at: T0 + 4_000,
  });
  insertDecision({
    id: 'dec_held',
    agent: 'settlement',
    decision: 'HELD',
    outputs: { stationId: 'B', amountStroops: '960000000' },
    at: T0 + 5_000,
  });
  insertDecision({
    id: 'dec_sweep',
    agent: 'sweep',
    decision: 'SWEPT',
    outputs: { cardId: 'card_D1' },
    txIds: ['ctx_sweep'],
    at: T0 + 6_000,
  });
  insertPaidIntent('pi_test_1', '1000.00', 'velo_pay_hash', T0 + 7_000);
}

beforeEach(async () => {
  db = openDb(':memory:');
  seedProgram(db);
  seedBeneficiary(db, { id: 'ben_D1' });
  stationA = seedStation(db, { id: 'A', name: 'Petron San Roque' });
  seedStation(db, { id: 'B', name: 'Rotonda Fuels' });
  deviceHashValue = await seedCard(db, {
    id: 'card_D1',
    beneficiaryId: 'ben_D1',
    uid: '04A21F9C9C7E',
    agent: Keypair.random(),
    secretEnc: 'v1:unused',
  });
  db.prepare('UPDATE cards SET returned_stroops = ? WHERE id = ?').run(1_150_000_000, 'card_D1');
});

afterEach(() => {
  db.close();
});

describe('COA header', () => {
  it('is the documented columns, in the documented order', () => {
    expect(HEADER).toBe(COA_HEADER);
    expect(COA_COLUMNS).toEqual([
      'timestamp',
      'event',
      'card_hash_prefix',
      'station',
      'amount_php',
      'amount_xlm',
      'tx_hash',
      'agent_decision_id',
    ]);
  });

  it('writes the header and nothing else when there is no money event', () => {
    expect(buildCoaCsv(db, { phpPerXlm: 10 })).toBe(`${HEADER}\n`);
    expect(coaRows(db)).toEqual([]);
  });
});

describe('buildCoaCsv', () => {
  it('writes one row per money event, oldest first, with a tx hash on every on-chain row', () => {
    seedScriptedRun();
    const prefix = deviceHashValue.slice(0, 8);
    const lines = buildCoaCsv(db, { phpPerXlm: 10 }).trimEnd().split('\n');

    expect(lines).toEqual([
      HEADER,
      `${formatCoaTimestamp(T0 + 1_000)},fund,${prefix},,1500.00,150.00,fund_outer,dec_tranche`,
      `${formatCoaTimestamp(T0 + 2_000)},tap_authorized,${prefix},A,350.00,35.00,ctx_tap_inner,`,
      `${formatCoaTimestamp(T0 + 3_000)},tap_rejected,${prefix},A,800.00,80.00,,`,
      `${formatCoaTimestamp(T0 + 4_000)},settlement_claimed,,A,350.00,35.00,claim_inner,dec_claim`,
      `${formatCoaTimestamp(T0 + 5_000)},settlement_held,,B,960.00,96.00,,dec_held`,
      `${formatCoaTimestamp(T0 + 6_000)},sweep,${prefix},,1150.00,115.00,sweep_outer,dec_sweep`,
      `${formatCoaTimestamp(T0 + 7_000)},budget_credited,,,10000.00,1000.00,velo_pay_hash,`,
    ]);
  });

  it('stamps Manila time with an explicit +08:00 offset', () => {
    // 2026-11-05T02:12:04Z == 10:12:04 in Asia/Manila.
    expect(formatCoaTimestamp(Date.UTC(2026, 10, 5, 2, 12, 4))).toBe('2026-11-05T10:12:04+08:00');
  });

  it('exports a real refusal but not a synthetic burst edge', () => {
    insertTap({
      id: 'tap_frozen',
      cardId: 'card_D1',
      stationId: 'B',
      amountStroops: 480_000_000,
      status: 'refused',
      reasonCode: 'STATION_FROZEN',
      at: T0 + 100,
    });
    insertTap({
      id: 'tap_virtual',
      cardId: null,
      stationId: 'B',
      amountStroops: 480_000_000,
      status: 'refused',
      reasonCode: 'SIMULATED_EDGE',
      simulated: true,
      at: T0 + 200,
    });
    insertTap({
      id: 'tap_failed',
      cardId: 'card_D1',
      stationId: 'A',
      amountStroops: 100_000_000,
      status: 'failed',
      at: T0 + 300,
    });

    const rows = coaRows(db);

    expect(rows.map((row) => row.event)).toEqual(['tap_rejected']);
    expect(rows[0]).toMatchObject({ station: 'B', amountStroops: 480_000_000n, txHash: '' });
  });

  it('exports one sweep row when a failed attempt and its successful retry are both recorded', () => {
    insertChainTx({ id: 'ctx_sweep', kind: 'sweep', sourcePublic: stationA.publicKey(), at: T0 + 6_000, outerHash: 'sweep_outer' });
    insertDecision({
      id: 'dec_failed',
      agent: 'sweep',
      decision: 'SWEPT',
      outputs: { cardId: 'card_D1', error: 'CHAIN_ERROR' },
      at: T0 + 5_000,
    });
    insertDecision({
      id: 'dec_retry',
      agent: 'sweep',
      decision: 'SWEPT',
      outputs: { cardId: 'card_D1' },
      txIds: ['ctx_sweep'],
      at: T0 + 6_000,
    });

    const rows = coaRows(db).filter((row) => row.event === 'sweep');

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ amountStroops: 1_150_000_000n, agentDecisionId: 'dec_retry', txHash: 'sweep_outer' });
  });
});

describe('escapeCsvField', () => {
  it('quotes only fields that need it', () => {
    expect(escapeCsvField('tap_authorized')).toBe('tap_authorized');
    expect(escapeCsvField('1,000.00')).toBe('"1,000.00"');
    expect(escapeCsvField('he said "hi"')).toBe('"he said ""hi"""');
    expect(escapeCsvField('two\nlines')).toBe('"two\nlines"');
  });
});
