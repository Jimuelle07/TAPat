import { smooth } from "../shared";

/** ₱2.7B nearly lost to ghost and duplicate beneficiaries (DSWD, via Daily Tribune). */
export const TOTAL_BILLIONS = 2.7;
export const GRAVITY = 300;

const LEAD = 1.0;
const LEAK = 14;
const EMPTY = 2;
const REFILL = 1.4;
export const LOOP = LEAD + LEAK + EMPTY + REFILL;

/** Where the figure rests for the server render and for reduced motion. */
export const REST_TIME = 6.5;

/** A coin stream: where it leaves, the speed it leaves at, and how far it falls. */
export interface Stream {
  /** Which drawer it lands in (0, 1, 2). */
  drawer: number;
  /** Seconds between coins, and the offset of the first. */
  every: number;
  first: number;
  /** Sideways launch speed (world units per second). */
  vx: number;
  /** Fall from the launch point to the drawer's coins, in world units. */
  drop: number;
  /** Coins in the pool. */
  pool: number;
}

export const STREAMS: Stream[] = [
  { drawer: 1, every: 0.45, first: 0, vx: 0, drop: 17.4, pool: 2 },
  { drawer: 2, every: 0.66, first: 0.31, vx: 71, drop: 25, pool: 2 },
  { drawer: 0, every: 0.8, first: 0.55, vx: -71, drop: 25, pool: 2 },
];

/** Seconds a coin of a stream takes to land. */
export const fallTime = (stream: Stream) => Math.sqrt((2 * stream.drop) / GRAVITY);

/** After landing a coin hops once on the drawer's coins before it settles into the heap. */
export const HOP = 0.42;
export const HOP_HEIGHT = 3.4;

export interface Flight {
  stream: number;
  slot: number;
  /** Seconds since it left. */
  age: number;
}

export interface State {
  /** How far the illustrated hopper has drained (0 full, 1 empty). */
  leaked: number;
  flights: Flight[];
  /** Whether the leak is running (so coins are being shed). */
  leaking: boolean;
}

/** How much has leaked at `t`: a calm linear drain, then a quick refill. */
export function leakedAt(time: number) {
  const t = ((time % LOOP) + LOOP) % LOOP;
  if (t < LEAD) return 0;
  if (t < LEAD + LEAK) return (t - LEAD) / LEAK;
  if (t < LEAD + LEAK + EMPTY) return 1;
  return 1 - smooth((t - LEAD - LEAK - EMPTY) / REFILL);
}

export function stateAt(time: number): State {
  const t = ((time % LOOP) + LOOP) % LOOP;
  const flights: Flight[] = [];
  const spill = t >= LEAD && t < LEAD + LEAK;
  STREAMS.forEach((stream, index) => {
    const span = fallTime(stream) + HOP;
    for (let j = Math.floor((t - LEAD - stream.first - span) / stream.every); j <= Math.floor((t - LEAD - stream.first) / stream.every); j++) {
      if (j < 0) continue;
      const left = LEAD + stream.first + j * stream.every;
      const age = t - left;
      if (age < 0 || age >= span || left > LEAD + LEAK - span) continue;
      flights.push({ stream: index, slot: j % stream.pool, age });
    }
  });
  return { leaked: leakedAt(t), flights, leaking: spill };
}

/** Only the cited figure plus a progress word: the pace and how much leaked are an illustration, not data. */
export const readoutOf = (leaked: number) => `₱${TOTAL_BILLIONS}B · nearly lost · ${leaked >= 1 ? "drained to ghost drawers" : "draining"}`;
