// GET /api/beneficiaries + POST /api/beneficiaries/:id/request-evidence (docs/api-and-data.md §5.2 #8-#9).
import type { FastifyInstance } from 'fastify';
import { beneficiariesQuerySchema } from '@tapat/shared';
import type { Config } from '../config';
import type { Db } from '../db/index';
import { listBeneficiaries, requestEvidence, type EvidenceNotifier } from '../services/beneficiaries';

export interface BeneficiaryRouteDeps {
  db: Db;
  config: Pick<Config, 'TELEGRAM_BOT_USERNAME'>;
  /** Absent until the Telegram bot lands; the deep link is returned either way. */
  notifier?: EvidenceNotifier;
  now?: () => number;
}

export function registerBeneficiaryRoutes(app: FastifyInstance, deps: BeneficiaryRouteDeps): void {
  app.get('/api/beneficiaries', async (request, reply) => {
    const query = beneficiariesQuerySchema.parse(request.query);
    return reply.send(listBeneficiaries(deps.db, query, { botUsername: deps.config.TELEGRAM_BOT_USERNAME }));
  });

  app.post<{ Params: { id: string } }>('/api/beneficiaries/:id/request-evidence', async (request, reply) => {
    const response = await requestEvidence(
      {
        db: deps.db,
        config: deps.config,
        ...(deps.notifier === undefined ? {} : { notifier: deps.notifier }),
        ...(deps.now === undefined ? {} : { now: deps.now }),
      },
      request.params.id,
    );
    return reply.send(response);
  });
}
