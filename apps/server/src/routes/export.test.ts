// GET /api/export/coa.csv (docs/api-and-data.md §5.2 #19): the download contract, not the row content (coa.test.ts).
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import type { Db } from '../db/index';
import { openDb } from '../db/index';
import { COA_HEADER } from '../services/coa';
import { buildServer } from '../server';
import { registerExportRoutes } from './export';

let app: FastifyInstance | undefined;
let db: Db | undefined;

afterEach(async () => {
  await app?.close();
  db?.close();
  app = undefined;
  db = undefined;
});

async function exportServer(insertProgram: boolean): Promise<FastifyInstance> {
  db = openDb(':memory:');
  if (insertProgram) {
    db.prepare(
      `INSERT INTO program (id, name, salt, status, expires_at_s, budget_verified_stroops, tranche_fired, created_at)
       VALUES ('prog_a1b2c3d4', 'TODA Fuel Aid', '00000000000000000000000000000000', 'active', 1796054399, 10000000000, 0, 1762400000000)`,
    ).run();
  }
  const server = await buildServer();
  registerExportRoutes(server, { db, phpPerXlm: 10 });
  return server;
}

describe('GET /api/export/coa.csv', () => {
  it('answers 404 NOT_FOUND when there is no program', async () => {
    app = await exportServer(false);
    const response = await app.inject({ method: 'GET', url: '/api/export/coa.csv' });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'no program; run seed-demo.ts' } });
  });

  it('serves a text/csv attachment named after the program, with the documented header', async () => {
    app = await exportServer(true);
    const response = await app.inject({ method: 'GET', url: '/api/export/coa.csv' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(response.headers['content-disposition']).toBe('attachment; filename="tapat-coa-prog_a1b2c3d4.csv"');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.split('\n')[0]).toBe(COA_HEADER);
  });
});
