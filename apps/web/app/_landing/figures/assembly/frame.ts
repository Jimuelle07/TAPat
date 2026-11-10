import type { SolidPaths } from "@/app/_landing/iso/iso-kit";
import { CLAIM, GOV, LOCK, PUSH_TIP, READER, SWEEP, TRAY, X1, X2, X3, X4, X5, X6, X7, X8 } from "./consts";
import { cleatsAt, gateAt, governorAt, keywayAt, leverAt, needleAt, radarAt, springAt } from "./dyn";
import type { Truth } from "./truth";
import { BELT_X0, BELT_X1, BELT_Z, CHIP_H, CHIP_R, CHIP_Z, move } from "./view";

/* The whole figure as a pure function of one number. u runs 0 to 8.35: the integer part is the station, and each
   station spends its first 0.62 working and the rest carrying the chips to the next. Every moving part is a
   function of u (and of whether the card is frozen), so the tour, the pointer and the keys all just choose u,
   and scrubbing backwards plays everything backwards. */

export const ACT = 0.62;
export const GO = 0.64;
export const U_END = 8.35;
export const U_REST = 4.62;

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const STATIONS = [X1, X2, X3, X4, X5, X6, X7, X8];
const FLOOR = 2.4;

/* A carry with momentum: the stack leans back a hair, sets off, runs a hair past the station and settles. The back
   terms are ease-in-out-back with a small constant, so it overshoots by about 2% of the stride. */
const BACK = 0.75;
const glide = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  const c = BACK * 1.525;
  const f = t < 0.5 ? ((2 * t) ** 2 * ((c + 1) * 2 * t - c)) / 2 : ((2 * t - 2) ** 2 * ((c + 1) * (2 * t - 2) + c) + 2) / 2;
  return f;
};

/* Where the stack of chips is along the belt. */
function stackX(u: number) {
  if (u < 0.5) return lerp(BELT_X0 + 14, X1, smooth(0, 0.5, u));
  for (let i = 0; i < 7; i++) if (u < i + 1) return u < i + GO ? STATIONS[i]! : lerp(STATIONS[i]!, STATIONS[i + 1]!, glide(i + GO, i + 1, u));
  if (u < 7 + GO) return X8;
  return lerp(X8, SWEEP.box.x, smooth(7 + GO, 8, u));
}

/* The settle after a carry: the stack rocks on the belt for a moment once it stops at a station. */
const settleAt = (u: number) => {
  const du = u - Math.floor(u);
  return u >= 1 && u < 8 && du < 0.24 ? 0.55 * Math.exp(-du * 15) * Math.sin(du * 58) : 0;
};

/* The height of what the chips ride on at x: the belt, the chute, the lockbox floor. */
const surfaceAt = (x: number) => (x < SWEEP.rampX0 ? BELT_Z : x < SWEEP.rampX1 ? lerp(BELT_Z, FLOOR, (x - SWEEP.rampX0) / (SWEEP.rampX1 - SWEEP.rampX0)) : FLOOR);

const PRICE_AT = (truth: Truth, u: number) => {
  const days = truth.days;
  const t = clamp((u - 0.2) / 0.4) * (days.length - 1);
  const index = Math.min(days.length - 2, Math.floor(t));
  const from = days[index]!;
  const to = days[index + 1]!;
  const f = smooth(0, 0.7, t - index);
  const shown = t - index >= 0.7 ? to : from;
  return { price: lerp(from.price, to.price, f), shown };
};

export interface Pose {
  u: number;
  step: number;
  frozen: boolean;
  say: string;
  chips: Array<{ x: number; y: number; z: number }>;
  opacity: number;
  belt: number;
  tray: number;
  card: number;
  tap: boolean;
  pins: number[];
  plug: number;
  gov: number;
  lift: number;
  pusher: number;
  gate7: number;
  closed: number;
  lever: number;
  stop8: number;
  radar: number;
  price: number;
}

