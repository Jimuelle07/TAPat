// The chain write pipeline (SDD §4.2, §4.5): every Noir write becomes one `chain_txs` row that this module owns.
// The package signs and hands off; only this module decides what a failure means and persists the outcome.
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { Keypair, TransactionBuilder } from '@stellar/stellar-sdk';
import {
  GasHandoffError,
  GasSponsorError,
  NoirContractError,
  VeloAuthError,
  VeloError,
  VeloProviderError,
  VeloValidationError,
  getTransactionOutcome,
  signNoirCall,
  submitDirect,
  submitSponsored,
  type GasApi,
  type GasSubmitResult,
  type NoirAgentClient,
  type NoirOperation,
  type OnChainOutcome,
  type SubmitSponsoredOptions,
} from '@tapat/agent';
import type { Config } from '../config';
import type { Db } from '../db/index';

export type ChainKind =
  | 'register'
  | 'register_agent'
  | 'fund'
  | 'authorize'
  | 'claim'
  | 'revoke_agent'
  | 'sweep'
  | 'revoke_device';

export interface ChainTxResult {
  chainTxId: string;
  status: 'succeeded' | 'failed' | 'submission_unknown';
  gasMode: 'velo' | 'direct';
  innerHash: string | null;
  outerHash: string | null;
  errorCode: string | null;
  error: string | null;
}

/** The logger surface this module needs; `app.log` satisfies it. */
export interface ChainLog {
  warn(obj: object, msg: string): void;
  error(obj: object, msg: string): void;
}

export interface ChainDeps {
  db: Db;
  noir: NoirAgentClient;
  /** null when GAS_MODE=direct. */
  gas: Pick<GasApi, 'sponsor' | 'submit' | 'getStatus' | 'waitForResult'> | null;
  config: Pick<
    Config,
    | 'GAS_MODE'
    | 'GAS_FALLBACK_DIRECT'
    | 'STELLAR_NETWORK_PASSPHRASE'
    | 'NOIR_DEVICE_REGISTRY_ID'
    | 'NOIR_AGENT_REGISTRY_ID'
    | 'NOIR_PAYMENT_ESCROW_ID'
  >;
  log: ChainLog;
  /** Tests pass retryDelayMs: 0 to keep the sponsor retry loop synchronous. */
  gasOptions?: Pick<SubmitSponsoredOptions, 'sponsorAttempts' | 'retryDelayMs' | 'wait'>;
  /** Chain confirmation poll for a sponsored row still `submission_unknown` after the Velo status (non-terminal, or a failed/cancelled hint). */
  confirm?: { timeoutMs?: number; pollMs?: number };
  /** Default Date.now. */
  now?: () => number;
}

type ChainTxStatus = 'pending' | 'succeeded' | 'failed' | 'submission_unknown';

interface ChainTxRow {
  id: string;
  kind: ChainKind;
  contract_id: string;
  method: string;
  source_public: string;
  status: ChainTxStatus;
  gas_mode: 'velo' | 'direct';
  velo_request_id: string | null;
  inner_hash: string | null;
  outer_hash: string | null;
  error_code: string | null;
  error: string | null;
  created_at: number;
  updated_at: number;
}

/** The columns a status transition writes; `updated_at` is always stamped by `persist`. */
type RowFields = Pick<
  ChainTxRow,
  'status' | 'velo_request_id' | 'inner_hash' | 'outer_hash' | 'error_code' | 'error' | 'gas_mode'
>;

/** A transition sets only the columns it knows about; `mapGasResult` fills all of them. */
type RowPatch = Partial<RowFields>;

type ContractKey = 'NOIR_DEVICE_REGISTRY_ID' | 'NOIR_AGENT_REGISTRY_ID' | 'NOIR_PAYMENT_ESCROW_ID';

interface OpDef {
  kind: ChainKind;
  contract: ContractKey;
  method: string;
}

