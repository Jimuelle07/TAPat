// One tap (SDD §6.3, api-and-data.md §5.2 #13): frozen refusal, card resolution, nonce, `authorize`, decline mapping.
// A rejected or refused tap moves no money and is never linked to a chain tx; the tap row is the record.
import { randomUUID } from 'node:crypto';
import { Keypair } from '@stellar/stellar-sdk';
import { NoirContractError, decryptSecret, type PaymentRefusal } from '@tapat/agent';
import {
  TAP_REASON_LABELS,
  deviceHash,
  formatPhp,
  phpToStroops,
  type Tap,
  type TapBody,
  type TapReasonCode,
  type TapResponse,
} from '@tapat/shared';
import type { Config } from '../config';
import type { Db } from '../db/index';
import { ApiError } from '../errors';
import {
  discardUnsubmittedChainTx,
  latestFailedChainTxId,
  readChainTx,
  runChainTx,
  type ChainDeps,
  type ChainTxResult,
} from './chain';
import type { CardRow } from './enroll';
import { getCurrentProgram } from './program';
import type { SseBus } from './sse';

interface StationRow {
  id: string;
  name: string;
  public_key: string;
  status: 'active' | 'frozen';
}

export interface TapRow {
  id: string;
  card_id: string | null;
  card_ref: string | null;
  station_id: string;
  amount_stroops: number;
  nonce: number | null;
  status: Tap['status'];
  reason_code: TapReasonCode | null;
  chain_tx_id: string | null;
  simulated: number;
  midas_score: number | null;
  tick: number | null;
  created_at: number;
}

export function toTap(row: TapRow): Tap {
  return {
    id: row.id,
    cardId: row.card_id,
    cardRef: row.card_ref,
    stationId: row.station_id,
    amountStroops: String(row.amount_stroops),
    nonce: row.nonce === null ? null : String(row.nonce),
    status: row.status,
    reasonCode: row.reason_code,
    chainTxId: row.chain_tx_id,
    simulated: row.simulated === 1,
    midasScore: row.midas_score,
    tick: row.tick,
    createdAt: row.created_at,
  };
}

export interface TapDeps {
  db: Db;
  chain: ChainDeps;
  bus: SseBus;
  config: Pick<Config, 'KEY_ENCRYPTION_SECRET' | 'XLM_SAC_ID' | 'PHP_PER_XLM'>;
  /** The Freeze Agent's queue: called for every tap row written, so the next freeze tick can score it. */
  onTap?: (tap: Tap) => void;
  now?: () => number;
  id?: () => string;
}

/** Contract code -> reason (§5.2 #13 row 1); `requireEscrow: false` means `insufficient_escrow` never comes back. */
const REFUSAL_REASONS: Record<PaymentRefusal, TapReasonCode> = {
  expired: 'EXPIRED',
  over_limit: 'OVER_CAP',
  no_agent: 'POLICY_DENIED',
  wrong_agent: 'POLICY_DENIED',
  wrong_asset: 'POLICY_DENIED',
  invalid_amount: 'POLICY_DENIED',
  insufficient_escrow: 'POLICY_DENIED',
};

/** The sentence the station page renders verbatim; the amount is always named (§5.2 #13). */
function declineMessage(
  amountStroops: bigint,
  reason: TapReasonCode,
  contractCode: number,
  capStroops: bigint,
): string {
  const clause =
    reason === 'OVER_CAP'
      ? `${formatPhp(amountStroops)} is over the ${formatPhp(capStroops)} per-tap cap`
      : `${formatPhp(amountStroops)} — ${TAP_REASON_LABELS[reason]}`;
  return `Declined: ${clause} — rejected by the Noir contract (simulation of \`authorize\` returned Error #${contractCode}); no tx submitted.`;
}

/**
 * Records one tap and returns the §5.2 #13 envelope. Declines are 200 with `status:'rejected'`; only a frozen
 * station (423), an unresolvable card (404) or a chain failure (502) answer with an error envelope.
 */
