// F1 intake (docs/system-design.md §6.1, docs/api-and-data.md §5.2 #6-#7): one uploaded masterlist becomes
// `beneficiaries` rows with scores and statuses, one `intake` decision row, the SSE `intake` event and the boot-time
// calibration block. Matching, hard rules and CRC are `@tapat/agent`'s pure functions; this module only does I/O.
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  calibrateCrc,
  decideIntake,
  pairProbability,
  toMatchRecord,
  type CalibrationPoint,
  type CrcThresholds,
  type IntakeDecision,
  type MatchRecord,
} from '@tapat/agent';
import type { Beneficiary, IntakeResponse } from '@tapat/shared';
import { z } from 'zod';
import type { Config } from '../config';
import type { Db } from '../db/index';
import { ApiError } from '../errors';
import { newLinkCode, toBeneficiary, type BeneficiaryRow, type EvidenceNotifier } from './beneficiaries';
// The masterlist format has one parser: `seed-demo.ts` reads the same file before the program exists.
import { parseMasterlistCsv, type MasterlistRow } from './demo';
import { getCurrentProgram } from './program';
import type { SseBus } from './sse';
import { toAgentDecision } from './tranche';

const DEFAULT_OCR_FIXTURES_DIR = fileURLToPath(new URL('../../../../fixtures/masterlist', import.meta.url));
const DEFAULT_CALIBRATION_FIXTURE = fileURLToPath(new URL('../../../../fixtures/calibration/labeled.json', import.meta.url));

/** §5.2 #6 upload limits: 5 MB for a scan, 1 MB for a CSV. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_CSV_BYTES = 1024 * 1024;

/** §5.2 #6, verbatim: the demo build bundles no OCR model. */
export const OCR_UNAVAILABLE_MESSAGE = 'OCR model not bundled in demo build; upload CSV';

const MANILA_DATE = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** `ageOn`'s `onDate`: the program start date in Asia/Manila (docs/algorithms.md §3.4). */
function manilaDate(ms: number): string {
  let year = '';
  let month = '';
  let day = '';
  for (const part of MANILA_DATE.formatToParts(ms)) {
    if (part.type === 'year') year = part.value;
    else if (part.type === 'month') month = part.value;
    else if (part.type === 'day') day = part.value;
  }
  return `${year}-${month}-${day}`;
}

const personSchema = z.object({
  last: z.string(),
  first: z.string(),
  middle: z.string(),
  suffix: z.string().nullable(),
  birthdate: z.string().nullable(),
  barangay: z.string().nullable(),
  plate: z.string().nullable().optional(),
});

const calibrationSchema = z.object({
  records: z.array(z.object({ label: z.enum(['genuine', 'ghost']), a: personSchema, b: personSchema })).min(1),
});

export interface CalibrationArgs {
  alpha: number;
  beta: number;
  /** Test/laptop seam; default the committed `fixtures/calibration/labeled.json`. */
  path?: string;
}

/**
 * docs/algorithms.md §5.5 + §5.1: each calibration entry is a pair, so its score is `1 - pairProbability(a, b)` with no
 * file-order prefix to subtract. `main()` calls this once at boot and hands the result to the routes unchanged.
 */
export function loadCalibration(args: CalibrationArgs): CrcThresholds {
  const fixture = calibrationSchema.parse(JSON.parse(readFileSync(args.path ?? DEFAULT_CALIBRATION_FIXTURE, 'utf8')));
  const points: CalibrationPoint[] = fixture.records.map((record) => ({
    score: Math.round((1 - pairProbability(toMatchRecord(record.a), toMatchRecord(record.b))) * 1e6) / 1e6,
    genuine: record.label === 'genuine',
  }));
  return calibrateCrc(points, args.alpha, args.beta);
}

const masterlistRowSchema = z.object({
  last_name: z.string(),
  first_name: z.string(),
  middle_name: z.string(),
  suffix: z.string(),
  birthdate: z.string(),
  plate: z.string(),
  toda: z.string(),
  barangay: z.string(),
});

const ocrFixtureSchema = z.object({
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  rows: z.array(masterlistRowSchema).min(1),
});

export interface IntakeFile {
  filename: string;
  mimetype: string;
  bytes: Buffer;
}

export interface IntakeDeps {
  db: Db;
  bus: SseBus;
  config: Pick<Config, 'TELEGRAM_BOT_USERNAME'>;
  /** The boot-time CRC thresholds (`GET /api/intake/calibration` returns the same object, §5.2 #7). */
  calibration: CrcThresholds;
  /** Tests point this at a temp dir holding the precomputed `.ocr.json` files. */
  ocrFixturesDir?: string;
  /** Absent until the Telegram bot lands; uncertain rows with a linked chat then stay `uncertain`. */
  notifier?: EvidenceNotifier;
  now?: () => number;
}

