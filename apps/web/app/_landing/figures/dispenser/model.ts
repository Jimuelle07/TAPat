import { angleOf, NOTCH_DEG, LATCH_OUT_DEG } from "./kin";
import { ASK_MAX, SLIDE_RATE, STOP_PESO } from "./view";

// The truth model. Numbers come from the demo program (PRD §3: ₱65.00/L trigger, ₱1,500 per card, ₱500 per-tap cap), from the real
// "staircase" scenario of scenarios.json for the price path (days 24 to 28, fired on day 28 after four days above the mark), and from the
// hero's sample taps. No DOM here.
export const MARK = 65;
export const HOLD_DAYS = 4;
export const DAY_NO = [24, 25, 26, 27, 28];
export const DAY_PRICE = [63.84, 67.4, 67.59, 67.61, 67.65];
export const CARD_PESO = 1500;
export const CARDS = 3;
export const FUNDED = CARD_PESO * CARDS; // 4,500
export const TAP_OK = 300;
export const TAP_NO = 800;
export const CAP = STOP_PESO; // 500
export const SPENT = TAP_OK;
export const RETURNED = FUNDED - SPENT; // 4,200
export const WHO_OK = "Ana V. …A1B2";
export const WHO_NO = "Juan D. …A9C7";

// Display strings are built on the server with the site's money helpers and passed down; the live code never formats money itself.
export interface Copy {
  money: string[]; // index = pesos / 100
  price: string[]; // "63.84" … for each day
  mark: string; // "65.00"
  lgu: string; // the lockbox label
}

export const BEATS = 4;
export const BEAT_NAME = ["Price rolls up", "Gate lifts", "Two taps", "Funds return"];
export const BEAT_LENGTH = [6.2, 4.9, 5.6, 4.4];
export const TOUR_LENGTH = BEAT_LENGTH.reduce((sum, length) => sum + length, 0);

