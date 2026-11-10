/*
 * The truth of the price-mixing machine. Everything the figure draws or prints comes from here, and the numbers come
 * from `lib/diesel-sim.ts` (the simulated diesel year). Pure: no DOM, no clock, no randomness.
 *
 * The pump price is  pump = ((crude US$/bbl × peso/US$ ÷ 158.987 L/bbl) × 1.25 + excise 6.00 + margin 9.50) × 1.12.
 * The machine solves that with parts, and `kin` below does the same with the parts' real positions, so the figure
 * can never disagree with the simulator:
 *   - a lever hinged at one end: crude (float) lifts it at a fixed station, the peso rate slides a carriage along it
 *     (distance = KAPPA × rate), so the carriage rises  ∝ crude × rate           (the product);
 *   - a floating balance arm rests on that carriage at one end and on two fixed weights (excise 6.00, margin 9.50)
 *     at the other; its midpoint rises by half the sum                                   (the addition);
 *   - a rack on the midpoint turns a 14-tooth pinion, coaxial with a 28-tooth gear that drives a 25-tooth gear:
 *     28 ÷ 25 = 1.12, so the last shaft turns exactly  1 + VAT  times as far            (the VAT);
 *   - the last shaft swings a pointer over a ₱/L scale; a counter copies the price only when the calendar cam
 *     lets it, on a Tuesday.
 */
import {
  DIESEL_CRACK_FACTOR,
  DIESEL_EXCISE_PHP,
  DIESEL_MARGIN_PHP,
  DIESEL_VAT_RATE,
  LITRES_PER_BARREL,
  WEEKS_PER_YEAR,
  pumpFromBenchmark,
  simulateDieselYear,
  type DieselWeek,
} from "../../../../lib/diesel-sim";

export { WEEKS_PER_YEAR, pumpFromBenchmark, simulateDieselYear, type DieselWeek };
export { DIESEL_CRACK_FACTOR, DIESEL_EXCISE_PHP, DIESEL_MARGIN_PHP, DIESEL_VAT_RATE, LITRES_PER_BARREL };

/** The price the Tranche Agent's demo trigger sits on (docs/PRD.md §3). */
export const INDEX_PHP = 65;

/** The simulator starts from these benchmarks: week 1's pump price is the one they imply. */
export const OPENING = { crudeUsd: 80, phpPerUsd: 57.5 } as const;
export const OPENING_PUMP = Math.round(pumpFromBenchmark(OPENING.crudeUsd, OPENING.phpPerUsd) / 0.05) * 0.05;

export const CRUDE_RANGE = [55, 120] as const;
export const FX_RANGE = [54, 61] as const;

// ---------------------------------------------------------------- the linkage (x along the bench, z up)

export const GAIN = DIESEL_CRACK_FACTOR / LITRES_PER_BARREL; // ₱/L per (US$/bbl × ₱/US$)
export const XH = 60; // hinge of the product lever
export const ZH = 14;
export const D1 = 200; // crude's station along the lever
export const S1 = 0.7; // lever rise at that station per US$/bbl
export const KAPPA = 2.8; // carriage distance from the hinge per ₱/US$
/** Height units the carriage gains per ₱/L of product cost. */
export const K_OUT = (S1 * KAPPA) / D1 / GAIN;

export const TOWER_H = 22; // carriage pin to the balance arm's left pin
export const BEAM_L = 130; // balance arm, pin to pin
export const BEAM_XR = 28; // right pin x (fixed)
export const WEIGHT_PLATE = 3; // plate on top of the weights; the arm's right pin sits at its mid-height
export const EXCISE_H = DIESEL_EXCISE_PHP * K_OUT;
export const MARGIN_H = DIESEL_MARGIN_PHP * K_OUT;
/** The post under the weights is as tall as puts the balance arm level at the opening benchmark. */
const Z1_OPENING = ZH + KAPPA * OPENING.phpPerUsd * ((S1 * OPENING.crudeUsd) / D1) + TOWER_H;
export const POST_TOP = Z1_OPENING - EXCISE_H - MARGIN_H - WEIGHT_PLATE;
export const ZR0 = POST_TOP + WEIGHT_PLATE; // arm's right pin height with no weights at all

export const TEETH = { pinion: 14, a: 28, b: 25 } as const;
export const MODULE = 1.5;
export const R_PINION = (TEETH.pinion * MODULE) / 2;
export const R_A = (TEETH.a * MODULE) / 2;
export const R_B = (TEETH.b * MODULE) / 2;
export const RACK_X = -37; // the rack's pitch line (the arm's middle)
export const GEAR_A: [number, number] = [RACK_X + R_PINION, 124];
export const GEAR_B: [number, number] = [GEAR_A[0] + R_A + R_B, 124];
export const ZM_ZERO = (ZH + TOWER_H + ZR0) / 2;

