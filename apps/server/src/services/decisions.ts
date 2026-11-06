// `agent_decisions` row -> the REST shape (docs/api-and-data.md §3) and the one insert every service uses.
// `inputs_json` carries the numbers the decision used, `outputs_json` the result, `tx_ids_json` its chain txs.
import { randomUUID } from 'node:crypto';
import type { AgentDecision, AgentName } from '@tapat/shared';
import type { Db } from '../db/index';

export interface DecisionRow {
  id: string;
  agent: AgentName;
  decision: string;
  inputs_json: string;
  outputs_json: string;
  tx_ids_json: string;
  created_at: number;
}

/** The SSE `tranche`/`settlement`/`sweep`/`intake` payload; every JSON column is parsed. */
export function toAgentDecision(row: DecisionRow): AgentDecision {
  return {
    id: row.id,
    agent: row.agent,
    decision: row.decision,
    inputs: JSON.parse(row.inputs_json) as Record<string, unknown>,
    outputs: JSON.parse(row.outputs_json) as Record<string, unknown>,
    txIds: JSON.parse(row.tx_ids_json) as string[],
    createdAt: row.created_at,
  };
}

export interface NewDecision {
  agent: AgentName;
  /** The closed vocabulary for that agent (SDD §6.0); never a failure code. */
  decision: string;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  txIds?: string[];
  createdAt: number;
  /** Test seam for the `dec_` id. */
  id?: string;
}

/** Writes one row and returns it as the REST shape, ready for the matching SSE event. */
export function insertDecision(db: Db, decision: NewDecision): AgentDecision {
  const row: DecisionRow = {
    id: decision.id ?? `dec_${randomUUID().replaceAll('-', '').slice(0, 8)}`,
    agent: decision.agent,
    decision: decision.decision,
    inputs_json: JSON.stringify(decision.inputs ?? {}),
    outputs_json: JSON.stringify(decision.outputs ?? {}),
    tx_ids_json: JSON.stringify(decision.txIds ?? []),
    created_at: decision.createdAt,
  };
  db.prepare(
    `INSERT INTO agent_decisions (id, agent, decision, inputs_json, outputs_json, tx_ids_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.agent,
    row.decision,
    row.inputs_json,
    row.outputs_json,
    row.tx_ids_json,
    row.created_at,
  );
  return toAgentDecision(row);
}
