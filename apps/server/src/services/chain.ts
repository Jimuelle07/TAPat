// The chain write pipeline (SDD §4.2, §4.5): every Noir write becomes one `chain_txs` row that this module owns.
// The package signs and hands off; only this module decides what a failure means and persists the outcome.
import { randomUUID } from 'node:crypto';
import { Keypair, TransactionBuilder } from '@stellar/stellar-sdk';
import {
  GasHandoffError,
  GasSponsorError,
  NoirContractError,
  VeloAuthError,
  VeloError,
  VeloProviderError,
  VeloValidationError,
  signNoirCall,
  submitDirect,
  submitSponsored,
  type GasApi,
  type GasSubmitResult,
  type NoirAgentClient,
  type NoirOperation,
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

/** Reconciler looks at rows younger than this; older ones freeze as `submission_unknown` (SDD §4.5). */
const RECONCILE_WINDOW_MS = 120_000;

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

/** Velo status -> row columns. `submission_unknown` keeps the row for the reconciler. */
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
        status: 'failed',
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

function persist(db: Db, row: ChainTxRow, patch: RowPatch, at: number): void {
  Object.assign(row, patch, { updated_at: at });
  db.prepare(
    `UPDATE chain_txs
        SET status = ?, gas_mode = ?, velo_request_id = ?, inner_hash = ?, outer_hash = ?,
            error_code = ?, error = ?, updated_at = ?
      WHERE id = ?`,
  ).run(
    row.status,
    row.gas_mode,
    row.velo_request_id,
    row.inner_hash,
    row.outer_hash,
    row.error_code,
    row.error,
    row.updated_at,
    row.id,
  );
}

/**
 * Builds, signs, submits and records one Noir write. Throws only for programmer faults and contract rejections
 * raised by `prepare()`; every other outcome is persisted and returned (SDD §4.2).
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
    try {
      const hash = await submitDirect(deps.noir, signedXdr, op);
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
    } catch (error) {
      if (error instanceof NoirContractError) {
        persist(
          deps.db,
          row,
          { ...contractErrorPatch(error), status: 'failed', gas_mode: 'direct' },
          now(),
        );
        return;
      }
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
      // never resubmit; the reconciler skips direct rows (no velo_request_id), so this stays unknown for good.
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
    }
  };

  if (deps.config.GAS_MODE === 'direct' || deps.gas === null) {
    await direct();
  } else {
    let sponsored: GasSubmitResult | null = null;
    try {
      sponsored = await submitSponsored(deps.gas, signedXdr, {
        idempotencyKey: id,
        ...deps.gasOptions,
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
    if (sponsored !== null) persist(deps.db, row, mapGasResult(sponsored), now());
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

/**
 * Reads back one page of recently uncertain rows by identity. Never sponsors and never submits; a non-terminal
 * status writes nothing so the row freezes after the 2-minute window. Returns the rows made terminal.
 */
export async function reconcileOnce(
  deps: Pick<ChainDeps, 'db' | 'gas' | 'log' | 'now'>,
): Promise<number> {
  if (deps.gas === null) return 0;
  const now = deps.now ?? Date.now;
  const rows = deps.db
    .prepare(
      `SELECT id, velo_request_id, inner_hash FROM chain_txs
        WHERE status = 'submission_unknown'
          AND velo_request_id IS NOT NULL
          AND inner_hash IS NOT NULL
          AND updated_at > ?`,
    )
    .all<{ id: string; velo_request_id: string; inner_hash: string }>(now() - RECONCILE_WINDOW_MS);

  let settled = 0;
  for (const row of rows) {
    try {
      const result = await deps.gas.getStatus({
        requestId: row.velo_request_id,
        transactionHash: row.inner_hash,
      });
      const patch = mapGasResult(result);
      if (patch.status === 'submission_unknown') continue;
      // Guarded: a concurrent writer may have settled the row between the SELECT and here.
      const { changes } = deps.db
        .prepare(
          `UPDATE chain_txs
              SET status = ?, gas_mode = ?, velo_request_id = ?, inner_hash = ?, outer_hash = ?,
                  error_code = ?, error = ?, updated_at = ?
            WHERE id = ? AND status = 'submission_unknown'`,
        )
        .run(
          patch.status,
          patch.gas_mode,
          patch.velo_request_id,
          patch.inner_hash,
          patch.outer_hash,
          patch.error_code,
          patch.error,
          now(),
          row.id,
        );
      if (changes === 1) settled += 1;
    } catch (error) {
      deps.log.warn({ chainTxId: row.id, cause: error }, 'reconcile status read failed');
    }
  }
  return settled;
}

/** Runs `reconcileOnce` every `intervalMs`, skipping a tick while the previous one is still running. */
export function startReconciler(
  deps: Pick<ChainDeps, 'db' | 'gas' | 'log' | 'now'>,
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