/** Pointer: ₱ per radian of the last shaft, and where it points at the index price. */
export const PHP_PER_RAD = (2 * R_PINION) / K_OUT;
export const POINTER_AT_INDEX = (60 * Math.PI) / 180;
const POINTER_ZERO = POINTER_AT_INDEX - INDEX_PHP / PHP_PER_RAD;
export const pointerAngleOf = (php: number) => POINTER_ZERO + php / PHP_PER_RAD;

export interface Kin {
  crude: number;
  fx: number;
  /** Lever */
  tilt: number; // radians
  pusher: [number, number]; // pin the float's arm drives
  carriage: [number, number]; // pin the peso post positions
  /** Balance arm */
  beamL: [number, number];
  beamR: [number, number];
  beamM: [number, number];
  /** Q: how far the rack has risen from its zero. */
  rise: number;
  /** Shaft angles, radians, counter-clockwise from +x in the x–z plane */
  pinion: number;
  gearB: number;
  pointer: number;
  /** ₱/L the machine reads at this instant (before the Tuesday gate) */
  pump: number;
}

/** Where every moving part of the lever, arm and gear train sits for a benchmark (crude US$/bbl, peso per US$). */
export function kin(crude: number, fx: number): Kin {
  const tan = (S1 * crude) / D1;
  const d2 = KAPPA * fx;
  const carriage: [number, number] = [XH - d2, ZH + d2 * tan];
  const z1 = carriage[1] + TOWER_H;
  const z2 = ZR0 + EXCISE_H + MARGIN_H;
  const xl = BEAM_XR - Math.sqrt(BEAM_L * BEAM_L - (z2 - z1) * (z2 - z1));
  const beamL: [number, number] = [xl, z1];
  const beamR: [number, number] = [BEAM_XR, z2];
  const beamM: [number, number] = [(xl + BEAM_XR) / 2, (z1 + z2) / 2];
  const rise = beamM[1] - ZM_ZERO;
  const pinion = -rise / R_PINION;
  const gearB = (TEETH.a / TEETH.b) * (rise / R_PINION);
  return {
    crude,
    fx,
    tilt: Math.atan(tan),
    pusher: [XH - D1, ZH + S1 * crude],
    carriage,
    beamL,
    beamR,
    beamM,
    rise,
    pinion,
    gearB,
    pointer: gearB + POINTER_ZERO,
    pump: (2 * (1 + DIESEL_VAT_RATE) * rise) / K_OUT,
  };
}

/** The machine at the simulator's opening benchmark: the pose every moving part is built at. */
export const REST = kin(OPENING.crudeUsd, OPENING.phpPerUsd);

// ---------------------------------------------------------------- the clock: one week per WEEK_S

export const WEEK_S = 0.8;
export const RESET_S = 1.1;
export const HOLD_S = 2.0; // after week 52, including the reset to the opening state
export const YEAR_S = WEEKS_PER_YEAR * WEEK_S + HOLD_S;

/** Cam, in degrees from the notch centre: it dwells on Tuesday and runs the rest of the week. */
const NOTCH_HALF = 34;
const DWELL = 0.34;
export const CAM_NOTCH_DEG = NOTCH_HALF;
export const CAM_DEPTH = 4.5;

const smooth = (t: number) => {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
};

/** Cam angle (degrees from the notch centre, positive = turning on) at a phase of the week. */
export function camAngle(phase: number) {
  if (phase < DWELL) return -NOTCH_HALF + (2 * NOTCH_HALF * phase) / DWELL;
  return NOTCH_HALF + ((360 - 2 * NOTCH_HALF) * (phase - DWELL)) / (1 - DWELL);
}

/** The cam's radius deficit (follower sinking) at an angle from the notch centre, degrees. */
export function notchDepth(angle: number) {
  const a = Math.abs(((angle + 180) % 360 + 360) % 360 - 180);
  return CAM_DEPTH * (1 - smooth((a - NOTCH_HALF * 0.5) / (NOTCH_HALF * 0.5)));
}

export interface Bench {
  crude: number;
  fx: number;
  pump: number;
}

const OPENING_BENCH: Bench = { crude: OPENING.crudeUsd, fx: OPENING.phpPerUsd, pump: OPENING_PUMP };
const benchOf = (w: DieselWeek): Bench => ({ crude: w.crudeUsd, fx: w.phpPerUsd, pump: w.pumpPhp });

/** A cubic Hermite through weekly values with Catmull-Rom tangents: the market keeps moving through every week boundary at the speed it had, so the gears never stop and start. */
const glide = (p0: number, p1: number, p2: number, p3: number, u: number) => {
  const m1 = (p2 - p0) / 2;
  const m2 = (p3 - p1) / 2;
  const u2 = u * u;
  const u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p1 + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2 + (u3 - u2) * m2;
};

export interface State {
  week: number; // 1-based; 0 before the first Tuesday
  phase: number;
  crude: number; // what the drum and dial show right now
  fx: number;
  counter: number; // what the counter shows right now (rolling on Tuesdays only)
  camDeg: number; // degrees from the notch centre
  gate: number; // 0 shut … CAM_DEPTH open
  pump: number; // the pump price the counter has settled on or is rolling towards
  change: number;
  event: string | null;
  note: "week" | "year ends";
}

