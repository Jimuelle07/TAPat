/**
 * The truth model of the recorder. Everything the figure shows (pen, paper, counter, latch, release,
 * readout) is a pure function of one clock `d` (days, 1 to the scenario length) and the precomputed
 * scenario data in `app/_landing/scenarios.json`. Prices are simulated; the release day `fireIdx` and
 * `cpRecent` come from the real Tranche Agent code (Bayesian Online Changepoint Detection), so nothing is
 * recomputed here.
 */

export type EventKind = "spike-ignored" | "hike" | "drop" | "release";

export interface LandingScenario {
  id: string;
  title: string;
  story: string;
  seed: number;
  points: Array<{ idx: number; pricePhp: number; cpRecent: number; mapR: number }>;
  shiftIdx: number;
  fireIdx: number;
  reason: string;
  events: Array<{ idx: number; label: string; kind: EventKind }>;
}

export interface LandingScenarios {
  source: "simulated";
  agent: "precomputed";
  thresholdPhp: number;
  tranchePhp: number;
  cards: number;
  scenarios: LandingScenario[];
}

/** DEFAULT_BOCPD.warmup in @tapat/agent: the first days only set the baseline. */
export const WARMUP_DAYS = 10;
const SPIKE_STATUS_DAYS = 4;

/** The pen holds a day's price, then swings to the next one over the last 30% of the day. */
const SWING_FROM = 0.7;
const smooth01 = (t: number) => {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
};
export const swingOf = (frac: number) => smooth01((frac - SWING_FROM) / (1 - SWING_FROM));
export { SWING_FROM };

/** The day clock the instruments see: whole days, with the swing at the end of each. */
export const stepped = (d: number) => {
  const whole = Math.floor(d);
  return whole + swingOf(d - whole);
};

export const dayOf = (scenario: LandingScenario, d: number) => Math.min(scenario.points.length, Math.max(1, Math.floor(d + 1e-9)));

export const pointOf = (scenario: LandingScenario, day: number) => scenario.points[Math.min(scenario.points.length, Math.max(1, day)) - 1]!;

/** Price under the pen at clock d: the day's price, swinging to the next day's at the end of the day. */
export function penPrice(scenario: LandingScenario, d: number) {
  const last = scenario.points.length;
  const clamped = Math.min(last, Math.max(1, d));
  const whole = Math.min(last, Math.floor(clamped));
  const a = pointOf(scenario, whole).pricePhp;
  if (whole >= last) return a;
  const b = pointOf(scenario, whole + 1).pricePhp;
  return a + (b - a) * swingOf(clamped - whole);
}

/** Consecutive days up to and including `day` that closed at or above the wire. */
export function runAbove(scenario: LandingScenario, day: number, thresholdPhp: number) {
  let run = 0;
  for (let i = Math.min(day, scenario.points.length); i >= 1; i--) {
    if (pointOf(scenario, i).pricePhp < thresholdPhp) break;
    run++;
  }
  return run;
}

/** Teeth the counting wheel stands at on a whole day: the run above the wire, and back to zero once the latch has tripped. */
export const teethOn = (scenario: LandingScenario, day: number, thresholdPhp: number) => (day >= scenario.fireIdx ? 0 : runAbove(scenario, day, thresholdPhp));

export const releasedOn = (scenario: LandingScenario, day: number) => day >= scenario.fireIdx;

export type Status = "Watching" | "Spike ignored" | "Shift detected" | "Funds released";

export function statusOn(scenario: LandingScenario, day: number): Status {
  const current = pointOf(scenario, day);
  const recentSpike = scenario.events.some((e) => e.kind === "spike-ignored" && e.idx <= day && day - e.idx < SPIKE_STATUS_DAYS);
  if (day >= scenario.fireIdx) return "Funds released";
  if (day >= scenario.shiftIdx && current.cpRecent >= 0.5) return "Shift detected";
  if (recentSpike) return "Spike ignored";
  return "Watching";
}

export const perLitre = (n: number) => `₱${n.toFixed(2)}`;

/** Changepoint probability for the dial, or null during warm-up. */
export const cpOn = (scenario: LandingScenario, day: number) => {
  const point = pointOf(scenario, day);
  return point.idx <= WARMUP_DAYS ? null : point.cpRecent;
};

export function readoutOn(scenario: LandingScenario, day: number) {
  const point = pointOf(scenario, day);
  const cp = cpOn(scenario, day);
  return `Day ${day} · ${perLitre(point.pricePhp)}/L · ${cp === null ? "warm-up" : `p ${cp.toFixed(3)}`} · ${statusOn(scenario, day)}`;
}

export const RESTING_READOUT = "Day 1 · warming up";

/** A representative frame for reduced motion: the release done and the tokens in their trays. */
export const stillDayOf = (scenario: LandingScenario) => Math.min(scenario.points.length, scenario.fireIdx + 6);

/** Real seconds per simulated day when the recorder plays by itself. */
export const SECONDS_PER_DAY = 0.3;
