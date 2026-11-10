import { boxCorners, fitProjection, iso, translateAlong, type Flat, type Plan, type Point3 } from "@/app/_landing/iso/iso-kit";

/* The assembly bench: world units are about 1 px of the real thing, x runs down the conveyor, y is depth
   (negative is the back, away from the viewer), z is up. Eight stations stand 62 apart on the bench. */

export const WIDTH = 1100;
export const HEIGHT = 440;
export const AZIMUTH = 72;
export const ELEVATION = 36;

export const PITCH = 62;
export const STATION = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => n * PITCH);

export const BASE: Plan = { x: -8, y: -76, w: 616, d: 148, r: 9 };
export const BASE_H = 10;
export const FOOT_H = 6;

/* The conveyor. Its belt top is the floor the ₱ chips ride on. */
export const BELT_Z = 7.2;
export const BELT_X0 = 6;
export const BELT_X1 = 526;
export const LANE = 9.4;
export const RAIL_IN = 11.2;
export const RAIL_OUT = 14;
export const RAIL_H = 9;

/* The chips: three ₱500 chips make the ₱1,500 tranche. */
export const CHIP_R = 9;
export const CHIP_H = 3.2;
export const CHIP_Z = [BELT_Z, BELT_Z + CHIP_H, BELT_Z + CHIP_H * 2];
export const STACK_TOP = BELT_Z + CHIP_H * 3;

/* The vault pit and its drawer. */
export const PIT_HALF = 19;

export const P = fitProjection(
  [
    ...boxCorners(BASE, -BASE_H - FOOT_H, 0),
    [STATION[5] - 1, -46, 70],
    [STATION[0], -47, 58],
    [BASE.x + BASE.w - 10, -30, 56],
  ] as Point3[],
  WIDTH,
  HEIGHT,
  { pad: 18, azimuth: AZIMUTH, elevation: ELEVATION },
);

export const at = (point: Point3): Flat => iso(point, P);
export const move = (dx: number, dy = 0, dz = 0) => translateAlong(P, [dx, dy, dz]);
