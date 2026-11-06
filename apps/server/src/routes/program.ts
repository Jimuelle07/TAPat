// GET /api/program and POST /api/program (docs/api-and-data.md §5.2 #2, #3): the current program row, or a new one.
import type { FastifyInstance } from 'fastify';
import { createProgramBodySchema, type ProgramResponse } from '@tapat/shared';
import type { Db } from '../db/index';
import { createProgram, getCurrentProgram } from '../services/program';

export function registerProgramRoutes(app: FastifyInstance, deps: { db: Db; phpPerXlm: number }): void {
  app.get('/api/program', async (): Promise<ProgramResponse> => ({
    program: getCurrentProgram(deps.db),
    phpPerXlm: deps.phpPerXlm,
  }));

  app.post('/api/program', async (request, reply) => {
    const body = createProgramBodySchema.parse(request.body ?? {});
    const program = createProgram(deps.db, body, { phpPerXlm: deps.phpPerXlm });
    return reply.code(201).send({ program });
  });
}
