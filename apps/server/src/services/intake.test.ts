// F1 intake + beneficiaries (docs/api-and-data.md §5.2 #6-#9, docs/system-design.md §6.1). `buildServer()` + `inject`;
// no network, no `.env`: the calibration fixture is the committed one and the multipart bodies are built here.
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { CrcThresholds } from '@tapat/agent';
import type { Db } from '../db/index';
import { openDb } from '../db/index';
import { buildServer } from '../server';
import type { EvidenceNotifier } from '../services/beneficiaries';
import { loadCalibration } from '../services/intake';
import { createProgram, getCurrentProgram } from '../services/program';
import { createSseBus, type SseBus } from '../services/sse';
import { registerBeneficiaryRoutes } from '../routes/beneficiaries';
import { registerIntakeRoutes } from '../routes/intake';

const BOT = 'tapat_demo_bot';
/** Noon UTC on 2026-11-05 is 20:00 in Asia/Manila, so the program start date is unambiguously 2026-11-05. */
const T0 = Date.parse('2026-11-05T12:00:00Z');

let app: FastifyInstance | undefined;
let db: Db | undefined;

afterEach(async () => {
  await app?.close();
  db?.close();
  app = undefined;
  db = undefined;
});

/** The four seeded drivers (SDD §2.5): their masterlist rows, inserted `enrolled` before the upload runs. */
const SEEDED = [
  { id: 'ben_D1', last: 'Dela Cruz', first: 'Juan', middle: 'Santos', birthdate: '1980-03-02', plate: 'ABC 1234', toda: 'San Roque TODA', barangay: 'San Roque' },
  { id: 'ben_D2', last: 'Reyes', first: 'Pedro', middle: 'Mendoza', birthdate: '1975-06-15', plate: 'DEF 2345', toda: 'San Roque TODA', barangay: 'San Roque' },
  { id: 'ben_D3', last: 'Bautista', first: 'Ramon', middle: 'Aquino', birthdate: '1983-09-21', plate: 'GHI 3456', toda: 'Rotonda TODA', barangay: 'Rotonda' },
  { id: 'ben_D5', last: 'Garcia', first: 'Lito', middle: 'Ramos', birthdate: '1978-01-30', plate: 'MNO 5678', toda: 'Concepcion TODA', barangay: 'Concepcion' },
] as const;

function seedProgramAndDrivers(database: Db): void {
  createProgram(database, {}, { phpPerXlm: 10, now: () => T0 });
  const program = getCurrentProgram(database);
  if (program === null) throw new Error('seed: no program');
  const insert = database.prepare(
    `INSERT INTO beneficiaries
       (id, program_id, last_name, first_name, middle_name, suffix, birthdate, plate, toda, barangay,
        source, score, status, rule_code, decision_reason, link_code, created_at)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, 'csv', 1, 'enrolled', NULL, 'genuine', ?, ?)`,
  );
  SEEDED.forEach((driver, index) => {
    insert.run(
      driver.id,
      program.id,
      driver.last,
      driver.first,
      driver.middle,
      driver.birthdate,
      driver.plate,
      driver.toda,
      driver.barangay,
      `seed000${index}`,
      T0 - 1000,
    );
  });
}

interface ServerOptions {
  calibration?: CrcThresholds;
  ocrFixturesDir?: string;
  notifier?: EvidenceNotifier;
  bus?: SseBus;
}

async function intakeServer(options: ServerOptions = {}): Promise<FastifyInstance> {
  const database = openDb(':memory:');
  seedProgramAndDrivers(database);
  const server = await buildServer();
  const notifier = options.notifier === undefined ? {} : { notifier: options.notifier };
  registerIntakeRoutes(server, {
    db: database,
    bus: options.bus ?? createSseBus(),
    config: { TELEGRAM_BOT_USERNAME: BOT },
    calibration: options.calibration ?? loadCalibration({ alpha: 0.05, beta: 0.02 }),
    ...notifier,
    ...(options.ocrFixturesDir === undefined ? {} : { ocrFixturesDir: options.ocrFixturesDir }),
  });
  registerBeneficiaryRoutes(server, { db: database, config: { TELEGRAM_BOT_USERNAME: BOT }, ...notifier });
  await server.ready();
  db = database;
  app = server;
  return server;
}

