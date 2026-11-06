// Settlement runner (docs/test-plan.md §2.2 `apps/server/src/services/settlement.test.ts`): the pending/stale split,
// the frozen hold, the claim tx, and the 502 after every station ran. Fake chain — no network, no money.
import { Keypair } from '@stellar/stellar-sdk';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NoirContractError, encryptSecret } from '@tapat/agent';
import type { Db } from '../db/index';
import { openDb } from '../db/index';
import type { ChainDeps } from './chain';
import { runSettlement, type SettlementDeps } from './settlement';
import { createSseBus, type SseBus, type SseEventName } from './sse';
import {
  KEY_ENCRYPTION_SECRET,
  T0,
  XLM_SAC_ID,
  fakeLog,
  fakeNoir,
  makeChainDeps,
  seedProgram,
  seedStation,
  unsignedXdr,
  type FakeNoir,
} from './test-fakes';

interface Published {
  event: SseEventName;
  data: unknown;
}

interface DecisionRow {
  decision: string;
  inputs_json: string;
  outputs_json: string;
  tx_ids_json: string;
}

let db: Db;
let fake: FakeNoir;
let chain: ChainDeps;
let bus: SseBus;
let published: Published[];
let deps: SettlementDeps;
let stationA: Keypair;
let stationB: Keypair;

/**
 * `seedCard`/`seedStation` write a placeholder `secret_enc`; the settlement signs `claim` with the station's own key,
 * so the demo's encryption is what the row must hold.
 */
function encryptStationSecret(id: string, keypair: Keypair): void {
  db.prepare('UPDATE stations SET secret_enc = ? WHERE id = ?').run(
    encryptSecret(keypair.secret(), KEY_ENCRYPTION_SECRET),
    id,
  );
}

function insertTap(id: string, stationId: string, amountStroops: number, status = 'authorized'): void {
  db.prepare(
    `INSERT INTO taps (id, card_id, card_ref, station_id, amount_stroops, nonce, status, reason_code,
                       chain_tx_id, simulated, midas_score, tick, created_at)
     VALUES (?, NULL, NULL, ?, ?, NULL, ?, NULL, NULL, 0, NULL, NULL, ?)`,
  ).run(id, stationId, amountStroops, status, T0);
}

function decisions(): DecisionRow[] {
  return db.prepare('SELECT * FROM agent_decisions ORDER BY rowid').all<DecisionRow>();
}

function claims(): Array<{ status: string; source_public: string }> {
  return db
    .prepare(`SELECT status, source_public FROM chain_txs WHERE kind = 'claim' ORDER BY rowid`)
    .all<{ status: string; source_public: string }>();
}

beforeEach(() => {
  db = openDb(':memory:');
  seedProgram(db);
  stationA = seedStation(db, { id: 'A', name: 'Petron San Roque' });
  stationB = seedStation(db, { id: 'B', name: 'Rotonda Fuels', status: 'frozen' });
  encryptStationSecret('A', stationA);
  encryptStationSecret('B', stationB);
  fake = fakeNoir();
  chain = makeChainDeps(db, fake.noir, fakeLog());
  bus = createSseBus();
  published = [];
  bus.subscribe((event, data) => published.push({ event, data }));
  deps = {
    db,
    chain,
    bus,
    config: { KEY_ENCRYPTION_SECRET, XLM_SAC_ID },
    now: () => T0,
  };
});

afterEach(() => {
  db.close();
});

