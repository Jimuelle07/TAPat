import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Bocpd, bocpdRun, trancheShouldFire } from './bocpd';

const fixture: { points: { idx: number; price_php: number }[] } = JSON.parse(
  readFileSync(new URL('../../../../fixtures/prices/doe-diesel-sim.json', import.meta.url), 'utf8'),
);
const prices = fixture.points.map((p) => p.price_php);

describe('bocpd on the DOE diesel fixture', () => {
  const points = bocpdRun(prices);

  it('fires on the sustained step, at 0-based index 33–36', () => {
    const r = trancheShouldFire(points, 65);
    expect(r.fire).toBe(true);
    expect(r.at).toBeGreaterThanOrEqual(33);
    expect(r.at).toBeLessThanOrEqual(36);
  });

  it('never fires on the one-day spike at index 14 or anywhere before the step', () => {
    expect(prices[14]).toBe(66);
    for (let n = 1; n <= 31; n++) expect(trancheShouldFire(points.slice(0, n), 65).fire).toBe(false);
  });

  it('floors sigma2 at 0.05 on the warm-up', () => {
    expect(new Bocpd({}, prices.slice(0, 10)).sigma2).toBeGreaterThanOrEqual(0.05);
    expect(new Bocpd({}, Array(10).fill(58.5)).sigma2).toBe(0.05);
  });

  it('incremental push matches the batch run', () => {
    const det = new Bocpd({}, prices.slice(0, 10));
    for (const p of prices) det.push(p);
    expect(det.points).toEqual(points);
  });

  it('fires at the original index when only a trailing slice is passed', () => {
    const sliced = bocpdRun(prices).slice(30);
    expect(sliced).toEqual(points.slice(30));
    const r = trancheShouldFire(sliced, 65);
    expect(r.fire).toBe(true);
    expect(r.at).toBe(33);
    expect(trancheShouldFire(sliced, 65)).toEqual(trancheShouldFire(points, 65));
  });
});

describe('bocpd on a series that starts high', () => {
  it('does not fire while the whole series is still one segment', () => {
    const points = bocpdRun(Array(20).fill(71));
    for (let n = 1; n <= points.length; n++) {
      expect(trancheShouldFire(points.slice(0, n), 65).fire).toBe(false);
    }
  });

  it('is held back by the run-length < index guard, not the other clauses', () => {
    const p = bocpdRun(Array(20).fill(71))[5];
    expect(p.cpRecent).toBeGreaterThanOrEqual(0.9);
    expect(p.mapRunLength).toBeGreaterThanOrEqual(3);
    expect(p.segmentMean).toBeGreaterThanOrEqual(65);
    expect(p.mapRunLength).toBeGreaterThanOrEqual(p.index);
  });
});

describe('bocpd on a constant series', () => {
  it('never fires', () => {
    expect(trancheShouldFire(bocpdRun(Array(45).fill(58.5)), 65).fire).toBe(false);
  });
});