/**
 * Reconciler looks at rows younger than this; older ones freeze as `submission_unknown` (SDD §4.5). It covers the
 * 300 s transaction validity the SDK's `prepare()` sets, plus 60 s for the ledger to close and RPC to index.
 */
const RECONCILE_WINDOW_MS = 360_000;

/**
 * Velo's status lags the chain by minutes, so the sponsored wait is short: the chain check below is the confirmation.
 */
const VELO_WAIT = { timeoutMs: 10_000, maxAttempts: 5 };

/** Chain confirmation defaults: 30 s of reads, every 2 s. */
const CONFIRM_DEFAULTS = { timeoutMs: 30_000, pollMs: 2_000 };

/**
 * Messages `@noirx402/agent-sdk@0.3.0` throws when the network definitely did not apply the transaction
 * (`dist/client.js` `submit`: `<label> rejected by the network:` when sendTransaction returns ERROR, and
 * `<label> failed on-chain (<hash>)` when the transaction landed but failed). Its other throws — notably
 * `<label> not confirmed after 60s (<hash>)` — leave the outcome open, as does any transport error.
 */
const DIRECT_TERMINAL_FAILURE = [' rejected by the network: ', ' failed on-chain ('] as const;

/**
 * `op.kind` -> row kind/contract/method. A missing kind is a compile error; `defundEscrow` has no row because TAPat
 * never defunds an escrow (`null` keeps the record exhaustive).
 */
const OP_TABLE: Record<NoirOperation['kind'], OpDef | null> = {
  registerDevice: { kind: 'register', contract: 'NOIR_DEVICE_REGISTRY_ID', method: 'register' },
  revokeDevice: { kind: 'revoke_device', contract: 'NOIR_DEVICE_REGISTRY_ID', method: 'revoke' },
  registerAgent: { kind: 'register_agent', contract: 'NOIR_AGENT_REGISTRY_ID', method: 'register_agent' },
  revokeAgent: { kind: 'revoke_agent', contract: 'NOIR_AGENT_REGISTRY_ID', method: 'revoke_agent' },
  fundEscrow: { kind: 'fund', contract: 'NOIR_PAYMENT_ESCROW_ID', method: 'fund_escrow' },
  authorize: { kind: 'authorize', contract: 'NOIR_PAYMENT_ESCROW_ID', method: 'authorize' },
  claim: { kind: 'claim', contract: 'NOIR_PAYMENT_ESCROW_ID', method: 'claim' },
  sweepOnRevoke: { kind: 'sweep', contract: 'NOIR_PAYMENT_ESCROW_ID', method: 'sweep_on_revoke' },
  defundEscrow: null,
};

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function contractErrorPatch(error: NoirContractError): { error_code: string; error: string } {
  return {
    error_code: `CONTRACT_${error.errorName}`,
    error: `${error.message} (code ${error.code}, method ${error.method})`,
  };
}

/**
 * Velo status -> row columns. `failed`/`cancelled` means the Gas Station stopped, not that the network refused the
 * transaction: `prepare()` gives it 300 s of validity, so the row stays `submission_unknown` with the Gas Station code
 * as a hint and only the chain settles it (AGENTS.md money §4).
 */
function mapGasResult(result: GasSubmitResult): RowFields {
  const base = {
    velo_request_id: result.requestId,
    inner_hash: result.transactionHash,
    outer_hash: result.outerTransactionHash,
    error_code: null as string | null,
    error: null as string | null,
  };
  switch (result.status) {
    case 'succeeded':
      return { ...base, status: 'succeeded', gas_mode: 'velo' };
    case 'failed':
    case 'cancelled':
      return {
        ...base,
        status: 'submission_unknown',
        gas_mode: 'velo',
        error_code: result.status === 'failed' ? 'GAS_FAILED' : 'GAS_CANCELLED',
        error: `Gas Station status ${result.status} (request ${result.requestId})`,
      };
    case 'claimed':
    case 'submitted':
    case 'submission_unknown':
      return { ...base, status: 'submission_unknown', gas_mode: 'velo' };
  }
}

