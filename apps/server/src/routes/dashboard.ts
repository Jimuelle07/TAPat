// GET /api/dashboard (docs/api-and-data.md §5.2 #18): the one snapshot every page loads before it opens the stream.
import type { FastifyInstance } from 'fastify';
import type { Dashboard } from '@tapat/shared';
import type { DashboardService } from '../services/dashboard';

export function registerDashboardRoutes(app: FastifyInstance, deps: { dashboard: DashboardService }): void {
  app.get('/api/dashboard', async (): Promise<Dashboard> => deps.dashboard.get());
}
