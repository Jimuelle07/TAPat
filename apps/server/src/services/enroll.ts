// Enrollment (SDD §6.2, api-and-data.md §5.2 #10): photo check -> agent keypair -> register -> register_agent.
// The card row is the retry unit: `cards.device_hash` is UNIQUE, so a `failed` row is resumed with the same keypair.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Keypair } from '@stellar/stellar-sdk';
import {
  NoirContractError,
  encryptSecret,
  fundWithFriendbot,
  generateAgentKeypair,
} from '@tapat/agent';
import { deviceHash, type Card, type EnrollResponse } from '@tapat/shared';
import type { Config } from '../config';
import type { Db } from '../db/index';
import { ApiError } from '../errors';
import { toBeneficiary, type BeneficiaryRow } from './beneficiaries';
import { readChainTx, runChainTx, type ChainDeps } from './chain';
import { getCurrentProgram } from './program';
import type { SseBus } from './sse';

const DEFAULT_FIXTURES_DIR = fileURLToPath(new URL('../../../../fixtures/enroll', import.meta.url));

interface ProgramRowSalt {
  id: string;
  salt: string;
}

export interface CardRow {
  id: string;
  beneficiary_id: string;
  device_hash: string;
  uid_last4: string;
  virtual: number;
  agent_public: string;
  agent_secret_enc: string;
  max_amount_stroops: number;
  expires_at_s: number;
  last_nonce: number;
  status: Card['status'];
  returned_stroops: number;
  error: string | null;
  created_at: number;
}

/** `cards` row -> the REST shape (§3). The device hash and the encrypted secret never leave the server. */
export function toCard(row: CardRow): Card {
  return {
    id: row.id,
    beneficiaryId: row.beneficiary_id,
    uidLast4: row.uid_last4,
    virtual: row.virtual === 1,
    agentPublic: row.agent_public,
    maxAmountStroops: String(row.max_amount_stroops),
    expiresAtS: row.expires_at_s,
    lastNonce: String(row.last_nonce),
    status: row.status,
    returnedStroops: String(row.returned_stroops),
    error: row.error,
    createdAt: row.created_at,
  };
}

/** §5.2 #10 request after multipart parsing; `hasPhoto` is whether the `photo` file part arrived. */
export interface EnrollRequest {
  beneficiaryId: string;
  uid: string;
  samplePhoto?: string;
  officerConfirmed?: boolean;
  hasPhoto: boolean;
  /** Seed-only (D3/D5): the HTTP body never carries these. */
  expiresAtS?: number;
  virtual?: boolean;
}

export interface EnrollDeps {
  db: Db;
  chain: ChainDeps;
  bus: SseBus;
  /** The device owner: signs `register` and `register_agent`, and owns every card on chain. */
  programWallet: Keypair;
  config: Pick<Config, 'KEY_ENCRYPTION_SECRET' | 'XLM_SAC_ID' | 'TELEGRAM_BOT_USERNAME'>;
  /** Directory holding `<samplePhoto basename>.json`; the tests point it at a temp dir. */
  fixturesDir?: string;
  now?: () => number;
  /** Card id factory; the seed passes `card_D1`-style ids, the API the random one. */
  id?: () => string;
  /** Agent keypair factory and friendbot funding, both replaceable in tests. */
  keypair?: () => { publicKey: string; secret: string };
  fund?: (publicKey: string) => Promise<void>;
}

interface PhotoCheck {
  source: 'precomputed' | 'officer_confirmed';
  plate: string | null;
  toda: string | null;
  matched: boolean;
}

/** Uppercase, spaces and dashes removed (SDD §6.2 step 4). */
function normalizePlate(plate: string): string {
  return plate.toUpperCase().replace(/[\s-]/g, '');
}

/** Trimmed, lowercase, single-spaced TODA for the same comparison. */
function normalizeToda(toda: string): string {
  return toda.trim().toLowerCase().replace(/\s+/g, ' ');
}

function photoError(field: string): ApiError {
  return new ApiError(422, 'PHOTO_MISMATCH', `${field} on the photo does not match the beneficiary record`);
}

/**
 * SDD §6.2 step 4. `samplePhoto` reads the precomputed record `fixtures/enroll/<basename>.json`
 * (`d4-photo.jpg` -> `d4-photo.json`); an uploaded photo needs the officer's confirmation and no model runs.
 */
