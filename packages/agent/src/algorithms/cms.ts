// Count-Min Sketch with a decayed "current" window (docs/algorithms.md §7). Pure and deterministic: no I/O, no clock,
// no randomness. `midas.ts` is the only consumer.

export interface SketchConfig {
  depth: number;
  width: number;
  seeds: number[];
}

export const DEFAULT_SKETCH: SketchConfig = {
  depth: 2,
  width: 1024,
  seeds: [0x9747b28c, 0x85ebca6b],
};

export interface SketchState {
  current: number[];
  totals: number[];
  totalCount: number;
  distinctKeys: string[];
}

/** FNV-1a over the UTF-8 bytes, with the seed mixed into the offset basis (§7.1). All math stays 32-bit. */
export function fnv1a32(input: string, seed: number): number {
  let h = (0x811c9dc5 ^ seed) >>> 0;
  const bytes = new TextEncoder().encode(input);
  for (const b of bytes) {
    h = (h ^ b) >>> 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function bucket(key: string, row: number, cfg: SketchConfig): number {
  return fnv1a32(key, cfg.seeds[row]) % cfg.width;
}

export function sketchInit(cfg: SketchConfig = DEFAULT_SKETCH): SketchState {
  const cells = cfg.depth * cfg.width;
  return { current: new Array<number>(cells).fill(0), totals: new Array<number>(cells).fill(0), totalCount: 0, distinctKeys: [] };
}

/**
 * Increments `bucket(key, r)` in every row of the requested target. Adding to `totals` is what counts as an accepted
 * event: it bumps `totalCount` once and registers the key in `distinctKeys` once, however often it appears.
 */
export function sketchAdd(
  state: SketchState,
  key: string,
  target: 'current' | 'totals' | 'both' = 'current',
  cfg: SketchConfig = DEFAULT_SKETCH,
): void {
  for (let row = 0; row < cfg.depth; row++) {
    const i = row * cfg.width + bucket(key, row, cfg);
    if (target !== 'totals') state.current[i] += 1;
    if (target !== 'current') state.totals[i] += 1;
  }
  if (target !== 'current') {
    state.totalCount += 1;
    if (!state.distinctKeys.includes(key)) state.distinctKeys.push(key);
  }
}

/** The minimum over rows of the decayed window count — the sketch's estimate for `key`. */
export function sketchEstimate(state: SketchState, key: string, cfg: SketchConfig = DEFAULT_SKETCH): number {
  let estimate = Infinity;
  for (let row = 0; row < cfg.depth; row++) {
    const value = state.current[row * cfg.width + bucket(key, row, cfg)];
    if (value < estimate) estimate = value;
  }
  return estimate;
}

/** Multiplies every decayed cell by `factor`; `totals` is the background and never fades. */
export function sketchDecay(state: SketchState, factor: number): void {
  for (let i = 0; i < state.current.length; i++) state.current[i] *= factor;
}

export function sketchClone(state: SketchState): SketchState {
  return {
    current: state.current.slice(),
    totals: state.totals.slice(),
    totalCount: state.totalCount,
    distinctKeys: state.distinctKeys.slice(),
  };
}

/** Standard chi-squared score for categorical data: grows when one category dominates a spread-out background. */
export function chiSquare(observed: number, total: number, categories: number): number {
  if (total <= 0 || categories <= 1) return 0;
  const expected = total / categories;
  return (Math.pow(observed - expected, 2) * categories * categories) / (total * (categories - 1));
}
