// POST /api/enroll wiring (docs/api-and-data.md §5.2 #10): multipart parsing, field validation and the 201 shape.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Keypair } from '@stellar/stellar-sdk';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { Db } from '../db/index';
import { openDb } from '../db/index';
import { buildServer } from '../server';
import { registerEnrollRoutes } from './enroll';
import {
  BOT_USERNAME,
  KEY_ENCRYPTION_SECRET,
  XLM_SAC_ID,
  fakeLog,
  fakeNoir,
  makeChainDeps,
  seedBeneficiary,
  seedProgram,
} from '../services/test-fakes';
import { createSseBus } from '../services/sse';

const BOUNDARY = '----tapat-boundary';
const D1_UID = '04A21F9C9C7E';

const ErrorBody = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
const EnrollBody = z.object({
  card: z.object({ status: z.string(), uidLast4: z.string(), maxAmountStroops: z.string() }),
  beneficiary: z.object({ status: z.string(), telegramDeepLink: z.string() }),
  photoCheck: z.object({
    source: z.string(),
    plate: z.string().nullable(),
    toda: z.string().nullable(),
    matched: z.boolean(),
  }),
  chainTxIds: z.array(z.string()),
});

let app: FastifyInstance | undefined;
let db: Db | undefined;
let fixturesDir: string;

beforeEach(async () => {
  db = openDb(':memory:');
  seedProgram(db);
  seedBeneficiary(db, { id: 'ben_D1' });
  fixturesDir = mkdtempSync(join(tmpdir(), 'tapat-enroll-route-'));
  writeFileSync(join(fixturesDir, 'd4-photo.json'), JSON.stringify({ plate: 'ABC 1234', toda: 'San Roque TODA' }));
  const fake = fakeNoir();
  app = await buildServer();
  registerEnrollRoutes(app, {
    db,
    chain: makeChainDeps(db, fake.noir, fakeLog()),
    bus: createSseBus(),
    programWallet: Keypair.random(),
    config: { KEY_ENCRYPTION_SECRET, XLM_SAC_ID, TELEGRAM_BOT_USERNAME: BOT_USERNAME },
    fixturesDir,
    fund: async () => undefined,
  });
});

afterEach(async () => {
  await app?.close();
  db?.close();
  rmSync(fixturesDir, { recursive: true, force: true });
  app = undefined;
  db = undefined;
});

type Part = { name: string; value: string } | { name: string; value: string; filename: string; type: string };

function multipartBody(parts: Part[]): string {
  const chunks = parts.map((part) => {
    if ('filename' in part) {
      return `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\nContent-Type: ${part.type}\r\n\r\n${part.value}\r\n`;
    }
    return `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${part.name}"\r\n\r\n${part.value}\r\n`;
  });
  return `${chunks.join('')}--${BOUNDARY}--\r\n`;
}

async function post(parts: Part[]) {
  return (app as FastifyInstance).inject({
    method: 'POST',
    url: '/api/enroll',
    headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
    payload: multipartBody(parts),
  });
}

describe('POST /api/enroll', () => {
  it('answers 201 with the card, the beneficiary, the photo check and both tx ids', async () => {
    const response = await post([
      { name: 'beneficiaryId', value: 'ben_D1' },
      { name: 'uid', value: D1_UID },
      { name: 'samplePhoto', value: 'd4-photo.jpg' },
    ]);

    expect(response.statusCode).toBe(201);
    const body = EnrollBody.parse(response.json());
    expect(body.card.status).toBe('active');
    expect(body.card.uidLast4).toBe('9C7E');
    expect(body.photoCheck).toEqual({ source: 'precomputed', plate: 'ABC 1234', toda: 'San Roque TODA', matched: true });
    expect(body.chainTxIds).toHaveLength(2);
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('answers 400 VALIDATION_ERROR naming the missing uid', async () => {
    const response = await post([{ name: 'beneficiaryId', value: 'ben_D1' }]);
    expect(response.statusCode).toBe(400);
    const body = ErrorBody.parse(response.json());
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toContain('uid');
  });

  it('answers 400 VALIDATION_ERROR for a uid that is not alphanumeric after normalization', async () => {
    const response = await post([
      { name: 'beneficiaryId', value: 'ben_D1' },
      { name: 'uid', value: 'ab_cd' },
    ]);
    expect(response.statusCode).toBe(400);
    expect(ErrorBody.parse(response.json()).error.code).toBe('VALIDATION_ERROR');
  });

  it('normalizes a colon-separated uid before hashing it', async () => {
    const response = await post([
      { name: 'beneficiaryId', value: 'ben_D1' },
      { name: 'uid', value: '04:a2:1f:9c:9c:7e' },
      { name: 'samplePhoto', value: 'd4-photo.jpg' },
    ]);
    expect(response.statusCode).toBe(201);
    expect(EnrollBody.parse(response.json()).card.uidLast4).toBe('9C7E');
  });

  it('answers 404 NOT_FOUND for an unknown beneficiary', async () => {
    const response = await post([
      { name: 'beneficiaryId', value: 'ben_nope' },
      { name: 'uid', value: D1_UID },
      { name: 'samplePhoto', value: 'd4-photo.jpg' },
    ]);
    expect(response.statusCode).toBe(404);
    expect(ErrorBody.parse(response.json()).error.code).toBe('NOT_FOUND');
  });

  it('answers 422 PHOTO_CONFIRMATION_REQUIRED for an uploaded photo without confirmation', async () => {
    const response = await post([
      { name: 'beneficiaryId', value: 'ben_D1' },
      { name: 'uid', value: D1_UID },
      { name: 'photo', filename: 'tag.jpg', type: 'image/jpeg', value: 'jpeg-bytes' },
      { name: 'officerConfirmed', value: 'false' },
    ]);
    expect(response.statusCode).toBe(422);
    expect(ErrorBody.parse(response.json()).error.code).toBe('PHOTO_CONFIRMATION_REQUIRED');
  });

  it('accepts an officer-confirmed upload and labels it officer_confirmed', async () => {
    const response = await post([
      { name: 'beneficiaryId', value: 'ben_D1' },
      { name: 'uid', value: D1_UID },
      { name: 'photo', filename: 'tag.jpg', type: 'image/jpeg', value: 'jpeg-bytes' },
      { name: 'officerConfirmed', value: 'true' },
    ]);
    expect(response.statusCode).toBe(201);
    expect(EnrollBody.parse(response.json()).photoCheck).toEqual({
      source: 'officer_confirmed',
      plate: null,
      toda: null,
      matched: true,
    });
  });

  it('answers 400 VALIDATION_ERROR for a non-image photo part', async () => {
    const response = await post([
      { name: 'beneficiaryId', value: 'ben_D1' },
      { name: 'uid', value: D1_UID },
      { name: 'photo', filename: 'notes.txt', type: 'text/plain', value: 'not an image' },
      { name: 'officerConfirmed', value: 'true' },
    ]);
    expect(response.statusCode).toBe(400);
    expect(ErrorBody.parse(response.json()).error.code).toBe('VALIDATION_ERROR');
  });
});