function checkPhoto(deps: EnrollDeps, request: EnrollRequest, beneficiary: BeneficiaryRow): PhotoCheck {
  if (request.samplePhoto !== undefined) {
    const file = resolve(deps.fixturesDir ?? DEFAULT_FIXTURES_DIR, `${basename(request.samplePhoto, '.jpg')}.json`);
    let fixture: { plate?: string; toda?: string };
    try {
      fixture = JSON.parse(readFileSync(file, 'utf8')) as { plate?: string; toda?: string };
    } catch (error) {
      throw new Error(`precomputed photo fixture ${file} is missing or unreadable: ${String(error)}`);
    }
    const plate = fixture.plate ?? '';
    const toda = fixture.toda ?? '';
    if (normalizePlate(plate) !== normalizePlate(beneficiary.plate)) throw photoError('plate');
    if (normalizeToda(toda) !== normalizeToda(beneficiary.toda)) throw photoError('toda');
    return { source: 'precomputed', plate, toda, matched: true };
  }
  if (request.hasPhoto) {
    if (request.officerConfirmed !== true) {
      throw new ApiError(422, 'PHOTO_CONFIRMATION_REQUIRED', 'officerConfirmed must be "true" when a photo is uploaded');
    }
    return { source: 'officer_confirmed', plate: null, toda: null, matched: true };
  }
  throw new ApiError(422, 'PHOTO_CONFIRMATION_REQUIRED', 'send samplePhoto or a photo with officerConfirmed');
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Publishes the row `runChainTx` just wrote, whatever its status (§5.4 `chain_tx`). */
function publishChainTx(deps: EnrollDeps, chainTxId: string): void {
  const tx = readChainTx(deps.db, chainTxId);
  if (tx !== null) deps.bus.publish('chain_tx', tx);
}

/** One chain step. A throw or a non-`succeeded` status fails the card and answers 502 `CHAIN_ERROR`. */
async function chainStep(
  deps: EnrollDeps,
  card: CardRow,
  signer: Keypair,
  op: Parameters<typeof runChainTx>[2],
  chainTxIds: string[],
): Promise<void> {
  try {
    const result = await runChainTx(deps.chain, signer, op);
    chainTxIds.push(result.chainTxId);
    publishChainTx(deps, result.chainTxId);
    if (result.status !== 'succeeded') {
      throw new ApiError(502, 'CHAIN_ERROR', result.errorCode ?? result.error ?? 'chain transaction did not succeed');
    }
  } catch (error) {
    const message =
      error instanceof NoirContractError ? `CONTRACT_${error.errorName}` : error instanceof ApiError ? error.message : messageOf(error);
    deps.db
      .prepare(`UPDATE cards SET status = 'failed', error = ? WHERE id = ?`)
      .run(error instanceof NoirContractError ? error.message : message, card.id);
    throw error instanceof ApiError ? error : new ApiError(502, 'CHAIN_ERROR', message);
  }
}

/**
 * Enrolls (or resumes) one card. Errors are the §5.3 codes; a chain failure leaves `cards.status='failed'` with the
 * error stored, so re-posting the same `uid` resumes this row and this keypair.
 */
export async function enrollCard(deps: EnrollDeps, request: EnrollRequest): Promise<EnrollResponse> {
  const now = deps.now ?? Date.now;
  const program = getCurrentProgram(deps.db);
  if (program === null) throw new ApiError(404, 'NOT_FOUND', 'no program; run seed-demo.ts');
  if (program.status !== 'draft' && program.status !== 'active') {
    throw new ApiError(409, 'INVALID_STATE', `program is ${program.status}`);
  }
  const at = now();
  // `register_agent` panics InvalidPolicy on a past expiry, so refuse before burning a sponsored transaction.
  if (program.expiresAtS !== 0 && program.expiresAtS <= Math.floor(at / 1000)) {
    throw new ApiError(409, 'INVALID_STATE', 'program policy expiry has passed; create a new program');
  }

  const beneficiary = deps.db
    .prepare('SELECT * FROM beneficiaries WHERE id = ?')
    .get<BeneficiaryRow>(request.beneficiaryId);
  if (beneficiary === undefined || beneficiary.program_id !== program.id) {
    throw new ApiError(404, 'NOT_FOUND', `beneficiary ${request.beneficiaryId} not found`);
  }

  const salt = deps.db.prepare('SELECT id, salt FROM program WHERE id = ?').get<ProgramRowSalt>(program.id)?.salt;
  if (salt === undefined) throw new Error(`program ${program.id} disappeared`);
  const hash = await deviceHash(salt, request.uid);

  // A non-`failed` card for this UID is the duplicate (§5.2 #10) — it answers before the beneficiary's status, so a
  // re-post of an enrolled card never reads as a generic INVALID_STATE.
  const existing = deps.db.prepare('SELECT * FROM cards WHERE device_hash = ?').get<CardRow>(hash);
  if (existing !== undefined && existing.status !== 'failed') {
    throw new ApiError(409, 'CARD_ALREADY_ENROLLED', `card ${existing.id} is already ${existing.status}`);
  }
  if (beneficiary.status !== 'approved') {
    throw new ApiError(
      409,
      'INVALID_STATE',
      `beneficiary ${beneficiary.id} is ${beneficiary.status}; only approved beneficiaries can be enrolled`,
    );
  }
  const photoCheck = checkPhoto(deps, request, beneficiary);

  const makeKeypair = deps.keypair ?? generateAgentKeypair;
  const fund = deps.fund ?? fundWithFriendbot;
  const wallet = deps.programWallet;
  const uidLast4 = request.uid.slice(-4);

  let card: CardRow;
  if (existing === undefined) {
    const agent = makeKeypair();
    try {
      await fund(agent.publicKey);
    } catch (error) {
      // Nothing is stored yet: the unfunded key is dropped and the officer simply retries.
      throw new ApiError(502, 'CHAIN_ERROR', messageOf(error));
    }
    card = {
      id: deps.id?.() ?? `card_${randomUUID().replaceAll('-', '').slice(0, 4)}`,
      beneficiary_id: beneficiary.id,
      device_hash: hash,
      uid_last4: uidLast4,
      virtual: request.virtual === true ? 1 : 0,
      agent_public: agent.publicKey,
      agent_secret_enc: encryptSecret(agent.secret, deps.config.KEY_ENCRYPTION_SECRET),
      max_amount_stroops: Number(program.perTapCapStroops),
      expires_at_s: request.expiresAtS ?? program.expiresAtS,
      last_nonce: 0,
      status: 'pending',
      returned_stroops: 0,
      error: null,
      created_at: at,
    };
    deps.db
      .prepare(
        `INSERT INTO cards
           (id, beneficiary_id, device_hash, uid_last4, virtual, agent_public, agent_secret_enc,
            max_amount_stroops, expires_at_s, last_nonce, status, returned_stroops, error, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        card.id,
        card.beneficiary_id,
        card.device_hash,
        card.uid_last4,
        card.virtual,
        card.agent_public,
        card.agent_secret_enc,
        card.max_amount_stroops,
        card.expires_at_s,
        card.last_nonce,
        card.status,
        card.returned_stroops,
        card.error,
        card.created_at,
      );
  } else {
    card = existing;
    deps.db.prepare(`UPDATE cards SET status = 'pending', error = NULL WHERE id = ?`).run(card.id);
    card = { ...card, status: 'pending', error: null };
  }

  const chainTxIds: string[] = [];
  // Resume: the chain says which steps already applied, so a retry never repeats `register`.
  let owner: string | null = null;
  let policyLanded = false;
  if (existing !== undefined) {
    try {
      owner = await deps.chain.noir.getDeviceOwner(hash);
      policyLanded = owner === wallet.publicKey() && (await deps.chain.noir.getPolicy(hash)) !== null;
    } catch (error) {
      deps.db.prepare(`UPDATE cards SET status = 'failed', error = ? WHERE id = ?`).run(messageOf(error), card.id);
      throw new ApiError(502, 'CHAIN_ERROR', messageOf(error));
    }
  }

  if (!policyLanded) {
    if (owner !== wallet.publicKey()) {
      await chainStep(
        deps,
        card,
        wallet,
        { kind: 'registerDevice', deviceHash: hash, agent: card.agent_public },
        chainTxIds,
      );
    }
    await chainStep(
      deps,
      card,
      wallet,
      {
        kind: 'registerAgent',
        deviceHash: hash,
        agent: card.agent_public,
        asset: deps.config.XLM_SAC_ID,
        maxAmount: BigInt(card.max_amount_stroops),
        expiresAt: new Date(card.expires_at_s * 1000),
      },
      chainTxIds,
    );
  }

  const enrolledAt = now();
  deps.db.transaction(() => {
    deps.db.prepare(`UPDATE cards SET status = 'active', error = NULL WHERE id = ?`).run(card.id);
    deps.db.prepare(`UPDATE beneficiaries SET status = 'enrolled' WHERE id = ?`).run(beneficiary.id);
    deps.db
      .prepare(
        `INSERT INTO agent_decisions (id, agent, decision, inputs_json, outputs_json, tx_ids_json, created_at)
         VALUES (?, 'intake', 'APPROVED', ?, ?, ?, ?)`,
      )
      .run(
        `dec_${randomUUID().replaceAll('-', '').slice(0, 8)}`,
        JSON.stringify({ perTapCapStroops: card.max_amount_stroops, expiresAtS: card.expires_at_s }),
        JSON.stringify({
          cardId: card.id,
          beneficiaryId: beneficiary.id,
          deviceHashPrefix: hash.slice(0, 8),
          photoSource: photoCheck.source,
          matched: photoCheck.matched,
        }),
        JSON.stringify(chainTxIds),
        enrolledAt,
      );
  });

  const cardRow = deps.db.prepare('SELECT * FROM cards WHERE id = ?').get<CardRow>(card.id);
  const beneficiaryRow = deps.db
    .prepare('SELECT * FROM beneficiaries WHERE id = ?')
    .get<BeneficiaryRow>(beneficiary.id);
  if (cardRow === undefined || beneficiaryRow === undefined) throw new Error('enrollment rows disappeared');
  const response: EnrollResponse = {
    card: toCard(cardRow),
    beneficiary: toBeneficiary(beneficiaryRow, { botUsername: deps.config.TELEGRAM_BOT_USERNAME }),
    deviceHashPrefix: hash.slice(0, 8),
    photoCheck,
    chainTxIds,
  };
  deps.bus.publish('enroll', response.card);
  return response;
}