/** Error code for a failed sponsorship: the cause's Velo class decides what the operator has to fix. */
function sponsorErrorCode(cause: unknown): string {
  if (!(cause instanceof VeloError)) return 'GAS_UNAVAILABLE';
  if (cause instanceof VeloProviderError) return 'GAS_UNAVAILABLE';
  if (cause instanceof VeloAuthError) return 'VELO_AUTH';
  return cause.constructor.name;
}

const ROW_UPDATE = `UPDATE chain_txs
    SET status = ?, gas_mode = ?, velo_request_id = ?, inner_hash = ?, outer_hash = ?,
        error_code = ?, error = ?, updated_at = ?
  WHERE id = ?`;

/** Runs the full-row update; `guard` appends a `status` predicate for a conditional write. */
function runRowUpdate(db: Db, row: ChainTxRow, guard = ''): number {
  return db
    .prepare(ROW_UPDATE + guard)
    .run(
      row.status,
      row.gas_mode,
      row.velo_request_id,
      row.inner_hash,
      row.outer_hash,
      row.error_code,
      row.error,
      row.updated_at,
      row.id,
    ).changes;
}

function persist(db: Db, row: ChainTxRow, patch: RowPatch, at: number): void {
  const next: ChainTxRow = { ...row, ...patch, updated_at: at };
  const changes = runRowUpdate(db, next);
  // An unconditional write that matched nothing means the row is gone; keep the caller's view of it.
  if (changes === 1) Object.assign(row, next);
}

/**
 * A confirmation write that only lands while the row is still `submission_unknown`. A concurrent writer that settled
 * it first wins, and the in-memory row is left as it was so the returned result matches what was written.
 */
function persistIfUncertain(db: Db, row: ChainTxRow, patch: RowPatch, at: number): boolean {
  const next: ChainTxRow = { ...row, ...patch, updated_at: at };
  const changes = runRowUpdate(db, next, ` AND status = 'submission_unknown'`);
  if (changes === 1) Object.assign(row, next);
  return changes === 1;
}

/**
 * Confirms a sponsored row by its inner hash, because Velo's status lags the chain by minutes. Polls until the hash
 * is indexed, the window ends, or the reads keep failing; a read error is logged and retried. Never resubmits, so a
 * row still unknown at the end stays `submission_unknown` for the reconciler. Writes are guarded on the row still
 * being `submission_unknown`: another writer's verdict is never overwritten (decision C-c).
 */
async function confirmOnChain(deps: ChainDeps, row: ChainTxRow, at: () => number): Promise<void> {
  const innerHash = row.inner_hash;
  if (innerHash === null) return;
  const timeoutMs = deps.confirm?.timeoutMs ?? CONFIRM_DEFAULTS.timeoutMs;
  const pollMs = deps.confirm?.pollMs ?? CONFIRM_DEFAULTS.pollMs;
  const deadline = at() + timeoutMs;
  for (;;) {
    let outcome: OnChainOutcome | null = null;
    try {
      outcome = await getTransactionOutcome(deps.noir, innerHash);
    } catch (cause) {
      deps.log.warn({ chainTxId: row.id, cause }, 'chain confirmation read failed');
    }
    if (outcome === 'succeeded') {
      persistIfUncertain(deps.db, row, { status: 'succeeded', error_code: null, error: null }, at());
      return;
    }
    if (outcome === 'failed') {
      persistIfUncertain(
        deps.db,
        row,
        { status: 'failed', error_code: 'CHAIN_FAILED', error: `Transaction ${innerHash} failed on chain` },
        at(),
      );
      return;
    }
    // Not indexed yet (or unreadable): wait for the next ledger, always after at least one read.
    if (at() >= deadline) return;
    await sleep(pollMs);
  }
}

/**
 * One chain read that decides whether a transaction the Gas Station reported as not succeeded actually applied. A
 * Velo `failed`/`cancelled` says the Gas Station stopped, not that the network refused the transaction, so it is not
 * a retry signal on its own (AGENTS.md money §4). Returns the row columns the read proves, or `null` when the hash is
 * unindexed or the read failed: the caller writes nothing, so the row stays `submission_unknown` with the Gas Station
 * code as a hint. Never polls and never resubmits.
 */
