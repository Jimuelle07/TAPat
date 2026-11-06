import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { Db } from '../db/index';
import { openDb } from '../db/index';
import { createProgram } from '../services/program';
import { registerProgramRoutes } from './program';
import { buildServer } from '../server';

let app: FastifyInstance | undefined;
let db: Db | undefined;

afterEach(async () => {
  await app?.close();
  db?.close();
  app = undefined;
  db = undefined;
});

async function programServer(): Promise<FastifyInstance> {
  db = openDb(':memory:');
  const server = await buildServer();
  registerProgramRoutes(server, { db, phpPerXlm: 10 });
  return server;
}

function insertProgram(database: Db): void {
  database
    .prepare(
      `INSERT INTO program (id, name, salt, status, expires_at_s, budget_verified_stroops, tranche_fired, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run('prog-1', 'TODA Program', '00'.repeat(16), 'active', 1796054399, 10000000000, 1, 1762400000000);
}

describe('GET /api/program', () => {
  it('returns a null program on an empty database', async () => {
    app = await programServer();
    const response = await app.inject({ method: 'GET', url: '/api/program' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ program: null, phpPerXlm: 10 });
  });

  it('returns stroops as strings, trancheFired as a boolean and never the salt', async () => {
    app = await programServer();
    insertProgram(db as Db);
    const response = await app.inject({ method: 'GET', url: '/api/program' });
    expect(response.statusCode).toBe(200);
    const { program } = response.json() as { program: Record<string, unknown> };
    expect(program.budgetVerifiedStroops).toBe('10000000000');
    expect(program.trancheFired).toBe(true);
    expect(program.status).toBe('active');
    expect('salt' in program).toBe(false);
  });
});

const ProgramBody = z.object({
  program: z.object({
    id: z.string(),
    name: z.string(),
    status: z.string(),
    perTapCapStroops: z.string(),
    trancheStroops: z.string(),
    expiresAtS: z.number(),
    priceThresholdPhp: z.number(),
    alpha: z.number(),
    beta: z.number(),
    budgetVerifiedStroops: z.string(),
    budgetFundedStroops: z.string(),
    trancheFired: z.boolean(),
  }),
});
const ErrorBody = z.object({ error: z.object({ code: z.string(), message: z.string() }) });

describe('POST /api/program', () => {
  it('creates a draft program with the demo defaults, a prog_ id and a stored 16-byte salt', async () => {
    app = await programServer();
    const response = await app.inject({ method: 'POST', url: '/api/program', payload: {} });

    expect(response.statusCode).toBe(201);
    const { program } = ProgramBody.parse(response.json());
    expect(program.id).toMatch(/^prog_[0-9a-f]{8}$/);
    expect(program).toMatchObject({
      name: 'TODA Fuel Aid — San Roque',
      status: 'draft',
      perTapCapStroops: '500000000',
      trancheStroops: '1500000000',
      expiresAtS: 1796054399,
      priceThresholdPhp: 65,
      alpha: 0.05,
      beta: 0.02,
      budgetVerifiedStroops: '0',
      budgetFundedStroops: '0',
      trancheFired: false,
    });
    expect('salt' in program).toBe(false);
    const row = (db as Db).prepare('SELECT salt FROM program').get<{ salt: string }>();
    expect(row?.salt).toMatch(/^[0-9a-f]{32}$/);
  });

  it('takes an empty request body and the same defaults', async () => {
    app = await programServer();
    const response = await app.inject({ method: 'POST', url: '/api/program' });
    expect(response.statusCode).toBe(201);
  });

  it('converts the PHP fields to stroops and the ISO expiry to unix seconds', async () => {
    app = await programServer();
    const response = await app.inject({
      method: 'POST',
      url: '/api/program',
      payload: {
        name: 'Custom',
        perTapCapPhp: 250,
        tranchePhp: 1000,
        expiresAt: '2026-12-01T00:00:00+08:00',
        priceThresholdPhp: 60.5,
        alpha: 0.1,
        beta: 0.03,
      },
    });
    expect(response.statusCode).toBe(201);
    const { program } = ProgramBody.parse(response.json());
    expect(program).toMatchObject({
      name: 'Custom',
      perTapCapStroops: '250000000',
      trancheStroops: '1000000000',
      expiresAtS: Date.parse('2026-12-01T00:00:00+08:00') / 1000,
      priceThresholdPhp: 60.5,
      alpha: 0.1,
      beta: 0.03,
    });
  });

  it('gives each program its own salt', async () => {
    const first = openDb(':memory:');
    const second = openDb(':memory:');
    createProgram(first, {}, { phpPerXlm: 10 });
    createProgram(second, {}, { phpPerXlm: 10 });
    const salts = [first, second].map((database) => database.prepare('SELECT salt FROM program').get<{ salt: string }>()?.salt);
    expect(salts[0]).not.toBe(salts[1]);
    first.close();
    second.close();
  });

  it.each([
    ['a bad expiresAt', { expiresAt: 'tomorrow' }, 'expiresAt'],
    ['alpha outside (0,1)', { alpha: 1.5 }, 'alpha'],
    ['a PHP amount with 3 decimals', { perTapCapPhp: 500.123 }, 'perTapCapPhp'],
    ['an unknown field', { seed: 1 }, ''],
  ])('answers 400 VALIDATION_ERROR for %s', async (_label, payload, field) => {
    app = await programServer();
    const response = await app.inject({ method: 'POST', url: '/api/program', payload });
    expect(response.statusCode).toBe(400);
    const body = ErrorBody.parse(response.json());
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toContain(field);
    expect((db as Db).prepare('SELECT COUNT(*) AS n FROM program').get<{ n: number }>()?.n).toBe(0);
  });

  it('answers 409 INVALID_STATE when a program already exists, and keeps the first one', async () => {
    app = await programServer();
    insertProgram(db as Db);
    const response = await app.inject({ method: 'POST', url: '/api/program', payload: {} });
    expect(response.statusCode).toBe(409);
    expect(ErrorBody.parse(response.json()).error.code).toBe('INVALID_STATE');
    expect((db as Db).prepare('SELECT COUNT(*) AS n FROM program').get<{ n: number }>()?.n).toBe(1);
  });

  it('makes the created program visible to GET /api/program without its salt', async () => {
    app = await programServer();
    await app.inject({ method: 'POST', url: '/api/program', payload: {} });
    const response = await app.inject({ method: 'GET', url: '/api/program' });
    const body = z.object({ program: z.object({ status: z.string() }).passthrough() }).parse(response.json());
    expect(body.program.status).toBe('draft');
    expect('salt' in body.program).toBe(false);
  });
});
