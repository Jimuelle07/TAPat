// MIDAS-F (docs/algorithms.md §8): three decayed Count-Min sketches (edge, source node, destination node) score every
// tap edge; an edge that is already over the threshold inflates the window but is kept out of the background totals,
// so an attack ratchets instead of being absorbed. Pure and deterministic.
//
// One deviation from §8.2 step 3, forced by the numbers in §8.3: the chi-square's background `s` is the *decayed
// window mass* (the sum of one CMS row), not the lifetime `totalCount`. With the lifetime total, `s / t` is a
// lifetime average per key (§8.3's 60-tick stream gives s / t ≈ 44 at a two-station destination sketch) while `a` is
// a decayed window count (≈ 1), so the honest baseline already sits at chi-square ≈ 88 and no burst can ever exceed
// it. The window mass is the only background on the same scale as `a`, and it is what `sketchDecay` already
// maintains. It is floored at `t` (one observation per known key) so that a thin window — fewer edges than known
// keys, the normal state of a 60-tick warm-up — does not report every first appearance as anomalous.
// `totals`/`totalCount`/`distinctKeys` stay exactly as documented: filtering keeps over-threshold edges out of them,
// `distinctKeys` is the category count, and §12.6's filtering and decay vectors hold unchanged.

import {
  chiSquare,
  DEFAULT_SKETCH,
  sketchAdd,
  sketchClone,
  sketchDecay,
  sketchEstimate,
  sketchInit,
  type SketchConfig,
  type SketchState,
} from './cms';

export interface EdgeEvent {
  tick: number;
  cardId: string;
  stationId: string;
  amountStroops: string | bigint;
}

export interface MidasConfig {
  threshold: number;
  decay: number;
  sketch: SketchConfig;
}

export interface MidasScore {
  tick: number;
  edge: number;
  source: number;
  destination: number;
  score: number;
  filtered: boolean;
}

export interface MidasState {
  tick: number;
  edge: SketchState;
  source: SketchState;
  destination: SketchState;
}

export const DEFAULT_MIDAS: MidasConfig = { threshold: Infinity, decay: 0.6, sketch: DEFAULT_SKETCH };

function round6(x: number): number {
  return Math.round(x * 1e6) / 1e6;
}

/** The window's total mass: every event adds exactly one to one cell per row, so any single row sums to the mass. */
function windowMass(state: SketchState, cfg: SketchConfig): number {
  let mass = 0;
  for (let i = 0; i < cfg.width; i++) mass += state.current[i];
  return mass;
}

/** chi-square of one sketch for `key`; `0` while the sketch knows fewer than two keys (§7.3's `t <= 1` guard). */
function sketchScore(state: SketchState, key: string, cfg: SketchConfig): number {
  const categories = state.distinctKeys.length;
  if (categories <= 1) return 0;
  const background = Math.max(windowMass(state, cfg), categories);
  return round6(chiSquare(sketchEstimate(state, key, cfg), background, categories));
}

export function initMidasState(cfg: Partial<MidasConfig> = {}): MidasState {
  const sketch = cfg.sketch ?? DEFAULT_SKETCH;
  return { tick: 0, edge: sketchInit(sketch), source: sketchInit(sketch), destination: sketchInit(sketch) };
}

/**
 * Scores one edge and returns the next state plus the score. The incoming state is never mutated, so the caller can
 * keep it and decide whether to adopt the result.
 */
export function stepMidas(
  state: MidasState,
  event: EdgeEvent,
  cfg: MidasConfig,
): { state: MidasState; score: MidasScore } {
  const next: MidasState = {
    tick: state.tick,
    edge: sketchClone(state.edge),
    source: sketchClone(state.source),
    destination: sketchClone(state.destination),
  };
  const { sketch } = cfg;

  // Decay happens once per tick change, before the first edge of the new tick; ten edges in a tick share one background.
  if (event.tick > next.tick) {
    sketchDecay(next.edge, cfg.decay);
    sketchDecay(next.source, cfg.decay);
    sketchDecay(next.destination, cfg.decay);
    next.tick = event.tick;
  }

  const keyEdge = `${event.cardId}|${event.stationId}`;
  sketchAdd(next.edge, keyEdge, 'current', sketch);
  sketchAdd(next.source, event.cardId, 'current', sketch);
  sketchAdd(next.destination, event.stationId, 'current', sketch);

  const edge = sketchScore(next.edge, keyEdge, sketch);
  const source = sketchScore(next.source, event.cardId, sketch);
  const destination = sketchScore(next.destination, event.stationId, sketch);
  const score = round6(Math.log1p(Math.max(edge, source, destination)));
  const filtered = score >= cfg.threshold;

  // Filtering: an over-threshold edge is scored against the background but never joins it.
  if (!filtered) {
    sketchAdd(next.edge, keyEdge, 'totals', sketch);
    sketchAdd(next.source, event.cardId, 'totals', sketch);
    sketchAdd(next.destination, event.stationId, 'totals', sketch);
  }

  return { state: next, score: { tick: event.tick, edge, source, destination, score, filtered } };
}

/** Feeds `events` through a fresh state in order, returning one score per event. */
export function replayMidas(events: EdgeEvent[], cfg: MidasConfig): MidasScore[] {
  let state = initMidasState(cfg);
  const scores: MidasScore[] = [];
  for (const event of events) {
    const step = stepMidas(state, event, cfg);
    state = step.state;
    scores.push(step.score);
  }
  return scores;
}
