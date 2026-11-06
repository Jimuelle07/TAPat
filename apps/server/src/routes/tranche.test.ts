// Tranche routes (docs/api-and-data.md §5.2 #11-12): status codes, bodies and the error envelope.
import { Keypair } from '@stellar/stellar-sdk';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../db/index';
import { openDb } from '../db/index';
import { buildServer } from '../server';
import { createSseBus } from '../services/sse';
import { T0, XLM_SAC_ID, fakeLog, fakeNoir, makeChainDeps, seedBeneficiary, seedCard, seedProgram } from '../services/test-fakes';
import { createTrancheService, type TrancheService } from '../services/tranche';
import { registerTrancheRoutes } from './tranche';

let app: FastifyInstance;
let db: Db;
let service: TrancheService;

beforeEach(async () => {
  db = openDb(':memory:');
  app = await buildServer();
  service = createTrancheService({
    db,
    chain: makeChainDeps(db, fakeNoir().noir, fakeLog()),
    bus: createSseBus(),
    programWallet: Keypair.random(),
    config: { XLM_SAC_ID, PRICE_TICK_MS: 700 },
    now: () => T0,
    schedule: () => () => undefined,
  });
  registerTrancheRoutes(app, { tranche: service });
});

afterEach(async () => {
  service.stop();
  await app.close();
  db.close();
});

async function seedFundedProgram(): Promise<void> {
  seedProgram(db);
  db.prepare('UPDATE program SET budget_verified_stroops = 10000000000').run();
  seedBeneficiary(db, { id: 'ben_D1' });
  await seedCard(db, { id: 'card_D1', beneficiaryId: 'ben_D1', uid: 'TAPATVIRTUAL01', agent: Keypair.random(), secretEnc: 'v1:unused' });
}

describe('POST /api/agents/tranche/start', () => {
  it('answers 202 with the stream description, then 409 while it runs', async () => {
    await seedFundedProgram();
    const started = await app.inject({ method: 'POST', url: '/api/agents/tranche/start' });
    expect(started.statusCode).toBe(202);
    expect(started.json()).toEqual({ started: true, points: 45, tickMs: 700 });
    expect(started.headers['cache-control']).toBe('no-store');

    const again = await app.inject({ method: 'POST', url: '/api/agents/tranche/start' });
    expect(again.statusCode).toBe(409);
    expect(again.json()).toEqual({ error: { code: 'INVALID_STATE', message: 'tranche already running' } });
  });

  it('answers 409 INVALID_STATE "no verified budget" before any budget is credited', async () => {
    seedProgram(db);
    const response = await app.inject({ method: 'POST', url: '/api/agents/tranche/start' });
    expect(response.statusCode).toBe(409);
    expect(response.json().error).toMatchObject({ code: 'INVALID_STATE' });
    expect(response.json().error.message).toContain('no verified budget');
  });

  it('answers 404 NOT_FOUND without a program', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/agents/tranche/start' });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
  });
});

describe('GET /api/agents/tranche/state', () => {
  it('answers the idle state with an empty series before any run', async () => {
    await seedFundedProgram();
    const response = await app.inject({ method: 'GET', url: '/api/agents/tranche/state' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      running: false,
      fired: false,
      idx: 0,
      total: 45,
      lastPricePhp: null,
      cpRecent: null,
      mapR: null,
      thresholdPhp: 65,
      budgetVerifiedStroops: '10000000000',
      budgetFundedStroops: '0',
      points: [],
      funds: [],
    });
  });

  it('carries the series so far once ticks have run', async () => {
    await seedFundedProgram();
    service.start();
    await service.tick();
    await service.tick();
    await service.tick();

    const state = (await app.inject({ method: 'GET', url: '/api/agents/tranche/state' })).json();
    expect(state.running).toBe(true);
    expect(state.idx).toBe(3);
    expect(state.points.map((point: { idx: number }) => point.idx)).toEqual([1, 2, 3]);
    expect(state.points[0]).toMatchObject({ programId: 'prog_test', idx: 1, pricePhp: 58.81, simulated: true });
  });

  it('answers 404 without a program', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/agents/tranche/state' });
    expect(response.statusCode).toBe(404);
  });
});
