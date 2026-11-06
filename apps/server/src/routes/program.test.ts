import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import type { Db } from '../db/index';
import { openDb } from '../db/index';
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
