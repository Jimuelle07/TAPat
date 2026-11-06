// `telegramEvidenceNotifier`: the bridge between `request-evidence` (it hands over the `Beneficiary` response shape) and
// the bot (it needs the row, chat id included). The bot answers `false` instead of throwing, so this proves a failed
// send still reaches the officer as `telegramSent: false` and never blocks the state change.
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { Db } from '../db/index';
import { openDb } from '../db/index';
import { requestEvidence, telegramEvidenceNotifier } from './beneficiaries';
import { seedBeneficiary, seedProgram } from './test-fakes';
import type { TelegramService } from './telegram';

const BOT = 'tapat_demo_bot';

let db: Db;

beforeEach(() => {
  db = openDb(':memory:');
  seedProgram(db);
  seedBeneficiary(db, { id: 'ben_linked', firstName: 'Juan', status: 'rejected' });
  db.prepare(`UPDATE beneficiaries SET telegram_chat_id = '4242' WHERE id = 'ben_linked'`).run();
});

afterEach(() => {
  db.close();
});

/** The bot's one call, typed from the service that owns it, spied so the test can count it. */
type SendEvidenceRequest = TelegramService['sendEvidenceRequest'];
type FakeTelegram = Pick<TelegramService, 'sendEvidenceRequest'> & { sendEvidenceRequest: Mock<SendEvidenceRequest> };

/** `accepted` is what the bot resolves: `false` is "no linked chat or the send failed", never a throw. */
function fakeTelegram(accepted: boolean): FakeTelegram {
  return { sendEvidenceRequest: vi.fn<SendEvidenceRequest>(async () => accepted) };
}

function status(id: string): string | undefined {
  return db.prepare('SELECT status FROM beneficiaries WHERE id = ?').get<{ status: string }>(id)?.status;
}

describe('telegramEvidenceNotifier', () => {
  it('loads the row by id and reports telegramSent true when the bot accepted it', async () => {
    const telegram = fakeTelegram(true);
    const response = await requestEvidence(
      { db, config: { TELEGRAM_BOT_USERNAME: BOT }, notifier: telegramEvidenceNotifier(db, telegram) },
      'ben_linked',
    );

    expect(telegram.sendEvidenceRequest).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ben_linked', first_name: 'Juan', telegram_chat_id: '4242' }),
    );
    expect(response.telegramSent).toBe(true);
    expect(response.beneficiary.status).toBe('evidence_requested');
    expect(status('ben_linked')).toBe('evidence_requested');
  });

  it('reports telegramSent false, and still moves to evidence_requested, when the bot answered false', async () => {
    const telegram = fakeTelegram(false);
    const response = await requestEvidence(
      { db, config: { TELEGRAM_BOT_USERNAME: BOT }, notifier: telegramEvidenceNotifier(db, telegram) },
      'ben_linked',
    );

    expect(telegram.sendEvidenceRequest).toHaveBeenCalledTimes(1);
    expect(response.telegramSent).toBe(false);
    expect(response.beneficiary.status).toBe('evidence_requested');
    expect(status('ben_linked')).toBe('evidence_requested');
  });
});
