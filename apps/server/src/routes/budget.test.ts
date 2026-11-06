// POST /api/program/budget-checkout wiring (docs/api-and-data.md §5.2 #4): validation and the status of each outcome.
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../db/index';
import { openDb } from '../db/index';
import { buildServer } from '../server';
import type { BudgetDeps } from '../services/budget';
import { createSseBus } from '../services/sse';
import { T0, fakeLog, seedProgram } from '../services/test-fakes';
import { PUBLIC_BASE_URL, WEBHOOK_SECRET, fakeVelo, type FakeVelo } from '../services/test-velo';
import { registerBudgetRoutes } from './budget';

let app: FastifyInstance;
let db: Db;
let fake: FakeVelo;

beforeEach(async () => {
  db = openDb(':memory:');
  fake = fakeVelo();
  const deps: BudgetDeps = {
    db,
    velo: fake.velo,
    bus: createSseBus(),
    config: { PHP_PER_XLM: 10, PUBLIC_BASE_URL, VELO_WEBHOOK_SECRET: WEBHOOK_SECRET },
    log: fakeLog(),
    now: () => T0,
  };
  app = await buildServer();
  registerBudgetRoutes(app, deps);
});

afterEach(async () => {
  await app.close();
  db.close();
});

function checkout(payload: unknown) {
  return app.inject({ method: 'POST', url: '/api/program/budget-checkout', payload: payload as object });
}

describe('POST /api/program/budget-checkout', () => {
  it('answers 201 with the checkout URL and intent id, and stores 1000.00 XLM for ₱10,000', async () => {
    seedProgram(db);
    const response = await checkout({ amountPhp: 10000 });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      checkoutUrl: 'https://pay.velo-build.dev/checkout/pi_budget_1',
      paymentIntentId: 'pi_budget_1',
    });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(db.prepare('SELECT amount, purpose, status FROM velo_intents').get()).toEqual({
      amount: '1000.00',
      purpose: 'budget',
      status: 'created',
    });
  });

  it('answers 400 VALIDATION_ERROR for a non-integer, non-positive or missing amount', async () => {
    seedProgram(db);
    for (const body of [{ amountPhp: 10.5 }, { amountPhp: 0 }, { amountPhp: -5 }, { amountPhp: '100' }, {}, { amountPhp: 100, extra: 1 }]) {
      const response = await checkout(body);
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');
    }
    expect(fake.create).not.toHaveBeenCalled();
  });

  it('answers 404 NOT_FOUND without a program', async () => {
    const response = await checkout({ amountPhp: 100 });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
  });

  it('answers 409 INVALID_STATE for an ended program', async () => {
    seedProgram(db);
    db.prepare(`UPDATE program SET status = 'ended'`).run();
    const response = await checkout({ amountPhp: 100 });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('INVALID_STATE');
  });

  it('answers 502 CHAIN_ERROR with VELO_CALL_FAILED when the SDK throws', async () => {
    seedProgram(db);
    fake.create.mockRejectedValueOnce(new Error('boom'));
    const response = await checkout({ amountPhp: 100 });
    expect(response.statusCode).toBe(502);
    expect(response.json()).toEqual({ error: { code: 'CHAIN_ERROR', message: 'VELO_CALL_FAILED: boom' } });
  });
});