async function readChainVerdict(
  deps: Pick<ChainDeps, 'noir' | 'log'>,
  chainTxId: string,
  innerHash: string,
): Promise<{ status: 'succeeded'; error_code: null; error: null } | {
  status: 'failed';
  error_code: 'CHAIN_FAILED';
  error: string;
} | null> {
  let outcome: OnChainOutcome;
  try {
    outcome = await getTransactionOutcome(deps.noir, innerHash);
  } catch (cause) {
    deps.log.warn({ chainTxId, cause }, 'chain read after a Velo failure failed');
    return null;
  }
  if (outcome === 'succeeded') return { status: 'succeeded', error_code: null, error: null };
  if (outcome === 'failed') {
    return { status: 'failed', error_code: 'CHAIN_FAILED', error: `Transaction ${innerHash} failed on chain` };
  }
  return null;
}

/**
 * Builds, signs, submits and records one Noir write. A contract rejection raised by `prepare()` marks the row failed
 * and rethrows (`CONTRACT_*`); every other outcome the pipeline can classify is persisted and returned (SDD §4.2).
 * A persistence fault after a confirmed send propagates with the effect already applied and the row left `pending`:
 * callers must treat any throw other than a `prepare()` rejection (`NoirContractError`/`PREPARE_FAILED`) as
 * non-retryable. Boot recovery turns such a row into `HANDOFF_INTERRUPTED`.
 */