function database(): Db {
  if (db === undefined) throw new Error('no database');
  return db;
}

/** One `multipart/form-data` file part, built by hand so the test needs no extra dependency. */
function masterlistUpload(filename: string, mimetype: string, body: Buffer): { headers: Record<string, string>; payload: Buffer } {
  const boundary = '----tapat-intake-test';
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimetype}\r\n\r\n`,
  );
  return {
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.concat([head, body, Buffer.from(`\r\n--${boundary}--\r\n`)]),
  };
}

function uploadCsv(server: FastifyInstance): Promise<{ statusCode: number; json: () => unknown }> {
  return server.inject({ method: 'POST', url: '/api/intake/upload', ...masterlistUpload('masterlist.csv', 'text/csv', Buffer.from(CSV)) });
}

/** A multipart body with no file part at all: the endpoint still has to answer `file: upload a …`. */
function formField(name: string, value: string): { headers: Record<string, string>; payload: Buffer } {
  const boundary = '----tapat-intake-test';
  return {
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n--${boundary}--\r\n`,
    ),
  };
}

/** The committed fixture itself, so the test tracks the twelve rows the demo uploads. */
const CSV = readFileSync(new URL('../../../../fixtures/masterlist/masterlist.csv', import.meta.url), 'utf8');

const BeneficiaryBody = z.object({
  id: z.string(),
  lastName: z.string(),
  source: z.enum(['ocr_precomputed', 'csv']),
  score: z.number(),
  status: z.enum(['approved', 'rejected', 'uncertain', 'evidence_requested', 'enrolled']),
  ruleCode: z.string().nullable(),
  decisionReason: z.string(),
  linkCode: z.string(),
  telegramLinked: z.boolean(),
  telegramDeepLink: z.string(),
});

const IntakeBody = z.object({
  rows: z.array(BeneficiaryBody),
  summary: z.object({
    total: z.number(),
    approved: z.number(),
    rejected: z.number(),
    uncertain: z.number(),
    enrolled: z.number(),
  }),
  calibration: z.object({
    lambdaLo: z.number(),
    lambdaHi: z.number(),
    alpha: z.number(),
    beta: z.number(),
    n: z.number(),
    wrongfulDenialRate: z.number(),
    ghostAdmissionRate: z.number(),
    feasible: z.boolean(),
  }),
});

const CALIBRATION_KEYS = ['alpha', 'beta', 'feasible', 'ghostAdmissionRate', 'lambdaHi', 'lambdaLo', 'n', 'wrongfulDenialRate'];

const D5_CALIBRATION = {
  lambdaLo: 0.05,
  lambdaHi: 0.05,
  alpha: 0.05,
  beta: 0.02,
  n: 400,
  wrongfulDenialRate: 0,
  ghostAdmissionRate: 0,
  feasible: true,
};

