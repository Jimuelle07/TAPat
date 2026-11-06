// Conformal Risk Control (docs/algorithms.md §5, Angelopoulos et al. 2022): two thresholds from a labeled
// calibration set with the finite-sample correction. Pure and deterministic: the caller reads the fixture.
import type { IntakeStatus } from './matcher';

const round6 = (x: number): number => Math.round(x * 1e6) / 1e6;

export interface CalibrationPoint {
  /** `1 - pairProbability(a, b)`, 6 decimals. */
  score: number;
  /** `true` = two different people, so approving is correct. */
  genuine: boolean;
}

export interface CrcThresholds {
  lambdaLo: number;
  lambdaHi: number;
  alpha: number;
  beta: number;
  /** Number of calibration points. */
  n: number;
  /** Empirical (uncorrected) wrongful-denial rate at `lambdaLo`. */
  wrongfulDenialRate: number;
  /** Empirical (uncorrected) ghost-admission rate at `lambdaHi`. */
  ghostAdmissionRate: number;
  /** `false` when a search found no threshold on the grid (§5.3). */
  feasible: boolean;
}

/** §5.3 grid: 101 values, generated from `k / 100` — never accumulated by addition. */
export const CRC_GRID: readonly number[] = Array.from({ length: 101 }, (_, k) => round6(k / 100));

/** §5.2: `(n / (n + 1)) * mean(genuine AND score < lambda) + 1 / (n + 1)`. */
export function riskDenial(points: readonly CalibrationPoint[], lambda: number): number {
  const n = points.length;
  let count = 0;
  for (const point of points) if (point.genuine && point.score < lambda) count += 1;
  const mean = n === 0 ? 0 : count / n;
  return round6((n / (n + 1)) * mean + 1 / (n + 1));
}

/** §5.2: `(n / (n + 1)) * mean(ghost AND score >= lambda) + 1 / (n + 1)`. */
export function riskAdmission(points: readonly CalibrationPoint[], lambda: number): number {
  const n = points.length;
  let count = 0;
  for (const point of points) if (!point.genuine && point.score >= lambda) count += 1;
  const mean = n === 0 ? 0 : count / n;
  return round6((n / (n + 1)) * mean + 1 / (n + 1));
}

/**
 * §5.3: `lambdaLo` is the largest grid value whose denial risk is within `alpha`, `lambdaHi` the smallest grid value
 * whose admission risk is within `beta`. A search that finds nothing falls back to `0.00` / `1.00` and marks the
 * calibration infeasible; an inverted pair is clamped to an empty uncertain band (`lambdaLo = lambdaHi`).
 */
export function calibrateCrc(points: readonly CalibrationPoint[], alpha: number, beta: number): CrcThresholds {
  const n = points.length;
  let lambdaLo: number | undefined;
  for (const lambda of CRC_GRID) {
    if (riskDenial(points, lambda) <= alpha) lambdaLo = lambda;
  }
  let lambdaHi: number | undefined;
  for (const lambda of CRC_GRID) {
    if (riskAdmission(points, lambda) <= beta) {
      lambdaHi = lambda;
      break;
    }
  }
  let feasible = true;
  if (lambdaLo === undefined) {
    lambdaLo = 0;
    feasible = false;
  }
  if (lambdaHi === undefined) {
    lambdaHi = 1;
    feasible = false;
  }
  if (lambdaLo > lambdaHi) lambdaLo = lambdaHi;

  let denied = 0;
  let admitted = 0;
  for (const point of points) {
    if (point.genuine && point.score < lambdaLo) denied += 1;
    if (!point.genuine && point.score >= lambdaHi) admitted += 1;
  }
  return {
    lambdaLo,
    lambdaHi,
    alpha,
    beta,
    n,
    wrongfulDenialRate: n === 0 ? 0 : round6(denied / n),
    ghostAdmissionRate: n === 0 ? 0 : round6(admitted / n),
    feasible,
  };
}

/** §5.4. With `lambdaLo === lambdaHi` the uncertain band is empty and every record is decided. */
export function crcDecide(score: number, thresholds: Pick<CrcThresholds, 'lambdaLo' | 'lambdaHi'>): IntakeStatus {
  if (score >= thresholds.lambdaHi) return 'approved';
  if (score < thresholds.lambdaLo) return 'rejected';
  return 'uncertain';
}
