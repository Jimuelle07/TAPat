// Sweep (SDD §6.8, api-and-data.md §5.2 #5): end the program, revoke every live policy, sweep the escrow back to the
// Program Wallet. Revoke always precedes the sweep — `sweep_on_revoke` refuses while an agent is still live.
import type { Keypair } from '@stellar/stellar-sdk';
import { NoirContractError } from '@tapat/agent';
import type { CardStatus, EndProgramResponse } from '@tapat/shared';
import type { Config } from '../config';
import type { Db } from '../db/index';
import { ApiError } from '../errors';
import { readChainTx, runChainTx, type ChainDeps } from './chain';
import { insertDecision, type NewDecision } from './decisions';
import { getCurrentProgram } from './program';
import type { SseBus } from './sse';

/** The part of `getPolicy`'s answer the sweep decides on (the SDK type is not re-exported by `@tapat/agent`). */
interface AgentPolicy {
  expiresAt: Date | null;
}

interface SweepCardRow {
  id: string;
  beneficiary_id: string;
  device_hash: string;
  agent_public: string;
  status: CardStatus;
}

type CardOutcome = EndProgramResponse['cards'][number];

/** A revoke or sweep tx from an earlier call is still `pending` or `submission_unknown`; the card waits for it. */
export const TX_UNRESOLVED = 'TX_UNRESOLVED';

/** The chain tx a failed card left behind, recorded in its decision so a retry can find it. */
interface Attempt {
  kind: 'revoke' | 'sweep';
  chainTxId: string;
  balanceBeforeStroops: string | null;
}

type RevokeOutcome =
  | { status: 'revoked'; chainTxId: string }
  | { status: 'skipped'; reason: 'EXPIRED_POLICY' | 'NO_POLICY' };

export interface SweepDeps {
  db: Db;
  chain: ChainDeps;
  bus: SseBus;
  /** The device owner (LGU side): signs `revoke_agent` and `sweep_on_revoke`, and receives the swept funds. */
  programWallet: Keypair;
  config: Pick<Config, 'XLM_SAC_ID'>;
  now?: () => number;
}

/** The error code the UI shows for a card that could not be swept; the chain row keeps the full message. */
function errorCodeOf(error: unknown): string {
  if (error instanceof NoirContractError) return `CONTRACT_${error.errorName}`;
  return error instanceof Error ? error.message : String(error);
}

/** Every write is also a `chain_tx` event, so the UI's tx list updates before the response lands. */
function publishChainTx(deps: SweepDeps, chainTxId: string): void {
  const chainTx = readChainTx(deps.db, chainTxId);
  if (chainTx !== null) deps.bus.publish('chain_tx', chainTx);
}

/** Databases with an end in flight: a second concurrent call would sign for the same card on the Program Wallet. */
const ending = new WeakSet<Db>();

/**
 * `POST /api/program/end`. Only an `active` or `ending` program can be ended. A card that fails mid-way keeps its
 * `status` and its `reason`; the rest of the cards still run and the response is still 200, but the program stays
 * `ending`, so the next call retries only the cards still `active`. Once every card is swept the program moves to
 * `ended`, and a further call answers 409 `INVALID_STATE`. `totalReturnedStroops` is the program's cumulative return,
 * so a resumed call also counts the cards an earlier call swept. A call while another is still running answers 409
 * `INVALID_STATE`. `502 CHAIN_ERROR` is reserved for the one unrecoverable failure: the program row cannot be updated
 * or read back.
 */
export async function endProgram(deps: SweepDeps): Promise<EndProgramResponse> {
  if (ending.has(deps.db)) throw new ApiError(409, 'INVALID_STATE', 'program end already running');
  ending.add(deps.db);
  try {
    return await runEnd(deps);
  } finally {
    ending.delete(deps.db);
  }
}