describe('loadCalibration', () => {
  it('returns exactly the eight CrcThresholds fields of the committed calibration set (D5)', () => {
    const calibration = loadCalibration({ alpha: 0.05, beta: 0.02 });
    expect(Object.keys(calibration).sort()).toEqual(CALIBRATION_KEYS);
    expect(calibration).toEqual(D5_CALIBRATION);
  });

  it('is served as-is by GET /api/intake/calibration', async () => {
    const server = await intakeServer();
    const response = await server.inject({ method: 'GET', url: '/api/intake/calibration' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(D5_CALIBRATION);
  });
});

describe('POST /api/intake/upload (CSV)', () => {
  it('decides the 12-row masterlist as 6 approved, 2 rejected, 0 uncertain, 4 enrolled', async () => {
    const server = await intakeServer();
    const response = await uploadCsv(server);

    expect(response.statusCode).toBe(200);
    const body = IntakeBody.parse(response.json());
    expect(body.summary).toEqual({ total: 12, approved: 6, rejected: 2, uncertain: 0, enrolled: 4 });
    expect(body.rows).toHaveLength(12);
    expect(body.rows.every((row) => row.source === 'csv')).toBe(true);
    expect(body.calibration).toEqual(D5_CALIBRATION);

    // The four seeded drivers keep `enrolled`: their cards must never be orphaned by a re-upload.
    const enrolled = body.rows.filter((row) => row.status === 'enrolled');
    expect(enrolled.map((row) => row.id).sort()).toEqual(SEEDED.map((driver) => driver.id).sort());

    const ghost = body.rows[8];
    expect(ghost?.status).toBe('rejected');
    expect(ghost?.ruleCode).toBe('DUPLICATE_PLATE');
    expect(ghost?.decisionReason).toBe('plate ABC1234 duplicates record 0');
    const underage = body.rows[9];
    expect(underage?.status).toBe('rejected');
    expect(underage?.ruleCode).toBe('UNDERAGE');
    expect(underage?.decisionReason).toBe('age 16 is below 18 on 2026-11-05');

    // The two Santos variants are genuine enough to approve once the clamped band is empty (D5).
    expect(body.rows[10]?.status).toBe('approved');
    expect(body.rows[10]?.score).toBe(0.741513);
    expect(body.rows[11]?.status).toBe('approved');
    expect(body.rows[11]?.score).toBe(0.731059);

    // One `intake` decision row records the run's thresholds and counts (PRD F1 #4).
    const decisions = database()
      .prepare(`SELECT decision, inputs_json, outputs_json FROM agent_decisions WHERE agent = 'intake'`)
      .all<{ decision: string; inputs_json: string; outputs_json: string }>();
    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.decision).toBe('REJECTED');
    expect(JSON.parse(decisions[0]?.inputs_json ?? '{}')).toEqual({
      lambdaLo: 0.05,
      lambdaHi: 0.05,
      alpha: 0.05,
      beta: 0.02,
      n: 400,
    });
    expect(JSON.parse(decisions[0]?.outputs_json ?? '{}')).toEqual({
      total: 12,
      approved: 6,
      rejected: 2,
      uncertain: 0,
      enrolled: 4,
      source: 'csv',
    });
  });

  it('publishes one SSE `intake` event carrying that decision', async () => {
    const bus = createSseBus();
    const seen: Array<{ event: string; data: unknown }> = [];
    bus.subscribe((event, data) => seen.push({ event, data }));

    const server = await intakeServer({ bus });
    await uploadCsv(server);

    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ event: 'intake', data: { agent: 'intake', decision: 'REJECTED' } });
  });

  it('replaces the prior non-enrolled rows instead of duplicating them', async () => {
    const server = await intakeServer();
    await uploadCsv(server);
    const second = await uploadCsv(server);

    expect(second.statusCode).toBe(200);
    expect(IntakeBody.parse(second.json()).summary).toEqual({
      total: 12,
      approved: 6,
      rejected: 2,
      uncertain: 0,
      enrolled: 4,
    });
    expect(database().prepare('SELECT COUNT(*) AS n FROM beneficiaries').get<{ n: number }>()?.n).toBe(12);
  });

  it('rejects a bad header, an unknown extension, a missing file and a wrong MIME type', async () => {
    const server = await intakeServer();

    const badHeader = await server.inject({
      method: 'POST',
      url: '/api/intake/upload',
      ...masterlistUpload('list.csv', 'text/csv', Buffer.from('last_name,first_name\nA,B')),
    });
    expect(badHeader.statusCode).toBe(400);
    expect(badHeader.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message:
          'masterlist header must be exactly last_name,first_name,middle_name,suffix,birthdate,plate,toda,barangay',
      },
    });

    const unknown = await server.inject({
      method: 'POST',
      url: '/api/intake/upload',
      ...masterlistUpload('list.txt', 'text/plain', Buffer.from('nope')),
    });
    expect(unknown.statusCode).toBe(400);
    expect(unknown.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });

    const wrongMime = await server.inject({
      method: 'POST',
      url: '/api/intake/upload',
      ...masterlistUpload('list.csv', 'application/octet-stream', Buffer.from(CSV)),
    });
    expect(wrongMime.statusCode).toBe(400);
    expect(wrongMime.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });

    const missing = await server.inject({
      method: 'POST',
      url: '/api/intake/upload',
      ...formField('note', 'no file in this body'),
    });
    expect(missing.statusCode).toBe(400);
    expect(missing.json()).toMatchObject({
      error: { code: 'VALIDATION_ERROR', message: 'file: upload a .csv, .png, .jpg or .jpeg masterlist' },
    });
  });
});

