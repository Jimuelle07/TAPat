// GET /api/health (docs/api-and-data.md §5.2): the bare HealthResponse, no envelope.
import type { FastifyInstance } from 'fastify';
import type { GasMode } from '@tapat/shared';
import { checkHealth, type HealthProbes } from '../services/health';

export function registerHealthRoutes(app: FastifyInstance, deps: { probes: HealthProbes; gasMode: GasMode }): void {
  app.get('/api/health', async () => checkHealth(deps.probes, deps.gasMode));
}