export function poseAt(u: number, frozen: boolean, clock: number, truth: Truth): Pose {
  const x = stackX(u);
  const a = (i: number) => clamp((u - i) / ACT);
  const sx = Math.min(x, BELT_X1);

  // 03: the drawer takes the stack in and brings it back out
  const a2 = a(2);
  const tray = -TRAY.travel * (smooth(0.05, 0.38, a2) - smooth(0.58, 0.9, a2));

  // 04: the card goes down onto the pad and comes back up
  const a3 = a(3);
  const card = -READER.stroke * (smooth(0.05, 0.35, a3) - smooth(0.62, 0.92, a3));
  const tap = a3 > 0.33 && a3 < 0.66;

  // 05: each pin rises to the shear line in turn, then the plug turns
  const a4 = a(4);
  const hum = (j: number) => 0.3 * Math.sin(clock * 5.5 + j * 2.1);
  const sets = LOCK.start.map((_, j) => smooth(0.06 + 0.12 * j, 0.22 + 0.12 * j, a4));
  const pins = LOCK.start.map((start, j) => start * (1 - sets[j]!) + hum(j) * (1 - sets[j]!));
  const plug = 90 * smooth(0.5, 0.92, a4);

  // 02: the governor swings out while the shift is judged; its balls always sway a little on their arms
  const a1 = a(1);
  const wobble = 0.7 * Math.sin(clock * 9) * (0.45 + 0.55 * smooth(0.1, 0.3, a1) * (1 - smooth(0.75, 0.9, a1)));
  const gov = lerp(GOV.from, GOV.to, smooth(0.12, 0.85, a1)) + wobble;
  const lift = governorAt(gov).sleeve - governorAt(GOV.from).sleeve;

  // 07: the pusher shoves the top chip onto the chute, or the latch holds it
  const u6 = u - 6;
  const sp = smooth(0.08, 0.36, u6);
  const sr = smooth(0.4, 0.62, u6);
  const tip = frozen ? 0 : -CLAIM.push * (sp - sr);
  const closed = frozen ? smooth(5.45, 5.8, u) : 0;
  const ramp = CLAIM.ramp;

  // 08: the lever and the stop plate
  const a7 = a(7);
  const lever = lerp(SWEEP.lever.from, SWEEP.lever.to, smooth(0.08, 0.5, a7));
  const stop8 = 12.5 * smooth(0.3, 0.62, a7);

  const rock = settleAt(u);
  const run = (k: number) => {
    const level = surfaceAt(x) + CHIP_H * k;
    return { x, y: tray, z: level + rock };
  };
  const chips = [run(0), run(1), run(2)];
  if (!frozen && u >= 6) {
    const release = PUSH_TIP - CLAIM.push - CHIP_R;
    const pushed = Math.min(0, PUSH_TIP + tip - CHIP_R);
    const slide = smooth(0.38, 0.8, u6) ** 1.6;
    const y = u6 < 0.36 ? pushed : lerp(release, CLAIM.bin.y, slide);
    let z = CHIP_Z[2]!;
    if (y < ramp.y0) z = y > ramp.y1 ? lerp(ramp.z0, ramp.z1, (ramp.y0 - y) / (ramp.y0 - ramp.y1)) : lerp(ramp.z1, CLAIM.bin.floor, smooth(0, 8, ramp.y1 - y));
    const onRamp = smooth(0, 5, ramp.y0 - y) * (1 - smooth(0, 5, ramp.y1 - y));
    chips[2] = { x: X7, y, z: z + 2.4 * onRamp };
  }

  const opacity = smooth(0, 0.12, u) * (1 - smooth(8.2, U_END, u));

  const { price, shown } = PRICE_AT(truth, u);
  const frac = u - Math.floor(u);
  const step = Math.min(7, Math.floor(u) + (frac >= GO + 0.18 ? 1 : 0));

  const aligned = sets.filter((s) => s > 0.98).length;
  const say = ((): string => {
    const t = truth.say;
    switch (step) {
      case 0:
        return t.sensor.replace("{day}", String(shown.day)).replace("{price}", shown.price.toFixed(2));
      case 1:
        return a1 > 0.55 ? t.fire : t.think;
      case 2:
        return t.fund;
      case 3:
        return t.tap;
      case 4:
        return t.check[aligned]!;
      case 5:
        return frozen && a(5) > 0.4 ? t.frozen : t.watch;
      case 6:
        return frozen ? t.held : t.claim;
      default:
        return frozen ? t.sweepHeld : t.sweep;
    }
  })();

  return {
    u,
    step,
    frozen,
    say,
    chips,
    opacity,
    belt: (sx + clock * 7) % 9,
    tray,
    card,
    tap,
    pins,
    plug,
    gov,
    lift,
    pusher: tip,
    gate7: CLAIM.gate * (1 - closed),
    closed,
    lever,
    stop8,
    radar: (clock * 80 + 20) % 360,
    price: price + 0.2 * Math.sin(clock * 6.3),
  };
}

