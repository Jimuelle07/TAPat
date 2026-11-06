// Enrollment service (docs/test-plan.md §2.2 `apps/server/src/services/enroll.test.ts`): mocked RPC, no network.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Keypair } from '@stellar/stellar-sdk';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { NoirOperation } from '@tapat/agent';
import { decryptSecret } from '@tapat/agent';
import type { Db } from '../db/index';
import { openDb } from '../db/index';
import { ApiError } from '../errors';
import type { ChainDeps } from './chain';
import { enrollCard, type CardRow, type EnrollDeps, type EnrollRequest } from './enroll';
import { createSseBus, type SseBus } from './sse';
import {
  BOT_USERNAME,
  KEY_ENCRYPTION_SECRET,
  T0,
  XLM_SAC_ID,
  fakeLog,
  fakeNoir,
  makeChainDeps,
  seedBeneficiary,
  seedProgram,
  unsignedXdr,
  type FakeNoir,
} from './test-fakes';

let db: Db;
let fixturesDir: string;
let fake: FakeNoir;
let chain: ChainDeps;
let bus: SseBus;
let deps: EnrollDeps;
let keypairCalls: number;
let agentKeypair: Keypair;
let programWallet: Keypair;

const D1_UID = '04A21F9C9C7E';

beforeEach(() => {
  db = openDb(':memory:');
  seedProgram(db);
  seedBeneficiary(db, { id: 'ben_D1' });
  fixturesDir = mkdtempSync(join(tmpdir(), 'tapat-enroll-'));
  writeFileSync(join(fixturesDir, 'd4-photo.json'), JSON.stringify({ plate: 'ABC 1234', toda: 'San Roque TODA' }));
  writeFileSync(join(fixturesDir, 'mismatch-photo.json'), JSON.stringify({ plate: 'ZZZ 9999', toda: 'Rotonda TODA' }));
  fake = fakeNoir();
  chain = makeChainDeps(db, fake.noir, fakeLog());
  bus = createSseBus();
  keypairCalls = 0;
  agentKeypair = Keypair.random();
  programWallet = Keypair.random();
  deps = {
    db,
    chain,
    bus,
    programWallet,
    config: { KEY_ENCRYPTION_SECRET, XLM_SAC_ID, TELEGRAM_BOT_USERNAME: BOT_USERNAME },
    fixturesDir,
    now: () => T0,
    keypair: () => {
      keypairCalls += 1;
      return { publicKey: agentKeypair.publicKey(), secret: agentKeypair.secret() };
    },
    fund: async () => undefined,
  };
});

afterEach(() => {
  db.close();
  rmSync(fixturesDir, { recursive: true, force: true });
});

function request(overrides: Partial<EnrollRequest> = {}): EnrollRequest {
  return { beneficiaryId: 'ben_D1', uid: D1_UID, samplePhoto: 'd4-photo.jpg', hasPhoto: false, ...overrides };
}

function cards(): CardRow[] {
  return db.prepare('SELECT * FROM cards').all<CardRow>();
}

interface ChainRow {
  id: string;
  kind: string;
  status: string;
  error_code: string | null;
  error: string | null;
}

function chainRows(): ChainRow[] {
  return db.prepare('SELECT id, kind, status, error_code, error FROM chain_txs ORDER BY rowid').all<ChainRow>();
}

