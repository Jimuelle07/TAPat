import { describe, expect, it } from 'vitest';
import {
  chiSquare,
  DEFAULT_SKETCH,
  fnv1a32,
  sketchAdd,
  sketchClone,
  sketchDecay,
  sketchEstimate,
  sketchInit,
  type SketchState,
} from './cms';

function sum(values: number[]): number {
  let s = 0;
  for (const v of values) s += v;
  return s;
}

describe('fnv1a32', () => {
  it('pins the seeded hash of a known key', () => {
    expect(fnv1a32('abc', 0x9747b28c)).toBe(112606583);
    expect(fnv1a32('abc', 0x85ebca6b)).toBe(428626506);
    expect(fnv1a32('abc', 0x9747b28c)).not.toBe(fnv1a32('abc', 0x85ebca6b));
  });
});

describe('sketchAdd / sketchEstimate', () => {
  it('estimates an exact count on a small key set', () => {
    const state = sketchInit();
    for (let i = 0; i < 5; i++) sketchAdd(state, 'card_D1|A', 'current');
    expect(sketchEstimate(state, 'card_D1|A')).toBe(5);
    expect(sketchEstimate(state, 'never-added')).toBe(0);
  });

  it('never estimates below the true count', () => {
    const state = sketchInit();
    const truth = new Map<string, number>();
    for (let i = 0; i < 200; i++) {
      const key = `virtual${String(i % 20).padStart(2, '0')}|${i % 3 === 0 ? 'B' : 'A'}`;
      const times = (i % 13) + 1;
      for (let n = 0; n < times; n++) sketchAdd(state, key, 'current');
      truth.set(key, (truth.get(key) ?? 0) + times);
    }
    for (const [key, count] of truth) expect(sketchEstimate(state, key)).toBeGreaterThanOrEqual(count);
  });

  it('counts an accepted event once per target, and a key once in distinctKeys', () => {
    const state = sketchInit();
    sketchAdd(state, 'k1', 'current');
    expect(state.totalCount).toBe(0);
    expect(state.distinctKeys).toEqual([]);
    sketchAdd(state, 'k1', 'totals');
    sketchAdd(state, 'k1', 'totals');
    sketchAdd(state, 'k2', 'both');
    expect(state.totalCount).toBe(3);
    expect(state.distinctKeys).toEqual(['k1', 'k2']);
    expect(sum(state.totals)).toBe(3 * DEFAULT_SKETCH.depth);
    expect(sum(state.current)).toBe(2 * DEFAULT_SKETCH.depth);
  });
});

describe('sketchDecay', () => {
  it('multiplies every current entry by the factor and leaves totals untouched', () => {
    const state = sketchInit();
    sketchAdd(state, 'k1', 'both');
    sketchAdd(state, 'k2', 'both');
    const totals = state.totals.slice();
    sketchDecay(state, 0.6);
    for (const value of state.current) expect(value === 0 || value === 0.6).toBe(true);
    expect(state.totals).toEqual(totals);
    expect(state.totalCount).toBe(2);
  });
});

describe('sketchClone', () => {
  it('deep-copies both arrays and the key list', () => {
    const state = sketchInit();
    sketchAdd(state, 'k1', 'both');
    const copy = sketchClone(state);
    sketchAdd(copy, 'k2', 'both');
    sketchDecay(copy, 0.5);
    expect(copy.current).not.toBe(state.current);
    expect(copy.totals).not.toBe(state.totals);
    expect(state.distinctKeys).toEqual(['k1']);
    expect(copy.distinctKeys).toEqual(['k1', 'k2']);
    expect(state.totalCount).toBe(1);
    expect(copy.totalCount).toBe(2);
    expect(sketchEstimate(state, 'k1')).toBe(1);
    expect(sketchEstimate(copy, 'k1')).toBe(0.5);
  });
});

describe('chiSquare', () => {
  it('is 0 when there is nothing to compare', () => {
    expect(chiSquare(0, 0, 5)).toBe(0);
    expect(chiSquare(5, 5, 1)).toBe(0);
  });

  it('is 0 when the observed count is exactly the uniform share', () => {
    expect(chiSquare(10, 100, 10)).toBe(0);
  });

  it('grows with the deviation from the uniform share', () => {
    expect(chiSquare(20, 100, 10)).toBeCloseTo(100 / 9, 6);
  });
});

describe('sketchInit', () => {
  it('starts empty at the configured depth and width', () => {
    const state: SketchState = sketchInit();
    expect(state.current).toHaveLength(DEFAULT_SKETCH.depth * DEFAULT_SKETCH.width);
    expect(state.totals).toHaveLength(DEFAULT_SKETCH.depth * DEFAULT_SKETCH.width);
    expect(sum(state.current)).toBe(0);
    expect(state.totalCount).toBe(0);
    expect(state.distinctKeys).toEqual([]);
  });
});
