/*
 * The Tranche relay's truth model, a pure function of the frame. The day series is a slice of the precomputed "volatile" scenario in
 * scenarios.json (prices simulated, decisions from the real Tranche Agent); `build.ts` writes the slice into tranche.gen.ts and checks it
 * against the whole scenario. Fire rule (docs/algorithms.md §6.4): changepoint probability >= 0.9, run length >= 3 (the level has held 4 days),
 * segment mean >= the threshold. No DOM here.
 */

export interface Day {
  idx: number;
  price: number;
  /** Changepoint probability of the day. */
  cp: number;
  /** Run length of the most likely segment: days since its changepoint. */
  run: number;
  /** Mean price over the segment (run + 1 days), the number the agent compares with the threshold. */
  mean: number;
}

export interface Copy {
  /** "₱1,500", from the site's money helpers at build time. */
  tranche: string;
  cards: number;
}

export const FPS = 30;
export const DURATION = 360;
export const FIRST_DAY = 20;
export const LAST_DAY = 37;
export const FIRE_DAY = 36;
export const HOLD_NEEDED = 4;
export const CP_NEEDED = 0.9;
export const MARK = 65;

const STEP = 14;
const FIRST_AT = 14;
const RESET_AT = 318;
const RESET_LEN = 28;
const GATE_AT = 250;
const TOKEN_AT = 262;
const TOKEN_GAP = 14;
const TOKEN_LEN = 52;
const FADE_OUT_AT = 318;
const JUMP_AT = 332;
const FADE_IN_AT = 336;

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The three tests that must all hold before funds are released. */
export const testsOf = (day: Day) => [day.cp >= CP_NEEDED ? 1 : 0, day.run >= HOLD_NEEDED - 1 ? 1 : 0, day.mean >= MARK ? 1 : 0] as const;
export const heldOf = (day: Day) => Math.min(HOLD_NEEDED, day.run + 1);

export interface TrancheFrame {
  price: number;
  cp: number;
  /** 0..1 per held-days plunger. */
  pegs: number[];
  /** 0..1 per condition key: probability, held days, level. */
  keys: number[];
  gate: number;
  /** Per token: travel 0..1 and opacity. */
  tokens: Array<{ u: number; alpha: number }>;
  chips: number[];
  /** Day-clock needle, degrees clockwise from its zero. */
  needle: number;
  readout: string;
}

export function trancheAt(frame: number, days: Day[], copy: Copy): TrancheFrame {
  const dayAt = (d: number) => days[Math.min(LAST_DAY, Math.max(FIRST_DAY, d)) - FIRST_DAY]!;
  const pos = FIRST_DAY + Math.min(LAST_DAY - FIRST_DAY, Math.max(0, (frame - FIRST_AT) / STEP));
  const i = Math.floor(pos);
  const e = smooth((pos - i) / 0.6);
  const reset = smooth((frame - RESET_AT) / RESET_LEN);
  // A value that follows the day series, eased between days, and glides back to day 20's reading in the reset.
  const follow = (of: (day: Day) => number) => lerp(lerp(of(dayAt(i)), of(dayAt(i + 1)), e), of(dayAt(FIRST_DAY)), reset);

  const price = follow((d) => d.price);
  const cp = follow((d) => d.cp);
  const pegs = Array.from({ length: HOLD_NEEDED }, (_, k) => follow((d) => (heldOf(d) > k ? 1 : 0)));
  const keys = [0, 1, 2].map((k) => follow((d) => testsOf(d)[k]!));
  const needle = (i + e - FIRST_DAY + reset) * 20;

  const gate = smooth((frame - GATE_AT) / 26) * (1 - smooth((frame - (RESET_AT + 4)) / 24));
  const alpha = frame < JUMP_AT ? 1 - smooth((frame - FADE_OUT_AT) / 12) : smooth((frame - FADE_IN_AT) / 14);
  const tokens = Array.from({ length: copy.cards }, (_, k) => ({
    u: frame < JUMP_AT ? smooth((frame - TOKEN_AT - TOKEN_GAP * k) / TOKEN_LEN) : 0,
    alpha,
  }));
  const chips = tokens.map((t) => smooth((t.u - 0.85) / 0.15) * t.alpha);

  const shown = reset > 0.5 ? FIRST_DAY : e > 0.5 ? Math.min(LAST_DAY, i + 1) : i;
  const day = dayAt(shown);
  const released = frame >= GATE_AT && frame < JUMP_AT - 6;
  const readout = released
    ? `day ${FIRE_DAY} · released ${copy.cards} × ${copy.tranche}`
    : `day ${shown} · ₱${day.price.toFixed(2)} · p ${day.cp.toFixed(2)} · held ${heldOf(day)}/${HOLD_NEEDED}`;
  return { price, cp, pegs, keys, gate, tokens, chips, needle, readout };
}

/** The frame the still poster and reduced motion show: the moment of release, tokens on their way. */
export const STILL = 300;
