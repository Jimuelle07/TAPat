import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CRC_GRID, calibrateCrc, crcDecide, riskAdmission, riskDenial } from './crc';
import type { CalibrationPoint } from './crc';
import { pairProbability, toMatchRecord } from './matcher';

interface FixturePerson {
  last: string;
  first: string;
  middle: string;
  suffix: string | null;
  birthdate: string | null;
  barangay: string | null;
}

interface FixtureRecord {
  id: string;
  label: 'genuine' | 'ghost';
  a: FixturePerson;
  b: FixturePerson;
}

const fixture: { counts: Record<string, number>; records: FixtureRecord[] } = JSON.parse(
  readFileSync(new URL('../../../../fixtures/calibration/labeled.json', import.meta.url), 'utf8'),
);

const round6 = (x: number): number => Math.round(x * 1e6) / 1e6;

/** §5.5: each calibration entry is a pair, so its score is `1 - pairProbability(a, b)` with no prefix to subtract. */
const points: CalibrationPoint[] = fixture.records.map((record) => ({
  score: round6(1 - pairProbability(toMatchRecord(record.a), toMatchRecord(record.b))),
  genuine: record.label === 'genuine',
}));

describe('calibration set (docs/algorithms.md §12.3)', () => {
  it('has n = 400 points: 320 genuine (including the 20 hard negatives) and 60 ghosts', () => {
    expect(points).toHaveLength(400);
    expect(points.filter((p) => p.genuine)).toHaveLength(340);
    expect(points.filter((p) => !p.genuine)).toHaveLength(60);
    expect(fixture.counts).toEqual({ genuine: 320, ghost: 60, hardNegative: 20 });
  });
});

describe('calibrateCrc on fixtures/calibration/labeled.json', () => {
  const thresholds = calibrateCrc(points, 0.05, 0.02);

  it('bounds the empirical rates by alpha and beta', () => {
    expect(thresholds.wrongfulDenialRate).toBeLessThanOrEqual(0.05);
    expect(thresholds.ghostAdmissionRate).toBeLessThanOrEqual(0.02);
  });

  it('returns an ordered pair of thresholds', () => {
    expect(thresholds.lambdaLo).toBeLessThanOrEqual(thresholds.lambdaHi);
  });

  it('reports n = 400, echoes alpha and beta, and is feasible', () => {
    expect(thresholds.n).toBe(400);
    expect(thresholds.alpha).toBe(0.05);
    expect(thresholds.beta).toBe(0.02);
    expect(thresholds.feasible).toBe(true);
  });

  /**
   * Measured on this fixture, not the illustrative 0.62 / 0.81 in the docs' sample payloads. The two searches are
   * each defined, so `feasible` stays true, but they cross: the denial bound is pinned by the 20 Jr/Sr hard negatives
   * (all score 0.800814 — at lambda 0.81 they are 20 denials, one over the 19 the bound allows), while the admission
   * bound is met from 0.05 on because every ghost scores at most 0.047426 (the birthdate-null variants). §5.3
   * therefore clamps lambdaLo down to lambdaHi: an empty uncertain band that decides every record.
   */
  it('collapses to lambdaLo = lambdaHi = 0.05 with zero measured errors', () => {
    expect(thresholds).toMatchObject({
      lambdaLo: 0.05,
      lambdaHi: 0.05,
      wrongfulDenialRate: 0,
      ghostAdmissionRate: 0,
    });
    expect(riskDenial(points, 0.8)).toBeLessThanOrEqual(0.05);
    expect(riskDenial(points, 0.81)).toBeGreaterThan(0.05);
    expect(riskAdmission(points, 0.05)).toBeLessThanOrEqual(0.02);
    expect(riskAdmission(points, 0.04)).toBeGreaterThan(0.02);
  });
});

describe('crcDecide (docs/algorithms.md §5.4)', () => {
  const thresholds = { lambdaLo: 0.62, lambdaHi: 0.81 };

  it('approves score 1', () => {
    expect(crcDecide(1, thresholds)).toBe('approved');
  });

  it('rejects score 0', () => {
    expect(crcDecide(0, thresholds)).toBe('rejected');
  });

  it('is uncertain strictly inside the band', () => {
    expect(crcDecide(0.62, thresholds)).toBe('uncertain');
    expect(crcDecide(0.81, thresholds)).toBe('approved');
    expect(crcDecide(0.619999, thresholds)).toBe('rejected');
  });

  it('decides every score when lambdaLo === lambdaHi', () => {
    const empty = { lambdaLo: 0.05, lambdaHi: 0.05 };
    expect(crcDecide(0.05, empty)).toBe('approved');
    expect(crcDecide(0.049, empty)).toBe('rejected');
  });
});

describe('risk functions (docs/algorithms.md §5.2 / §12.3)', () => {
  const synthetic: CalibrationPoint[] = Array.from({ length: 100 }, (_, i) => ({
    score: round6(((i * 37) % 101) / 100),
    genuine: i % 3 !== 0,
  }));

  it('riskDenial is non-decreasing in lambda', () => {
    let previous = -1;
    for (const lambda of CRC_GRID) {
      const risk = riskDenial(synthetic, lambda);
      expect(risk).toBeGreaterThanOrEqual(previous);
      previous = risk;
    }
  });

  it('riskAdmission is non-increasing in lambda', () => {
    let previous = 2;
    for (const lambda of CRC_GRID) {
      const risk = riskAdmission(synthetic, lambda);
      expect(risk).toBeLessThanOrEqual(previous);
      previous = risk;
    }
  });

  it('carries the finite-sample correction: an empty indicator set still risks 1 / (n + 1)', () => {
    const two: CalibrationPoint[] = [
      { score: 0.9, genuine: true },
      { score: 0.1, genuine: false },
    ];
    expect(riskDenial(two, 0)).toBe(0.333333);
    expect(riskAdmission(two, 1)).toBe(0.333333);
    expect(riskDenial([], 0.5)).toBe(1);
  });
});

describe('calibrateCrc edge cases (docs/test-plan.md §2.1)', () => {
  it('clamps an inverted pair to an empty band and decides every record', () => {
    const inverted: CalibrationPoint[] = [
      { score: 0.9, genuine: true },
      { score: 0.1, genuine: false },
    ];
    const thresholds = calibrateCrc(inverted, 0.5, 0.4);
    expect(thresholds.lambdaLo).toBe(0.11);
    expect(thresholds.lambdaHi).toBe(0.11);
    expect(crcDecide(0.9, thresholds)).toBe('approved');
    expect(crcDecide(0.1, thresholds)).toBe('rejected');
  });

  it('falls back to 0.00 / 1.00 and reports infeasible when a search finds nothing', () => {
    const thresholds = calibrateCrc([], 0.05, 0.02);
    expect(thresholds).toMatchObject({
      lambdaLo: 0,
      lambdaHi: 1,
      n: 0,
      wrongfulDenialRate: 0,
      ghostAdmissionRate: 0,
      feasible: false,
    });
  });
});
