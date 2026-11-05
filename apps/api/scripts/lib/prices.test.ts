import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT, fixtureJson } from './fixture-file';
import { generatePrices } from './prices';
import { round2 } from './rng';

/** The committed fixture; core.autocrlf may check it out as CRLF, the generator writes LF. */
function committed(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

describe('generatePrices (docs/algorithms.md §9.1)', () => {
  it('is byte-identical across runs for seed 3 and equals the committed fixture', () => {
    const first = fixtureJson(generatePrices(3));
    expect(fixtureJson(generatePrices(3))).toBe(first);
    expect(first).toBe(committed('fixtures/prices/doe-diesel-sim.json'));
  });

  it('has 45 two-decimal points with the day-15 spike, a ~58.5 base and a ~71 post-hike level', () => {
    const fixture = generatePrices(3);
    expect(fixture.source).toBe('simulated');
    expect(fixture.seed).toBe(3);
    expect(fixture.points.map((p) => p.idx)).toEqual(Array.from({ length: 45 }, (_, i) => i + 1));
    for (const p of fixture.points) expect(p.price_php).toBe(round2(p.price_php));
    expect(fixture.points[14].price_php).toBe(66);

    const base = fixture.points.filter((p) => p.idx <= 30 && p.idx !== 15).map((p) => p.price_php);
    const hike = fixture.points.filter((p) => p.idx >= 31).map((p) => p.price_php);
    expect(Math.abs(mean(base) - 58.5)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(mean(hike) - 71)).toBeLessThanOrEqual(0.5);
  });

  it('gives a different series for a different seed', () => {
    expect(generatePrices(4).points).not.toEqual(generatePrices(3).points);
  });
});