describe('POST /api/intake/upload (image)', () => {
  it('answers 422 OCR_UNAVAILABLE for an unknown scan hash', async () => {
    const server = await intakeServer();
    const response = await server.inject({
      method: 'POST',
      url: '/api/intake/upload',
      ...masterlistUpload('scanned-list.png', 'image/png', Buffer.from('not-a-known-scan')),
    });
    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      error: { code: 'OCR_UNAVAILABLE', message: 'OCR model not bundled in demo build; upload CSV' },
    });
  });

  it('ingests the precomputed rows of a matching hash with source ocr_precomputed', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'tapat-ocr-'));
    const bytes = Buffer.from('pretend this is a photograph of the masterlist');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const rows = [
      { last_name: 'Aquino', first_name: 'Benigno', middle_name: 'C', suffix: '', birthdate: '1990-01-01', plate: 'AAA 1111', toda: 'San Roque TODA', barangay: 'San Roque' },
      { last_name: 'Bautista', first_name: 'Cory', middle_name: 'D', suffix: '', birthdate: '1992-02-02', plate: 'BBB 2222', toda: 'Rotonda TODA', barangay: 'Rotonda' },
    ];
    writeFileSync(join(dir, 'scanned-list.ocr.json'), JSON.stringify({ sha256, rows }));

    try {
      const server = await intakeServer({ ocrFixturesDir: dir });
      const response = await server.inject({
        method: 'POST',
        url: '/api/intake/upload',
        ...masterlistUpload('scanned-list.png', 'image/png', bytes),
      });

      expect(response.statusCode).toBe(200);
      const body = IntakeBody.parse(response.json());
      expect(body.rows).toHaveLength(2);
      expect(body.rows.map((row) => row.source)).toEqual(['ocr_precomputed', 'ocr_precomputed']);
      expect(body.rows.map((row) => row.status)).toEqual(['approved', 'approved']);
      expect(body.summary).toEqual({ total: 2, approved: 2, rejected: 0, uncertain: 0, enrolled: 0 });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('GET /api/beneficiaries', () => {
  it('lists newest first, filters by status and composes the Telegram deep link', async () => {
    const server = await intakeServer();
    await uploadCsv(server);

    const rejected = await server.inject({ method: 'GET', url: '/api/beneficiaries?status=rejected' });
    expect(rejected.statusCode).toBe(200);
    const rows = z.array(BeneficiaryBody).parse(rejected.json());
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.telegramDeepLink).toBe(`https://t.me/${BOT}?start=${row.linkCode}`);
      expect(row.telegramLinked).toBe(false);
    }

    const limited = await server.inject({ method: 'GET', url: '/api/beneficiaries?limit=3' });
    expect(z.array(BeneficiaryBody).parse(limited.json())).toHaveLength(3);

    const invalid = await server.inject({ method: 'GET', url: '/api/beneficiaries?status=bogus' });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });
});

