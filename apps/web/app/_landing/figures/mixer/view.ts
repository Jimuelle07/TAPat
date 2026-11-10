import { boxCorners, fitProjection, iso, type Flat, type Plan, type Point3, type Projection } from "../../iso/iso-kit";

export const WIDTH = 800;
export const HEIGHT = 450;
const PAD = 26;
export const AZIMUTH = 64;

/** The bench. Everything stands on z = 0. */
export const BASE: Plan = { x: -240, y: -98, w: 464, d: 170, r: 10 };
export const BASE_H = 9;
export const FOOT_H = 5;

/** The chassis plate the mechanism hangs in front of. */
export const WALL: Plan = { x: -232, y: -92, w: 440, d: 12, r: 2 };
export const WALL_FACE = WALL.y + WALL.d; // -80
export const WALL_H = 172;

/** Depth planes of the mechanism (y ranges), back to front. */
export const LEVER_Y: [number, number] = [-76, -68];
export const RACK_Y: [number, number] = [-61.4, -55]; // rack and 14-tooth pinion
export const MESH_Y: [number, number] = [-66, -61.4]; // 28T and 25T gears
export const CARRIAGE_Y: [number, number] = [-62, -54]; // carriage, tower, weights post
export const BEAM_Y: [number, number] = [-55, -48]; // balance arm

export const LEFT_EDGE = BASE.x;
export const RIGHT_EDGE = BASE.x + BASE.w;

function fit(): Projection {
  const points: Point3[] = [
    ...boxCorners(BASE, -BASE_H - FOOT_H, 0),
    ...boxCorners({ x: WALL.x, y: WALL.y, w: WALL.w, d: WALL.d, r: 0 }, 0, WALL_H + 8),
  ];
  return fitProjection(points, WIDTH, HEIGHT, { pad: PAD, azimuth: AZIMUTH });
}

export const P = fit();

export const at = (point: Point3): Flat => iso(point, P);

const ORIGIN = at([0, 0, 0]);
const minus = (a: Flat, b: Flat): Flat => [a[0] - b[0], a[1] - b[1]];
export const EX = minus(at([1, 0, 0]), ORIGIN);
export const EY = minus(at([0, 1, 0]), ORIGIN);
export const EZ = minus(at([0, 0, 1]), ORIGIN);

const fine = (value: number) => Math.round(value * 100) / 100;

/** A screen translate for a move of dx, dy, dz in the world. */
export const shift = (dx: number, dz = 0, dy = 0) =>
  `translate(${fine(EX[0] * dx + EY[0] * dy + EZ[0] * dz)} ${fine(EX[1] * dx + EY[1] * dy + EZ[1] * dz)})`;
