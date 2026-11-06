// GET /api/stations (docs/api-and-data.md §5.2 #16): both stations with their pending/spent split.
// `POST /api/stations/:id/unfreeze` (#15) belongs to the Freeze Agent and is registered with it.
import type { FastifyInstance } from 'fastify';
import type { Station } from '@tapat/shared';
import type { Db } from '../db/index';
import { listStations } from '../services/stations';

export function registerStationRoutes(app: FastifyInstance, deps: { db: Db }): void {
  app.get('/api/stations', async (): Promise<Station[]> => listStations(deps.db));
}
