// GET /api/program (docs/api-and-data.md §5.2): the current program row, or null before one exists.
import type { FastifyInstance } from 'fastify';
import type { ProgramResponse } from '@tapat/shared';
import type { Db } from '../db/index';
import { getCurrentProgram } from '../services/program';

export function registerProgramRoutes(app: FastifyInstance, deps: { db: Db; phpPerXlm: number }): void {
  app.get('/api/program', async (): Promise<ProgramResponse> => ({
    program: getCurrentProgram(deps.db),
    phpPerXlm: deps.phpPerXlm,
  }));
}
