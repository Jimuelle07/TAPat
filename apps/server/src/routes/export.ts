// GET /api/export/coa.csv (docs/api-and-data.md §5.2 #19): the COA audit export, one row per money event.
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/index';
import { ApiError } from '../errors';
import { buildCoaCsv } from '../services/coa';
import { getCurrentProgram } from '../services/program';

export function registerExportRoutes(app: FastifyInstance, deps: { db: Db; phpPerXlm: number }): void {
  app.get('/api/export/coa.csv', async (_request, reply) => {
    const program = getCurrentProgram(deps.db);
    if (program === null) throw new ApiError(404, 'NOT_FOUND', 'no program; run seed-demo.ts');
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="tapat-coa-${program.id}.csv"`)
      .send(buildCoaCsv(deps.db, { phpPerXlm: deps.phpPerXlm }));
  });
}
