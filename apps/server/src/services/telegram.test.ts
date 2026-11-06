// Telegram bot (build-schedule TG1, SDD §7): a fake fetch stands in for the Bot API. No network, no real bot.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { Keypair } from '@stellar/stellar-sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NoirContractError, encryptSecret, type NoirOperation } from '@tapat/agent';
import type { Db } from '../db/index';
import { openDb } from '../db/index';
import type { BeneficiaryRow } from './beneficiaries';
import type { ChainDeps } from './chain';
import { createSseBus, type SseBus } from './sse';
import { recordTap, type TapDeps } from './tap';
import {
  EVIDENCE_REVIEW_TEXT,
  EVIDENCE_VERIFIED_TEXT,
  LINK_UNKNOWN_TEXT,
  createTelegramService,
  linkText,
  sendEvidenceRequest,
  type TelegramLog,
  type TelegramService,
} from './telegram';
import {
  BOT_USERNAME,
  KEY_ENCRYPTION_SECRET,
  T0,
  XLM_SAC_ID,
  fakeLog,
  fakeNoir,
  makeChainDeps,
  seedBeneficiary,
  seedCard,
  seedProgram,
  seedStation,
  unsignedXdr,
  type FakeNoir,
} from './test-fakes';

const BOT_TOKEN = '123456:test-token';
const CHAT_ID = '55501';
const D1_UID = '04A21F9C9C7E';
const DOCUMENT_BYTES = Buffer.from('orcr-image-bytes');
const DOCUMENT_SHA256 = createHash('sha256').update(DOCUMENT_BYTES).digest('hex');

interface TelegramCall {
  method: string;
  body: Record<string, unknown>;
}

interface FakeTelegram {
  fetch: typeof fetch;
  calls: TelegramCall[];
  sent: Array<{ chatId: string; text: string }>;
  updates: { current: unknown[] };
  down: { current: boolean };
  fixtureBytes: { current: Buffer };
}

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

/** A Bot API stand-in: records every call, answers `sendMessage`/`getUpdates`/`getFile`/file download. */
function fakeTelegram(): FakeTelegram {
  const calls: TelegramCall[] = [];
  const sent: Array<{ chatId: string; text: string }> = [];
  const updates = { current: [] as unknown[] };
  const down = { current: false };
  const fixtureBytes = { current: DOCUMENT_BYTES };
  const prefix = `https://api.telegram.org/bot${BOT_TOKEN}/`;

  const impl = vi.fn(async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    if (down.current) throw new Error('network down');
    const url = String(input);
    // The file download lives under /file/bot<token>/… — not under /bot<token>/… like the API methods.
    if (url.startsWith('https://api.telegram.org/file/bot')) {
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => Uint8Array.from(fixtureBytes.current).buffer as ArrayBuffer,
      } as unknown as Response;
    }
    const method = url.slice(prefix.length);
    const body = init?.body === undefined ? {} : (JSON.parse(String(init.body)) as Record<string, unknown>);
    calls.push({ method, body });
    if (method === 'sendMessage') {
      sent.push({ chatId: String(body.chat_id), text: String(body.text) });
      return jsonResponse({ ok: true, result: { message_id: sent.length } });
    }
    if (method === 'getUpdates') return jsonResponse({ ok: true, result: updates.current });
    if (method === 'getFile') return jsonResponse({ ok: true, result: { file_id: 'file-1', file_path: 'documents/doc.jpg' } });
    // The URL carries the token: never put it in a message that could reach a log.
    throw new Error(`unexpected telegram call ${method}`);
  });

  return { fetch: impl as unknown as typeof fetch, calls, sent, updates, down, fixtureBytes };
}

interface CollectedLog extends TelegramLog {
  entries: string[];
}

function collectedLog(): CollectedLog {
  const entries: string[] = [];
  return {
    entries,
    warn: (obj: object, msg: string) => entries.push(`${msg} ${JSON.stringify(obj)}`),
  };
}

