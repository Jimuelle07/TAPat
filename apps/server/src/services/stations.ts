// `stations` + our own taps -> `Station` (docs/api-and-data.md §5.2 #16). `pendingStroops`/`spentStroops` split this
// station's authorized taps at the boundary of its last succeeded claim, so no chain read is needed in the hot path.
import type { Station, StationStatus } from '@tapat/shared';
import type { Db } from '../db/index';

export interface StationRow {
  id: string;
  name: string;
  public_key: string;
  status: StationStatus;
  frozen_reason: string | null;
  frozen_at: number | null;
}

/** This station's authorized tap total, split at its last succeeded claim. */
export interface StationMoney {
  pendingStroops: bigint;
  spentStroops: bigint;
}

function toBigInt(value: number | bigint | null): bigint {
  if (value === null) return 0n;
  return typeof value === 'bigint' ? value : BigInt(Math.trunc(value));
}

/** The sums come back as SQLite integers; stroops leave as decimal strings (a u64 overflows a JS number). */
export function toStation(row: StationRow, money: StationMoney): Station {
  return {
    id: row.id,
    name: row.name,
    publicKey: row.public_key,
    status: row.status,
    frozenReason: row.frozen_reason,
    frozenAt: row.frozen_at,
    pendingStroops: String(money.pendingStroops),
    spentStroops: String(money.spentStroops),
  };
}

/**
 * `MAX(chain_txs.updated_at)` over this key's succeeded claims, or 0 before the first one. `updated_at` is written
 * when the claim is marked `succeeded`, i.e. after the SAC transfer, so a tap authorized between submit and
 * execution counts as claimed rather than pending (SDD §6.7).
 */
export function claimBoundary(db: Db, publicKey: string): number {
  const row = db
    .prepare(
      `SELECT COALESCE(MAX(updated_at), 0) AS boundary FROM chain_txs
        WHERE kind = 'claim' AND status = 'succeeded' AND source_public = ?`,
    )
    .get<{ boundary: number }>(publicKey);
  return row?.boundary ?? 0;
}

export function stationMoney(db: Db, station: Pick<StationRow, 'id' | 'public_key'>): StationMoney {
  const boundary = claimBoundary(db, station.public_key);
  const sum = (comparison: '>' | '<='): bigint => {
    const row = db
      .prepare(
        `SELECT COALESCE(SUM(amount_stroops), 0) AS total FROM taps
          WHERE station_id = ? AND status = 'authorized' AND created_at ${comparison} ?`,
      )
      .get<{ total: number | bigint }>(station.id, boundary);
    return toBigInt(row?.total ?? 0);
  };
  return { pendingStroops: sum('>'), spentStroops: sum('<=') };
}

/** Station A then B, each with its pending/spent split; the dashboard sums these for `held`/`pending`. */
export function listStations(db: Db): Station[] {
  return db
    .prepare('SELECT * FROM stations ORDER BY id')
    .all<StationRow>()
    .map((row) => toStation(row, stationMoney(db, row)));
}
