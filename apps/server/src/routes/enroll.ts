// POST /api/enroll (docs/api-and-data.md §5.2 #10): multipart in, EnrollResponse out.
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Keypair } from '@stellar/stellar-sdk';
import { VIRTUAL_UID_PREFIX, enrollFieldsSchema } from '@tapat/shared';
import type { Config } from '../config';
import type { Db } from '../db/index';
import { ApiError } from '../errors';
import type { ChainDeps } from '../services/chain';
import { enrollCard, type EnrollDeps } from '../services/enroll';
import type { SseBus } from '../services/sse';

const PHOTO_TYPES = ['image/jpeg', 'image/png'];
/** §5.2 #10: the same 5 MB image ceiling as the intake upload, applied before a part is buffered. */
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ENROLL_LIMITS = { fileSize: MAX_PHOTO_BYTES, files: 1, fields: 10, fieldSize: 4096 };

export interface EnrollRouteDeps {
  db: Db;
  chain: ChainDeps;
  bus: SseBus;
  programWallet: Keypair;
  config: Pick<Config, 'KEY_ENCRYPTION_SECRET' | 'XLM_SAC_ID' | 'TELEGRAM_BOT_USERNAME'>;
  /** Tests point this at a temp dir holding the precomputed photo records, and stub friendbot. */
  fixturesDir?: string;
  fund?: EnrollDeps['fund'];
}

/** §5.2 #10: bounded multipart read — one 5 MB photo, at most ten small text fields. */
async function readEnrollParts(request: FastifyRequest): Promise<{ fields: Record<string, string>; hasPhoto: boolean }> {
  const fields: Record<string, string> = {};
  let hasPhoto = false;
  try {
    for await (const part of request.parts({ limits: ENROLL_LIMITS })) {
      if (part.type === 'file') {
        if (part.fieldname !== 'photo') {
          throw new ApiError(400, 'VALIDATION_ERROR', `unexpected file field ${part.fieldname}`);
        }
        if (!PHOTO_TYPES.includes(part.mimetype)) {
          throw new ApiError(400, 'VALIDATION_ERROR', 'photo: must be image/jpeg or image/png');
        }
        hasPhoto = true;
        // No model runs in this build: the bytes are drained and dropped, the officer confirmed them.
        await part.toBuffer();
      } else {
        fields[part.fieldname] = String(part.value);
      }
    }
  } catch (error) {
    // The plugin's own limits (file size, one file, ten fields) all report 413; §5.2 #10 keeps them 400s.
    if (typeof error === 'object' && error !== null && 'statusCode' in error && error.statusCode === 413) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'multipart: too large (max 5 MB photo, 10 fields of 4 KB)');
    }
    throw error;
  }
  return { fields, hasPhoto };
}

export function registerEnrollRoutes(app: FastifyInstance, deps: EnrollRouteDeps): void {
  app.post('/api/enroll', async (request, reply) => {
    const { fields, hasPhoto } = await readEnrollParts(request);

    const parsed = enrollFieldsSchema.parse(fields);
    if (parsed.samplePhoto !== undefined && hasPhoto) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'send samplePhoto or photo, not both');
    }
    const response = await enrollCard(
      {
        db: deps.db,
        chain: deps.chain,
        bus: deps.bus,
        programWallet: deps.programWallet,
        config: deps.config,
        ...(deps.fixturesDir === undefined ? {} : { fixturesDir: deps.fixturesDir }),
        ...(deps.fund === undefined ? {} : { fund: deps.fund }),
      },
      { ...parsed, hasPhoto, virtual: parsed.uid.startsWith(VIRTUAL_UID_PREFIX) },
    );
    return reply.code(201).send(response);
  });
}
