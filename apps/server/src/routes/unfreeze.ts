// POST /api/stations/:id/unfreeze (docs/api-and-data.md §5.2 #15): the manual release, on `/demo` only. Held pending
// stays in escrow until the next settlement run; nothing is clawed back.
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Station } from '@tapat/shared';
import type { FreezeService } from '../services/freeze';

const paramsSchema = z.object({ id: z.string().min(1) });

export function registerUnfreezeRoutes(app: FastifyInstance, deps: { freeze: FreezeService }): void {
  app.post('/api/stations/:id/unfreeze', async (request): Promise<{ station: Station }> => {
    const { id } = paramsSchema.parse(request.params);
    return { station: deps.freeze.unfreeze(id) };
  });
}
