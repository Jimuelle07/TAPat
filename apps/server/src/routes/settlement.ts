// POST /api/settlement/run (docs/api-and-data.md §5.2 #17): claim the pending payments, hold the frozen stations'.
import type { FastifyInstance } from 'fastify';
import { runSettlement, type SettlementDeps } from '../services/settlement';

export function registerSettlementRoutes(app: FastifyInstance, deps: SettlementDeps): void {
  app.post('/api/settlement/run', async () => runSettlement(deps));
}
