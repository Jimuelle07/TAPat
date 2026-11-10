import { boxCorners, fitProjection, iso, type Flat, type Plan, type Point3 } from "../../iso/iso-kit";

/**
 * World layout of the Tranche relay (units about 1 mm of the real bench, z up, +y toward the viewer).
 *
 * Left: the price tower, a post with a cursor that climbs a ₱ scale, and the day clock. Middle: the changepoint
 * probability rail (carriage on a ruler with the 0.9 stop) and the held-days counter (four plungers). Right: three
 * condition keys, the gate bar they open, and three lanes that carry a ₱1,500 token each into a card.
 * Client and build both read these numbers; nothing here builds geometry beyond the camera.
 */
export const WIDTH = 640;
export const HEIGHT = 350;
export const AZIMUTH = 58;
export const ELEVATION = 30;

export const BASE: Plan = { x: -262, y: -108, w: 524, d: 216, r: 10 };
export const BASE_Z = -12;
export const BASE_H = 12;

/** Price tower: a frame of two guides and a bridge around the scale plate; a cursor bar slides up the plate. ₱56 is at the bottom of the scale, 7.5 world units per peso. */
export const SCALE_PHP0 = 56;
export const SCALE_PHP1 = 72;
export const PX_PER_PHP = 7.5;
export const SCALE_Z0 = 24;
export const zOfPrice = (php: number) => SCALE_Z0 + (php - SCALE_PHP0) * PX_PER_PHP;
export const MARK_PHP = 65;
/** What the still frame and the audit's rest pose show: the price and the changepoint probability of day 24. */
export const REST_PHP = 60.4;
export const REST_PROB = 0.64;
export const SCALE_PLATE: Plan = { x: -200, y: -24, w: 36, d: 5, r: 0.6 };
export const TOWER_TOP = 160;
export const CURSOR_H = 5;
export const CURSOR_D = 4;

/** Probability rail: 0 at RAIL_X0, 1 at RAIL_X1; the trip stop sits at 0.9. */
export const RAIL_X0 = -150;
export const RAIL_X1 = -30;
export const RAIL_Y = 62;
export const TRIP_P = 0.9;
export const xOfProb = (p: number) => RAIL_X0 + (RAIL_X1 - RAIL_X0) * p;
export const CARRIAGE_W = 20;
export const CARRIAGE_D = 22;
export const CARRIAGE_Z = 7;

/** Plungers rebuilt each frame: a collar in the block, a plunger that rises out of it. Held-days counter (four) and condition keys (three). */
export const PLUNGER_MIN = 0.8;
export const HOLD_DAYS = 4;
export const PEG_X = [-132, -104, -76, -48] as const;
export const PEG_Y = -62;
export const PEG_Z = 7.8;
export const PEG_R = 4.4;
export const PEG_MAX = 22;

/** Day clock: one needle turn is 18 days, 20 degrees a day. */
export const CLOCK = { x: -96, y: 2, r: 32 } as const;
export const CLOCK_TOP = 9;
export const DEG_PER_DAY = 20;

/** Condition keys (probability, held days, level): plungers on one bus plate, each rises when its test is met. */
export const KEY_X = 28;
export const KEY_Y = [-60, 0, 60] as const;
export const KEY_Z = 6;
export const KEY_R = 5.6;
export const KEY_MAX = 24;

/** Gate bar across the three lanes, the tokens it holds back and the cards they end on. */
export const GATE_X = 98;
export const GATE_LIFT = 14;
export const GATE_Z = 8;
export const GATE_H = 14;
export const LANE_Y = [-60, 0, 60] as const;
export const LANE_W = 38;
export const LANE_Z = 2.4;
export const TOKEN_X0 = 83;
export const TOKEN_X1 = 204;
export const TOKEN_R = 9;
export const TOKEN_H = 3.6;
export const CARD_X0 = 162;
export const CARD_W = 80;
export const CARD_D = 32;

const fitPoints: Point3[] = [
  ...boxCorners(BASE, -17, 0),
  [-206, -24, TOWER_TOP + 6],
  [-152, -14, TOWER_TOP + 6],
  [250, -90, 24],
  [250, 90, 24],
  [GATE_X, 90, GATE_LIFT + 30],
  [GATE_X, -90, GATE_LIFT + 30],
];

export const P = fitProjection(fitPoints, WIDTH, HEIGHT, { pad: 22, azimuth: AZIMUTH, elevation: ELEVATION });

export const at = (point: Point3): Flat => iso(point, P);
