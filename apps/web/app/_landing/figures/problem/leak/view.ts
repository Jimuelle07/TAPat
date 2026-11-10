import { iso, translateAlong, type Plan, type Point3 } from "@/app/_landing/iso/iso-kit";
import { boxPoints, fit } from "../shared";
import { GRAVITY, HOP, HOP_HEIGHT, STREAMS, fallTime, type Stream } from "./model";

export const WIDTH = 328;
export const HEIGHT = 185;
export const AZIMUTH = 34;
export const ELEVATION = 33;

export const BASE: Plan = { x: -74, y: -26, w: 148, d: 90, r: 6 };
export const BASE_H = 4;
export const FOOT_H = 3;

/** The three-bay rack the drawers slide in (back of the base) and the drawers themselves. */
export const BAY_W = 32;
export const WALL = 4;
export const DIVIDER = 3;
export const RACK: Plan = { x: -55, y: -10, w: WALL * 2 + BAY_W * 3 + DIVIDER * 2, d: 40, r: 2 };
export const RACK_FLOOR = BASE_H;
export const RACK_BOTTOM_H = 3;
export const DRAWER_Z = RACK_FLOOR + RACK_BOTTOM_H;
export const RACK_H = 15;
export const BAY_X = [0, 1, 2].map((i) => RACK.x + WALL + i * (BAY_W + DIVIDER));
export const BAY_CENTRE = BAY_X.map((x) => x + BAY_W / 2);
export const DRAWER_D = 36;
export const DRAWER_W = 30;
export const PULL = [16, 24, 14];
export const FLOOR_H = 1.5;
export const WALL_H = 6;
export const FRONT_H = 10;
export const FRONT_D = 3;
export const BACK_Y = -7;

/** The hopper hangs from a gantry behind it: two legs, a crossbar and two arms resting on the bin's lugs. */
export const CENTRE: [number, number] = [0, 34];
export const LEG_X = 58;
export const LEG_Y = 12;
export const LEG = 6;
export const SKID_Y: [number, number] = [-8, 40];
export const GANTRY_Z = 57;
export const GANTRY_H = 8;
export const GANTRY: Plan = { x: -LEG_X - 5, y: LEG_Y - 4, w: LEG_X * 2 + 10, d: 8, r: 1.5 };

/** The hopper: a funnel below, a bin above its shoulder. */
export const SPOUT_Z = 26;
export const SPOUT_R = 3.4;
export const SPOUT_LEN = 5;
export const CONE_R = 8;
export const SHOULDER_Z = 46;
export const CONE_LEN = SHOULDER_Z - SPOUT_Z - SPOUT_LEN;
export const SHOULDER_R = 13;
export const SHOULDER_H = 2;
export const BODY_Z = SHOULDER_Z + SHOULDER_H;
export const BODY_H = 20;
export const BODY_R = SHOULDER_R - 0.8;
export const BODY_TOP = BODY_Z + BODY_H;
export const RIM_H = 2.5;
export const RIM_TOP = BODY_TOP + RIM_H;
export const LUG_Z = BODY_Z + 7;
export const LUG_H = 4;
export const ARM_Z = LUG_Z + LUG_H;

/** Level gauge: a panel on the hopper's face, a window in it, a scale beside it. */
export const GAUGE: Plan = { x: -5.5, y: CENTRE[1] + SHOULDER_R + 4, w: 11, d: 3, r: 1 };
export const GAUGE_Z = BODY_Z + 2;
export const GAUGE_H = 16;
export const GAUGE_FACE = GAUGE.y + GAUGE.d;
export const WINDOW = { x0: -3.6, x1: 0.2, z0: GAUGE_Z + 2, z1: GAUGE_Z + GAUGE_H - 2 };

/** The top of a drawer's coins: where a falling coin lands. */
export const LAND_Z = DRAWER_Z + FLOOR_H + 0.5;

export const P = fit(
  [
    ...boxPoints(BASE, -FOOT_H, BASE_H),
    ...boxPoints({ x: -LEG_X - 5, y: LEG_Y - 4, w: LEG_X * 2 + 10, d: 60, r: 0 }, BASE_H, RIM_TOP + 2),
  ] as Point3[],
  WIDTH,
  HEIGHT,
  { azimuth: AZIMUTH, elevation: ELEVATION, pad: [6, 6, 6, 8] },
);

/** Cone surface: radius at height z, and a point on it at an angle (radians from +x). */
export const coneRadius = (z: number) => (z <= SPOUT_Z + SPOUT_LEN ? SPOUT_R : SPOUT_R + ((z - SPOUT_Z - SPOUT_LEN) * (CONE_R - SPOUT_R)) / CONE_LEN);
export const conePoint = (z: number, angle: number, out = 0): Point3 => [
  CENTRE[0] + (coneRadius(z) + out) * Math.cos(angle),
  CENTRE[1] + (coneRadius(z) + out) * Math.sin(angle),
  z,
];

const rad = (degrees: number) => (degrees * Math.PI) / 180;
/** The direction towards the viewer, where the cracks face (a third either side of it). */
export const CRACK_AT = [rad(AZIMUTH - 32), rad(AZIMUTH + 32)];
export const CRACK_Z = SPOUT_Z + 8;

/** Where each stream's coins leave the hopper: the spout, then the two cracks. */
export const LAUNCH: Point3[] = [[CENTRE[0], CENTRE[1], SPOUT_Z + 0.4], conePoint(CRACK_Z, CRACK_AT[0], 1.6), conePoint(CRACK_Z, CRACK_AT[1], 1.6)];

/** A coin's offset (world) after `age` seconds: a sideways launch, gravity, then one small hop on the heap. */
export const offsetOf = (stream: Stream, age: number): Point3 => {
  const fall = fallTime(stream);
  if (age <= fall) return [stream.vx * age, 0, -0.5 * GRAVITY * age * age];
  const s = Math.min(1, (age - fall) / HOP);
  return [stream.vx * (fall + 0.18 * (age - fall)), 0, -stream.drop + HOP_HEIGHT * 4 * s * (1 - s)];
};
export const flightShift = (stream: number, age: number) => translateAlong(P, offsetOf(STREAMS[stream], age));
/** A drawer rocking on its runners when a coin lands: `slide` world units along the pull direction. */
export const drawerShift = (slide: number) => translateAlong(P, [0, slide, 0]);
export const here = (point: Point3) => iso(point, P);
