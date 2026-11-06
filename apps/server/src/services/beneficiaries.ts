// `beneficiaries` rows -> `Beneficiary` response shapes (docs/api-and-data.md §3, §5.2 #8-#9). `telegram_chat_id` never
// leaves this module; the officer sees `telegramLinked` and a server-composed deep link instead.
import { randomBytes, randomUUID } from 'node:crypto';
import type { BeneficiariesQuery, Beneficiary, RequestEvidenceResponse } from '@tapat/shared';
import type { Config } from '../config';
import type { Db } from '../db/index';
import { ApiError } from '../errors';

export interface BeneficiaryRow {
  id: string;
  program_id: string;
  last_name: string;
  first_name: string;
  middle_name: string | null;
  suffix: string | null;
  birthdate: string;
  plate: string;
  toda: string;
  barangay: string;
  source: 'ocr_precomputed' | 'csv';
  score: number | null;
  status: Beneficiary['status'];
  rule_code: Beneficiary['ruleCode'];
  decision_reason: string | null;
  link_code: string | null;
  telegram_chat_id: string | null;
  created_at: number;
}

/** The Telegram sender the evidence flow needs; the Telegram unit injects the real one (SDD §6.10). */
export interface EvidenceNotifier {
  sendEvidenceRequest(beneficiary: Beneficiary): Promise<void>;
}

/** The deep link the UI renders; without a `link_code` it is the bot's plain address. */
export function telegramDeepLink(botUsername: string, linkCode: string | null): string {
  const base = `https://t.me/${botUsername}`;
  return linkCode === null ? base : `${base}?start=${linkCode}`;
}

export function toBeneficiary(row: BeneficiaryRow, deps: { botUsername: string }): Beneficiary {
  return {
    id: row.id,
    programId: row.program_id,
    lastName: row.last_name,
    firstName: row.first_name,
    middleName: row.middle_name,
    suffix: row.suffix,
    birthdate: row.birthdate,
    plate: row.plate,
    toda: row.toda,
    barangay: row.barangay,
    source: row.source,
    score: row.score,
    status: row.status,
    ruleCode: row.rule_code,
    decisionReason: row.decision_reason,
    linkCode: row.link_code,
    telegramLinked: row.telegram_chat_id !== null,
    telegramDeepLink: telegramDeepLink(deps.botUsername, row.link_code),
    createdAt: row.created_at,
  };
}

const LINK_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';

/** 8 lowercase base32 characters, the Telegram deep-link token (`beneficiaries.link_code`, SDD §6.1). */
export function newLinkCode(): string {
  return Array.from(randomBytes(8), (byte) => LINK_ALPHABET[byte % 32]).join('');
}

/** api-and-data.md §5.2 #8: newest first, optional repeatable `status` filter, `limit` already capped by the schema. */
export function listBeneficiaries(db: Db, query: BeneficiariesQuery, deps: { botUsername: string }): Beneficiary[] {
  const filter = query.status.length === 0 ? '' : ` WHERE status IN (${query.status.map(() => '?').join(', ')})`;
  const rows = db
    .prepare(`SELECT * FROM beneficiaries${filter} ORDER BY created_at DESC, rowid DESC LIMIT ?`)
    .all<BeneficiaryRow>(...query.status, query.limit);
  return rows.map((row) => toBeneficiary(row, deps));
}

export interface RequestEvidenceDeps {
  db: Db;
  config: Pick<Config, 'TELEGRAM_BOT_USERNAME'>;
  /** Absent until the Telegram bot lands: the response then carries the deep link and `telegramSent:false`. */
  notifier?: EvidenceNotifier;
  now?: () => number;
}

/**
 * api-and-data.md §5.2 #9: the evidence request and the one-tap appeal. `uncertain` and `rejected` (hard rules
 * included) may ask; `approved`, `enrolled` and `evidence_requested` are a 409. A send failure is not an error — the
 * state still moves, so the officer can hand over the deep link.
 */
export async function requestEvidence(deps: RequestEvidenceDeps, id: string): Promise<RequestEvidenceResponse> {
  const row = deps.db.prepare('SELECT * FROM beneficiaries WHERE id = ?').get<BeneficiaryRow>(id);
  if (row === undefined) throw new ApiError(404, 'NOT_FOUND', `beneficiary ${id} not found`);
  if (row.status !== 'uncertain' && row.status !== 'rejected') {
    throw new ApiError(
      409,
      'INVALID_STATE',
      `beneficiary ${id} is ${row.status}; evidence can be requested from uncertain or rejected`,
    );
  }

  const beneficiary = toBeneficiary({ ...row, status: 'evidence_requested' }, { botUsername: deps.config.TELEGRAM_BOT_USERNAME });
  let telegramSent = false;
  if (deps.notifier !== undefined && row.telegram_chat_id !== null) {
    try {
      await deps.notifier.sendEvidenceRequest(beneficiary);
      telegramSent = true;
    } catch {
      // §5.2 #9: the officer falls back to the deep link; the beneficiary still moves to `evidence_requested` below.
    }
  }

  const requestedAt = (deps.now ?? Date.now)();
  deps.db.transaction(() => {
    deps.db.prepare(`UPDATE beneficiaries SET status = 'evidence_requested' WHERE id = ?`).run(id);
    deps.db
      .prepare(
        `INSERT INTO agent_decisions (id, agent, decision, inputs_json, outputs_json, tx_ids_json, created_at)
         VALUES (?, 'intake', 'EVIDENCE_REQUESTED', ?, ?, '[]', ?)`,
      )
      .run(
        `dec_${randomUUID().replaceAll('-', '').slice(0, 8)}`,
        JSON.stringify(row.score === null ? {} : { score: row.score }),
        JSON.stringify({ beneficiaryId: id, telegramSent }),
        requestedAt,
      );
  });

  return { beneficiary, telegramSent, deepLink: beneficiary.telegramDeepLink };
}