export async function runChainTx(
  deps: ChainDeps,
  signer: Keypair,
  op: NoirOperation,
): Promise<ChainTxResult> {
  const def = OP_TABLE[op.kind];
  if (def === null) throw new Error('defundEscrow is not used by TAPat');
  const now = deps.now ?? Date.now;
  const id = randomUUID();
  const createdAt = now();
  const row: ChainTxRow = {
    id,
    kind: def.kind,
    contract_id: deps.config[def.contract],
    method: def.method,
    source_public: signer.publicKey(),
    status: 'pending',
    gas_mode: deps.config.GAS_MODE,
    velo_request_id: null,
    inner_hash: null,
    outer_hash: null,
    error_code: null,
    error: null,
    created_at: createdAt,
    updated_at: createdAt,
  };
  deps.db
    .prepare(
      `INSERT INTO chain_txs
         (id, kind, contract_id, method, source_public, status, gas_mode,
          velo_request_id, inner_hash, outer_hash, error_code, error, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      row.id,
      row.kind,
      row.contract_id,
      row.method,
      row.source_public,
      row.status,
      row.gas_mode,
      row.velo_request_id,
      row.inner_hash,
      row.outer_hash,
      row.error_code,
      row.error,
      row.created_at,
      row.updated_at,
    );

  // The SDK simulates, attaches the footprint and sets the resource fee; the acting account signs.
  let signedXdr: string;
  try {
    signedXdr = await signNoirCall(deps.noir, signer, op, deps.config.STELLAR_NETWORK_PASSPHRASE);
  } catch (error) {
    const patch =
      error instanceof NoirContractError
        ? contractErrorPatch(error)
        : { error_code: 'PREPARE_FAILED', error: messageOf(error) };
    persist(deps.db, row, { ...patch, status: 'failed', gas_mode: deps.config.GAS_MODE }, now());
    throw error;
  }

  // Same hash the Gas Station reports as `transactionHash`, computed before any hand-off.
  let innerHash: string;
  try {
    innerHash = TransactionBuilder.fromXDR(signedXdr, deps.config.STELLAR_NETWORK_PASSPHRASE)
      .hash()
      .toString('hex');
  } catch (error) {
    // Nothing was handed off yet, so this is still a prepare failure.
    persist(
      deps.db,
      row,
      { status: 'failed', gas_mode: deps.config.GAS_MODE, error_code: 'PREPARE_FAILED', error: messageOf(error) },
      now(),
    );
    throw error;
  }
  persist(deps.db, row, { status: 'pending', gas_mode: deps.config.GAS_MODE, inner_hash: innerHash }, now());

  const direct = async (): Promise<void> => {
    // Persisted before the send: a crash mid-hand-off must read as handed off, so the boot repair classifies this
    // row from `gas_mode` alone (decision C-a). The inner hash is already on the row and is kept.
    persist(deps.db, row, { status: 'pending', gas_mode: 'direct', inner_hash: innerHash }, now());
    let hash: string;
    try {
      hash = await submitDirect(deps.noir, signedXdr, op);
    } catch (error) {
      // The pinned SDK's `submit` throws only plain Errors (`NoirContractError` comes from `prepare()`), so the
      // message patterns are the whole classification here.
      const message = messageOf(error);
      const terminal = DIRECT_TERMINAL_FAILURE.some((pattern) => message.includes(pattern));
      if (terminal) {
        persist(
          deps.db,
          row,
          { status: 'failed', gas_mode: 'direct', error_code: 'DIRECT_FAILED', error: message },
          now(),
        );
        return;
      }
      // Unconfirmed or transport-level: the transaction may still land. Freeze the locally computed inner hash and
      // never resubmit; the reconciler confirms it against the chain.
      persist(
        deps.db,
        row,
        {
          status: 'submission_unknown',
          gas_mode: 'direct',
          inner_hash: innerHash,
          outer_hash: null,
          error_code: 'DIRECT_UNKNOWN',
          error: message,
        },
        now(),
      );
      return;
    }
    // After the classification: a persistence fault must propagate, not relabel a confirmed send as failed.
    persist(
      deps.db,
      row,
      {
        status: 'succeeded',
        gas_mode: 'direct',
        inner_hash: hash,
        outer_hash: null,
        error_code: null,
        error: null,
      },
      now(),
    );
  };

  if (deps.config.GAS_MODE === 'direct' || deps.gas === null) {
    await direct();
  } else {
    let sponsored: GasSubmitResult | null = null;
    try {
      sponsored = await submitSponsored(deps.gas, signedXdr, {
        idempotencyKey: id,
        ...deps.gasOptions,
        wait: deps.gasOptions?.wait ?? VELO_WAIT,
        onReserved: (identity) =>
          // Persisted before the hand-off: a crash from here on is reconciled by identity, never resubmitted.
          persist(
            deps.db,
            row,
            {
              status: 'pending',
              gas_mode: 'velo',
              velo_request_id: identity.requestId,
              inner_hash: identity.transactionHash,
            },
            now(),
          ),
        onRetry: (attempt, error) =>
          deps.log.warn({ chainTxId: id, attempt, cause: error }, 'sponsor retry'),
        onUncertainHandoff: (error) =>
          deps.log.warn({ chainTxId: id, cause: error }, 'hand-off uncertain; reading status by identity'),
      });
    } catch (error) {
      if (error instanceof GasSponsorError) {
        // Nothing was handed off, so the same XDR may still go direct.
        if (error.cause instanceof VeloValidationError) {
          deps.log.error({ chainTxId: id, cause: error.cause }, 'Gas Station rejected our envelope');
        }
        if (deps.config.GAS_FALLBACK_DIRECT) {
          deps.log.warn({ chainTxId: id }, 'sponsor failed before hand-off; sending direct');
          await direct();
        } else {
          persist(
            deps.db,
            row,
            {
              status: 'failed',
              gas_mode: 'velo',
              error_code: sponsorErrorCode(error.cause),
              error: messageOf(error.cause),
            },
            now(),
          );
        }
      } else if (error instanceof GasHandoffError) {
        // submit() may have reached Velo: never fall back, never resubmit; the reconciler owns the row.
        persist(
          deps.db,
          row,
          {
            status: 'submission_unknown',
            gas_mode: 'velo',
            velo_request_id: error.identity.requestId,
            inner_hash: error.identity.transactionHash,
            error_code: 'GAS_HANDOFF_UNKNOWN',
            error: messageOf(error.cause),
          },
          now(),
        );
      } else {
        persist(
          deps.db,
          row,
          { status: 'failed', gas_mode: row.gas_mode, error_code: 'INTERNAL', error: messageOf(error) },
          now(),
        );
        throw error;
      }
    }
    // Outside the classification try/catch: a persistence fault must surface, not rewrite the row as failed/INTERNAL.
    // A Velo `failed`/`cancelled` maps to `submission_unknown` (the Gas Station stopping proves nothing), so
    // `confirmOnChain` below is the one chain read that decides from the inner hash.
    if (sponsored !== null) persist(deps.db, row, mapGasResult(sponsored), now());
  }

  // Also outside the classification try/catch: an unknown Velo outcome — including the `failed`/`cancelled` hint — is
  // confirmed against the chain itself. Still unindexed when the poll ends, the row keeps its hint for the reconciler.
  if (row.status === 'submission_unknown' && row.gas_mode === 'velo') {
    await confirmOnChain(deps, row, now);
  }

  const final = deps.db.prepare('SELECT * FROM chain_txs WHERE id = ?').get<ChainTxRow>(id);
  if (final === undefined) throw new Error(`chain_txs row ${id} disappeared`);
  if (final.status === 'pending') throw new Error(`chain_txs row ${id} left pending`);
  return {
    chainTxId: final.id,
    status: final.status,
    gasMode: final.gas_mode,
    innerHash: final.inner_hash,
    outerHash: final.outer_hash,
    errorCode: final.error_code,
    error: final.error,
  };
}

interface ReconcileRow {
  id: string;
  velo_request_id: string | null;
  inner_hash: string;
  outer_hash: string | null;
}

/**
 * One guarded status transition. The `WHERE status = 'submission_unknown'` is the guard: a concurrent writer that
 * settled the row between the SELECT and here makes the update miss, and only a hit is counted.
 */
function settleGuarded(
  deps: Pick<ChainDeps, 'db'>,
  row: ReconcileRow,
  patch: {
    status: 'succeeded' | 'failed';
    error_code: string | null;
    error: string | null;
    outer_hash?: string | null;
  },
  at: number,
): boolean {
  const { changes } = deps.db
    .prepare(
      `UPDATE chain_txs
          SET status = ?, error_code = ?, error = ?, outer_hash = ?, updated_at = ?
        WHERE id = ? AND status = 'submission_unknown'`,
    )
    .run(patch.status, patch.error_code, patch.error, patch.outer_hash ?? row.outer_hash, at, row.id);
  return changes === 1;
}

/**
 * Reads back recently uncertain rows by identity and by hash. Velo's status settles a sponsored row when it turns
 * `succeeded`; a `failed`/`cancelled` only decides through one chain read, and an unproven outcome writes nothing so
 * the row freezes as `submission_unknown` once it leaves the window. Otherwise the chain itself decides from the
 * inner hash (a direct row has no Velo identity). Never sponsors and never submits. Returns the rows made terminal.
 */
export async function reconcileOnce(
  deps: Pick<ChainDeps, 'db' | 'noir' | 'gas' | 'log' | 'now'>,
): Promise<number> {
  const now = deps.now ?? Date.now;
  const rows = deps.db
    .prepare(
      `SELECT id, velo_request_id, inner_hash, outer_hash FROM chain_txs
        WHERE status = 'submission_unknown'
          AND inner_hash IS NOT NULL
          AND updated_at > ?`,
    )
    .all<ReconcileRow>(now() - RECONCILE_WINDOW_MS);

  let settled = 0;
  for (const row of rows) {
    let veloOuterHash: string | null = null;
    if (deps.gas !== null && row.velo_request_id !== null) {
      try {
        const result = await deps.gas.getStatus({
          requestId: row.velo_request_id,
          transactionHash: row.inner_hash,
        });
        if (result.status === 'succeeded') {
          const patch = {
            status: 'succeeded' as const,
            error_code: null,
            error: null,
            outer_hash: result.outerTransactionHash,
          };
          if (settleGuarded(deps, row, patch, now())) settled += 1;
          continue;
        }
        if (result.status === 'failed' || result.status === 'cancelled') {
          // The Gas Station stopping is not proof the transaction did not apply (decision C-b/F2): only a chain read
          // decides. No verdict — or an unreadable chain — writes nothing and does not read again this tick.
          const verdict = await readChainVerdict(deps, row.id, row.inner_hash);
          if (verdict !== null && settleGuarded(deps, row, verdict, now())) settled += 1;
          continue;
        }
        veloOuterHash = result.outerTransactionHash;
      } catch (error) {
        deps.log.warn({ chainTxId: row.id, cause: error }, 'reconcile status read failed');
      }
    }
    let outcome: OnChainOutcome;
    try {
      outcome = await getTransactionOutcome(deps.noir, row.inner_hash);
    } catch (error) {
      deps.log.warn({ chainTxId: row.id, cause: error }, 'reconcile chain read failed');
      continue;
    }
    if (outcome === 'not_found') continue;
    const outerHash = veloOuterHash ?? row.outer_hash;
    const patch =
      outcome === 'succeeded'
        ? { status: 'succeeded' as const, error_code: null, error: null, outer_hash: outerHash }
        : {
            status: 'failed' as const,
            error_code: 'CHAIN_FAILED',
            error: `Transaction ${row.inner_hash} failed on chain`,
            outer_hash: outerHash,
          };
    if (settleGuarded(deps, row, patch, now())) settled += 1;
  }
  return settled;
}

/**
 * Boot-time repair for rows a previous process left `pending` (API boot only: no runChainTx is in flight yet).
 * Nothing was handed off when the inner hash is missing, or when the row still says `gas_mode = 'velo'` with no
 * `velo_request_id`: `sponsor()` never submits, and the direct path persists `gas_mode = 'direct'` before it sends,
 * so such a row is safely retryable. Every other pending row may be on chain, so it becomes `submission_unknown`
 * and the reconciler decides from the chain; it is never resubmitted.
 */
export function recoverInterruptedTxs(
  deps: Pick<ChainDeps, 'db' | 'log' | 'now'>,
): { failed: number; unknown: number } {
  const at = (deps.now ?? Date.now)();
  const failed = deps.db
    .prepare(
      `UPDATE chain_txs
          SET status = 'failed', error_code = 'PREPARE_INTERRUPTED', error = ?, updated_at = ?
        WHERE status = 'pending'
          AND (inner_hash IS NULL OR (gas_mode = 'velo' AND velo_request_id IS NULL))`,
    )
    .run('Process exited before the transaction was handed off', at).changes;
  const unknown = deps.db
    .prepare(
      `UPDATE chain_txs
          SET status = 'submission_unknown', error_code = 'HANDOFF_INTERRUPTED', error = ?, updated_at = ?
        WHERE status = 'pending'
          AND inner_hash IS NOT NULL
          AND NOT (gas_mode = 'velo' AND velo_request_id IS NULL)`,
    )
    .run('Process exited during the hand-off; the transaction may be on chain', at).changes;
  if (failed > 0 || unknown > 0) {
    deps.log.warn({ failed, unknown }, 'recovered chain_txs rows a previous process left pending');
  }
  return { failed, unknown };
}

/** Runs `reconcileOnce` every `intervalMs`, skipping a tick while the previous one is still running. */
export function startReconciler(
  deps: Pick<ChainDeps, 'db' | 'noir' | 'gas' | 'log' | 'now'>,
  intervalMs = 5000,
): () => void {
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    reconcileOnce(deps).then(
      () => {
        running = false;
      },
      (error: unknown) => {
        running = false;
        deps.log.warn({ cause: error }, 'reconcile tick failed');
      },
    );
  }, intervalMs);
  return () => clearInterval(timer);
}
