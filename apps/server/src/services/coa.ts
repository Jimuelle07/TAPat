// GET /api/export/coa.csv (api-and-data.md §5.2 #19): one row per money event, oldest first, the documented columns.
// Every row is derived from our own tables — `taps`, `chain_txs`, `velo_intents` and `agent_decisions` — so the export
// never needs a chain read and can be produced from an ended program.
import { stroopsToPhp, stroopsToXlmString } from '@tapat/shared';
import type { Db } from '../db/index';

/** The header, verbatim (api-and-data.md §5.2 #19): exactly these names, in this order. */
export const COA_COLUMNS = [
  'timestamp',
  'event',
  'card_hash_prefix',
  'station',
  'amount_php',
  'amount_xlm',
  'tx_hash',
  'agent_decision_id',
] as const;

export const COA_HEADER = COA_COLUMNS.join(',');

/** The closed event vocabulary of the export. */
export type CoaEvent =
  | 'fund'
  | 'tap_authorized'
  | 'tap_rejected'
  | 'settlement_claimed'
  | 'settlement_held'
  | 'sweep'
  | 'budget_credited';

export interface CoaRow {
  /** Unix ms — used for the oldest-first sort only. */
  at: number;
  event: CoaEvent;
  /** First 8 hex characters of `device_hash`; empty when the event belongs to no card. */
  cardHashPrefix: string;
  /** `stations.id`; empty for card-level and program-level events. */
  station: string;
  amountStroops: bigint | null;
  /** `chain_txs.outer_hash ?? inner_hash`; empty for a `HELD` decision. */
  txHash: string;
  /** Empty when the row came from a tap or a Velo payment. */
  agentDecisionId: string;
}

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

/** ISO-8601 in Asia/Manila (UTC+8, no DST) → `2026-11-05T10:12:04+08:00`. */
export function formatCoaTimestamp(ms: number): string {
  const iso = new Date(ms + MANILA_OFFSET_MS).toISOString();
  return `${iso.slice(0, 19)}+08:00`;
}

/** RFC 4180: quote a field that contains a comma, quote or newline; double its quotes. */
export function escapeCsvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** Row sort: oldest first, and a stable order for events that share a millisecond. */
const EVENT_ORDER: Record<CoaEvent, number> = {
  fund: 0,
  budget_credited: 1,
  tap_authorized: 2,
  tap_rejected: 3,
  settlement_claimed: 4,
  settlement_held: 5,
  sweep: 6,
};

interface TapRow {
  id: string;
  status: 'authorized' | 'rejected' | 'refused';
  amount_stroops: number;
  created_at: number;
  station_id: string;
  device_hash: string | null;
  outer_hash: string | null;
  inner_hash: string | null;
}

interface DecisionRow {
  id: string;
  agent: string;
  decision: string;
  outputs_json: string;
  tx_ids_json: string;
  created_at: number;
}

interface ChainTxRow {
  status: string;
  source_public: string;
  outer_hash: string | null;
  inner_hash: string | null;
}

interface CardRow {
  id: string;
  device_hash: string;
  returned_stroops: number;
}

interface IntentRow {
  id: string;
  amount: string;
  tx_hash: string | null;
  created_at: number;
  paid_at: number | null;
}

/** XLM decimal string (2 decimals per the schema) → stroops, exactly; `null` for anything else. */
function xlmStringToStroops(amount: string): bigint | null {
  const match = /^(\d+)(?:\.(\d{1,7}))?$/.exec(amount);
  if (match === null) return null;
  return BigInt(match[1] + (match[2] ?? '').padEnd(7, '0'));
}

function hashOf(row: ChainTxRow): string {
  return row.outer_hash ?? row.inner_hash ?? '';
}

