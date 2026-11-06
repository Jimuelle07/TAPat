// GET /api/dashboard (api-and-data.md §5.2 #18): the route wiring, the bare object and the 404 envelope.
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import type { Db } from '../db/index';
import { openDb } from '../db/index';
import { buildServer } from '../server';
import { createDashboardService } from '../services/dashboard';
import { fakeNoir, seedProgram } from '../services/test-fakes';
import { registerDashboardRoutes } from './dashboard';

let app: FastifyInstance | undefined;
let db: Db | undefined;

afterEach(async () => {
  await app?.close();
  db?.close();
  app = undefined;
  db = undefined;
});

async function dashboardServer(database: Db): Promise<FastifyInstance> {
  const server = await buildServer();
  registerDashboardRoutes(server, {
    dashboard: createDashboardService({
      db: database,
      noir: fakeNoir().noir,
      config: { PHP_PER_XLM: 10 },
      midasThreshold: 2.2,
    }),
  });
  return server;
}

describe('GET /api/dashboard', () => {
  it('returns the Dashboard object with no-store and no program salt', async () => {
    db = openDb(':memory:');
    seedProgram(db);
    app = await dashboardServer(db);

    const response = await app.inject({ method: 'GET', url: '/api/dashboard' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    const body = response.json() as Record<string, unknown>;
    expect(body).toMatchObject({
      phpPerXlm: 10,
      midasThreshold: 2.2,
      fundedStroops: '0',
      spentStroops: '0',
      heldStroops: '0',
      pendingStroops: '0',
      escrowRemainingStroops: '0',
      returnedStroops: '0',
      invariantOk: true,
      counts: { beneficiaries: 0, cardsActive: 0 },
      cards: [],
      stations: [],
      recentTaps: [],
      recentDecisions: [],
      recentChainTxs: [],
    });
    expect('salt' in (body.program as Record<string, unknown>)).toBe(false);
    expect(body.budget).toMatchObject({ state: 'none' });
  });

  it('answers 404 NOT_FOUND without a program', async () => {
    db = openDb(':memory:');
    app = await dashboardServer(db);

    const response = await app.inject({ method: 'GET', url: '/api/dashboard' });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });
});
