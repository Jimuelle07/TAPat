// Telegram bot (SDD §7, build-schedule TG1): long polling over plain `fetch` — no webhook, no public bot route.
// Linking (`/start <link_code>`), the receipt/decline text for a tap, the evidence request, and the OR/CR match.
// Nothing here may fail a tap: every network/JSON/DB error is logged (never the token) and swallowed.
import { createHash, randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TAP_REASON_LABELS,
  formatPhp,
  type AgentDecision,
  type TapReasonCode,
} from '@tapat/shared';
import type { Config } from '../config';
import type { Db } from '../db/index';
import type { BeneficiaryRow } from './beneficiaries';
import type { SseBus } from './sse';
import type { TapNotice } from './tap';

const API_BASE = 'https://api.telegram.org';
const DEFAULT_FIXTURES_DIR = fileURLToPath(new URL('../../../../fixtures/orcr', import.meta.url));
const CALL_TIMEOUT_MS = 5_000;
/** Long poll: Telegram holds `getUpdates` open, the abort must outlive that hold. */
const POLL_TIMEOUT_S = 25;

/** The logger surface this module needs; `app.log` satisfies it. The bot token never reaches it. */
export interface TelegramLog {
  warn(obj: object, msg: string): void;
}

const SILENT: TelegramLog = { warn: () => undefined };

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Everything one Bot API call needs. Kept separate so the evidence request is callable from a route alone. */
export interface TelegramSender {
  config: Pick<Config, 'TELEGRAM_BOT_TOKEN'>;
  fetch?: typeof fetch;
  log?: TelegramLog;
}

interface TelegramEnvelope<T> {
  ok?: boolean;
  result?: T;
  description?: string;
}

