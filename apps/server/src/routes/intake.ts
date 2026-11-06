// POST /api/intake/upload + GET /api/intake/calibration (docs/api-and-data.md §5.2 #6-#7).
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { CrcThresholds } from '@tapat/agent';
import type { Config } from '../config';
import type { Db } from '../db/index';
import { ApiError } from '../errors';
import type { EvidenceNotifier } from '../services/beneficiaries';
import { MAX_IMAGE_BYTES, uploadMasterlist, type IntakeFile } from '../services/intake';
import type { SseBus } from '../services/sse';

export interface IntakeRouteDeps {
  db: Db;
  bus: SseBus;
  config: Pick<Config, 'TELEGRAM_BOT_USERNAME'>;
  /** Boot-time thresholds; `main()` computes them once with `loadCalibration`. */
  calibration: CrcThresholds;
  /** Tests point this at a temp dir holding the precomputed `.ocr.json` files. */
  ocrFixturesDir?: string;
  notifier?: EvidenceNotifier;
  now?: () => number;
}

/** §5.2 #6: exactly one file field named `file`; the multipart limit keeps a scan bounded before it is hashed. */
async function readUpload(request: FastifyRequest): Promise<IntakeFile> {
  let file: IntakeFile | null = null;
  try {
    for await (const part of request.parts({ limits: { fileSize: MAX_IMAGE_BYTES } })) {
      if (part.type !== 'file') continue;
      if (part.fieldname !== 'file') {
        throw new ApiError(400, 'VALIDATION_ERROR', `unexpected file field ${part.fieldname}`);
      }
      if (file !== null) throw new ApiError(400, 'VALIDATION_ERROR', 'send exactly one file');
      file = { filename: part.filename, mimetype: part.mimetype, bytes: await part.toBuffer() };
    }
  } catch (error) {
    // The plugin's stream limit trips first; §5.2 #6 keeps every upload failure a 400 `VALIDATION_ERROR`.
    if (typeof error === 'object' && error !== null && 'statusCode' in error && error.statusCode === 413) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'file: too large (max 5 MB image, 1 MB CSV)');
    }
    throw error;
  }
  if (file === null) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'file: upload a .csv, .png, .jpg or .jpeg masterlist');
  }
  return file;
}

export function registerIntakeRoutes(app: FastifyInstance, deps: IntakeRouteDeps): void {
  app.post('/api/intake/upload', async (request, reply) => {
    const file = await readUpload(request);
    const response = await uploadMasterlist(
      {
        db: deps.db,
        bus: deps.bus,
        config: deps.config,
        calibration: deps.calibration,
        ...(deps.ocrFixturesDir === undefined ? {} : { ocrFixturesDir: deps.ocrFixturesDir }),
        ...(deps.notifier === undefined ? {} : { notifier: deps.notifier }),
        ...(deps.now === undefined ? {} : { now: deps.now }),
      },
      file,
    );
    return reply.code(200).send(response);
  });

  app.get('/api/intake/calibration', async (_request, reply) => reply.send(deps.calibration));
}