let db: Db;
let fake: FakeNoir;
let chain: ChainDeps;
let bus: SseBus;
let telegram: FakeTelegram;
let log: CollectedLog;
let service: TelegramService;
let tapDeps: TapDeps;
let fixturesDir: string;

function setChat(beneficiaryId: string, chatId: string | null): void {
  db.prepare('UPDATE beneficiaries SET telegram_chat_id = ? WHERE id = ?').run(chatId, beneficiaryId);
}

function chatOf(beneficiaryId: string): string | null {
  return (
    db.prepare('SELECT telegram_chat_id AS chat FROM beneficiaries WHERE id = ?').get<{ chat: string | null }>(beneficiaryId)
      ?.chat ?? null
  );
}

function beneficiaryStatus(beneficiaryId: string): string {
  return (
    db.prepare('SELECT status FROM beneficiaries WHERE id = ?').get<{ status: string }>(beneficiaryId)?.status ?? ''
  );
}

interface DecisionRow {
  decision: string;
  outputs_json: string;
}

function decisions(): DecisionRow[] {
  return db
    .prepare(`SELECT decision, outputs_json FROM agent_decisions WHERE agent = 'intake' ORDER BY rowid`)
    .all<DecisionRow>();
}

/** The Telegram service over this database; `fetch`, the fixtures directory and the log are all injected. */
function buildService(overrides: { fixturesDir?: string } = {}): TelegramService {
  return createTelegramService({
    db,
    config: { TELEGRAM_BOT_TOKEN: BOT_TOKEN, TELEGRAM_BOT_USERNAME: BOT_USERNAME, PHP_PER_XLM: 10 },
    bus,
    fetch: telegram.fetch,
    now: () => T0,
    log,
    ...(overrides.fixturesDir === undefined ? {} : { fixturesDir: overrides.fixturesDir }),
  });
}

beforeEach(async () => {
  db = openDb(':memory:');
  seedProgram(db);
  seedBeneficiary(db, { id: 'ben_D1' });
  seedBeneficiary(db, { id: 'ben_07', firstName: 'Maria Teresa', lastName: 'Santos', plate: 'XYZ 7788' });
  seedStation(db, { id: 'A', name: 'Petron San Roque' });
  seedStation(db, { id: 'B', name: 'Rotonda Fuels' });
  const cardAgent = Keypair.random();
  await seedCard(db, {
    id: 'card_D1',
    beneficiaryId: 'ben_D1',
    uid: D1_UID,
    agent: cardAgent,
    secretEnc: encryptSecret(cardAgent.secret(), KEY_ENCRYPTION_SECRET),
  });
  fake = fakeNoir();
  chain = makeChainDeps(db, fake.noir, fakeLog());
  bus = createSseBus();
  telegram = fakeTelegram();
  log = collectedLog();
  service = buildService();
  tapDeps = {
    db,
    chain,
    bus,
    config: { KEY_ENCRYPTION_SECRET, XLM_SAC_ID, PHP_PER_XLM: 10 },
    notify: (notice) => service.notifyTap(notice),
    now: () => T0,
  };
  fixturesDir = mkdtempSync(join(tmpdir(), 'tapat-orcr-'));
});

afterEach(() => {
  db.close();
  rmSync(fixturesDir, { recursive: true, force: true });
});

/** The `authorize` simulation is refused by the contract, exactly as the SDK reports it. */
function refuseAuthorize(code: number, errorName: string): void {
  fake.prepare.mockImplementation(async (source: string, op: NoirOperation) => {
    if (op.kind === 'authorize') throw new NoirContractError('paymentEscrow', code, errorName, 'authorize');
    return unsignedXdr(source);
  });
}

