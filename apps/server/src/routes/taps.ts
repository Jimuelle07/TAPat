// POST /api/taps (docs/api-and-data.md §5.2 #13): a real NFC read or a simulated tap, both a real `authorize`.
import type { FastifyInstance } from 'fastify';
import { tapBodySchema } from '@tapat/shared';
import { recordTap, type TapDeps } from '../services/tap';

export function registerTapRoutes(app: FastifyInstance, deps: TapDeps): void {
  app.post('/api/taps', async (request) => recordTap(deps, tapBodySchema.parse(request.body)));
}