/** One Bot API call. Returns `result`, or `null` on any failure — including a failed `fetch`. */
async function telegramCall<T>(
  sender: TelegramSender,
  method: string,
  payload: object | undefined,
  timeoutMs: number,
): Promise<T | null> {
  const doFetch = sender.fetch ?? globalThis.fetch;
  const log = sender.log ?? SILENT;
  try {
    // The token is only ever inside this URL: never log the URL, only `method`.
    const response = await doFetch(`${API_BASE}/bot${sender.config.TELEGRAM_BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload ?? {}),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = (await response.json()) as TelegramEnvelope<T>;
    if (!response.ok || body.ok !== true) {
      log.warn({ method, status: response.status, description: body.description }, 'telegram call refused');
      return null;
    }
    return body.result ?? null;
  } catch (error) {
    log.warn({ method, cause: messageOf(error) }, 'telegram call failed');
    return null;
  }
}

export const EVIDENCE_VERIFIED_TEXT = 'Verified ✅ Pwede ka nang mag-enroll sa TODA.';
export const EVIDENCE_REVIEW_TEXT = 'Natanggap namin. Ire-review ng LGU officer.';
export const LINK_UNKNOWN_TEXT = 'No match for that link code — ask the TODA officer for your link.';

/** SDD §7, one row of the receipt table: `Paid ₱{amt} at {station}` / `Balance: ₱{bal}` / `Tx: …`. */
export function receiptText(input: {
  amountStroops: string;
  balanceStroops: string | null;
  stationName: string;
  txHash: string | null;
  phpPerXlm: number;
}): string {
  const amount = formatPhp(input.amountStroops, { phpPerXlm: input.phpPerXlm, withSymbol: false });
  const lines = [`TAPat ⛽ Paid ₱${amount} at ${input.stationName}`];
  // Without a readable escrow balance the receipt still goes out, just without the balance line.
  if (input.balanceStroops !== null) {
    lines.push(`Balance: ₱${formatPhp(input.balanceStroops, { phpPerXlm: input.phpPerXlm, withSymbol: false })}`);
  }
  if (input.txHash !== null) lines.push(`Tx: https://stellar.expert/explorer/testnet/tx/${input.txHash}`);
  return lines.join('\n');
}

/** `{reason}` is the dashboard label itself; the bot never composes its own wording (SDD §7). */
export function declineText(input: {
  amountStroops: string;
  stationName: string;
  reasonCode: TapReasonCode;
  phpPerXlm: number;
}): string {
  const amount = formatPhp(input.amountStroops, { phpPerXlm: input.phpPerXlm, withSymbol: false });
  return `TAPat ⛽ Declined ₱${amount} at ${input.stationName}: ${TAP_REASON_LABELS[input.reasonCode]}`;
}

export function evidenceRequestText(firstName: string): string {
  return `Hi ${firstName}! Para matapos ang verification mo sa TAPat fuel aid, i-send ang litrato ng OR/CR mo bilang FILE dito.`;
}

export function linkText(firstName: string): string {
  return `Kumusta, ${firstName}! Naka-link ka na sa TAPat fuel aid. Makakatanggap ka ng resibo dito sa bawat tap.`;
}

/**
 * The evidence request (`POST /api/beneficiaries/:id/request-evidence`, SDD §7). `true` when Telegram accepted it;
 * `false` when the beneficiary has no linked chat or the send failed — the route answers 200 with `telegramSent:false`
 * and the deep link instead, so a failure here is never an error.
 */
export async function sendEvidenceRequest(
  sender: TelegramSender,
  beneficiary: Pick<BeneficiaryRow, 'first_name' | 'telegram_chat_id'>,
): Promise<boolean> {
  if (beneficiary.telegram_chat_id === null) return false;
  const result = await telegramCall<{ message_id: number }>(
    sender,
    'sendMessage',
    { chat_id: beneficiary.telegram_chat_id, text: evidenceRequestText(beneficiary.first_name) },
    CALL_TIMEOUT_MS,
  );
  return result !== null;
}

interface TelegramFile {
  file_id: string;
  file_path?: string;
}

interface TelegramMessage {
  message_id: number;
  chat: { id: number };
  text?: string;
  document?: TelegramFile;
  photo?: TelegramFile[];
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

/** `fixtures/orcr/<plate>.json` (api-and-data.md §4): the digest plus the fields the photo carries. */
interface OrcrFixture {
  sha256: string;
  plate: string;
  toda?: string;
  name?: string;
}

export interface TelegramDeps {
  db: Db;
  config: Pick<Config, 'TELEGRAM_BOT_TOKEN' | 'TELEGRAM_BOT_USERNAME' | 'PHP_PER_XLM'>;
  /** SSE: every evidence decision is published as `intake` (§5.4). */
  bus?: SseBus;
  log?: TelegramLog;
  fetch?: typeof fetch;
  now?: () => number;
  /** Directory holding the precomputed OR/CR records; tests point it at a temp dir. */
  fixturesDir?: string;
  pollTimeoutS?: number;
  /** Pause between polls; the long poll itself does the waiting. */
  pollIntervalMs?: number;
  id?: () => string;
}

export interface TelegramService {
  /** Receipt for an authorized tap, decline text for a rejected or refused one; a no-op without a linked chat. */
  notifyTap(notice: TapNotice): Promise<void>;
  /** SDD §7 evidence request; `false` when there is no linked chat or the send failed. */
  sendEvidenceRequest(beneficiary: BeneficiaryRow): Promise<boolean>;
  /** One `getUpdates` round (the testable step of the loop); `null` when the Bot API call itself failed. */
  pollOnce(): Promise<number | null>;
  /** Starts the loop and returns its stop function, like every other background loop in this server. */
  start(): () => void;
}

export function createTelegramService(deps: TelegramDeps): TelegramService {
  const log = deps.log ?? SILENT;
  const now = deps.now ?? Date.now;
  const newId = deps.id ?? ((): string => `dec_${randomUUID().replaceAll('-', '').slice(0, 8)}`);
  const sender: TelegramSender = { config: deps.config, fetch: deps.fetch, log };
  const fixturesDir = deps.fixturesDir ?? DEFAULT_FIXTURES_DIR;
  const pollTimeoutS = deps.pollTimeoutS ?? POLL_TIMEOUT_S;
  const pollIntervalMs = deps.pollIntervalMs ?? 1_000;

  let offset = 0;
  let timer: NodeJS.Timeout | null = null;
  let stopped = false;
  let inFlight = false;

  /** The linked chat of the beneficiary that owns this card; `null` when the card has none. */
  function chatForCard(cardId: string): string | null {
    const row = deps.db
      .prepare(
        `SELECT b.telegram_chat_id AS chat FROM cards c
           JOIN beneficiaries b ON b.id = c.beneficiary_id
         WHERE c.id = ?`,
      )
      .get<{ chat: string | null }>(cardId);
    return row?.chat ?? null;
  }

  async function sendMessage(chatId: string, text: string): Promise<boolean> {
    const result = await telegramCall<{ message_id: number }>(
      sender,
      'sendMessage',
      { chat_id: chatId, text },
      CALL_TIMEOUT_MS,
    );
    return result !== null;
  }

  function recordDecision(
    beneficiary: BeneficiaryRow,
    decision: 'EVIDENCE_VERIFIED' | 'EVIDENCE_UNMATCHED',
    output: { sha256: string; matched: boolean; plate: string | null },
  ): void {
    const row: AgentDecision = {
      id: newId(),
      agent: 'intake',
      decision,
      // inputs are numbers only (§6.0): 1 when the digest matched a fixture and the plate agreed.
      inputs: { plateMatch: output.matched ? 1 : 0 },
      outputs: { sha256: output.sha256, matched: output.matched, plate: output.plate },
      txIds: [],
      createdAt: now(),
    };
    deps.db
      .prepare(
        `INSERT INTO agent_decisions
           (id, agent, decision, inputs_json, outputs_json, tx_ids_json, created_at)
         VALUES (?, 'intake', ?, ?, ?, '[]', ?)`,
      )
      .run(row.id, row.decision, JSON.stringify(row.inputs), JSON.stringify(row.outputs), row.createdAt);
    deps.bus?.publish('intake', row);
  }

  /** `/start <link_code>` (SDD §7): binds the chat to the beneficiary; an unknown code gets the short reply. */
  async function handleStart(chatId: string, code: string | null): Promise<void> {
    if (code === null) {
      await sendMessage(chatId, LINK_UNKNOWN_TEXT);
      return;
    }
    const beneficiary = deps.db
      .prepare('SELECT * FROM beneficiaries WHERE link_code = ?')
      .get<BeneficiaryRow>(code);
    if (beneficiary === undefined) {
      await sendMessage(chatId, LINK_UNKNOWN_TEXT);
      return;
    }
    // A link code that already went to another chat must never be re-bound: a leaked code would steal the receipts.
    // The reply is the same refusal as an unknown code, so the sender learns nothing about the record.
    if (beneficiary.telegram_chat_id !== null && beneficiary.telegram_chat_id !== chatId) {
      log.warn({ beneficiaryId: beneficiary.id }, 'link code already bound to another chat');
      await sendMessage(chatId, LINK_UNKNOWN_TEXT);
      return;
    }
    deps.db
      .prepare('UPDATE beneficiaries SET telegram_chat_id = ? WHERE id = ?')
      .run(chatId, beneficiary.id);
    await sendMessage(chatId, linkText(beneficiary.first_name));
    // The officer may have pressed Request evidence before the driver opened the link; the one request goes out on the first bind only.
    if (beneficiary.telegram_chat_id === null && beneficiary.status === 'evidence_requested') {
      await sendMessage(chatId, evidenceRequestText(beneficiary.first_name));
    }
  }

  function readOrcrFixtures(): OrcrFixture[] {
    let names: string[];
    try {
      names = readdirSync(fixturesDir).filter((name) => name.endsWith('.json'));
    } catch (error) {
      // No fixtures yet (FIX3) means no match, which is the documented "review by the LGU officer" path.
      log.warn({ cause: messageOf(error) }, 'OR/CR fixture directory unreadable');
      return [];
    }
    const fixtures: OrcrFixture[] = [];
    for (const name of names) {
      try {
        const parsed = JSON.parse(readFileSync(resolve(fixturesDir, name), 'utf8')) as Partial<OrcrFixture>;
        if (typeof parsed.sha256 === 'string' && typeof parsed.plate === 'string') {
          fixtures.push({ sha256: parsed.sha256.toLowerCase(), plate: parsed.plate, toda: parsed.toda, name: parsed.name });
        }
      } catch (error) {
        log.warn({ file: name, cause: messageOf(error) }, 'OR/CR fixture unreadable');
      }
    }
    return fixtures;
  }

  /** `getFile` then the file download; both URLs carry the token, so neither outcome is logged with them. */
  async function downloadFile(fileId: string): Promise<Buffer | null> {
    const file = await telegramCall<TelegramFile>(sender, 'getFile', { file_id: fileId }, CALL_TIMEOUT_MS);
    if (file === null || file.file_path === undefined) return null;
    const doFetch = sender.fetch ?? globalThis.fetch;
    try {
      const response = await doFetch(
        `${API_BASE}/file/bot${deps.config.TELEGRAM_BOT_TOKEN}/${file.file_path}`,
        { signal: AbortSignal.timeout(CALL_TIMEOUT_MS) },
      );
      if (!response.ok) {
        log.warn({ status: response.status }, 'telegram file download refused');
        return null;
      }
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      log.warn({ cause: messageOf(error) }, 'telegram file download failed');
      return null;
    }
  }

  /** SDD §7 evidence handling: digest -> fixture lookup -> plate check. The image itself is never stored. */
  async function handleEvidence(chatId: string, fileId: string): Promise<void> {
    const beneficiary = deps.db
      .prepare(
        `SELECT * FROM beneficiaries WHERE telegram_chat_id = ? AND status = 'evidence_requested'
         ORDER BY created_at DESC LIMIT 1`,
      )
      .get<BeneficiaryRow>(chatId);
    // A document from any other chat is not evidence for anyone: ignore it, reply nothing.
    if (beneficiary === undefined) return;

    const bytes = await downloadFile(fileId);
    if (bytes === null) {
      await sendMessage(chatId, EVIDENCE_REVIEW_TEXT);
      recordDecision(beneficiary, 'EVIDENCE_UNMATCHED', { sha256: '', matched: false, plate: null });
      return;
    }
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const match = readOrcrFixtures().find((fixture) => fixture.sha256 === sha256) ?? null;
    // SDD §7 step 2: the digest matched a fixture and the plate agrees (uppercase, spaces and dashes removed).
    const plateMatch =
      match !== null &&
      match.plate.toUpperCase().replace(/[\s-]/g, '') === beneficiary.plate.toUpperCase().replace(/[\s-]/g, '');

    if (plateMatch && match !== null) {
      deps.db.prepare(`UPDATE beneficiaries SET status = 'approved' WHERE id = ?`).run(beneficiary.id);
      recordDecision(beneficiary, 'EVIDENCE_VERIFIED', { sha256, matched: true, plate: match.plate });
      await sendMessage(chatId, EVIDENCE_VERIFIED_TEXT);
      return;
    }
    recordDecision(beneficiary, 'EVIDENCE_UNMATCHED', { sha256, matched: false, plate: match?.plate ?? null });
    await sendMessage(chatId, EVIDENCE_REVIEW_TEXT);
  }

  async function handleMessage(message: TelegramMessage): Promise<void> {
    const chatId = String(message.chat.id);
    if (message.text !== undefined) {
      const started = /^\/start(?:@[A-Za-z0-9_]+)?(?:\s+(\S+))?/.exec(message.text);
      if (started !== null) {
        await handleStart(chatId, started[1] ?? null);
        return;
      }
    }
    // A document is the requested form; a photo is accepted too (the digest of whatever Telegram delivered).
    const document = message.document ?? message.photo?.at(-1);
    if (document !== undefined) await handleEvidence(chatId, document.file_id);
  }

  async function pollOnce(): Promise<number | null> {
    if (inFlight) return 0;
    inFlight = true;
    try {
      const updates = await telegramCall<TelegramUpdate[]>(
        sender,
        'getUpdates',
        { offset, timeout: pollTimeoutS, allowed_updates: ['message'] },
        (pollTimeoutS + 10) * 1_000,
      );
      if (updates === null) return null;
      let handled = 0;
      for (const update of updates) {
        offset = update.update_id + 1;
        handled += 1;
        if (update.message === undefined) continue;
        try {
          await handleMessage(update.message);
        } catch (error) {
          // One bad update must not stop the poller (and must not answer with a 5xx retry loop either).
          log.warn({ updateId: update.update_id, cause: messageOf(error) }, 'telegram update failed');
        }
      }
      return handled;
    } finally {
      inFlight = false;
    }
  }

  async function notifyTap(notice: TapNotice): Promise<void> {
    if (notice.cardId === null) return;
    const chatId = chatForCard(notice.cardId);
    if (chatId === null) return;
    if (notice.status === 'authorized') {
      await sendMessage(
        chatId,
        receiptText({
          amountStroops: notice.amountStroops,
          balanceStroops: notice.balanceStroops,
          stationName: notice.stationName,
          txHash: notice.txHash,
          phpPerXlm: deps.config.PHP_PER_XLM,
        }),
      );
      return;
    }
    if (notice.reasonCode === null) return;
    await sendMessage(
      chatId,
      declineText({
        amountStroops: notice.amountStroops,
        stationName: notice.stationName,
        reasonCode: notice.reasonCode,
        phpPerXlm: deps.config.PHP_PER_XLM,
      }),
    );
  }

  function start(): () => void {
    stopped = false;
    const schedule = (): void => {
      if (stopped) return;
      void (async () => {
        let handled: number | null = null;
        try {
          handled = await pollOnce();
        } catch (error) {
          log.warn({ cause: messageOf(error) }, 'telegram poll failed');
        }
        if (stopped) return;
        // A failing Bot API (offline laptop) is retried every 5 s instead of every second, so the log stays readable.
        timer = setTimeout(schedule, handled === null ? Math.min(pollIntervalMs * 5, 30_000) : pollIntervalMs);
      })();
    };
    schedule();
    return () => {
      stopped = true;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };
  }

  return {
    notifyTap,
    sendEvidenceRequest: (beneficiary) => sendEvidenceRequest(sender, beneficiary),
    pollOnce,
    start,
  };
}