async function runEnd(deps: SweepDeps): Promise<EndProgramResponse> {
  const now = deps.now ?? Date.now;
  const program = getCurrentProgram(deps.db);
  if (program === null) throw new ApiError(404, 'NOT_FOUND', 'no program; run seed-demo.ts');
  if (program.status !== 'active' && program.status !== 'ending') {
    throw new ApiError(409, 'INVALID_STATE', `program is ${program.status}`);
  }

  // Claim the end before any chain call (concurrent calls are refused above); `ending` itself is a resume after a call
  // that left a card unswept or that the process did not finish (api-and-data.md §5.2 #5: the sweep is safe to re-call).
  const claimed = deps.db
    .prepare(`UPDATE program SET status = 'ending' WHERE id = ? AND status IN ('active', 'ending')`)
    .run(program.id);
  if (claimed.changes !== 1) throw new ApiError(409, 'INVALID_STATE', 'program is not active');

  const cards = deps.db
    .prepare(
      `SELECT c.id, c.beneficiary_id, c.device_hash, c.agent_public, c.status
         FROM cards c JOIN beneficiaries b ON b.id = c.beneficiary_id
        WHERE b.program_id = ? AND c.status = 'active'
        ORDER BY c.created_at, c.rowid`,
    )
    .all<SweepCardRow>(program.id);

  const outcomes: CardOutcome[] = [];
  const decidedAt = now();
  for (const card of cards) outcomes.push(await sweepCard(deps, card, now()));

  const unfinished = outcomes.some((card) => card.status === 'active');
  const totalReturned = BigInt(
    deps.db
      .prepare(
        `SELECT COALESCE(SUM(c.returned_stroops), 0) AS total
           FROM cards c JOIN beneficiaries b ON b.id = c.beneficiary_id
          WHERE b.program_id = ?`,
      )
      .get<{ total: number | bigint }>(program.id)?.total ?? 0,
  );
  if (unfinished) {
    // The per-card `chain_tx` events already refreshed the dashboard; the program stays `ending` for the retry.
    const current = getCurrentProgram(deps.db);
    if (current === null) throw new ApiError(502, 'CHAIN_ERROR', 'program row could not be read');
    return { program: current, cards: outcomes, totalReturnedStroops: String(totalReturned) };
  }

  // The closing rows cover every swept card, not just this call's, so a reload of /demo/end after a resumed call still
  // lists them all. A card an earlier call swept is rebuilt from its row: `swept` with 0 returned is only ever the
  // empty-escrow branch.
  const byCard = new Map(outcomes.map((card) => [card.cardId, card]));
  const programCards = deps.db
    .prepare(
      `SELECT c.id, c.status, c.returned_stroops
         FROM cards c JOIN beneficiaries b ON b.id = c.beneficiary_id
        WHERE b.program_id = ?
        ORDER BY c.created_at, c.rowid`,
    )
    .all<{ id: string; status: CardStatus; returned_stroops: number | bigint }>(program.id);
  const closingCards = programCards.flatMap((row) => {
    const card = byCard.get(row.id);
    if (card !== undefined) return [{ cardId: card.cardId, returnedStroops: card.returnedStroops, status: card.status, reason: card.reason }];
    if (row.status !== 'swept') return [];
    const returnedStroops = String(row.returned_stroops);
    return [{ cardId: row.id, returnedStroops, status: row.status, reason: returnedStroops === '0' ? 'EMPTY_ESCROW' : null }];
  });

  // Every revoke/sweep tx any call of this program recorded on a per-card decision (a failed attempt keeps its revoke),
  // so the closing row's audit trail matches its cumulative card list.
  const programCardIds = new Set(programCards.map((row) => row.id));
  const closingTxIds = new Set<string>();
  for (const row of deps.db
    .prepare(
      `SELECT outputs_json, tx_ids_json FROM agent_decisions
        WHERE agent = 'sweep' AND decision IN ('SWEPT', 'SKIPPED') ORDER BY rowid`,
    )
    .all<{ outputs_json: string; tx_ids_json: string }>()) {
    const outputs: unknown = JSON.parse(row.outputs_json);
    const cardId = typeof outputs === 'object' && outputs !== null && 'cardId' in outputs ? outputs.cardId : null;
    if (typeof cardId !== 'string' || !programCardIds.has(cardId)) continue;
    const txIds: unknown = JSON.parse(row.tx_ids_json);
    if (Array.isArray(txIds)) for (const id of txIds) if (typeof id === 'string') closingTxIds.add(id);
  }

  const programEnded = deps.db.transaction((): NewDecision | null => {
    const ended = deps.db
      .prepare(`UPDATE program SET status = 'ended' WHERE id = ? AND status = 'ending'`)
      .run(program.id);
    if (ended.changes !== 1) return null;
    return {
      agent: 'sweep',
      decision: 'PROGRAM_ENDED',
      inputs: { cardsProcessed: closingCards.length, cardsSwept: closingCards.filter((c) => c.status === 'swept').length },
      outputs: {
        totalReturnedStroops: String(totalReturned),
        cards: closingCards,
      },
      txIds: [...closingTxIds],
      createdAt: decidedAt,
    };
  });
  if (programEnded === null) throw new ApiError(502, 'CHAIN_ERROR', 'program row could not be updated');
  const decision = insertDecision(deps.db, programEnded);

  const ended = getCurrentProgram(deps.db);
  if (ended === null) throw new ApiError(502, 'CHAIN_ERROR', 'program row could not be updated');

  deps.bus.publish('sweep', decision);
  return { program: ended, cards: outcomes, totalReturnedStroops: String(totalReturned) };
}