describe('runSettlement', () => {
  it('claims the active station once and holds the frozen one with no transaction', async () => {
    insertTap('tap_a1', 'A', 350_000_000);
    insertTap('tap_b1', 'B', 480_000_000);
    insertTap('tap_b2', 'B', 480_000_000);
    // A refused burst edge is not money: it must never reach the pending sum.
    insertTap('tap_b3', 'B', 450_000_000, 'refused');

    const response = await runSettlement(deps);

    expect(response.stations).toEqual([
      {
        stationId: 'A',
        stationName: 'Petron San Roque',
        pendingStroops: '350000000',
        action: 'claimed',
        chainTxId: expect.any(String),
        decisionId: expect.any(String),
      },
      {
        stationId: 'B',
        stationName: 'Rotonda Fuels',
        pendingStroops: '960000000',
        action: 'held',
        chainTxId: null,
        decisionId: expect.any(String),
      },
    ]);

    // Exactly one claim, signed by Station A's own key.
    expect(claims()).toEqual([{ status: 'succeeded', source_public: stationA.publicKey() }]);

    const rows = decisions();
    const claimed = rows.find((row) => row.decision === 'CLAIMED');
    const held = rows.find((row) => row.decision === 'HELD');
    expect(rows.map((row) => row.decision)).toEqual(['CLAIMED', 'HELD']);
    expect(JSON.parse(claimed?.outputs_json ?? '{}')).toMatchObject({
      stationId: 'A',
      amountStroops: '350000000',
      claimed: true,
    });
    expect(JSON.parse(claimed?.tx_ids_json ?? '[]')).toEqual([response.stations[0]?.chainTxId]);
    // Held: the amount is recorded, and there is no tx to point at (the money stays in escrow).
    expect(JSON.parse(held?.inputs_json ?? '{}')).toMatchObject({ stationStatus: 'frozen', pendingStroops: '960000000' });
    expect(JSON.parse(held?.outputs_json ?? '{}')).toMatchObject({ stationId: 'B', amountStroops: '960000000', held: true });
    expect(held?.tx_ids_json).toBe('[]');

    // One `settlement` SSE event per station, and the claim's `chain_tx` event.
    expect(published.filter((entry) => entry.event === 'settlement')).toHaveLength(2);
    expect(published.filter((entry) => entry.event === 'chain_tx')).toHaveLength(1);
    expect(published.find((entry) => entry.event === 'settlement')?.data).toMatchObject({
      agent: 'settlement',
      decision: 'CLAIMED',
    });
  });

  it('finds nothing pending at the claimed station on the next run', async () => {
    insertTap('tap_a1', 'A', 350_000_000);
    await runSettlement(deps);

    const second = await runSettlement(deps);

    expect(second.stations.map((station) => station.action)).toEqual(['nothing_pending', 'nothing_pending']);
    expect(second.stations.map((station) => station.pendingStroops)).toEqual(['0', '0']);
    // No second claim transaction.
    expect(claims()).toHaveLength(1);
    const nothing = decisions().filter((row) => row.decision === 'NOTHING_PENDING');
    expect(nothing).toHaveLength(2);
    expect(JSON.parse(nothing[0]?.outputs_json ?? '{}')).toMatchObject({ stationId: 'A', amountStroops: '0' });
  });

  it('answers 502 CHAIN_ERROR after the other stations have run', async () => {
    insertTap('tap_a1', 'A', 350_000_000);
    insertTap('tap_b1', 'B', 480_000_000);
    fake.prepare.mockImplementation(async (source: string, op) => {
      if (op.kind === 'claim') throw new NoirContractError('paymentEscrow', 8, 'DeviceNotRegistered', 'claim');
      return unsignedXdr(source);
    });

    await expect(runSettlement(deps)).rejects.toMatchObject({
      statusCode: 502,
      code: 'CHAIN_ERROR',
      message: expect.stringContaining('CONTRACT_DeviceNotRegistered'),
    });

    // Station A's attempt is logged with the error, Station B was still held, and nothing claimed.
    expect(claims()).toEqual([{ status: 'failed', source_public: stationA.publicKey() }]);
    const failed = decisions().find((row) => row.decision === 'CLAIMED');
    expect(JSON.parse(failed?.outputs_json ?? '{}')).toMatchObject({ stationId: 'A', claimed: false });
    expect(JSON.parse(failed?.outputs_json ?? '{}').error).toContain('CONTRACT_DeviceNotRegistered');
    expect(JSON.parse(failed?.tx_ids_json ?? '[]')).toHaveLength(1);
    expect(decisions().some((row) => row.decision === 'HELD')).toBe(true);
  });

  it('is 404 NOT_FOUND without a program', async () => {
    db.prepare('DELETE FROM program').run();

    await expect(runSettlement(deps)).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
    expect(decisions()).toHaveLength(0);
  });
});
