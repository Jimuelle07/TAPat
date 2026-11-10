import { boxCorners, fitProjection, iso, type Flat, type Plan, type Point3 } from "../../iso/iso-kit";

/**
 * World layout of the strip-chart recorder (units are about 1 px of the real thing, z up, +y toward the viewer).
 *
 * The long axis is x. Paper travels toward -x: it comes off the supply roll on the right, runs under the pen
 * on the platen and winds onto the take-up reel on the left. Price is the pen's y (up = toward the back),
 * time is the paper's x.
 */
export const WIDTH = 1000;
export const HEIGHT = 470;
export const AZIMUTH = 66;
export const ELEVATION = 38;

export const BASE: Plan = { x: -312, y: -114, w: 632, d: 244, r: 10 };
export const BASE_T = 12;

/** Platen bed and paper. */
export const FLANGE: Plan = { x: -203, y: -65, w: 268, d: 130, r: 5 };
export const BED: Plan = { x: -200, y: -62, w: 262, d: 124, r: 4 };
export const BED_Z = 3;
export const PAPER_Z = 16;
export const PAPER_T = 0.6;
export const PAPER_TOP = PAPER_Z + PAPER_T;
export const PAPER_X0 = -200;
export const PAPER_X1 = 62;
export const PAPER_HALF = 47;
export const PAPER: Plan = { x: PAPER_X0, y: -PAPER_HALF, w: PAPER_X1 - PAPER_X0, d: PAPER_HALF * 2, r: 1.2 };

/** Chart scale: ₱65.00 sits on the centre line, 3.4 world units per peso, up (toward the back) is dearer. */
export const PX_PER_PHP = 3.4;
export const WIRE_PHP = 65;
export const PEN_Y_MAX = 44;
export const yOfPrice = (php: number) => Math.max(-PEN_Y_MAX, Math.min(PEN_Y_MAX, (WIRE_PHP - php) * PX_PER_PHP));

/** The pen writes at PEN_X; the paper carries each day DAY_UNITS further toward -x. */
export const PEN_X = 40;
export const DAY_UNITS = 10.5;
export const WIRE_Z = PAPER_TOP + 2.6;

/** Gantry that carries the pen carriage. */
export const GANTRY_X = 20;
export const GANTRY_W = 10;
export const GANTRY_Z = 38;
export const GANTRY_H = 8;

/** Supply roll (right, cantilevered from a back upright) and take-up reel (left). */
export const SUPPLY = { x: 114, z: 40, r: 19 } as const;
export const REEL = { x: -236, z: 29.2, r: 12.5 } as const;
export const ROLL_LEN = 94;
export const ROLL_Y0 = -47;

/** Ratchet unit (front right): the counting wheel, and the pawl that holds it. */
export const WHEEL = { x: 160, y: 94, z: 6, h: 3.6 } as const;
export const DECK: Plan = { x: 118, y: 52, w: 78, d: 70, r: 3 };
export const TEETH = 12;
export const ROOT_R = 17.6;
export const TIP_R = 22.4;
export const PAWL = { pivot: [141.5, 63.1] as const, length: 19.9 };

/** Chute: three lanes on one slope. s runs down the slope from the head, v is up the slope's normal. */
export const SLOPE_DEG = 15;
export const HEAD = [186, 40] as const;
export const LANES = [-38, 0, 38] as const;
export const LANE_W = 38;
export const BAR_S = 24.5;
export const TOKEN_R = 10.5;
export const TOKEN_T = 3.6;
export const TOKEN_S0 = 12.5;
export const TOKEN_S1 = 94.5;
export const BAR_LIFT = 7;
/** The stop bar reaches past the outer lanes to the solenoid in front. */
export const BAR_END = 1.5 * LANE_W + 20;

const fitPoints: Point3[] = [
  ...boxCorners(BASE, -17, 0),
  [-248, -50, 44],
  [114, -50, 62],
  [114, 50, 62],
  [34, 0, 50],
  [200, -BAR_END, 46],
  [286, 60, 18],
  [286, -60, 18],
  [-300, 100, 12],
];

export const P = fitProjection(fitPoints, WIDTH, HEIGHT, { pad: 16, azimuth: AZIMUTH, elevation: ELEVATION });

export const at = (point: Point3): Flat => iso(point, P);