/**
 * One card: live policy -> `revoke_agent`, then a non-zero escrow -> `sweep_on_revoke`. A zero balance skips the
 * sweep transaction (`sweep_on_revoke` would return 0 and move nothing) but still sweeps the card and records the row.
 */
async function sweepCard(deps: SweepDeps, card: SweepCardRow, at: number): Promise<CardOutcome> {
  const base = {
    cardId: card.id,
    beneficiaryId: card.beneficiary_id,
    returnedStroops: '0',
    revokeTxId: null,
    sweepTxId: null,
    status: card.status,
    reason: null,
  } satisfies CardOutcome;

  // A retry must never sign a second tx while the first is unsettled (AGENTS.md §4): the reconciler owns it.
  const prior = priorAttempt(deps.db, card.id);
  if (prior !== null) {
    const priorTx = readChainTx(deps.db, prior.chainTxId);
    const priorStatus = priorTx?.status;
    if (priorStatus === 'pending' || priorStatus === 'submission_unknown') {
      deps.chain.log.warn({ cardId: card.id, chainTxId: prior.chainTxId, status: priorStatus }, 'card has an unresolved tx; not re-signing');
      return { ...base, status: 'active', reason: TX_UNRESOLVED };
    }
    if (priorStatus === 'succeeded' && prior.kind === 'sweep' && prior.balanceBeforeStroops !== null) {
      // The reconciler settled the earlier sweep: the escrow is already home, so record it instead of reading 0.
      const returned = BigInt(prior.balanceBeforeStroops);
      return finishCard(deps, base, at, {
        returned,
        status: 'swept',
        reason: null,
        decision: { decision: 'SWEPT', inputs: { balanceBeforeStroops: Number(returned), recovered: 1 } },
        outputs: { returnedStroops: String(returned), recoveredFromChainTxId: prior.chainTxId },
        txIds: [prior.chainTxId],
        revokeTxId: null,
        sweepTxId: prior.chainTxId,
      });
    }
  }

  let policyLive = false;
  let marker: { rowid: number; balanceBefore: bigint | null } | null = null;
  try {
    const policy: AgentPolicy | null = await deps.chain.noir.getPolicy(card.device_hash);
    policyLive = policy !== null && (policy.expiresAt === null || policy.expiresAt.getTime() >= at);

    let revoke: RevokeOutcome;
    if (!policyLive) {
      // An expired (or absent) policy already allows a sweep, and `revoke_agent` panics `AgentNotFound` without one.
      revoke = { status: 'skipped', reason: policy === null ? 'NO_POLICY' : 'EXPIRED_POLICY' };
    } else {
      marker = { rowid: lastChainTxRowid(deps.db), balanceBefore: null };
      const revoked = await runChainTx(deps.chain, deps.programWallet, {
        kind: 'revokeAgent',
        deviceHash: card.device_hash,
      });
      publishChainTx(deps, revoked.chainTxId);
      if (revoked.status !== 'succeeded') {
        return failedCard(deps, base, {
          at,
          policyLive,
          attempt: { kind: 'revoke', chainTxId: revoked.chainTxId, balanceBeforeStroops: null },
          code: revoked.errorCode ?? 'CHAIN_ERROR',
        });
      }
      revoke = { status: 'revoked', chainTxId: revoked.chainTxId };
    }

    const balanceBefore = await deps.chain.noir.getEscrowBalance(card.device_hash);
    if (balanceBefore === 0n) {
      return finishCard(deps, base, at, {
        returned: 0n,
        status: 'swept',
        reason: 'EMPTY_ESCROW',
        decision: { decision: 'SKIPPED', inputs: { balanceBeforeStroops: 0, policyLive: policyLive ? 1 : 0 } },
        outputs: { reason: 'EMPTY_ESCROW', revoke },
        txIds: revoke.status === 'revoked' ? [revoke.chainTxId] : [],
        revokeTxId: revoke.status === 'revoked' ? revoke.chainTxId : null,
        sweepTxId: null,
      });
    }

    marker = { rowid: lastChainTxRowid(deps.db), balanceBefore };
    const swept = await runChainTx(deps.chain, deps.programWallet, {
      kind: 'sweepOnRevoke',
      deviceHash: card.device_hash,
      token: deps.config.XLM_SAC_ID,
      agent: card.agent_public,
    });
    publishChainTx(deps, swept.chainTxId);
    if (swept.status !== 'succeeded') {
      return failedCard(deps, base, {
        at,
        policyLive,
        revoke,
        attempt: { kind: 'sweep', chainTxId: swept.chainTxId, balanceBeforeStroops: String(balanceBefore) },
        code: swept.errorCode ?? 'CHAIN_ERROR',
      });
    }
    return finishCard(deps, base, at, {
      returned: balanceBefore,
      status: 'swept',
      reason: null,
      decision: {
        decision: 'SWEPT',
        inputs: { balanceBeforeStroops: Number(balanceBefore), policyLive: policyLive ? 1 : 0 },
      },
      outputs: { returnedStroops: String(balanceBefore), revoke },
      txIds: [...(revoke.status === 'revoked' ? [revoke.chainTxId] : []), swept.chainTxId],
      revokeTxId: revoke.status === 'revoked' ? revoke.chainTxId : null,
      sweepTxId: swept.chainTxId,
    });
  } catch (error) {
    // A chain read failed, `prepare()` refused, or a write after the hand-off threw: the card stays `active` and the
    // loop moves on. A tx persisted since the marker is recorded so a retry never re-signs it.
    const attempt = marker === null ? undefined : inFlightAttempt(deps.db, marker);
    return failedCard(deps, base, { at, policyLive, code: errorCodeOf(error), error, ...(attempt === undefined ? {} : { attempt }) });
  }
}

