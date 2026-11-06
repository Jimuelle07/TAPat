// POST /api/agents/freeze/burst (docs/api-and-data.md §5.2 #14): the anomaly pattern only — 30 simulated edges at
// Station B, each a `refused`/`SIMULATED_EDGE` tap row, so no `authorize` is attempted and no money moves.
import type { FastifyInstance } from 'fastify';
import type { FreezeService } from '../services/freeze';

export function registerAgentRoutes(app: FastifyInstance, deps: { freeze: FreezeService }): void {
  app.post('/api/agents/freeze/burst', async (_request, reply) => reply.code(202).send(deps.freeze.burst()));
}