describe('enrollCard', () => {
  it('enrolls a card: active card row, two succeeded chain txs, beneficiary enrolled, enroll + chain_tx events', async () => {
    const events: string[] = [];
    bus.subscribe((event) => events.push(event));

    const response = await enrollCard(deps, request());

    expect(response.card.status).toBe('active');
    expect(response.card.uidLast4).toBe('9C7E');
    expect(response.card.maxAmountStroops).toBe('500000000');
    expect(response.card.agentPublic).toBe(agentKeypair.publicKey());
    expect(response.deviceHashPrefix).toMatch(/^[0-9a-f]{8}$/);
    expect(response.photoCheck).toEqual({
      source: 'precomputed',
      plate: 'ABC 1234',
      toda: 'San Roque TODA',
      matched: true,
    });
    expect(response.chainTxIds).toHaveLength(2);
    expect(response.beneficiary.status).toBe('enrolled');
    expect(response.beneficiary.telegramDeepLink).toBe(`https://t.me/${BOT_USERNAME}?start=link_ben_D1`);
    expect(Object.keys(response.card)).not.toContain('deviceHash');
    expect(Object.keys(response.card)).not.toContain('agentSecretEnc');

    const rows = chainRows();
    expect(rows.map((row) => [row.kind, row.status])).toEqual([
      ['register', 'succeeded'],
      ['register_agent', 'succeeded'],
    ]);
    expect(cards()).toHaveLength(1);
    expect(cards()[0]?.status).toBe('active');
    // The agent secret is ciphertext at rest and decrypts to the same key.
    expect(cards()[0]?.agent_secret_enc).not.toContain(agentKeypair.secret());
    expect(events.filter((event) => event === 'chain_tx')).toHaveLength(2);
    expect(events.at(-1)).toBe('enroll');
  });

  it('rejects a second enroll of the same UID with 409 CARD_ALREADY_ENROLLED', async () => {
    await enrollCard(deps, request());
    await expect(enrollCard(deps, request())).rejects.toMatchObject({
      statusCode: 409,
      code: 'CARD_ALREADY_ENROLLED',
    });
    expect(cards()).toHaveLength(1);
    expect(keypairCalls).toBe(1);
  });

  it('resumes a failed card: same row, same keypair, only register_agent on the retry', async () => {
    fake.prepare.mockImplementation(async (source: string, op: NoirOperation) => {
      if (op.kind === 'registerAgent') throw new Error('rpc down');
      return unsignedXdr(source);
    });

    await expect(enrollCard(deps, request())).rejects.toMatchObject({ statusCode: 502, code: 'CHAIN_ERROR' });

    const failed = cards();
    expect(failed).toHaveLength(1);
    expect(failed[0]?.status).toBe('failed');
    expect(failed[0]?.error).toContain('rpc down');
    expect(chainRows().map((row) => [row.kind, row.status])).toEqual([
      ['register', 'succeeded'],
      ['register_agent', 'failed'],
    ]);

    // The register landed on chain, so the retry finds it and skips straight to register_agent.
    fake.prepare.mockImplementation(async (source: string) => unsignedXdr(source));
    fake.getDeviceOwner.mockResolvedValue(programWallet.publicKey());
    fake.getPolicy.mockResolvedValue(null);

    const response = await enrollCard(deps, request());

    expect(response.card.id).toBe(failed[0]?.id);
    expect(response.card.agentPublic).toBe(failed[0]?.agent_public);
    expect(response.chainTxIds).toHaveLength(1);
    expect(keypairCalls).toBe(1);
    expect(cards()).toHaveLength(1);
    expect(chainRows().map((row) => [row.kind, row.status])).toEqual([
      ['register', 'succeeded'],
      ['register_agent', 'failed'],
      ['register_agent', 'succeeded'],
    ]);
    expect(cards()[0]?.status).toBe('active');
  });

  it('answers 502 CHAIN_ERROR and stores no card when friendbot funding fails', async () => {
    const failing: EnrollDeps = {
      ...deps,
      fund: async () => {
        throw new Error('friendbot failed for G...: HTTP 500');
      },
    };
    await expect(enrollCard(failing, request())).rejects.toMatchObject({ statusCode: 502, code: 'CHAIN_ERROR' });
    expect(cards()).toHaveLength(0);
    expect(chainRows()).toHaveLength(0);
  });

  it('answers 422 PHOTO_MISMATCH naming the field when the precomputed plate differs', async () => {
    await expect(enrollCard(deps, request({ samplePhoto: 'mismatch-photo.jpg' }))).rejects.toMatchObject({
      statusCode: 422,
      code: 'PHOTO_MISMATCH',
      message: expect.stringContaining('plate') as string,
    });
    expect(cards()).toHaveLength(0);
    expect(fake.prepare).not.toHaveBeenCalled();
  });

  it('requires the officer confirmation for an uploaded photo, then labels the check officer_confirmed', async () => {
    await expect(
      enrollCard(deps, request({ samplePhoto: undefined, hasPhoto: true, officerConfirmed: false })),
    ).rejects.toMatchObject({ statusCode: 422, code: 'PHOTO_CONFIRMATION_REQUIRED' });

    const response = await enrollCard(
      deps,
      request({ samplePhoto: undefined, hasPhoto: true, officerConfirmed: true }),
    );
    expect(response.photoCheck).toEqual({ source: 'officer_confirmed', plate: null, toda: null, matched: true });
  });

  it('refuses an unapproved beneficiary with 409 INVALID_STATE', async () => {
    db.prepare(`UPDATE beneficiaries SET status = 'uncertain' WHERE id = 'ben_D1'`).run();
    await expect(enrollCard(deps, request())).rejects.toMatchObject({ statusCode: 409, code: 'INVALID_STATE' });
  });

  it('refuses an expired program policy with 409 INVALID_STATE', async () => {
    db.prepare('UPDATE program SET expires_at_s = ?').run(Math.floor(T0 / 1000) - 1);
    await expect(enrollCard(deps, request())).rejects.toMatchObject({
      statusCode: 409,
      code: 'INVALID_STATE',
      message: expect.stringContaining('expiry') as string,
    });
    expect(fake.prepare).not.toHaveBeenCalled();
  });

  it('reports a missing program as 404 NOT_FOUND', async () => {
    const empty = openDb(':memory:');
    const emptyDeps: EnrollDeps = { ...deps, db: empty, chain: makeChainDeps(empty, fake.noir) };
    await expect(enrollCard(emptyDeps, request())).rejects.toBeInstanceOf(ApiError);
    await expect(enrollCard(emptyDeps, request())).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
    empty.close();
  });

  it('stores the seed-only expiry and virtual flag for D3/D5', async () => {
    seedBeneficiary(db, { id: 'ben_D3', lastName: 'Bautista', firstName: 'Ramon' });
    await enrollCard(deps, {
      beneficiaryId: 'ben_D3',
      uid: '04A21F9C77B0',
      hasPhoto: true,
      officerConfirmed: true,
      expiresAtS: Math.floor(T0 / 1000) + 30,
      virtual: true,
    });
    const row = db.prepare(`SELECT * FROM cards WHERE beneficiary_id = 'ben_D3'`).get<CardRow>();
    expect(row?.expires_at_s).toBe(Math.floor(T0 / 1000) + 30);
    expect(row?.virtual).toBe(1);
  });

  it('keeps the stored secret usable: decryptSecret returns the generated agent secret', async () => {
    await enrollCard(deps, request());
    const row = cards()[0] as CardRow;
    expect(decryptSecret(row.agent_secret_enc, KEY_ENCRYPTION_SECRET)).toBe(agentKeypair.secret());
  });

  it('writes one intake/APPROVED decision with the two tx ids', async () => {
    const response = await enrollCard(deps, request());
    const decision = db
      .prepare(`SELECT * FROM agent_decisions WHERE agent = 'intake'`)
      .get<{ decision: string; tx_ids_json: string; outputs_json: string }>();
    expect(decision?.decision).toBe('APPROVED');
    expect(JSON.parse(decision?.tx_ids_json ?? '[]')).toEqual(response.chainTxIds);
    expect(JSON.parse(decision?.outputs_json ?? '{}')).toMatchObject({ cardId: response.card.id });
  });
});
