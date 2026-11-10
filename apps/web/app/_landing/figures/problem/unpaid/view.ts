import { iso, translateAlong, type Plan, type Point3 } from "@/app/_landing/iso/iso-kit";
import { boxPoints, fit } from "../shared";
import { BOX_Z, CHUTE_DROP, CHUTE_RUN, EDGE, FLOOR_Z, PUSH_X0, ROWS, startOfCoin } from "./model";

export const WIDTH = 328;
export const HEIGHT = 185;
export const AZIMUTH = 56;
export const ELEVATION = 40;

export const BASE: Plan = { x: -74, y: -10, w: 226, d: 80, r: 6 };
export const BASE_H = 4;
export const FOOT_H = 3;

/** The strongroom: a plinth, an open-fronted steel box on it, a barred gate sliding on rails in front. */
export const PLINTH: Plan = { x: -2, y: -2, w: 74, d: 56, r: 3 };
export const PLINTH_TOP = 22;
export const FLOOR_H = 3;
export const INNER_Z = PLINTH_TOP + FLOOR_H;
export const WALL = 4;
export const WALL_TOP = 65;
export const ROOF_H = 4;
export const BODY = { x: 0, y: 0, w: 70, d: 52 };
/** The outlet in the right wall: coins pass under the bridge of wall above it. */
export const OUTLET_TOP = 40;

export const RAIL: Plan = { x: -58, y: 52, w: 128, d: 8, r: 1 };
export const RAIL_H = 5;
export const BOTTOM_RAIL_Z = PLINTH_TOP;
export const GATE_Z = BOTTOM_RAIL_Z + RAIL_H;
export const GATE_TOP = 62;
export const TOP_RAIL_Z = GATE_TOP;
export const POST: Plan = { x: -64, y: 52, w: 6, d: 8, r: 1 };
export const GATE_X = 4;
export const GATE_W = 62;
export const GATE_Y = 54;
export const GATE_D = 4;
/** How far the gate slides to clear the opening. */
export const GATE_TRAVEL = 61;

/** The lock box on the gate and the 24-month dial in it. */
export const LOCK: Plan = { x: 10, y: GATE_Y + GATE_D, w: 26, d: 6, r: 2 };
export const LOCK_Z = 34;
export const LOCK_H = 22;
export const DIAL: Point3 = [LOCK.x + LOCK.w / 2, LOCK.y + LOCK.d, LOCK_Z + LOCK_H / 2];
export const DIAL_PLATE_R = 11.6;
export const DIAL_RING_R = 10.4;
export const DIAL_FACE_R = 9.4;
export const KNOB_R = 4.2;
export const KNOB_FROM = 2.4;
export const KNOB_TO = 7;

/** Chute from the outlet to the box, and the Treasury box itself. */
export const CHUTE_Y: [number, number] = [8, 44];
export const CHUTE_END = EDGE + CHUTE_RUN;
export const BIN: Plan = { x: 112, y: 8, w: 34, d: 36, r: 1.5 };
export const BIN_WALL = 2;
export const BIN_FLOOR_TOP = BOX_Z - 0.45;
export const BIN_RIM = 14;
export const BIN_FRONT = 15;

export const P = fit(
  [
    ...boxPoints(BASE, -FOOT_H, BASE_H),
    ...boxPoints({ x: -64, y: 0, w: 134, d: 60, r: 0 }, BASE_H, 70),
    ...boxPoints(BIN, BASE_H, 35),
  ] as Point3[],
  WIDTH,
  HEIGHT,
  { azimuth: AZIMUTH, elevation: ELEVATION, pad: [6, 6, 6, 8] },
);

export const here = (point: Point3) => iso(point, P);
/** A rigid move of a built group by a world offset. */
export const shift = (dx: number, dy = 0, dz = 0) => translateAlong(P, [dx, dy, dz]);
export const gateShift = (open: number) => shift(-GATE_TRAVEL * open);
export const plateShift = (x: number) => shift(x - PUSH_X0);

/** Where a coin starts (centre), by row and place in the row. */
export const coinStart = (row: number, k: number): Point3 => [startOfCoin(k), ROWS[row], FLOOR_Z];
export const COIN_GROUND = FLOOR_Z - 0.45;
export const CHUTE_TOP_END = FLOOR_Z - 0.45 - CHUTE_DROP;
