import { smooth } from "../shared";

/** Payouts kept in person; drivers fainted in heat-exposed queues (build plan). The queue and the lamp are an illustration. */
export const PEOPLE = 8;
export const SLOT_X = (slot: number) => 32 + 28 * slot;
export const LANE_Y = 54;
/** The sun lamp's pool on the pavement. */
export const POOL_X = 190;
export const POOL_R = 34;

const PERIOD = 3.4;
/** A step: the front person leaves, the rest move up one place, the person who left rejoins at the back. */
const EXIT_AT = 0;
const EXIT_T = 0.4;
const MOVE_AT = 0.12;
const MOVE_T = 0.42;
const REJOIN_AT = 0.66;
const REJOIN_T = 0.3;
const EXIT_DISTANCE = 16;
/** A walker bobs twice per place: the lift of each footfall, and its shape over the walk's progress `s` (0 to 1). */
const HOP = 1.1;
const bob = (s: number) => (s <= 0 || s >= 1 ? 0 : HOP * Math.abs(Math.sin(2 * Math.PI * s)));
/** At rest every person stands in a slot: the end of a step. */
export const REST_TIME = PERIOD * 3 + PERIOD * 0.98;

export interface Person {
  x: number;
  y: number;
  z: number;
  alpha: number;
  /** 0 in the shade, 1 under the lamp's pool: how hot this person is. */
  heat: number;
}

export interface State {
  people: Person[];
  /** How many are standing in the pool of light. */
  inSun: number;
  /** Persons served so far (steps taken). */
  served: number;
}

/** How hot a person at `x` is: full inside 10 units of the lamp, none beyond the pool's edge. */
export const heatAt = (x: number) => 1 - smooth((Math.abs(x - POOL_X) - 10) / (POOL_R - 10));

export function stateAt(time: number): State {
  const step = Math.floor(time / PERIOD);
  const u = (time - step * PERIOD) / PERIOD;
  const people: Person[] = [];
  for (let id = 0; id < PEOPLE; id++) {
    const start = (((id - step) % PEOPLE) + PEOPLE) % PEOPLE;
    if (start === 0) {
      const away = smooth((u - EXIT_AT) / EXIT_T);
      if (u < REJOIN_AT) {
        people.push({ x: SLOT_X(0), y: LANE_Y + EXIT_DISTANCE * away, z: bob((u - EXIT_AT) / EXIT_T), alpha: 1 - smooth((u - 0.1) / 0.35), heat: 0 });
      } else {
        const x = SLOT_X(PEOPLE - 1);
        people.push({ x, y: LANE_Y, z: 0, alpha: smooth((u - REJOIN_AT) / REJOIN_T), heat: heatAt(x) });
      }
      continue;
    }
    const t = smooth((u - MOVE_AT) / MOVE_T);
    const x = SLOT_X(start) + (SLOT_X(start - 1) - SLOT_X(start)) * t;
    people.push({ x, y: LANE_Y, z: bob((u - MOVE_AT) / MOVE_T), alpha: 1, heat: heatAt(x) });
  }
  return { people, inSun: people.filter((person) => person.heat > 0.5 && person.alpha > 0.5).length, served: step };
}

export const readoutOf = (state: State) => `in person · ${state.inSun > 0 ? "a driver faints" : "queue in the sun"}`;
