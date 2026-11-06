// GET /api/stations (api-and-data.md §5.2 #16): the pending/spent split at each station's last succeeded claim.
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../db/index';
import { openDb } from '../db/index';
import { buildServer } from '../server';
import { listStations } from '../services/stations';
import { XLM_SAC_ID, seedStation } from '../services/test-fakes';
import { registerStationRoutes } from './stations';

let app: FastifyInstance | undefined;
let db: Db | undefined;

beforeEach(() => {
  db = openDb(':memory:');
});

// The first `buildServer()` in a worker pays Fastify's boot (~1 s of module JIT; past the 5 s test budget while the
// whole suite runs in parallel), so it happens once per file inside this hook's longer timeout. Routes register before
// the first `inject` — Fastify refuses them after it has booted.
beforeAll(async () => {
  app = await buildServer();
}, 20_000);

afterAll(async () => {
  await app?.close();
  app = undefined;
});

afterEach(() => {
  db?.close();
  db = undefined;
});

function tap(id: string, stationId: string, amountStroops: number, createdAt: number, status = 'authorized'): void {
  (db as Db)
    .prepare(
      `INSERT INTO taps (id, card_id, card_ref, station_id, amount_stroops, nonce, status, reason_code, chain_tx_id,
                         simulated, created_at)
       VALUES (?, NULL, NULL, ?, ?, NULL, ?, NULL, NULL, 0, ?)`,
    )
    .run(id, stationId, amountStroops, status, createdAt);
}

function claim(id: string, publicKey: string, updatedAt: number): void {
  (db as Db)
    .prepare(
      `INSERT INTO chain_txs (id, kind, contract_id, method, source_public, status, gas_mode, created_at, updated_at)
       VALUES (?, 'claim', ?, 'claim', ?, 'succeeded', 'direct', ?, ?)`,
    )
    .run(id, XLM_SAC_ID, publicKey, updatedAt, updatedAt);
}

describe('GET /api/stations', () => {
  it('splits each station authorized taps at its last succeeded claim', async () => {
    const stationA = seedStation(db as Db, { id: 'A', name: 'Petron San Roque' });
    seedStation(db as Db, { id: 'B', name: 'Rotonda Fuels', status: 'frozen' });
    (db as Db)
      .prepare('UPDATE stations SET frozen_reason = ?, frozen_at = ? WHERE id = ?')
      .run('MIDAS 2.31 >= 1.78 (NEAR_CAP_STREAK)', 1_793_808_400_000, 'B');

    tap('tap_a1', 'A', 200_000_000, 1_000);
    tap('tap_a2', 'A', 150_000_000, 2_000);
    tap('tap_a3', 'A', 900_000_000, 3_000, 'rejected');
    claim('ctx_claim_a', stationA.publicKey(), 1_500);
    tap('tap_b1', 'B', 480_000_000, 2_500);

    // `beforeAll` built the app; routes must land before the first `inject` (see the hook's comment).
    const server = app as FastifyInstance;
    registerStationRoutes(server, { db: db as Db });
    const response = await server.inject({ method: 'GET', url: '/api/stations' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toEqual([
      {
        id: 'A',
        name: 'Petron San Roque',
        publicKey: stationA.publicKey(),
        status: 'active',
        frozenReason: null,
        frozenAt: null,
        pendingStroops: '150000000',
        spentStroops: '200000000',
      },
      {
        id: 'B',
        name: 'Rotonda Fuels',
        publicKey: expect.stringMatching(/^G[A-Z2-7]{55}$/),
        status: 'frozen',
        frozenReason: 'MIDAS 2.31 >= 1.78 (NEAR_CAP_STREAK)',
        frozenAt: 1_793_808_400_000,
        pendingStroops: '480000000',
        spentStroops: '0',
      },
    ]);
  });

  it('moves pending into spent on the next claim, keeping spent + pending equal to the authorized total', async () => {
    const stationA = seedStation(db as Db, { id: 'A', name: 'Petron San Roque' });
    tap('tap_a1', 'A', 200_000_000, 1_000);
    tap('tap_a2', 'A', 150_000_000, 2_000);
    claim('ctx_claim_a', stationA.publicKey(), 1_500);

    const before = listStations(db as Db);
    expect(before.map((station) => [station.pendingStroops, station.spentStroops])).toEqual([['150000000', '200000000']]);

    claim('ctx_claim_a2', stationA.publicKey(), 2_500);
    const after = listStations(db as Db);
    expect(after.map((station) => [station.pendingStroops, station.spentStroops])).toEqual([['0', '350000000']]);
    for (const station of after) {
      expect(BigInt(station.pendingStroops) + BigInt(station.spentStroops)).toBe(350_000_000n);
    }
  });
});
