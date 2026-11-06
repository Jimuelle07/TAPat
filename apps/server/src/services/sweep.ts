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

/**
 * `POST /api/program/end`. Only an `active` program can be ended, so a second call answers 409 `INVALID_STATE`.
 * A card that fails mid-way keeps its `status` and its `reason`; the rest of the cards still run and the response is
 * still 200. `502 CHAIN_ERROR` is reserved for the one unrecoverable failure: the program row cannot move to `ended`.
 */
export async function endProgram(deps: SweepDeps): Promise<EndProgramResponse> {
  const now = deps.now ?? Date.now;
  const program = getCurrentProgram(deps.db);
  if (program === null) throw new ApiError(404, 'NOT_FOUND', 'no program; run seed-demo.ts');
  if (program.status !== 'active' && program.status !== 'ending') {
    throw new ApiError(409, 'INVALID_STATE', `program is ${program.status}`);
  }

  // Claim the end before any chain call: a concurrent request sees `ending`, and `ending` itself is a resume after a
  // call the process did not finish (api-and-data.md §5.2 #5: the sweep is safe to re-call).
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

  const totalReturned = outcomes.reduce((sum, card) => sum + BigInt(card.returnedStroops), 0n);
  const programEnded = deps.db.transaction((): NewDecision | null => {
    const ended = deps.db
      .prepare(`UPDATE program SET status = 'ended' WHERE id = ? AND status = 'ending'`)
      .run(program.id);
    if (ended.changes !== 1) return null;
    return {
      agent: 'sweep',
      decision: 'PROGRAM_ENDED',
      inputs: { cardsProcessed: outcomes.length, cardsSwept: outcomes.filter((c) => c.status === 'swept').length },
      outputs: {
        totalReturnedStroops: String(totalReturned),
        cards: outcomes.map((card) => ({
          cardId: card.cardId,
          returnedStroops: card.returnedStroops,
          status: card.status,
          reason: card.reason,
        })),
      },
      txIds: outcomes.flatMap((card) => [card.revokeTxId, card.sweepTxId]).filter((id): id is string => id !== null),
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

  let policyLive = false;
  try {
    const policy: AgentPolicy | null = await deps.chain.noir.getPolicy(card.device_hash);
    policyLive = policy !== null && (policy.expiresAt === null || policy.expiresAt.getTime() >= at);

    let revoke: RevokeOutcome;
    if (!policyLive) {
      // An expired (or absent) policy already allows a sweep, and `revoke_agent` panics `AgentNotFound` without one.
      revoke = { status: 'skipped', reason: policy === null ? 'NO_POLICY' : 'EXPIRED_POLICY' };
    } else {
      const revoked = await runChainTx(deps.chain, deps.programWallet, {
        kind: 'revokeAgent',
        deviceHash: card.device_hash,
      });
      publishChainTx(deps, revoked.chainTxId);
      if (revoked.status !== 'succeeded') {
        return failedCard(deps, base, {
          at,
          policyLive,
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
    // A chain read failed or `prepare()` refused: the card stays `active` and the loop moves on.
    return failedCard(deps, base, { at, policyLive, code: errorCodeOf(error), error });
  }
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
  code: string;
  error?: unknown;
}

/** A card the sweep could not release: `status` stays `active`, `reason` carries the code, the attempt records it. */
function failedCard(deps: SweepDeps, base: CardOutcome, failure: CardFailure): CardOutcome {
  const { at, policyLive, revoke, code, error } = failure;
  const message = error === undefined ? undefined : error instanceof Error ? error.message : String(error);
  deps.chain.log.warn({ cardId: base.cardId, code }, 'card sweep failed; card stays active');
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
      },
      txIds: revoke !== undefined && revoke.status === 'revoked' ? [revoke.chainTxId] : [],
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
