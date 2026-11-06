// Program row -> `Program` response shape (docs/api-and-data.md §3). The salt column is server-only and never leaves.
import type { Program } from '@tapat/shared';
import type { Db } from '../db/index';

interface ProgramRow {
  id: string;
  name: string;
  salt: string;
  status: Program['status'];
  per_tap_cap_stroops: number | bigint;
  tranche_stroops: number | bigint;
  expires_at_s: number;
  price_threshold_php: number;
  alpha: number;
  beta: number;
  budget_verified_stroops: number | bigint;
  budget_funded_stroops: number | bigint;
  tranche_fired: number;
  created_at: number;
}

export function toProgram(row: ProgramRow): Program {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    perTapCapStroops: String(row.per_tap_cap_stroops),
    trancheStroops: String(row.tranche_stroops),
    expiresAtS: row.expires_at_s,
    priceThresholdPhp: row.price_threshold_php,
    alpha: row.alpha,
    beta: row.beta,
    budgetVerifiedStroops: String(row.budget_verified_stroops),
    budgetFundedStroops: String(row.budget_funded_stroops),
    trancheFired: row.tranche_fired === 1,
    createdAt: row.created_at,
  };
}

export function getCurrentProgram(db: Db): Program | null {
  const row = db.prepare('SELECT * FROM program ORDER BY created_at DESC LIMIT 1').get<ProgramRow>();
  return row === undefined ? null : toProgram(row);
}