/** The machine at `t` seconds into a year (0 … YEAR_S). `year` is simulateDieselYear(seed). */
export function stateAt(year: readonly DieselWeek[], t: number): State {
  if (t >= WEEKS_PER_YEAR * WEEK_S) {
    const last = year[WEEKS_PER_YEAR - 1]!;
    const into = t - WEEKS_PER_YEAR * WEEK_S;
    const back = smooth((into - (HOLD_S - RESET_S)) / RESET_S);
    const mix = (a: number, b: number) => a + (b - a) * back;
    return {
      week: WEEKS_PER_YEAR,
      phase: 1,
      crude: mix(last.crudeUsd, OPENING.crudeUsd),
      fx: mix(last.phpPerUsd, OPENING.phpPerUsd),
      counter: mix(last.pumpPhp, OPENING_PUMP),
      camDeg: -NOTCH_HALF,
      gate: 0,
      pump: last.pumpPhp,
      change: last.changePhp,
      event: null,
      note: "year ends",
    };
  }
  const index = Math.min(WEEKS_PER_YEAR - 1, Math.max(0, Math.floor(t / WEEK_S)));
  const phase = Math.min(1, t / WEEK_S - index);
  const week = year[index]!;
  const before = index === 0 ? OPENING_BENCH : benchOf(year[index - 1]!);
  const now = benchOf(week);
  const benchAt = (i: number) => (i < 0 ? OPENING_BENCH : benchOf(year[Math.min(WEEKS_PER_YEAR - 1, i)]!));
  const [b0, b1, b2, b3] = [benchAt(index - 2), benchAt(index - 1), benchAt(index), benchAt(index + 1)];
  const roll = smooth((phase - 0.07) / 0.2);
  const camDeg = camAngle(phase);
  return {
    week: index + 1,
    phase,
    crude: glide(b0.crude, b1.crude, b2.crude, b3.crude, phase),
    fx: glide(b0.fx, b1.fx, b2.fx, b3.fx, phase),
    counter: before.pump + (now.pump - before.pump) * roll,
    camDeg,
    gate: notchDepth(camDeg),
    pump: now.pump,
    change: week.changePhp,
    event: week.event,
    note: "week",
  };
}

/** The state at a given week's Tuesday settle (counter and cam at rest on the new price, market still at the old benchmark). */
export const weekStart = (week: number) => (week - 1) * WEEK_S;

// ---------------------------------------------------------------- the counter's number wheels

/** Wheel positions (digit units, may be fractional while rolling) for a price: hundredths, tenths, units, tens. */
export function wheelsOf(value: number): [number, number, number, number] {
  const hundredths = Math.round(value * 100 * 1000) / 1000;
  const out: number[] = [];
  let carry = hundredths;
  for (let wheel = 0; wheel < 4; wheel++) {
    out.push(carry);
    const whole = Math.floor(carry / 10);
    const rest = carry - whole * 10;
    // Like an odometer: a wheel only turns its neighbour while it passes from 9 to 0.
    carry = whole + Math.max(0, rest - 9);
  }
  return out as [number, number, number, number];
}

/** The text a counter shows when settled, e.g. "65.25". */
export const priceText = (value: number) => value.toFixed(2);

export const perLitre = (value: number) => `₱${value.toFixed(2)}`;

// ---------------------------------------------------------------- words

const sign = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "±");

/** Two lines for the plate's corner readout. */
export function readoutOf(s: State, seed: number): string {
  if (s.note === "year ends") return `year ${seed} ends · ${perLitre(s.pump)}/L\ncounter back to ${perLitre(OPENING_PUMP)}`;
  const change = Math.abs(s.change) < 0.005 ? "no change" : `Tue ${sign(s.change)}${Math.abs(s.change).toFixed(2)}`;
  const first = `week ${s.week} · pump ${perLitre(s.counter)}/L · ${change}`;
  const second = `crude $${s.crude.toFixed(2)}/bbl · ₱${s.fx.toFixed(2)}/US$${s.event ? ` · ${s.event}` : ""}`;
  return `${first}\n${second}`;
}

/** The same in a sentence, for screen readers. */
export function describeOf(s: State, seed: number): string {
  if (s.note === "year ends") return `Simulated year ${seed} is over. The pump price ended at ${perLitre(s.pump)} per litre.`;
  const change = Math.abs(s.change) < 0.005 ? "no change" : `${s.change > 0 ? "up" : "down"} ${Math.abs(s.change).toFixed(2)} pesos`;
  const side = s.pump >= INDEX_PHP ? `at or above the ₱${INDEX_PHP.toFixed(2)} index` : `below the ₱${INDEX_PHP.toFixed(2)} index`;
  return `Year ${seed}, week ${s.week} of ${WEEKS_PER_YEAR}. Pump price ${perLitre(s.pump)} per litre, ${change} on Tuesday, ${side}. Crude ${s.crude.toFixed(2)} dollars a barrel, ${s.fx.toFixed(2)} pesos to the dollar.${s.event ? ` ${s.event}.` : ""}`;
}
