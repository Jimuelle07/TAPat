// Program row -> `Program` response shape (docs/api-and-data.md §3). The salt column is server-only and never leaves.
import { randomBytes, randomUUID } from 'node:crypto';
import { phpToStroops, type CreateProgramBody, type Program } from '@tapat/shared';
import type { Db } from '../db/index';
import { ApiError } from '../errors';

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

/** SDD §2.2 demo defaults; also the values `seed-demo.ts` and `POST /api/program` write. */
export const PROGRAM_DEFAULTS = {
  name: 'TODA Fuel Aid — San Roque',
  perTapCapStroops: 500_000_000n,
  trancheStroops: 1_500_000_000n,
  expiresAtS: 1_796_054_399,
  priceThresholdPhp: 65,
  alpha: 0.05,
  beta: 0.02,
} as const;

export interface CreateProgramDeps {
  phpPerXlm: number;
  now?: () => number;
  /** Test seams for the two random parts. */
  id?: () => string;
  salt?: () => string;
}

/**
 * Inserts the one program row (docs/api-and-data.md §5.2 #3) with a fresh id and a fresh 16-byte salt. The CRC
 * thresholds are not recomputed here: `POST /api/program` stores the configured α/β/threshold only, and the intake
 * service's threshold cache lands with S7.
 */
export function createProgram(db: Db, body: CreateProgramBody, deps: CreateProgramDeps): Program {
  if (getCurrentProgram(db) !== null) throw new ApiError(409, 'INVALID_STATE', 'a program already exists');
  const now = deps.now ?? Date.now;
  const id = deps.id?.() ?? `prog_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
  const salt = deps.salt?.() ?? randomBytes(16).toString('hex');
  const expiresAtS =
    body.expiresAt === undefined ? PROGRAM_DEFAULTS.expiresAtS : Math.floor(Date.parse(body.expiresAt) / 1000);
  const perTapCapStroops =
    body.perTapCapPhp === undefined
      ? PROGRAM_DEFAULTS.perTapCapStroops
      : phpToStroops(body.perTapCapPhp, deps.phpPerXlm);
  const trancheStroops =
    body.tranchePhp === undefined ? PROGRAM_DEFAULTS.trancheStroops : phpToStroops(body.tranchePhp, deps.phpPerXlm);

  const row: ProgramRow = {
    id,
    name: body.name ?? PROGRAM_DEFAULTS.name,
    salt,
    status: 'draft',
    per_tap_cap_stroops: perTapCapStroops,
    tranche_stroops: trancheStroops,
    expires_at_s: expiresAtS,
    price_threshold_php: body.priceThresholdPhp ?? PROGRAM_DEFAULTS.priceThresholdPhp,
    alpha: body.alpha ?? PROGRAM_DEFAULTS.alpha,
    beta: body.beta ?? PROGRAM_DEFAULTS.beta,
    budget_verified_stroops: 0n,
    budget_funded_stroops: 0n,
    tranche_fired: 0,
    created_at: now(),
  };
  db.prepare(
    `INSERT INTO program
       (id, name, salt, status, per_tap_cap_stroops, tranche_stroops, expires_at_s, price_threshold_php,
        alpha, beta, budget_verified_stroops, budget_funded_stroops, tranche_fired, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.name,
    row.salt,
    row.status,
    row.per_tap_cap_stroops,
    row.tranche_stroops,
    row.expires_at_s,
    row.price_threshold_php,
    row.alpha,
    row.beta,
    row.budget_verified_stroops,
    row.budget_funded_stroops,
    row.tranche_fired,
    row.created_at,
  );
  return toProgram(row);
}
