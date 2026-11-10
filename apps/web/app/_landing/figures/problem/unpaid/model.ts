import { smooth } from "../shared";

/** ₱709.88M in DOTr subsidies left unpaid or expired, returned after two years (COA, via Astig.ph and NET25). */
export const AMOUNT = "₱709.88M";
export const MONTHS = 24;

/* ---- the coins: two rows of six on the safe's floor, pushed out through the outlet, down the chute, into the box */
export const ROWS = [14, 38];
export const PER_ROW = 5;
export const COIN_COUNT = ROWS.length * PER_ROW;
export const COIN_X0 = 40;
export const COIN_PITCH = 6.6;
export const COIN_R = 2.8;
export const COIN_H = 0.9;
export const PUSH_X0 = 6;
export const PUSH_X1 = 67;
/** Where a coin's centre crosses from the floor to the chute, and the chute's run and fall. */
export const EDGE = 70;
export const CHUTE_RUN = 43;
export const CHUTE_DROP = 7;
export const LAND_DX = 14;
/** The box floor, and the height a coin's centre rests at on it, in the same units as the view's floor. */
export const FLOOR_Z = 25.45;
export const BOX_Z = 7.45;
const PLATE_HALF = 1.5;
const CONTACT = PLATE_HALF + COIN_R;
const SLIDE_V0 = 16;
const SLIDE_A = 36;
const GRAVITY = 300;

/* ---- the tour: the dial turns 24 months, the gate opens, the pusher clears the floor, everything closes again */
const LEAD = 0.9;
const TURN = 8.4;
const WAIT = 0.6;
const OPEN = 1.3;
const PUSH_AT = LEAD + TURN + WAIT + OPEN + 0.3;
const PUSH = 3.4;
const SETTLE = 3.4;
const CLOSE = 1.6;
const RETURN_AT = PUSH_AT + PUSH + SETTLE;
export const LOOP = RETURN_AT + CLOSE;
/** Where the figure rests for the server render and for reduced motion: month 17 of 24. */
export const REST_TIME = LEAD + (TURN * 17.02) / MONTHS;

const pushOf = (t: number) =>
  t < RETURN_AT ? PUSH_X0 + (PUSH_X1 - PUSH_X0) * smooth((t - PUSH_AT) / PUSH) : PUSH_X1 - (PUSH_X1 - PUSH_X0) * smooth((t - RETURN_AT) / (CLOSE * 0.8));

/** Each coin's x while it is still on the floor: coin 0 is nearest the plate and each coin pushes the next. */
function floorX(t: number, k: number) {
  let behind = pushOf(t) + CONTACT;
  let x = 0;
  for (let i = 0; i <= k; i++) {
    x = Math.max(COIN_X0 + COIN_PITCH * i, behind);
    behind = x + COIN_R * 2 + 0.4;
  }
  return x;
}

/** When each coin of a row crosses the edge, found by stepping the pusher (it only moves forward). */
const LEAVES: number[] = (() => {
  const times = Array.from({ length: PER_ROW }, () => Infinity);
  for (let t = PUSH_AT; t < PUSH_AT + PUSH + 0.5; t += 1 / 240) {
    for (let k = 0; k < PER_ROW; k++) if (times[k] === Infinity && floorX(t, k) >= EDGE) times[k] = t;
  }
  return times;
})();

const SLIDE_LENGTH = Math.hypot(CHUTE_RUN, CHUTE_DROP);
const SLIDE_T = (-SLIDE_V0 + Math.sqrt(SLIDE_V0 ** 2 + 2 * SLIDE_A * SLIDE_LENGTH)) / SLIDE_A;
/** The coin that crossed the edge first sits at the bottom of its stack: `rank` counts the coins that left before it. */
const rankOf = (k: number) => PER_ROW - 1 - k;
const restZ = (k: number) => BOX_Z + COIN_H * rankOf(k);
const fallOf = (k: number) => Math.sqrt((2 * (FLOOR_Z - CHUTE_DROP - restZ(k))) / GRAVITY);
export const startOfCoin = (k: number) => COIN_X0 + COIN_PITCH * k;

export type Place = "floor" | "chute" | "air" | "box";

export interface CoinState {
  place: Place;
  /** World offset from where the coin started, [dx, dy, dz]. */
  offset: [number, number, number];
  alpha: number;
}

