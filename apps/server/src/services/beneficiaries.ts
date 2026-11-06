// `beneficiaries` row -> `Beneficiary` response shape (docs/api-and-data.md §3). `telegram_chat_id` never leaves.
import { randomBytes } from 'node:crypto';
import type { Beneficiary } from '@tapat/shared';

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