describe('createTelegramService', () => {
  it('links the chat on /start <link_code> and acknowledges the update with its offset', async () => {
    telegram.updates.current = [
      { update_id: 41, message: { message_id: 1, chat: { id: Number(CHAT_ID) }, text: '/start link_ben_D1' } },
    ];

    await expect(service.pollOnce()).resolves.toBe(1);

    expect(chatOf('ben_D1')).toBe(CHAT_ID);
    expect(telegram.sent).toEqual([{ chatId: CHAT_ID, text: linkText('Juan') }]);

    // The next poll acknowledges update 41 so Telegram never redelivers it.
    await service.pollOnce();
    const polls = telegram.calls.filter((call) => call.method === 'getUpdates');
    expect(polls.map((call) => call.body.offset)).toEqual([0, 42]);
  });

  it('answers an unknown link code with the short reply and binds nothing', async () => {
    telegram.updates.current = [
      { update_id: 7, message: { message_id: 1, chat: { id: Number(CHAT_ID) }, text: '/start nope1234' } },
    ];

    await service.pollOnce();

    expect(chatOf('ben_D1')).toBeNull();
    expect(telegram.sent).toEqual([{ chatId: CHAT_ID, text: LINK_UNKNOWN_TEXT }]);
  });

  it('sends the receipt to a linked beneficiary after an authorized tap', async () => {
    setChat('ben_D1', CHAT_ID);
    fake.getEscrowBalance.mockResolvedValue(1_150_000_000n);

    const response = await recordTap(tapDeps, { stationId: 'A', amountPhp: 350, uid: D1_UID });

    expect(response.tap.status).toBe('authorized');
    expect(telegram.sent).toHaveLength(1);
    const [paid, balance, tx] = (telegram.sent[0]?.text ?? '').split('\n');
    expect(paid).toBe('TAPat ⛽ Paid ₱350.00 at Petron San Roque');
    expect(balance).toBe('Balance: ₱1,150.00');
    expect(tx).toBe('Tx: https://stellar.expert/explorer/testnet/tx/direct_inner_hash');
  });

  it('sends nothing when the beneficiary has no linked chat', async () => {
    fake.getEscrowBalance.mockResolvedValue(1_150_000_000n);

    await recordTap(tapDeps, { stationId: 'A', amountPhp: 350, uid: D1_UID });

    expect(telegram.sent).toEqual([]);
  });

  it('sends the decline text with the shared reason label on a rejected tap', async () => {
    setChat('ben_D1', CHAT_ID);
    refuseAuthorize(3, 'AgentNotAuthorized');
    fake.checkPayment.mockResolvedValue({ ok: false, reason: 'over_limit' });

    const response = await recordTap(tapDeps, { stationId: 'A', amountPhp: 800, uid: D1_UID });

    expect(response.tap.reasonCode).toBe('OVER_CAP');
    expect(telegram.sent).toEqual([
      { chatId: CHAT_ID, text: 'TAPat ⛽ Declined ₱800.00 at Petron San Roque: over the ₱500.00 per-tap cap' },
    ]);
  });

  it('never fails a tap when the Bot API is unreachable, and never logs the token', async () => {
    setChat('ben_D1', CHAT_ID);
    fake.getEscrowBalance.mockResolvedValue(1_150_000_000n);
    telegram.down.current = true;

    const response = await recordTap(tapDeps, { stationId: 'A', amountPhp: 350, uid: D1_UID });

    expect(response.tap.status).toBe('authorized');
    expect(telegram.sent).toEqual([]);
    expect(log.entries.length).toBeGreaterThan(0);
    expect(log.entries.filter((entry) => entry.includes(BOT_TOKEN))).toEqual([]);
  });

  it('requests the OR/CR as a file only when the beneficiary is linked', async () => {
    const unlinked = db.prepare('SELECT * FROM beneficiaries WHERE id = ?').get<BeneficiaryRow>('ben_07');
    if (unlinked === undefined) throw new Error('ben_07 was not seeded');
    expect(unlinked.telegram_chat_id).toBeNull();
    expect(await service.sendEvidenceRequest(unlinked)).toBe(false);

    expect(await service.sendEvidenceRequest({ ...unlinked, telegram_chat_id: CHAT_ID })).toBe(true);
    expect(telegram.sent).toEqual([
      {
        chatId: CHAT_ID,
        text: 'Hi Maria Teresa! Para matapos ang verification mo sa TAPat fuel aid, i-send ang litrato ng OR/CR mo bilang FILE dito.',
      },
    ]);
  });

  it('verifies an OR/CR document whose digest and plate match, and stores only the digest', async () => {
    db.prepare(`UPDATE beneficiaries SET status = 'evidence_requested' WHERE id = 'ben_D1'`).run();
    setChat('ben_D1', CHAT_ID);
    writeFileSync(
      join(fixturesDir, 'abc1234.json'),
      JSON.stringify({ plate: 'ABC-1234', toda: 'San Roque TODA', name: 'Juan Dela Cruz', sha256: DOCUMENT_SHA256 }),
    );

    const withFixtures = buildService({ fixturesDir });
    telegram.updates.current = [
      {
        update_id: 90,
        message: { message_id: 2, chat: { id: Number(CHAT_ID) }, document: { file_id: 'file-1' } },
      },
    ];

    await withFixtures.pollOnce();

    expect(beneficiaryStatus('ben_D1')).toBe('approved');
    expect(decisions()).toEqual([
      {
        decision: 'EVIDENCE_VERIFIED',
        outputs_json: JSON.stringify({ sha256: DOCUMENT_SHA256, matched: true, plate: 'ABC-1234' }),
      },
    ]);
    expect(telegram.sent).toEqual([{ chatId: CHAT_ID, text: EVIDENCE_VERIFIED_TEXT }]);
  });

  it('answers a non-matching document with the LGU review text and leaves the status alone', async () => {
    db.prepare(`UPDATE beneficiaries SET status = 'evidence_requested' WHERE id = 'ben_07'`).run();
    setChat('ben_07', CHAT_ID);
    writeFileSync(
      join(fixturesDir, 'abc1234.json'),
      JSON.stringify({ plate: 'ABC1234', toda: 'San Roque TODA', sha256: DOCUMENT_SHA256 }),
    );

    const withFixtures = buildService({ fixturesDir });
    telegram.updates.current = [
      {
        update_id: 91,
        message: { message_id: 3, chat: { id: Number(CHAT_ID) }, document: { file_id: 'file-1' } },
      },
    ];

    await withFixtures.pollOnce();

    expect(beneficiaryStatus('ben_07')).toBe('evidence_requested');
    expect(decisions()[0]?.decision).toBe('EVIDENCE_UNMATCHED');
    expect(telegram.sent).toEqual([{ chatId: CHAT_ID, text: EVIDENCE_REVIEW_TEXT }]);
  });

  it('ignores a document from a chat that is not awaiting evidence', async () => {
    setChat('ben_D1', CHAT_ID);
    telegram.updates.current = [
      {
        update_id: 92,
        message: { message_id: 4, chat: { id: Number(CHAT_ID) }, document: { file_id: 'file-1' } },
      },
    ];

    await service.pollOnce();

    expect(decisions()).toEqual([]);
    expect(telegram.sent).toEqual([]);
    expect(telegram.calls.map((call) => call.method)).toEqual(['getUpdates']);
  });

  it('stops polling when the loop stop function is called', async () => {
    vi.useFakeTimers();
    try {
      const stop = service.start();
      stop();
      await vi.advanceTimersByTimeAsync(10_000);
      // The stop function cancels the pending timer: no further poll is scheduled.
      expect(telegram.calls.filter((call) => call.method === 'getUpdates').length).toBeLessThanOrEqual(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('is callable standalone (the S7 request-evidence route owns its own sending)', async () => {
    const ok = await sendEvidenceRequest(
      { config: { TELEGRAM_BOT_TOKEN: BOT_TOKEN }, fetch: telegram.fetch, log },
      { first_name: 'Juan', telegram_chat_id: CHAT_ID },
    );
    expect(ok).toBe(true);
    expect(telegram.sent).toHaveLength(1);
  });
});