export interface State {
  /** Month the dial reads, 0 to 24, fractional while it turns. */
  months: number;
  /** 0 shut, 1 fully open: how far the gate has slid. */
  gate: number;
  /** The pusher plate's x, in world units. */
  plate: number;
  coins: CoinState[];
  /** How many coins have landed in the Treasury box. */
  landed: number;
  phase: "idle" | "opening" | "returning" | "returned" | "closing";
}

/** One month's ratchet click: the dial rests for most of the month, then snaps to the next notch with a slight overshoot. */
const click = (frac: number) => {
  const u = Math.min(1, Math.max(0, (frac - 0.62) / 0.38));
  return smooth(u) + 0.14 * Math.sin(Math.PI * u) * (1 - u);
};

const monthsOf = (t: number) => {
  if (t < LEAD) return 0;
  if (t < LEAD + TURN) {
    const raw = (MONTHS * (t - LEAD)) / TURN;
    const whole = Math.floor(raw);
    return whole + click(raw - whole);
  }
  if (t < RETURN_AT) return MONTHS;
  return MONTHS * (1 - smooth((t - RETURN_AT) / (CLOSE * 0.8)));
};

const gateOf = (t: number) => {
  const open = LEAD + TURN + WAIT;
  if (t < open) return 0;
  if (t < RETURN_AT) return smooth((t - open) / OPEN);
  return 1 - smooth((t - RETURN_AT) / CLOSE);
};

function coinAt(t: number, index: number): CoinState {
  const k = index % PER_ROW;
  const leave = LEAVES[k];
  const fall = fallOf(k);
  const land = leave + SLIDE_T + fall;
  const final: [number, number, number] = [EDGE + CHUTE_RUN + LAND_DX - startOfCoin(k), 0, restZ(k) - FLOOR_Z];
  const hopS = (t - land) / 0.38;
  const hop: [number, number, number] = hopS > 0 && hopS < 1 ? [final[0], 0, final[2] + 1.7 * 4 * hopS * (1 - hopS) * (1 - hopS * 0.5)] : final;
  if (t >= RETURN_AT) {
    // the box empties and the floor refills, crossing over while no coin is moving
    const r = smooth((t - RETURN_AT) / (CLOSE * 0.9));
    return r < 0.5 ? { place: "box", offset: final, alpha: 1 - 2 * r } : { place: "floor", offset: [0, 0, 0], alpha: 2 * r - 1 };
  }
  if (t < PUSH_AT) return { place: "floor", offset: [0, 0, 0], alpha: 1 };
  if (t < leave) return { place: "floor", offset: [floorX(t, k) - startOfCoin(k), 0, 0], alpha: 1 };
  if (t >= land) return { place: "box", offset: hop, alpha: 1 };
  const age = t - leave;
  if (age < SLIDE_T) {
    const u = (SLIDE_V0 * age + (SLIDE_A * age * age) / 2) / SLIDE_LENGTH;
    return { place: "chute", offset: [EDGE - startOfCoin(k) + CHUTE_RUN * u, 0, -CHUTE_DROP * u], alpha: 1 };
  }
  const f = age - SLIDE_T;
  return {
    place: "air",
    offset: [EDGE - startOfCoin(k) + CHUTE_RUN + (LAND_DX * f) / fall, 0, -CHUTE_DROP - 0.5 * GRAVITY * f * f],
    alpha: 1,
  };
}

export function stateAt(time: number): State {
  const t = ((time % LOOP) + LOOP) % LOOP;
  const coins = Array.from({ length: COIN_COUNT }, (_, index) => coinAt(t, index));
  const landed = coins.filter((coin) => coin.place === "box").length;
  const phase = t >= RETURN_AT ? "closing" : t < LEAD + TURN + WAIT ? "idle" : t < PUSH_AT + 0.2 ? "opening" : landed === COIN_COUNT ? "returned" : "returning";
  return { months: monthsOf(t), gate: gateOf(t), plate: pushOf(t), coins, landed, phase };
}

export function readoutOf(state: State) {
  const month = Math.min(MONTHS, Math.floor(state.months + 1e-6));
  if (state.phase === "idle") return `month ${month} of ${MONTHS} · ${AMOUNT} idle`;
  if (state.phase === "opening") return `month ${MONTHS} · gate opening`;
  if (state.phase === "returning") return `returning · ${AMOUNT} to the Treasury`;
  if (state.phase === "returned") return `returned · ${AMOUNT} in the Treasury`;
  return `closing · month ${month} of ${MONTHS}`;
}