function parseJson(text: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function firstTxId(txIdsJson: string): string | null {
  try {
    const parsed: unknown = JSON.parse(txIdsJson) as unknown;
    return Array.isArray(parsed) && typeof parsed[0] === 'string' ? parsed[0] : null;
  } catch {
    return null;
  }
}

function decisionRows(db: Db, agent: string, decisions: readonly string[]): DecisionRow[] {
  const placeholders = decisions.map(() => '?').join(', ');
  return db
    .prepare(
      `SELECT id, agent, decision, outputs_json, tx_ids_json, created_at FROM agent_decisions
       WHERE agent = ? AND decision IN (${placeholders}) ORDER BY created_at, rowid`,
    )
    .all<DecisionRow>(agent, ...decisions);
}

function chainTxById(db: Db, id: string | null): ChainTxRow | undefined {
  return id === null ? undefined : db.prepare('SELECT * FROM chain_txs WHERE id = ?').get<ChainTxRow>(id);
}

function cardById(db: Db, id: string | null): CardRow | undefined {
  return id === null ? undefined : db.prepare('SELECT * FROM cards WHERE id = ?').get<CardRow>(id);
}

/** Every money event in the database, unformatted, oldest first. */
export function coaRows(db: Db): CoaRow[] {
  const rows: CoaRow[] = [];

  for (const row of db
    .prepare(
      `SELECT t.id, t.status, t.amount_stroops, t.created_at, t.station_id,
              c.device_hash, x.outer_hash, x.inner_hash
         FROM taps t
         LEFT JOIN cards c ON c.id = t.card_id
         LEFT JOIN chain_txs x ON x.id = t.chain_tx_id
        WHERE t.status IN ('authorized', 'rejected', 'refused')
          AND NOT (t.status = 'refused' AND t.simulated = 1)
        ORDER BY t.created_at, t.rowid`,
    )
    .all<TapRow>()) {
    rows.push({
      at: row.created_at,
      event: row.status === 'authorized' ? 'tap_authorized' : 'tap_rejected',
      cardHashPrefix: row.device_hash?.slice(0, 8) ?? '',
      station: row.station_id,
      amountStroops: BigInt(row.amount_stroops),
      txHash: row.outer_hash ?? row.inner_hash ?? '',
      agentDecisionId: '',
    });
  }

  // `fund`: the cards the Tranche Agent actually funded, with the tx that moved the money.
  for (const decision of decisionRows(db, 'tranche', ['FUNDED', 'BUDGET_EXHAUSTED'])) {
    const outputs = parseJson(decision.outputs_json);
    const funded = Array.isArray(outputs.funded) ? outputs.funded : [];
    for (const entry of funded) {
      if (typeof entry !== 'object' || entry === null) continue;
      const item = entry as Record<string, unknown>;
      const chainTxId = typeof item.chainTxId === 'string' ? item.chainTxId : null;
      const chainTx = chainTxById(db, chainTxId);
      if (chainTx === undefined || chainTx.status !== 'succeeded') continue;
      const card = cardById(db, typeof item.cardId === 'string' ? item.cardId : null);
      const amount = item.amountStroops;
      rows.push({
        at: decision.created_at,
        event: 'fund',
        cardHashPrefix:
          typeof item.deviceHashPrefix === 'string' ? item.deviceHashPrefix : (card?.device_hash.slice(0, 8) ?? ''),
        station: '',
        amountStroops: amount === undefined ? null : BigInt(String(amount)),
        txHash: hashOf(chainTx),
        agentDecisionId: decision.id,
      });
    }
  }

  // `settlement_claimed` / `settlement_held`: one row per settlement decision.
  const previousClaimAt = new Map<string, number>();
  for (const decision of decisionRows(db, 'settlement', ['CLAIMED', 'HELD'])) {
    const outputs = parseJson(decision.outputs_json);
    const txId = firstTxId(decision.tx_ids_json);
    const chainTx = chainTxById(db, txId);
    // `stationId` is not part of the settlement `outputs_json` contract; the backing claim tx names the station.
    let station = typeof outputs.stationId === 'string' ? outputs.stationId : '';
    if (station === '' && chainTx !== undefined) {
      station =
        db.prepare('SELECT id FROM stations WHERE public_key = ?').get<{ id: string }>(chainTx.source_public)?.id ?? '';
    }
    if (decision.decision === 'CLAIMED') {
      const since = previousClaimAt.get(station) ?? 0;
      const total = db
        .prepare(
          `SELECT COALESCE(SUM(amount_stroops), 0) AS total FROM taps
            WHERE station_id = ? AND status = 'authorized' AND created_at > ? AND created_at <= ?`,
        )
        .get<{ total: number }>(station, since, decision.created_at);
      previousClaimAt.set(station, decision.created_at);
      rows.push({
        at: decision.created_at,
        event: 'settlement_claimed',
        cardHashPrefix: '',
        station,
        amountStroops: BigInt(total?.total ?? 0),
        txHash: chainTx === undefined ? '' : hashOf(chainTx),
        agentDecisionId: decision.id,
      });
      continue;
    }
    const amount = outputs.amountStroops;
    rows.push({
      at: decision.created_at,
      event: 'settlement_held',
      cardHashPrefix: '',
      station,
      amountStroops: amount === undefined ? null : BigInt(String(amount)),
      // A held station is frozen, so the decision never has a tx (api-and-data.md §5.2 #19).
      txHash: '',
      agentDecisionId: decision.id,
    });
  }

  // `sweep`: `cards.returned_stroops` is the authoritative amount; the tx comes from the decision's tx ids.
  for (const decision of decisionRows(db, 'sweep', ['SWEPT'])) {
    const outputs = parseJson(decision.outputs_json);
    // A failed attempt moved no money; its retry or recovery decision is the sweep row.
    if (outputs.error !== undefined && outputs.error !== null) continue;
    const card = cardById(db, typeof outputs.cardId === 'string' ? outputs.cardId : null);
    const chainTx = chainTxById(db, firstTxId(decision.tx_ids_json));
    rows.push({
      at: decision.created_at,
      event: 'sweep',
      cardHashPrefix: card?.device_hash.slice(0, 8) ?? '',
      station: '',
      amountStroops: card === undefined ? null : BigInt(card.returned_stroops),
      txHash: chainTx === undefined ? '' : hashOf(chainTx),
      agentDecisionId: decision.id,
    });
  }

  // `budget_credited`: a paid Velo intent. No decision row: the officer paid, no agent decided.
  for (const intent of db
    .prepare(
      `SELECT id, amount, tx_hash, created_at, paid_at FROM velo_intents WHERE status = 'paid' ORDER BY created_at, rowid`,
    )
    .all<IntentRow>()) {
    rows.push({
      at: intent.paid_at ?? intent.created_at,
      event: 'budget_credited',
      cardHashPrefix: '',
      station: '',
      amountStroops: xlmStringToStroops(intent.amount),
      txHash: intent.tx_hash ?? '',
      agentDecisionId: '',
    });
  }

  return rows.sort((a, b) => a.at - b.at || EVENT_ORDER[a.event] - EVENT_ORDER[b.event]);
}

/** The whole file: header + one line per money event. `amount_php`/`amount_xlm` are 2 decimals; empty when absent. */
export function buildCoaCsv(db: Db, deps: { phpPerXlm: number }): string {
  const lines = [COA_HEADER];
  for (const row of coaRows(db)) {
    lines.push(
      [
        formatCoaTimestamp(row.at),
        row.event,
        row.cardHashPrefix,
        row.station,
        row.amountStroops === null ? '' : stroopsToPhp(row.amountStroops, deps.phpPerXlm).toFixed(2),
        row.amountStroops === null ? '' : stroopsToXlmString(row.amountStroops),
        row.txHash,
        row.agentDecisionId,
      ]
        .map(escapeCsvField)
        .join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}
