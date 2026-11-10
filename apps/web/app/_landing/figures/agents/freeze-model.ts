/*
 * The Freeze rig's truth model, a pure function of the frame. The trace is the real MIDAS-F code (packages/agent, 2×1024 Count-Min
 * Sketch, decay 0.6, threshold from apps/server/config/midas.json) run by `build.ts` over the committed honest history and burst fixtures;
 * every edge carries the score and the sketch columns the code produced. Taps are simulated, as the fixtures are. No DOM here.
 */

export interface Edge {
  /** Frame at which the tap passes the sensor and is scored. */
  s: number;
  /** Bound for the station the rig shows (the one the burst hits). */
  b: boolean;
  /** At least 90% of the per-tap cap. */
  near: boolean;
  score: number;
  /** Sketch columns after this edge: row 0 then row 1, sixteen each. */
  cols: number[];
}

export interface Trace {
  edges: Edge[];
  /** Columns and score before the first shown edge. */
  base: number[];
  baseScore: number;
  /** Index of the first edge whose score reaches the threshold. */
  cross: number;
}

export interface Copy {
  /** "2.20", the configured threshold. */
  threshold: string;
}

export const FPS = 30;
export const DURATION = 360;
export const FLIGHT = 52;
export const POOL = 12;

/** Frames into its flight at which a token passes the sensor arch (build.ts checks it against the lane geometry). */
export const SENSOR_AT = 30;

const RESET_AT = 290;
const SHUTTER_LEN = 22;
const DECAY = 0.6;
const TICK = 7;

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export interface TapFrame {
  /** Position 0..1 along the lane. */
  u: number;
  alpha: number;
  near: boolean;
}

export interface FreezeFrame {
  cols: number[];
  score: number;
  /** 0 rolled up, 1 closed. */
  shutter: number;
  lamp: number;
  sense: number;
  /** Per pool slot, null when idle. */
  taps: Array<TapFrame | null>;
  readout: string;
}

export function freezeAt(frame: number, trace: Trace, copy: Copy): FreezeFrame {
  const { edges, base, baseScore, cross } = trace;
  const crossAt = edges[cross]!.s;
  const last = edges[edges.length - 1]!;

  // Sketch and score: the latest scored edge, eased in over six frames from the one before it.
  let i = -1;
  for (let k = 0; k < edges.length; k++) if (edges[k]!.s <= frame) i = k;
  const colsOf = (k: number) => (k < 0 ? base : edges[k]!.cols);
  const scoreOf = (k: number) => (k < 0 ? baseScore : edges[k]!.score);
  const e = i < 0 ? 0 : smooth((frame - edges[i]!.s) / 6);
  let cols = colsOf(i).map((v, n) => lerp(colsOf(i - 1)[n]!, v, e));
  let score = lerp(scoreOf(i - 1), scoreOf(i), e);

  // Reset: the window decays by 0.6 a tick toward where it started, and the needle goes home.
  if (frame > RESET_AT) {
    const steps = (frame - RESET_AT) / TICK;
    const k = Math.floor(steps);
    const part = smooth(steps - k);
    const level = (n: number) => DECAY ** n;
    const from = last.cols.map((v, n) => base[n]! + (v - base[n]!) * level(k));
    const to = last.cols.map((v, n) => base[n]! + (v - base[n]!) * level(k + 1));
    cols = from.map((v, n) => lerp(v, to[n]!, part));
    cols = cols.map((v, n) => lerp(v, base[n]!, smooth((frame - (RESET_AT + 38)) / 14)));
    score = lerp(last.score, baseScore, smooth((frame - RESET_AT) / 36));
  }

  const dropped = smooth((frame - (crossAt + 4)) / SHUTTER_LEN) * (1 - smooth((frame - (RESET_AT + 6)) / 26));
  const lamp = smooth((frame - crossAt) / 5) * (1 - smooth((frame - (RESET_AT + 6)) / 10));

  let sense = 0;
  const taps: Array<TapFrame | null> = Array.from({ length: POOL }, () => null);
  let token = 0;
  edges.forEach((edge, index) => {
    if (!edge.b) return;
    const slot = token++ % POOL;
    const spawn = edge.s - SENSOR_AT;
    const age = frame - edge.s;
    if (age >= 0 && age <= 10) sense = Math.max(sense, 1 - smooth(age / 10));
    if (frame < spawn || frame > spawn + FLIGHT) return;
    const refused = index > cross;
    const u = Math.min((frame - spawn) / FLIGHT, refused ? SENSOR_AT / FLIGHT : 1);
    const fadeIn = smooth((frame - spawn) / 5);
    const fadeOut = refused ? 1 - smooth((frame - edge.s) / 9) : 1 - smooth((u - 0.92) / 0.08);
    taps[slot] = { u, alpha: fadeIn * fadeOut, near: edge.near };
  });

  const frozen = frame >= crossAt && frame < RESET_AT + 6;
  const shown = frozen ? edges[cross]!.score : score;
  const readout = frozen ? `frozen · MIDAS ${edges[cross]!.score.toFixed(2)} ≥ ${copy.threshold}` : `MIDAS ${shown.toFixed(2)} / ${copy.threshold}`;
  return { cols, score, shutter: dropped, lamp, sense, taps, readout };
}

/** The frame the still poster and reduced motion show: the station frozen under the burst. */
export const STILL = 262;