/* What to write onto the drawing for a pose. */
export interface Draw {
  move: Record<string, string>;
  lines: Record<string, string>;
  solids: Record<string, SolidPaths>;
  flags: Record<string, boolean>;
  opacity: number;
}

const REST_GOV = governorAt(GOV.from);
const REST_LEVER = leverAt(SWEEP.lever.from);

export function drawOf(p: Pose): Draw {
  const g = governorAt(p.gov);
  const lever = leverAt(p.lever);
  const lines: Record<string, string> = {
    needle: needleAt(p.price),
    cleats: cleatsAt(p.belt),
    ...g.lines,
    keyway: keywayAt(p.plug),
    lever: lever.d,
  };
  p.pins.forEach((delta, j) => {
    const spring = springAt(j, delta);
    lines[`sb${j}`] = spring.back;
    lines[`sf${j}`] = spring.front;
  });
  const moves: Record<string, string> = {
    tray: move(0, p.tray, 0),
    card: move(0, 0, p.card),
    govlift: move(0, 0, p.lift),
    ballL: move(g.left.ball[0] - REST_GOV.left.ball[0], 0, g.left.ball[2] - REST_GOV.left.ball[2]),
    ballR: move(g.right.ball[0] - REST_GOV.right.ball[0], 0, g.right.ball[2] - REST_GOV.right.ball[2]),
    pusher: move(0, p.pusher, 0),
    gate7: move(0, 0, p.gate7),
    knob: move(lever.tip[0] - REST_LEVER.tip[0], 0, lever.tip[2] - REST_LEVER.tip[2]),
    stop8: move(0, 0, p.stop8),
  };
  p.pins.forEach((delta, j) => (moves[`pin${j}`] = move(0, 0, delta)));
  p.chips.forEach((chip, k) => (moves[`chip${k}`] = move(chip.x, chip.y, chip.z - CHIP_Z[k]!)));
  const flags: Record<string, boolean> = { chipBack: p.u >= 6 && (p.chips[2]?.y ?? 0) < -21, tap: p.tap, beacon: p.closed > 0.5, signal: p.closed > 0.05, gate7p: p.closed > 0.5, gate7: p.closed > 0.5 };
  for (let i = 0; i < 8; i++) flags[`plate${i}`] = i === p.step;
  return { move: moves, lines, solids: { gate: gateAt(p.plug), radar: radarAt(p.radar) }, flags, opacity: p.opacity };
}

/* The tour: how long each stretch of u takes, in seconds. */
const WORK = [3.0, 3.0, 3.6, 2.6, 3.6, 2.6, 3.6, 3.0];
const SEGMENTS: Array<{ from: number; to: number; seconds: number }> = [
  ...WORK.flatMap((seconds, i) => [
    { from: i, to: i + GO, seconds },
    { from: i + GO, to: i + 1, seconds: i === 7 ? 1.5 : 0.8 },
  ]),
  { from: 8, to: 8.2, seconds: 1.0 },
  { from: 8.2, to: U_END, seconds: 0.5 },
];
export const TOUR_LENGTH = SEGMENTS.reduce((sum, s) => sum + s.seconds, 0);

export function tourU(t: number) {
  let left = t;
  for (const s of SEGMENTS) {
    if (left <= s.seconds) return lerp(s.from, s.to, left / s.seconds);
    left -= s.seconds;
  }
  return U_END;
}

export function tourAt(u: number) {
  let t = 0;
  for (const s of SEGMENTS) {
    if (u <= s.to) return t + ((u - s.from) / (s.to - s.from)) * s.seconds;
    t += s.seconds;
  }
  return t;
}

/* The u a station's work is finished at: a step to station i lands here. */
export const stationU = (i: number) => i + ACT;
