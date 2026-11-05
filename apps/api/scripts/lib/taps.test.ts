import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT, fixtureJson } from './fixture-file';
import { generateBurst, generateHonest } from './taps';

/** The committed fixture; core.autocrlf may check it out as CRLF, the generator writes LF. */
function committed(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
}

const VIRTUAL_CARDS = new Set(Array.from({ length: 20 }, (_, i) => `virtual${String(i + 1).padStart(2, '0')}`));

describe('generateHonest (docs/algorithms.md §9.3)', () => {
  it('is byte-identical across runs for seed 7 / 60 ticks and equals the committed fixture', () => {
    const first = fixtureJson(generateHonest(7, 60));
    expect(fixtureJson(generateHonest(7, 60))).toBe(first);
    expect(first).toBe(committed('fixtures/taps/honest-history.json'));
  });

  it('emits in-range edges in tick order', () => {
    const fixture = generateHonest(7, 60);
    expect(fixture.source).toBe('simulated');
    expect(fixture.seed).toBe(7);
    expect(fixture.tick_ms).toBe(1000);
    let previous = 1;
    for (const edge of fixture.ticks) {
      expect(edge.tick).toBeGreaterThanOrEqual(previous);
      expect(edge.tick).toBeLessThanOrEqual(60);
      previous = edge.tick;
      expect(VIRTUAL_CARDS.has(edge.card_ref)).toBe(true);
      expect(['A', 'B']).toContain(edge.station_id);
      expect(edge.amount_php).toBeGreaterThanOrEqual(60);
      expect(edge.amount_php).toBeLessThanOrEqual(350);
    }
  });

  it('never puts more than 3 edges for one (card, station) inside any 10 consecutive ticks', () => {
    const edges = generateHonest(7, 60).ticks;
    for (const edge of edges) {
      const inWindow = edges.filter(
        (other) =>
          other.card_ref === edge.card_ref &&
          other.station_id === edge.station_id &&
          other.tick > edge.tick - 10 &&
          other.tick <= edge.tick,
      );
      expect(inWindow.length).toBeLessThanOrEqual(3);
    }
  });
});

describe('generateBurst (docs/algorithms.md §9.3)', () => {
  it('is byte-identical across runs for seed 11 and equals the committed fixture', () => {
    const first = fixtureJson(generateBurst(11));
    expect(fixtureJson(generateBurst(11))).toBe(first);
    expect(first).toBe(committed('fixtures/taps/burst.json'));
  });

  it('has 30 station-B edges, 10 per tick offset 1..3, from 20 distinct cards at 400..500 PHP', () => {
    const fixture = generateBurst(11);
    expect(fixture.source).toBe('simulated');
    expect(fixture.edges).toHaveLength(30);
    for (const offset of [1, 2, 3]) {
      expect(fixture.edges.filter((e) => e.tick_offset === offset)).toHaveLength(10);
    }
    expect(new Set(fixture.edges.map((e) => e.card_ref)).size).toBe(20);
    for (const edge of fixture.edges) {
      expect(edge.station_id).toBe('B');
      expect(VIRTUAL_CARDS.has(edge.card_ref)).toBe(true);
      expect(edge.amount_php).toBeGreaterThanOrEqual(400);
      expect(edge.amount_php).toBeLessThanOrEqual(500);
    }
  });
});
