// Test-only chain fakes (no network), shaped like `chain.test.ts`: an in-memory DB, a fake Noir client whose
// `prepare()` hands back a signable XDR, and `GAS_MODE=direct` so `runChainTx` needs no Gas Station.
import { Account, Keypair, Operation, TransactionBuilder } from '@stellar/stellar-sdk';
import { vi } from 'vitest';
import type { NoirAgentClient, NoirOperation } from '@tapat/agent';
import { deviceHash, type Program } from '@tapat/shared';
import type { Db } from '../db/index';
import { createProgram } from './program';
import type { ChainDeps, ChainLog } from './chain';

export const PASSPHRASE = 'Test SDF Network ; September 2015';
export const DEVICE_REGISTRY_ID = 'CAC4KOLHDLDYDWBOKXNKRN5KVHO56PLOIFXDLTBUWGVN6GVDEB7FQHU5';
export const AGENT_REGISTRY_ID = 'CCMZDSPTLX7IIJWCYEUM5DJUHOSOYSTHGK777S2TXZWEMC5ZZGPJ3EBV';
export const PAYMENT_ESCROW_ID = 'CC7EAW5FNJEDBS7THM5IT6XIOHO4AOYMLXT3KSZ3HWUIKEACTW7E5BFS';
export const XLM_SAC_ID = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
export const KEY_ENCRYPTION_SECRET = '11'.repeat(32);
export const BOT_USERNAME = 'tapat_demo_bot';
export const SALT = 'ab'.repeat(16);
export const T0 = 1_763_000_000_000;

/** `++` on every call, and the fake's argument tuple stays typed. */
export function fakeLog(): ChainLog {
  return { warn: vi.fn(), error: vi.fn() };
}

/** An unsigned XDR the caller can sign; `source` is the account the contract checked `require_auth` on. */
export function unsignedXdr(source: string): string {
  return new TransactionBuilder(new Account(source, '1'), { fee: '100', networkPassphrase: PASSPHRASE })
    .addOperation(Operation.bumpSequence({ bumpTo: '2' }))
    .setTimeout(30)
    .build()
    .toXDR();
}

export interface FakeNoir {
  noir: NoirAgentClient;
  prepare: ReturnType<typeof vi.fn>;
  submit: ReturnType<typeof vi.fn>;
  getDeviceOwner: ReturnType<typeof vi.fn>;
  getPolicy: ReturnType<typeof vi.fn>;
  checkPayment: ReturnType<typeof vi.fn>;
  getEscrowBalance: ReturnType<typeof vi.fn>;
}

/** A Noir client whose writes succeed with `direct_inner_hash` and whose reads answer `null`/`0` by default. */
export function fakeNoir(): FakeNoir {
  const prepare = vi.fn(async (source: string, _op: NoirOperation) => unsignedXdr(source));
  const submit = vi.fn(async (_xdr: string, _op?: NoirOperation) => 'direct_inner_hash');
  const getDeviceOwner = vi.fn(async (_hash: string) => null as string | null);
  const getPolicy = vi.fn(async (_hash: string) => null as { agent: string } | null);
  const checkPayment = vi.fn(async (_p: object) => ({ ok: true }) as { ok: boolean; reason?: string });
  const getEscrowBalance = vi.fn(async (_hash: string) => 0n);
  const noir = {
    prepare,
    submit,
    getDeviceOwner,
    getPolicy,
    checkPayment,
    getEscrowBalance,
    server: { getTransaction: vi.fn(async () => ({ status: 'NOT_FOUND' })) },
  } as unknown as NoirAgentClient;
  return { noir, prepare, submit, getDeviceOwner, getPolicy, checkPayment, getEscrowBalance };
}

export function makeChainDeps(db: Db, noir: NoirAgentClient, log: ChainLog = fakeLog()): ChainDeps {
  return {
    db,
    noir,
    gas: null,
    config: {
      GAS_MODE: 'direct',
      GAS_FALLBACK_DIRECT: false,
      STELLAR_NETWORK_PASSPHRASE: PASSPHRASE,
      NOIR_DEVICE_REGISTRY_ID: DEVICE_REGISTRY_ID,
      NOIR_AGENT_REGISTRY_ID: AGENT_REGISTRY_ID,
      NOIR_PAYMENT_ESCROW_ID: PAYMENT_ESCROW_ID,
    },
    log,
    confirm: { timeoutMs: 0, pollMs: 0 },
    now: () => T0,
  };
}

/** The one program row, with a fixed id/salt/clock so hashes are reproducible. */
export function seedProgram(db: Db, now: number = T0): Program {
  return createProgram(db, {}, { phpPerXlm: 10, id: () => 'prog_test', salt: () => SALT, now: () => now });
}

export interface BeneficiarySeed {
  id: string;
  lastName?: string;
  firstName?: string;
  middleName?: string | null;
  birthdate?: string;
  plate?: string;
  toda?: string;
  status?: string;
  linkCode?: string;
}

export function seedBeneficiary(db: Db, seed: BeneficiarySeed): void {
  db.prepare(
    `INSERT INTO beneficiaries
       (id, program_id, last_name, first_name, middle_name, suffix, birthdate, plate, toda, barangay,
        source, score, status, rule_code, decision_reason, link_code, created_at)
     VALUES (?, 'prog_test', ?, ?, ?, NULL, ?, ?, ?, 'San Roque', 'csv', 1, ?, NULL, 'genuine', ?, ?)`,
  ).run(
    seed.id,
    seed.lastName ?? 'Dela Cruz',
    seed.firstName ?? 'Juan',
    seed.middleName === undefined ? 'Santos' : seed.middleName,
    seed.birthdate ?? '1980-03-02',
    seed.plate ?? 'ABC 1234',
    seed.toda ?? 'San Roque TODA',
    seed.status ?? 'approved',
    seed.linkCode ?? `link_${seed.id}`,
    T0 - 1000,
  );
}

export interface StationSeed {
  id: 'A' | 'B';
  name: string;
  status?: 'active' | 'frozen';
}

export function seedStation(db: Db, seed: StationSeed): Keypair {
  const keypair = Keypair.random();
  db.prepare(
    `INSERT INTO stations (id, name, public_key, secret_enc, status) VALUES (?, ?, ?, ?, ?)`,
  ).run(seed.id, seed.name, keypair.publicKey(), 'v1:unused', seed.status ?? 'active');
  return keypair;
}

export interface CardSeed {
  id: string;
  beneficiaryId: string;
  salt?: string;
  uid: string;
  agent: Keypair;
  secretEnc: string;
  status?: string;
  lastNonce?: number;
  maxAmountStroops?: number;
  expiresAtS?: number;
}

export async function seedCard(db: Db, seed: CardSeed): Promise<string> {
  const hash = await deviceHash(seed.salt ?? SALT, seed.uid);
  db.prepare(
    `INSERT INTO cards
       (id, beneficiary_id, device_hash, uid_last4, virtual, agent_public, agent_secret_enc,
        max_amount_stroops, expires_at_s, last_nonce, status, returned_stroops, error, created_at)
     VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, 0, NULL, ?)`,
  ).run(
    seed.id,
    seed.beneficiaryId,
    hash,
    seed.uid.slice(-4),
    seed.agent.publicKey(),
    seed.secretEnc,
    seed.maxAmountStroops ?? 500_000_000,
    seed.expiresAtS ?? 1_796_054_399,
    seed.lastNonce ?? 0,
    seed.status ?? 'active',
    T0,
  );
  return hash;
}
