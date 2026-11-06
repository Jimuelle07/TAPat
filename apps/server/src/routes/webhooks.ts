// POST /api/webhooks/velo (docs/api-and-data.md §5.5): an encapsulated plugin, so its raw-Buffer JSON parser never
// touches another route. The HMAC covers the raw bytes, so the body must reach the handler unparsed.
import type { FastifyInstance } from 'fastify';
import { ApiError } from '../errors';
import { handleVeloDelivery, type BudgetDeps } from '../services/budget';
import { verifyVeloWebhook } from '../velo/webhook';

export function registerWebhookRoutes(app: FastifyInstance, deps: BudgetDeps): void {
  void app.register(
    async (scope) => {
      scope.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_request, body, done) => {
        done(null, body);
      });

      scope.post('/', async (request, reply) => {
        const deliveryId = request.headers['x-velo-delivery'];
        if (typeof deliveryId !== 'string' || deliveryId === '') {
          throw new ApiError(400, 'VALIDATION_ERROR', 'x-velo-delivery header is required');
        }
        // The parser above hands over a Buffer; anything else cannot be verified against the HMAC of the raw bytes.
        if (!Buffer.isBuffer(request.body)) {
          throw new ApiError(400, 'WEBHOOK_SIGNATURE_INVALID', 'raw body is not a Buffer');
        }
        const rawBody = request.body;
        const signature = request.headers['x-velo-signature'];
        const event = verifyVeloWebhook({
          rawBody,
          signature: typeof signature === 'string' ? signature : undefined,
          secret: deps.config.VELO_WEBHOOK_SECRET,
        });
        await handleVeloDelivery(deps, { id: deliveryId, rawBody: rawBody.toString('utf8'), event });
        return reply.code(200).send({ received: true });
      });
    },
    { prefix: '/api/webhooks/velo' },
  );
}