function lastChainTxRowid(db: Db): number {
  return db.prepare(`SELECT COALESCE(MAX(rowid), 0) AS id FROM chain_txs`).get<{ id: number }>()?.id ?? 0;
}

/**
 * The revoke/sweep tx handed off since `marker`; the in-process end guard means no other call writes one meanwhile.
 * A `failed` row (a `prepare()` rejection) never reached the chain, so a retry may sign afresh and it is not an attempt.
 */
function inFlightAttempt(db: Db, marker: { rowid: number; balanceBefore: bigint | null }): Attempt | undefined {
  const row = db
    .prepare(
      `SELECT id, kind FROM chain_txs
        WHERE rowid > ? AND kind IN ('revoke_agent','sweep')
          AND status != 'failed' ORDER BY rowid DESC LIMIT 1`,
    )
    .get<{ id: string; kind: string }>(marker.rowid);
  if (row === undefined) return undefined;
  const sweep = row.kind === 'sweep';
  return { kind: sweep ? 'sweep' : 'revoke', chainTxId: row.id, balanceBeforeStroops: sweep ? String(marker.balanceBefore) : null };
}

interface CardWrite {
  returned: bigint;
  status: CardStatus;
  reason: string | null;
  decision: Pick<NewDecision, 'decision' | 'inputs'>;
  outputs: Record<string, unknown>;
  txIds: string[];
  revokeTxId: string | null;
  sweepTxId: string | null;
}