export async function recordTap(deps: TapDeps, body: TapBody): Promise<TapResponse> {
  const now = deps.now ?? Date.now;
  const newId = deps.id ?? ((): string => `tap_${randomUUID().replaceAll('-', '').slice(0, 8)}`);
  const simulated = body.simulated === true;
  const amountStroops = phpToStroops(body.amountPhp, deps.config.PHP_PER_XLM);

  const insertTap = (row: {
    cardId: string | null;
    nonce: number | null;
    status: Tap['status'];
    reasonCode: TapReasonCode | null;
    chainTxId: string | null;
  }): TapRow => {
    const created = now();
    const tap: TapRow = {
      id: newId(),
      card_id: row.cardId,
      card_ref: null,
      station_id: body.stationId,
      amount_stroops: Number(amountStroops),
      nonce: row.nonce,
      status: row.status,
      reason_code: row.reasonCode,
      chain_tx_id: row.chainTxId,
      simulated: simulated ? 1 : 0,
      midas_score: null,
      tick: null,
      created_at: created,
    };
    deps.db
      .prepare(
        `INSERT INTO taps
           (id, card_id, card_ref, station_id, amount_stroops, nonce, status, reason_code, chain_tx_id,
            simulated, midas_score, tick, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        tap.id,
        tap.card_id,
        tap.card_ref,
        tap.station_id,
        tap.amount_stroops,
        tap.nonce,
        tap.status,
        tap.reason_code,
        tap.chain_tx_id,
        tap.simulated,
        tap.midas_score,
        tap.tick,
        tap.created_at,
      );
    const payload = toTap(tap);
    deps.bus.publish('tap', payload);
    // Queue it for scoring (SDD §6.5 step 3): the Freeze Agent re-emits the scored row under the same `id`.
    deps.onTap?.(payload);
    return tap;
  };

  // 1. Station first: a frozen station refuses before any card lookup, nonce or signature.
  const station = deps.db.prepare('SELECT * FROM stations WHERE id = ?').get<StationRow>(body.stationId);
  if (station === undefined) throw new ApiError(404, 'NOT_FOUND', `station ${body.stationId} not found`);
  if (station.status === 'frozen') {
    insertTap({ cardId: null, nonce: null, status: 'refused', reasonCode: 'STATION_FROZEN', chainTxId: null });
    throw new ApiError(423, 'STATION_FROZEN', `station ${station.id} is frozen`);
  }

  // 2. Card: the uid path hashes with the program salt, the simulated path names the card.
  const program = getCurrentProgram(deps.db);
  if (program === null) throw new ApiError(404, 'NOT_FOUND', 'no program; run seed-demo.ts');
  let card: CardRow | undefined;
  if ('uid' in body) {
    const salt = deps.db.prepare('SELECT salt FROM program WHERE id = ?').get<{ salt: string }>(program.id)?.salt;
    if (salt === undefined) throw new Error(`program ${program.id} disappeared`);
    const hash = await deviceHash(salt, body.uid);
    card = deps.db.prepare('SELECT * FROM cards WHERE device_hash = ?').get<CardRow>(hash);
  } else {
    card = deps.db.prepare('SELECT * FROM cards WHERE id = ?').get<CardRow>(body.cardId);
  }
  if (card === undefined || card.status !== 'active') {
    insertTap({ cardId: null, nonce: null, status: 'refused', reasonCode: 'CARD_NOT_ENROLLED', chainTxId: null });
    throw new ApiError(404, 'CARD_NOT_ENROLLED', 'no active card for this tap');
  }

  // 3. Nonce, persisted before anything is signed (§5, SDD §5).
  const nonce = Math.max(now(), card.last_nonce + 1);
  deps.db.prepare('UPDATE cards SET last_nonce = ? WHERE id = ?').run(nonce, card.id);

  const agent = Keypair.fromSecret(decryptSecret(card.agent_secret_enc, deps.config.KEY_ENCRYPTION_SECRET));
  const capStroops = BigInt(card.max_amount_stroops);

  let result: ChainTxResult;
  try {
    result = await runChainTx(deps.chain, agent, {
      kind: 'authorize',
      deviceHash: card.device_hash,
      merchant: station.public_key,
      asset: deps.config.XLM_SAC_ID,
      amount: amountStroops,
      nonce: BigInt(nonce),
    });
  } catch (error) {
    // `runChainTx` wrote its row before simulating, and threw before returning the id.
    const failedTxId = latestFailedChainTxId(deps.db, 'authorize', agent.publicKey());
    const contractCode = error instanceof NoirContractError ? error.code : 0;

    // A contract decision (#3, #2) was reached during simulation: nothing was submitted, so the tap is `rejected`
    // and no chain_txs row survives (SDD §6.3 invariant).
    if (contractCode === 3 || contractCode === 2) {
      if (failedTxId !== null) discardUnsubmittedChainTx(deps.db, failedTxId);
      let reasonCode: TapReasonCode = 'INSUFFICIENT_ESCROW';
      if (contractCode === 3) {
        let refusal: PaymentRefusal = 'no_agent';
        try {
          const check = await deps.chain.noir.checkPayment({
            deviceHash: card.device_hash,
            agent: card.agent_public,
            asset: deps.config.XLM_SAC_ID,
            amount: amountStroops,
            requireEscrow: false,
          });
          if (!check.ok) refusal = check.reason;
        } catch {
          // The contract already refused; an unreadable predicate keeps the generic POLICY_DENIED.
        }
        reasonCode = REFUSAL_REASONS[refusal];
      }
      const tap = insertTap({ cardId: card.id, nonce, status: 'rejected', reasonCode, chainTxId: null });
      return {
        tap: toTap(tap),
        balanceStroops: null,
        message: declineMessage(amountStroops, reasonCode, contractCode, capStroops),
      };
    }

    // Any other code is a failure with no decision: the tx row stays as the audit trail and the tap points at it.
    const failedTx = failedTxId === null ? null : readChainTx(deps.db, failedTxId);
    if (failedTx !== null) deps.bus.publish('chain_tx', failedTx);
    insertTap({ cardId: card.id, nonce, status: 'failed', reasonCode: null, chainTxId: failedTxId });
    throw new ApiError(
      502,
      'CHAIN_ERROR',
      error instanceof NoirContractError ? `CONTRACT_${error.errorName}` : error instanceof Error ? error.message : String(error),
    );
  }

  const chainTx = readChainTx(deps.db, result.chainTxId);
  if (chainTx !== null) deps.bus.publish('chain_tx', chainTx);
  if (result.status !== 'succeeded') {
    insertTap({ cardId: card.id, nonce, status: 'failed', reasonCode: null, chainTxId: result.chainTxId });
    throw new ApiError(502, 'CHAIN_ERROR', result.errorCode ?? result.error ?? 'chain transaction did not succeed');
  }

  const tap = insertTap({ cardId: card.id, nonce, status: 'authorized', reasonCode: null, chainTxId: result.chainTxId });
  let balanceStroops: string | null = null;
  try {
    balanceStroops = String(await deps.chain.noir.getEscrowBalance(card.device_hash));
  } catch (error) {
    // The money already moved; the receipt must still go out, just without the balance line.
    deps.chain.log.warn({ tapId: tap.id, cause: error }, 'escrow balance read failed after an authorized tap');
  }
  const message =
    balanceStroops === null
      ? `Paid ${formatPhp(amountStroops)} at ${station.name}.`
      : `Paid ${formatPhp(amountStroops)} at ${station.name} — escrow balance ${formatPhp(balanceStroops)}.`;
  return { tap: toTap(tap), balanceStroops, message };
}