describe('POST /api/beneficiaries/:id/request-evidence', () => {
  it('moves a rejected row to evidence_requested and returns the deep link', async () => {
    const notifier = { sendEvidenceRequest: vi.fn(async () => undefined) };
    const server = await intakeServer({ notifier });
    await uploadCsv(server);
    const rejected = database()
      .prepare(`SELECT id, link_code FROM beneficiaries WHERE status = 'rejected' AND rule_code = 'UNDERAGE'`)
      .get<{ id: string; link_code: string }>();
    if (rejected === undefined) throw new Error('no rejected row to appeal');

    const response = await server.inject({ method: 'POST', url: `/api/beneficiaries/${rejected.id}/request-evidence` });
    expect(response.statusCode).toBe(200);
    const body = z
      .object({
        beneficiary: BeneficiaryBody,
        telegramSent: z.boolean(),
        deepLink: z.string(),
      })
      .parse(response.json());
    expect(body.beneficiary.status).toBe('evidence_requested');
    expect(body.deepLink).toBe(`https://t.me/${BOT}?start=${rejected.link_code}`);
    expect(body.beneficiary.telegramDeepLink).toBe(body.deepLink);
    // No linked chat: the notifier is never called and the officer hands the phone over (telegramSent false).
    expect(body.telegramSent).toBe(false);
    expect(notifier.sendEvidenceRequest).not.toHaveBeenCalled();

    expect(
      database().prepare(`SELECT COUNT(*) AS n FROM agent_decisions WHERE decision = 'EVIDENCE_REQUESTED'`).get<{ n: number }>()?.n,
    ).toBe(1);

    const again = await server.inject({ method: 'POST', url: `/api/beneficiaries/${rejected.id}/request-evidence` });
    expect(again.statusCode).toBe(409);
    expect(again.json()).toMatchObject({ error: { code: 'INVALID_STATE' } });
  });

  it('409s from approved, enrolled and evidence_requested and 404s for an unknown id', async () => {
    const server = await intakeServer();
    await uploadCsv(server);

    const approved = database()
      .prepare(`SELECT id FROM beneficiaries WHERE status = 'approved' ORDER BY id LIMIT 2`)
      .all<{ id: string }>();
    const enrolled = database().prepare(`SELECT id FROM beneficiaries WHERE status = 'enrolled' LIMIT 1`).get<{ id: string }>();
    if (approved.length < 2 || enrolled === undefined) throw new Error('seed should leave two approved and four enrolled');
    database().prepare(`UPDATE beneficiaries SET status = 'evidence_requested' WHERE id = ?`).run(approved[1]?.id);

    for (const id of [approved[0]?.id, enrolled.id, approved[1]?.id]) {
      const response = await server.inject({ method: 'POST', url: `/api/beneficiaries/${id}/request-evidence` });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ error: { code: 'INVALID_STATE' } });
    }

    const missing = await server.inject({ method: 'POST', url: '/api/beneficiaries/ben_nope/request-evidence' });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });

  it('sends through the notifier when the chat is linked', async () => {
    const sendEvidenceRequest = vi.fn(async () => undefined);
    const server = await intakeServer({ notifier: { sendEvidenceRequest } });
    await uploadCsv(server);
    const rejected = database().prepare(`SELECT id FROM beneficiaries WHERE status = 'rejected' LIMIT 1`).get<{ id: string }>();
    if (rejected === undefined) throw new Error('no rejected row');
    database().prepare(`UPDATE beneficiaries SET telegram_chat_id = '4242' WHERE id = ?`).run(rejected.id);

    const response = await server.inject({ method: 'POST', url: `/api/beneficiaries/${rejected.id}/request-evidence` });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ telegramSent: true });
    expect(sendEvidenceRequest).toHaveBeenCalledTimes(1);
  });

  it('is not an error when the notifier throws (telegramSent false, state still moves)', async () => {
    const server = await intakeServer({
      notifier: {
        sendEvidenceRequest: async () => {
          throw new Error('telegram is down');
        },
      },
    });
    await uploadCsv(server);
    const rejected = database().prepare(`SELECT id FROM beneficiaries WHERE status = 'rejected' LIMIT 1`).get<{ id: string }>();
    if (rejected === undefined) throw new Error('no rejected row');
    database().prepare(`UPDATE beneficiaries SET telegram_chat_id = '4242' WHERE id = ?`).run(rejected.id);

    const response = await server.inject({ method: 'POST', url: `/api/beneficiaries/${rejected.id}/request-evidence` });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ telegramSent: false, beneficiary: { status: 'evidence_requested' } });
  });
});

describe('upload without a program', () => {
  it('404s', async () => {
    db = openDb(':memory:');
    const server = await buildServer();
    registerIntakeRoutes(server, {
      db,
      bus: createSseBus(),
      config: { TELEGRAM_BOT_USERNAME: BOT },
      calibration: loadCalibration({ alpha: 0.05, beta: 0.02 }),
    });
    app = server;
    const response = await server.inject({
      method: 'POST',
      url: '/api/intake/upload',
      ...masterlistUpload('masterlist.csv', 'text/csv', Buffer.from(CSV)),
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });
});
