import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bocpdRun, trancheShouldFire } from '@tapat/agent';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT, fixtureJson } from './fixture-file';
import { generateLandingScenarios } from './landing-scenarios';
import { generatePrices } from './prices';

/** The committed JSON; core.autocrlf may check it out as CRLF, the generator writes LF. */
function committed(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
}

describe('generateLandingScenarios (docs/algorithms.md §9.4)', () => {
  const data = generateLandingScenarios();

  it('is byte-identical across runs and equals the committed scenarios.json', () => {
    const first = fixtureJson(data);
    expect(fixtureJson(generateLandingScenarios())).toBe(first);
    expect(first).toBe(committed('apps/web/app/_landing/scenarios.json'));
  });

  it('has five uniquely named scenarios of 45 daily points, idx 1..45', () => {
    expect(data.source).toBe('simulated');
    expect(data.agent).toBe('precomputed');
    expect(data.scenarios).toHaveLength(5);
    expect(new Set(data.scenarios.map((s) => s.id)).size).toBe(5);
    for (const s of data.scenarios) {
      expect(s.points.map((p) => p.idx)).toEqual(Array.from({ length: 45 }, (_, i) => i + 1));
    }
  });

  it("fires where the real agent fires, inside [shiftIdx + 3, shiftIdx + 10], with exactly one release event", () => {
    for (const s of data.scenarios) {
      const verdict = trancheShouldFire(bocpdRun(s.points.map((p) => p.pricePhp)), data.thresholdPhp);
      expect(verdict.fire, s.id).toBe(true);
      expect(s.fireIdx, s.id).toBe((verdict.at as number) + 1);
      expect(s.reason, s.id).toBe(verdict.reason);
      expect(s.fireIdx, s.id).toBeGreaterThanOrEqual(s.shiftIdx + 3);
      expect(s.fireIdx, s.id).toBeLessThanOrEqual(s.shiftIdx + 10);
      const releases = s.events.filter((e) => e.kind === 'release');
      expect(releases.map((e) => e.idx), s.id).toEqual([s.fireIdx]);
    }
  });

  it('never fires on an ignored spike, and every ignored spike is at or above the threshold', () => {
    for (const s of data.scenarios) {
      for (const e of s.events.filter((ev) => ev.kind === 'spike-ignored')) {
        expect(s.fireIdx, s.id).toBeGreaterThan(e.idx);
        expect(e.idx, s.id).toBeLessThan(s.shiftIdx);
        expect(s.points[e.idx - 1].pricePhp, s.id).toBeGreaterThanOrEqual(data.thresholdPhp);
      }
    }
    const spikeCount = (id: string) =>
      data.scenarios.find((s) => s.id === id)!.events.filter((e) => e.kind === 'spike-ignored').length;
    expect(spikeCount('crude-rally')).toBe(1);
    expect(spikeCount('volatile')).toBe(2);
  });

  it('crude-rally reuses the app fixture series (generatePrices(3))', () => {
    const crude = data.scenarios.find((s) => s.id === 'crude-rally')!;
    expect(crude.points.map((p) => p.pricePhp)).toEqual(generatePrices(3).points.map((p) => p.price_php));
  });
});