/** SDD §6.1 step 1: the upsert key is the full normalized identity, so a ghost variant stays a separate row. */
function identityKey(record: MatchRecord): string {
  return [record.last, record.first, record.middle, record.suffix ?? '', record.birthdate ?? '', record.plate].join('|');
}

function fileRecord(row: MasterlistRow): MatchRecord {
  return toMatchRecord({
    last: row.last_name,
    first: row.first_name,
    middle: row.middle_name,
    suffix: row.suffix === '' ? null : row.suffix,
    birthdate: row.birthdate,
    plate: row.plate,
    barangay: row.barangay,
  });
}

function storedRecord(row: BeneficiaryRow): MatchRecord {
  return toMatchRecord({
    last: row.last_name,
    first: row.first_name,
    middle: row.middle_name ?? '',
    suffix: row.suffix,
    birthdate: row.birthdate,
    plate: row.plate,
    barangay: row.barangay,
  });
}

/** SDD §6.1, image path: SHA-256 the bytes, then look for the precomputed fixture whose `sha256` matches. */
function ocrRowsForHash(deps: IntakeDeps, digest: string): MasterlistRow[] {
  const dir = deps.ocrFixturesDir ?? DEFAULT_OCR_FIXTURES_DIR;
  const files = existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith('.ocr.json')) : [];
  for (const name of files) {
    const fixture = ocrFixtureSchema.parse(JSON.parse(readFileSync(resolve(dir, name), 'utf8')));
    if (fixture.sha256 === digest) return fixture.rows;
  }
  throw new ApiError(422, 'OCR_UNAVAILABLE', OCR_UNAVAILABLE_MESSAGE);
}

/** SDD §6.1: the extension picks the branch; the MIME type and the size limit then have to agree with it. */
function readMasterlistFile(deps: IntakeDeps, file: IntakeFile): { rows: MasterlistRow[]; source: Beneficiary['source'] } {
  const name = file.filename.toLowerCase();
  if (name.endsWith('.csv')) {
    if (file.mimetype !== 'text/csv') throw new ApiError(400, 'VALIDATION_ERROR', 'file: a .csv must be sent as text/csv');
    if (file.bytes.length > MAX_CSV_BYTES) throw new ApiError(400, 'VALIDATION_ERROR', 'file: a .csv must be at most 1 MB');
    try {
      return { rows: parseMasterlistCsv(file.bytes.toString('utf8')), source: 'csv' };
    } catch (error) {
      throw new ApiError(400, 'VALIDATION_ERROR', error instanceof Error ? error.message : 'file: invalid CSV');
    }
  }
  if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg')) {
    if (file.mimetype !== 'image/png' && file.mimetype !== 'image/jpeg') {
      throw new ApiError(400, 'VALIDATION_ERROR', 'file: an image must be sent as image/png or image/jpeg');
    }
    if (file.bytes.length > MAX_IMAGE_BYTES) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'file: an image must be at most 5 MB');
    }
    const digest = createHash('sha256').update(file.bytes).digest('hex');
    return { rows: ocrRowsForHash(deps, digest), source: 'ocr_precomputed' };
  }
  throw new ApiError(400, 'VALIDATION_ERROR', 'file: expected a .csv, .png, .jpg or .jpeg masterlist');
}

/**
 * §5.2 #6: parse, decide, persist, publish. The prior non-`enrolled` rows of the program are replaced (a re-upload
 * never orphans a card), the four seeded drivers keep `enrolled`, and one `agent_decisions` row records the run.
 */
