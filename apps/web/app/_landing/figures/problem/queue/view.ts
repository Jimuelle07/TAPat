import { iso, translateAlong, type Plan, type Point3 } from "@/app/_landing/iso/iso-kit";
import { boxPoints, fit } from "../shared";
import { LANE_Y, PEOPLE, POOL_R, POOL_X, SLOT_X } from "./model";

export const WIDTH = 674;
export const HEIGHT = 241;
export const AZIMUTH = 62;
export const ELEVATION = 28;

/** The pavement the queue stands on. */
export const FLOOR: Plan = { x: -24, y: -12, w: 316, d: 88, r: 6 };
export const FLOOR_H = 3;
export const GROUND = FLOOR_H;
export const GROUND_FOOT = GROUND;

/** The payout booth at the head of the queue: a steel box, a window on its front, a counter shelf and a roof. */
export const BOOTH: Plan = { x: 0, y: 0, w: 66, d: 38, r: 2 };
export const PLINTH: Plan = { x: -3, y: -3, w: 72, d: 44, r: 2.5 };
export const PLINTH_H = 3;
export const BOOTH_Z = GROUND + PLINTH_H;
export const BOOTH_H = 42;
export const ROOF_Z = BOOTH_Z + BOOTH_H;
export const ROOF: Plan = { x: -5, y: -5, w: 76, d: 56, r: 3 };
export const ROOF_H = 4;
export const FRONT = BOOTH.y + BOOTH.d;
export const SHELF: Plan = { x: 12, y: FRONT, w: 42, d: 8, r: 1.5 };
export const SHELF_Z = BOOTH_Z + 14;
export const WINDOW = { x0: 17, x1: 49, z0: BOOTH_Z + 19, z1: BOOTH_Z + 35 };

/** The stanchions: two rows either side of the lane, a rope between each pair. */
export const POST_X = Array.from({ length: 6 }, (_, i) => 80 + 36 * i);
export const ROW_Y = [LANE_Y - 11, LANE_Y + 11];
export const POST_H = 20;
export const COLLAR_Z = GROUND + 14;
export const COLLAR_R = 2.2;
export const ROPE_R = 0.55;
export const ROPE_SAG = 1.3;

/** The sun lamp: a mast behind the queue, an arm over the lane, a shade with a bulb. */
export const MAST: Plan = { x: POOL_X - 2.5, y: 28, w: 5, d: 5, r: 1 };
export const MAST_TOP = 80;
export const ARM_Z = MAST_TOP - 5;
export const LAMP_Y = LANE_Y + 2;
export const SHADE_TOP = ARM_Z - 3;
export const SHADE_H = 10;
export const SHADE_R = 13;

export const P = fit(
  [
    ...boxPoints(FLOOR, 0, GROUND),
    ...boxPoints(ROOF, ROOF_Z, ROOF_Z + ROOF_H),
    ...boxPoints({ x: POOL_X - 20, y: MAST.y, w: 40, d: 40, r: 0 }, GROUND, MAST_TOP + 2),
  ] as Point3[],
  WIDTH,
  HEIGHT,
  { azimuth: AZIMUTH, elevation: ELEVATION, pad: [8, 10, 8, 14] },
);

export const here = (point: Point3) => iso(point, P);
export const shift = (dx: number, dy = 0, dz = 0) => translateAlong(P, [dx, dy, dz]);
/** The slot a person starts from, for a person built at the world origin. */
export const SLOTS = Array.from({ length: PEOPLE }, (_, slot) => SLOT_X(slot));
export const POOL: [number, number, number] = [POOL_X, LANE_Y, GROUND];
export const POOL_RADIUS = POOL_R;

/** Heat shimmer: a wavy line rising from the pool, `phase` radians along its wave (it drifts upward as the phase grows). */
export const WISP_RISE = 36;
export const wispAt = (index: number, count: number, phase: number) => {
  const base = here([POOL_X + (index - (count - 1) / 2) * 11, LANE_Y + (index % 2 ? 6 : -6), GROUND + 4]);
  const up = here([POOL_X, LANE_Y, GROUND + 5])[1] - here([POOL_X, LANE_Y, GROUND + 4])[1];
  let d = "";
  for (let step = 0; step <= 12; step++) {
    const s = step / 12;
    const x = base[0] + 2.4 * Math.sin(2 * Math.PI * s * 1.5 - phase - index * 1.7);
    const y = base[1] + up * WISP_RISE * s;
    d += `${step === 0 ? "M" : "L"}${Math.round(x * 10) / 10} ${Math.round(y * 10) / 10}`;
  }
  return d;
};
