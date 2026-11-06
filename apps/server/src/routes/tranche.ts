// POST /api/agents/tranche/start and GET /api/agents/tranche/state (docs/api-and-data.md §5.2 #11-12).
import type { FastifyInstance } from 'fastify';
import type { TrancheService } from '../services/tranche';

export function registerTrancheRoutes(app: FastifyInstance, deps: { tranche: TrancheService }): void {
  app.post('/api/agents/tranche/start', async (_request, reply) => reply.code(202).send(deps.tranche.start()));

  app.get('/api/agents/tranche/state', async () => deps.tranche.state());
}