/** Persists the card row and its decision together; the returned outcome is the response entry. */
function finishCard(deps: SweepDeps, base: CardOutcome, at: number, write: CardWrite): CardOutcome {
  deps.db.transaction(() => {
    const updated = deps.db
      .prepare(`UPDATE cards SET status = ?, returned_stroops = ?, error = NULL WHERE id = ? AND status = 'active'`)
      .run(write.status, write.returned, base.cardId);
    if (updated.changes !== 1) throw new Error(`card ${base.cardId} disappeared while it was being swept`);
    insertDecision(deps.db, {
      agent: 'sweep',
      decision: write.decision.decision,
      inputs: write.decision.inputs,
      outputs: { cardId: base.cardId, beneficiaryId: base.beneficiaryId, ...write.outputs },
      txIds: write.txIds,
      createdAt: at,
    });
  });
  return {
    ...base,
    returnedStroops: String(write.returned),
    revokeTxId: write.revokeTxId,
    sweepTxId: write.sweepTxId,
    status: write.status,
    reason: write.reason,
  };
}

/** What a failed card records; `policyLive` is explicit because a failed revoke tells us nothing about the balance. */
interface CardFailure {
  at: number;
  policyLive: boolean;
  revoke?: RevokeOutcome;
  /** The chain tx this call signed and could not settle; a retry resolves it before it signs anything new. */
  attempt?: Attempt;
  code: string;
  error?: unknown;
}

/** A card the sweep could not release: `status` stays `active`, `reason` carries the code, the attempt records it. */
function failedCard(deps: SweepDeps, base: CardOutcome, failure: CardFailure): CardOutcome {
  const { at, policyLive, revoke, attempt, code, error } = failure;
  const message = error === undefined ? undefined : error instanceof Error ? error.message : String(error);
  deps.chain.log.warn({ cardId: base.cardId, code }, 'card sweep failed; card stays active');
  const txIds = [
    ...(revoke !== undefined && revoke.status === 'revoked' ? [revoke.chainTxId] : []),
    ...(attempt === undefined ? [] : [attempt.chainTxId]),
  ];
  deps.db.transaction(() => {
    deps.db.prepare(`UPDATE cards SET error = ? WHERE id = ?`).run(message ?? code, base.cardId);
    insertDecision(deps.db, {
      agent: 'sweep',
      // SDD §6.0: a failed chain attempt is never a decision value — the attempt keeps its intent and records the error.
      decision: 'SWEPT',
      inputs: { policyLive: policyLive ? 1 : 0 },
      outputs: {
        cardId: base.cardId,
        beneficiaryId: base.beneficiaryId,
        error: code,
        ...(revoke === undefined ? {} : { revoke }),
        ...(attempt === undefined ? {} : { attempt }),
      },
      txIds,
      createdAt: at,
    });
  });
  return {
    ...base,
    revokeTxId: revoke !== undefined && revoke.status === 'revoked' ? revoke.chainTxId : null,
    status: 'active',
    reason: code,
  };
}

/** The slice of a stored sweep decision's `outputs_json` that `priorAttempt` reads; every field is checked before use. */
interface StoredSweepOutputs {
  cardId?: unknown;
  attempt?: { kind?: unknown; chainTxId?: unknown; balanceBeforeStroops?: unknown } | null;
}

/**
 * The newest recorded revoke/sweep tx for the card, if its last decision row carries one. A card whose newest row has
 * no attempt (a failure before any tx was signed) has nothing in flight.
 */
function priorAttempt(db: Db, cardId: string): Attempt | null {
  const rows = db
    .prepare(`SELECT outputs_json FROM agent_decisions WHERE agent = 'sweep' AND decision = 'SWEPT' ORDER BY rowid DESC`)
    .all<{ outputs_json: string }>();
  for (const row of rows) {
    let outputs: StoredSweepOutputs | null;
    try {
      outputs = JSON.parse(row.outputs_json);
    } catch {
      continue;
    }
    if (typeof outputs !== 'object' || outputs === null || outputs.cardId !== cardId) continue;
    const attempt = outputs.attempt;
    if (
      typeof attempt === 'object' &&
      attempt !== null &&
      (attempt.kind === 'revoke' || attempt.kind === 'sweep') &&
      typeof attempt.chainTxId === 'string' &&
      (attempt.balanceBeforeStroops === null || typeof attempt.balanceBeforeStroops === 'string')
    ) {
      const balance = attempt.balanceBeforeStroops;
      return {
        kind: attempt.kind,
        chainTxId: attempt.chainTxId,
        balanceBeforeStroops: typeof balance === 'string' && /^\d+$/.test(balance) ? balance : null,
      };
    }
    return null;
  }
  return null;
}
