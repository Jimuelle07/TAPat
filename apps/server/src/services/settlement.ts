// Settlement runner (SDD §6.7, api-and-data.md §5.2 #17): per station, claim everything pending with one SAC transfer
// signed by that station's key — unless the station is frozen, in which case the money stays in escrow and a `HELD`
// decision records the amount. Nothing here can cancel a pending payment; unfreeze is the only release (SDD §3.9).
import { randomUUID } from 'node:crypto';
import { Keypair } from '@stellar/stellar-sdk';
import { NoirContractError, decryptSecret } from '@tapat/agent';
import type { SettlementResponse, StationStatus } from '@tapat/shared';
import type { Config } from '../config';
import type { Db } from '../db/index';
import { ApiError } from '../errors';
import { latestFailedChainTxId, readChainTx, runChainTx, type ChainDeps } from './chain';
import { getCurrentProgram } from './program';
import type { SseBus } from './sse';
import { stationMoney } from './stations';
import { toAgentDecision } from './tranche';

export interface SettlementDeps {
  db: Db;
  chain: ChainDeps;
  bus: SseBus;
  config: Pick<Config, 'KEY_ENCRYPTION_SECRET' | 'XLM_SAC_ID'>;
  now?: () => number;
  id?: () => string;
}

/** The columns a claim needs; `secret_enc` never leaves this module. */
interface StationClaimRow {
  id: string;
  name: string;
  public_key: string;
  secret_enc: string;
  status: StationStatus;
}

interface DecisionRow {
  id: string;
  agent: 'settlement';
  decision: string;
  inputs_json: string;
  outputs_json: string;
  tx_ids_json: string;
  created_at: number;
}

/**
 * `POST /api/settlement/run`: one decision row and one `settlement` SSE event per station, in `id` order. A failed
 * claim does not stop the remaining stations; the run answers `502 CHAIN_ERROR` once they have all run.
 */
export async function runSettlement(deps: SettlementDeps): Promise<SettlementResponse> {
  const now = deps.now ?? Date.now;
  const newId = deps.id ?? ((): string => `dec_${randomUUID().replaceAll('-', '').slice(0, 8)}`);
  // The run settles a program's taps; without one there is nothing to hold or claim (api-and-data.md §5.2 #17).
  if (getCurrentProgram(deps.db) === null) throw new ApiError(404, 'NOT_FOUND', 'no program; run seed-demo.ts');

  const writeDecision = (
    decision: string,
    inputs: Record<string, unknown>,
    outputs: Record<string, unknown>,
    txIds: string[],
  ): DecisionRow => {
    const row: DecisionRow = {
      id: newId(),
      agent: 'settlement',
      decision,
      inputs_json: JSON.stringify(inputs),
      outputs_json: JSON.stringify(outputs),
      tx_ids_json: JSON.stringify(txIds),
      created_at: now(),
    };
    deps.db
      .prepare(
        `INSERT INTO agent_decisions (id, agent, decision, inputs_json, outputs_json, tx_ids_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(row.id, row.agent, row.decision, row.inputs_json, row.outputs_json, row.tx_ids_json, row.created_at);
    deps.bus.publish('settlement', toAgentDecision(row));
    return row;
  };

  const stations = deps.db
    .prepare('SELECT id, name, public_key, secret_enc, status FROM stations ORDER BY id')
    .all<StationClaimRow>();
  const settled: SettlementResponse['stations'] = [];
  const failures: string[] = [];

  for (const station of stations) {
    const { pendingStroops } = stationMoney(deps.db, station);
    const pending = pendingStroops.toString();

    // Nothing since the last succeeded claim: no transaction, and the decision keeps the audit trail complete.
    if (pendingStroops === 0n) {
      const row = writeDecision(
        'NOTHING_PENDING',
        { stationStatus: station.status, pendingStroops: pending },
        { stationId: station.id, stationName: station.name, amountStroops: pending },
        [],
      );
      settled.push({
        stationId: station.id,
        stationName: station.name,
        pendingStroops: pending,
        action: 'nothing_pending',
        chainTxId: null,
        decisionId: row.id,
      });
      continue;
    }

    // Frozen: the payment is owed to the station but not released. No transaction, the amount is held in escrow.
    if (station.status === 'frozen') {
      const row = writeDecision(
        'HELD',
        { stationStatus: station.status, pendingStroops: pending },
        { stationId: station.id, stationName: station.name, amountStroops: pending, held: true },
        [],
      );
      settled.push({
        stationId: station.id,
        stationName: station.name,
        pendingStroops: pending,
        action: 'held',
        chainTxId: null,
        decisionId: row.id,
      });
      continue;
    }

    // Active: one `claim(XLM_SAC, station)` for everything pending, signed by the station's own key. The signer must
    // be the key behind `stations.public_key`: `claimBoundary` finds this claim by `source_public` (SDD §6.7), so a
    // mismatched signer would make the next run re-claim the same taps.
    let chainTxId: string | null = null;
    let claimed = false;
    let error: string | null = null;
    let signer: Keypair | null = null;
    try {
      signer = Keypair.fromSecret(decryptSecret(station.secret_enc, deps.config.KEY_ENCRYPTION_SECRET));
      const result = await runChainTx(deps.chain, signer, { kind: 'claim', token: deps.config.XLM_SAC_ID });
      chainTxId = result.chainTxId;
      claimed = result.status === 'succeeded';
      if (!claimed) error = result.errorCode ?? result.error ?? 'chain transaction did not succeed';
      const tx = readChainTx(deps.db, result.chainTxId);
      if (tx !== null) deps.bus.publish('chain_tx', tx);
    } catch (cause) {
      // `runChainTx` wrote its row before simulating and threw before returning the id.
      error =
        cause instanceof NoirContractError
          ? `CONTRACT_${cause.errorName}`
          : cause instanceof Error
            ? cause.message
            : String(cause);
      chainTxId = signer === null ? null : latestFailedChainTxId(deps.db, 'claim', signer.publicKey());
      const failedTx = chainTxId === null ? null : readChainTx(deps.db, chainTxId);
      if (failedTx !== null) deps.bus.publish('chain_tx', failedTx);
    }
    if (error !== null) failures.push(`station ${station.id}: ${error}`);

    const row = writeDecision(
      'CLAIMED',
      { stationStatus: station.status, pendingStroops: pending },
      {
        stationId: station.id,
        stationName: station.name,
        amountStroops: pending,
        claimed,
        ...(error === null ? {} : { error }),
      },
      chainTxId === null ? [] : [chainTxId],
    );
    settled.push({
      stationId: station.id,
      stationName: station.name,
      pendingStroops: pending,
      action: 'claimed',
      chainTxId,
      decisionId: row.id,
    });
  }

  // Every station has run; only now does the failure surface (api-and-data.md §5.2 #17).
  if (failures.length > 0) throw new ApiError(502, 'CHAIN_ERROR', failures.join('; '));
  return { stations: settled };
}