export interface Targets {
  day: number; // index into DAY_PRICE of the price the drum is rolling to
  stage: number; // lever stage 0..5
  latch: number; // degrees
  fill: [number, number, number]; // balances in pesos
  box: number; // pesos in the LGU lockbox
  ask: number; // pesos requested at the reader
  flow: boolean; // funds are running down the return chute
  who: string;
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
export const ease = (t: number) => {
  const u = clamp(t, 0, 1);
  return u * u * (3 - 2 * u);
};

// Everything every actuator is told to do, `t` seconds into `beat`. Earlier beats are finished and later ones have not begun, so any beat can be entered cold.
export function targetsAt(beat: number, t: number): Targets {
  const targets: Targets = { day: 0, stage: 0, latch: 0, fill: [0, 0, 0], box: 0, ask: 0, flow: false, who: "" };
  if (beat === 0) {
    // Four days, each rolled in turn; the lever climbs a notch when the wheels have landed.
    const rolls = [0.5, 1.6, 2.7, 3.8];
    targets.day = rolls.filter((at) => t >= at).length;
    targets.stage = rolls.filter((at) => t >= at + 0.8).length;
    if (t >= 4.9) targets.latch = LATCH_OUT_DEG;
    if (t >= 5) targets.stage = 5;
    return targets;
  }
  targets.day = 4;
  targets.stage = 5;
  targets.latch = LATCH_OUT_DEG;
  if (beat === 1) {
    // Each card fills on a long eased ramp, so the next one starts as the last lands and the level never waits.
    targets.fill = [0, 1, 2].map((card) => CARD_PESO * ease((t - 0.3 - card * 1.3) / 1.4)) as Targets["fill"];
    return targets;
  }
  targets.fill = [CARD_PESO, CARD_PESO, CARD_PESO];
  if (beat === 2) {
    targets.who = t >= 3.4 ? WHO_NO : WHO_OK;
    if (t >= 0.4 && t < 2.6) targets.ask = TAP_OK;
    if (t >= 3.4) targets.ask = TAP_NO;
    if (t >= 1.4) targets.fill = [CARD_PESO - SPENT, CARD_PESO, CARD_PESO];
    return targets;
  }
  const held = [CARD_PESO - SPENT, CARD_PESO, CARD_PESO];
  targets.fill = held.map((value, card) => value * (1 - ease((t - 0.2 - card * 0.7) / 1.3))) as Targets["fill"];
  targets.box = RETURNED - targets.fill.reduce((sum, value) => sum + value, 0);
  targets.flow = t >= 0.2 && t < 3.4;
  return targets;
}

export interface Machine {
  wheel: number[]; // unwrapped wheel positions in digits
  wheelTo: number[];
  wheelV: number[]; // wheel speeds in digits per second, so a wheel accelerates into its roll and brakes onto the detent
  price: number; // pesos per litre, eased, drives the ruler's index
  stage: { at: number; rate: number };
  latch: number;
  fill: [number, number, number];
  box: number;
  ask: number;
  want: number; // the tap the reader is being asked for, pesos (0 when none)
  who: string;
  plunger: number;
  plungerV: number;
  sway: { at: number; rate: number }; // the governor weight's lag behind the lever, in rod units
  paid: number; // lamp levels 0..1
  declined: number;
  day: number;
}

export const digitsOf = (price: number) => {
  const cents = Math.round(price * 100);
  return [Math.floor(cents / 1000) % 10, Math.floor(cents / 100) % 10, Math.floor(cents / 10) % 10, cents % 10];
};

export function machineAt(beat: number): Machine {
  const t = targetsAt(beat, 0);
  const digits = digitsOf(DAY_PRICE[t.day]!);
  return {
    wheel: digits.slice(),
    wheelTo: digits.slice(),
    wheelV: digits.map(() => 0),
    price: DAY_PRICE[t.day]!,
    stage: { at: t.stage, rate: 0 },
    latch: t.latch,
    fill: t.fill.slice() as Machine["fill"],
    box: t.box,
    ask: t.ask,
    want: t.ask,
    who: t.who,
    plunger: Math.min(t.ask, CAP),
    plungerV: 0,
    sway: { at: 0, rate: 0 },
    paid: 0,
    declined: 0,
    day: t.day,
  };
}

export const REST: Machine = machineAt(0);

const WHEEL_SECONDS = 0.18; // critically damped: the wheel's time constant
const follow = (current: number, target: number, dt: number, seconds: number) => {
  const next = current + (target - current) * (1 - Math.exp(-dt / seconds));
  return Math.abs(target - next) < 1e-3 ? target : next;
};

function spring(state: { at: number; rate: number }, target: number, dt: number, stiffness: number, damping: number) {
  const steps = Math.max(Math.ceil(dt * 240), 1);
  const slice = dt / steps;
  for (let step = 0; step < steps; step++) {
    state.rate += (target - state.at) * stiffness * slice - state.rate * damping * slice;
    state.at += state.rate * slice;
  }
  if (Math.abs(target - state.at) < 5e-4 && Math.abs(state.rate) < 5e-4) {
    state.at = target;
    state.rate = 0;
  }
}

// Advance the machine toward the targets. `calm` jumps straight there.
export function step(machine: Machine, targets: Targets, dt: number, calm = false) {
  if (targets.day !== machine.day) {
    const digits = digitsOf(DAY_PRICE[targets.day]!);
    machine.wheelTo = machine.wheelTo.map((position, wheel) => position + ((digits[wheel]! - (position % 10) + 10) % 10));
    machine.day = targets.day;
  }
  const now = (value: number, to: number, seconds: number) => (calm ? to : follow(value, to, dt, seconds));
  if (calm) {
    machine.wheel = machine.wheelTo.slice();
    machine.wheelV = machine.wheelV.map(() => 0);
  } else {
    machine.wheel = machine.wheel.map((position, wheel) => {
      const to = machine.wheelTo[wheel]!;
      const w = 1 / WHEEL_SECONDS;
      const steps = Math.max(Math.ceil(dt * 240), 1);
      const slice = dt / steps;
      let x = position;
      let v = machine.wheelV[wheel]!;
      for (let i = 0; i < steps; i++) {
        v += (w * w * (to - x) - 2 * w * v) * slice;
        x += v * slice;
      }
      if (Math.abs(to - x) < 1e-3 && Math.abs(v) < 1e-3) {
        x = to;
        v = 0;
      }
      machine.wheelV[wheel] = v;
      return x;
    });
  }
  machine.price = now(machine.price, DAY_PRICE[targets.day]!, 0.32);
  if (calm) {
    machine.stage.at = targets.stage;
    machine.stage.rate = 0;
  } else spring(machine.stage, targets.stage, dt, 90, 13);
  machine.latch = now(machine.latch, targets.latch, 0.18);
  machine.fill = machine.fill.map((value, card) => now(value, targets.fill[card]!, 0.3)) as Machine["fill"];
  machine.box = now(machine.box, targets.box, 0.3);
  machine.ask = now(machine.ask, targets.ask, 0.3);
  machine.want = targets.ask;
  machine.who = targets.who;
  if (calm) {
    machine.plunger = Math.min(targets.ask, CAP);
    machine.plungerV = 0;
    machine.sway.at = 0;
    machine.sway.rate = 0;
  } else {
    // A spring-loaded slide: it swings a little past the tap it is asked for and settles; the stop at CAP absorbs it dead.
    const steps = Math.max(Math.ceil(dt * 240), 1);
    const slice = dt / steps;
    for (let i = 0; i < steps; i++) {
      machine.plungerV += ((targets.ask - machine.plunger) * 52 - machine.plungerV * 8.5) * slice;
      machine.plunger += machine.plungerV * slice;
      if (machine.plunger >= CAP || machine.plunger <= 0) {
        machine.plunger = clamp(machine.plunger, 0, CAP);
        machine.plungerV = 0;
      }
    }
    spring(machine.sway, -clamp(machine.stage.rate * 0.4, -2, 2), dt, 140, 5.5);
  }
  const pays = targets.who === WHO_OK && machine.plunger >= TAP_OK - 15 && machine.ask >= TAP_OK - 0.5 && targets.ask === TAP_OK;
  const refuses = targets.ask === TAP_NO && machine.plunger >= CAP - 0.5;
  machine.paid = now(machine.paid, pays ? 1 : 0, 0.14);
  machine.declined = now(machine.declined, refuses ? 1 : 0, 0.14);
}

export const angleNow = (machine: Machine) => angleOf(machine.stage.at);
export const gateShare = (machine: Machine) => clamp((angleNow(machine) - NOTCH_DEG[4]!) / (angleOf(5) - NOTCH_DEG[4]!), 0, 1);
export const priceShare = (machine: Machine) => clamp((machine.price - DAY_PRICE[0]!) / (DAY_PRICE[4]! - DAY_PRICE[0]!), 0, 1);
export const askShare = (machine: Machine) => machine.ask / ASK_MAX;
export const plungerShare = (machine: Machine) => machine.plunger / CAP;
export const cordGap = (machine: Machine) => (machine.ask - machine.plunger) * SLIDE_RATE;
export const balanceSum = (machine: Machine) => machine.fill.reduce((sum, value) => sum + value, 0);

// What the wheels read: the nearest detent of each wheel.
export function wheelText(machine: Machine) {
  const digits = machine.wheel.map((position) => ((Math.round(position) % 10) + 10) % 10);
  return `${digits[0]}${digits[1]}.${digits[2]}${digits[3]}`;
}

export const landed = (machine: Machine) => machine.wheel.every((position, wheel) => Math.abs(position - machine.wheelTo[wheel]!) < 0.1);

// Short enough to share the plate's bottom edge with the step name on a phone.
export function readoutOf(machine: Machine, beat: number, copy: Copy) {
  const money = (pesos: number) => copy.money[clamp(Math.round(pesos / 100), 0, copy.money.length - 1)]!;
  if (beat === 0) {
    const price = `₱${copy.price[machine.day]!}/L`;
    if (gateShare(machine) > 0.5) return `${price} · RELEASE`;
    if (!landed(machine)) return `day ${DAY_NO[machine.day]!} · rolling …`;
    return machine.day === 0 ? `${price} · below ₱${copy.mark}` : `${price} · held ${machine.day} of ${HOLD_DAYS}`;
  }
  if (beat === 1) {
    const total = balanceSum(machine);
    return total >= FUNDED - 20 ? `${money(FUNDED)} = ${CARDS} × ${money(CARD_PESO)}` : `${money(total)} of ${money(FUNDED)}`;
  }
  if (beat === 2) {
    if (machine.declined > 0.5) return `${machine.who} · ${money(TAP_NO)} · no tx`;
    if (machine.paid > 0.5) return `${machine.who} · ${money(TAP_OK)} PAID`;
    if (machine.want > 0) return `${machine.who} · ${money(machine.want)} …`;
    return `stop at ${money(CAP)}`;
  }
  return machine.box >= RETURNED - 20 ? `${money(RETURNED)} = ${money(FUNDED)} − ${money(SPENT)}` : `returning ${money(machine.box)}`;
}