export async function uploadMasterlist(deps: IntakeDeps, file: IntakeFile): Promise<IntakeResponse> {
  const program = getCurrentProgram(deps.db);
  if (program === null) throw new ApiError(404, 'NOT_FOUND', 'no program');
  const now = deps.now ?? Date.now;
  const { rows, source } = readMasterlistFile(deps, file);
  const records = rows.map(fileRecord);
  const decisions = decideIntake(records, {
    programStartDate: manilaDate(program.createdAt),
    lambdaLo: deps.calibration.lambdaLo,
    lambdaHi: deps.calibration.lambdaHi,
  });
  const uploadedAt = now();

  const { ids, summary, decisionId } = deps.db.transaction(() => {
    deps.db.prepare(`DELETE FROM beneficiaries WHERE program_id = ? AND status <> 'enrolled'`).run(program.id);
    const enrolled = new Map<string, BeneficiaryRow>();
    for (const row of deps.db.prepare('SELECT * FROM beneficiaries WHERE program_id = ?').all<BeneficiaryRow>(program.id)) {
      enrolled.set(identityKey(storedRecord(row)), row);
    }

    const insert = deps.db.prepare(
      `INSERT INTO beneficiaries
         (id, program_id, last_name, first_name, middle_name, suffix, birthdate, plate, toda, barangay,
          source, score, status, rule_code, decision_reason, link_code, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const update = deps.db.prepare(
      `UPDATE beneficiaries
          SET last_name = ?, first_name = ?, middle_name = ?, suffix = ?, birthdate = ?, plate = ?, toda = ?,
              barangay = ?, source = ?, score = ?, status = ?, rule_code = ?, decision_reason = ?
        WHERE id = ?`,
    );

    const ids: string[] = [];
    const summary: IntakeResponse['summary'] = { total: rows.length, approved: 0, rejected: 0, uncertain: 0, enrolled: 0 };
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i] as MasterlistRow;
      const decision = decisions[i] as IntakeDecision;
      const found = enrolled.get(identityKey(records[i] as MatchRecord));
      const status = found?.status === 'enrolled' ? 'enrolled' : decision.status;
      const middleName = row.middle_name === '' ? null : row.middle_name;
      const suffix = row.suffix === '' ? null : row.suffix;

      if (found !== undefined) {
        update.run(
          row.last_name,
          row.first_name,
          middleName,
          suffix,
          row.birthdate,
          row.plate,
          row.toda,
          row.barangay,
          source,
          decision.score,
          status,
          decision.ruleCode,
          decision.reason,
          found.id,
        );
        ids.push(found.id);
      } else {
        const id = `ben_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
        insert.run(
          id,
          program.id,
          row.last_name,
          row.first_name,
          middleName,
          suffix,
          row.birthdate,
          row.plate,
          row.toda,
          row.barangay,
          source,
          decision.score,
          status,
          decision.ruleCode,
          decision.reason,
          newLinkCode(),
          uploadedAt,
        );
        ids.push(id);
      }

      if (status === 'enrolled') summary.enrolled += 1;
      else if (status === 'approved') summary.approved += 1;
      else if (status === 'rejected') summary.rejected += 1;
      // `uncertain` and `evidence_requested` share the bucket: both are "one document away" (§5.2 #6).
      else summary.uncertain += 1;
    }

    const decisionId = `dec_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
    const decision = decisions.some((entry) => entry.status === 'rejected')
      ? 'REJECTED'
      : decisions.some((entry) => entry.status === 'uncertain')
        ? 'UNCERTAIN'
        : 'APPROVED';
    deps.db
      .prepare(
        `INSERT INTO agent_decisions (id, agent, decision, inputs_json, outputs_json, tx_ids_json, created_at)
         VALUES (?, 'intake', ?, ?, ?, '[]', ?)`,
      )
      .run(
        decisionId,
        decision,
        JSON.stringify({
          lambdaLo: deps.calibration.lambdaLo,
          lambdaHi: deps.calibration.lambdaHi,
          alpha: deps.calibration.alpha,
          beta: deps.calibration.beta,
          n: deps.calibration.n,
        }),
        JSON.stringify({ ...summary, source }),
        uploadedAt,
      );
    return { ids, summary, decisionId };
  });

  // SDD §6.1 step 5: an uncertain row with a linked chat gets the evidence request; without the notifier it stays
  // `uncertain` and the officer hands over the deep link instead.
  if (deps.notifier !== undefined) {
    for (const id of ids) {
      const row = deps.db.prepare('SELECT * FROM beneficiaries WHERE id = ?').get<BeneficiaryRow>(id);
      if (row === undefined || row.status !== 'uncertain' || row.telegram_chat_id === null) continue;
      try {
        await deps.notifier.sendEvidenceRequest(toBeneficiary(row, { botUsername: deps.config.TELEGRAM_BOT_USERNAME }));
        deps.db.prepare(`UPDATE beneficiaries SET status = 'evidence_requested' WHERE id = ?`).run(id);
      } catch {
        // §5.2 #9: a send failure is not an error; the row keeps its `telegramDeepLink`.
      }
    }
  }

  const responseRows = ids
    .map((id) => deps.db.prepare('SELECT * FROM beneficiaries WHERE id = ?').get<BeneficiaryRow>(id))
    .filter((row): row is BeneficiaryRow => row !== undefined)
    .map((row) => toBeneficiary(row, { botUsername: deps.config.TELEGRAM_BOT_USERNAME }));

  const decisionRow = deps.db
    .prepare('SELECT * FROM agent_decisions WHERE id = ?')
    .get<Parameters<typeof toAgentDecision>[0]>(decisionId);
  if (decisionRow !== undefined) deps.bus.publish('intake', toAgentDecision(decisionRow));

  return { rows: responseRows, summary, calibration: deps.calibration };
}
