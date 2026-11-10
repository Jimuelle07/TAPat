import { iso, slabOf, type Flat, type SolidPaths } from "../../iso/iso-kit";
import { prismOf, viewOf } from "../../iso/lathe.mjs";
import { latchPoly, leverPoly, pointAt, XZ_FRAME, Y_LATCH, Y_LEVER } from "./kin";
import { CARD_X, LIQ_BOX_H, LIQ_BOX_X, LIQ_BOX_Y, LIQ_BOX_Z0, LIQ_H, LIQ_MIN, LIQ_Y, LIQ_Z0, P, WHEEL_R, WHEEL_W, WHEEL_X, WHEEL_Y, WHEEL_Z } from "./view";

// Everything the live component recomputes per frame: screen offsets for moving parts, rebuilt solids and the glyphs on the wheels.
const V = viewOf(P);
const tenth = (value: number) => Math.round(value * 10) / 10;
const fine = (value: number) => Math.round(value * 100) / 100;

export const shiftOf = (vx: number, vy: number, vz: number): Flat => {
  const a = iso([0, 0, 0], P);
  const b = iso([vx, vy, vz], P);
  return [b[0] - a[0], b[1] - a[1]];
};

export const translate = ([dx, dy]: Flat) => (dx === 0 && dy === 0 ? "" : `translate(${fine(dx)} ${fine(dy)})`);

// A riding part's offset when the lever is at `deg`, measured from where it was drawn (at `from` degrees).
export function arcShift(from: number, deg: number, u: number): Flat {
  const [x0, z0] = pointAt(from, u);
  const [x1, z1] = pointAt(deg, u);
  return shiftOf(x1 - x0, 0, z1 - z0);
}

export const leverPaths = (deg: number): SolidPaths => prismOf(XZ_FRAME, leverPoly(deg), Y_LEVER[0], Y_LEVER[1], P);
export const latchPaths = (deg: number): SolidPaths => prismOf(XZ_FRAME, latchPoly(deg), Y_LATCH[0], Y_LATCH[1], P);

export function cardLiquid(card: number, pesos: number, full: number, ripple = 0): SolidPaths {
  const h = Math.max(LIQ_MIN, (LIQ_H * pesos) / full + (pesos > 1 ? ripple : 0));
  return slabOf({ x: CARD_X[card]! + 2, y: LIQ_Y[0], w: 14, d: LIQ_Y[1] - LIQ_Y[0], r: 0 }, LIQ_Z0, h, P, 1, 0);
}

export function boxLiquid(pesos: number, full: number, ripple = 0): SolidPaths {
  const h = Math.max(LIQ_MIN, (LIQ_BOX_H * pesos) / full + (pesos > 1 ? ripple : 0));
  return slabOf({ x: LIQ_BOX_X[0], y: LIQ_BOX_Y[0], w: LIQ_BOX_X[1] - LIQ_BOX_X[0], d: LIQ_BOX_Y[1] - LIQ_BOX_Y[0], r: 0 }, LIQ_BOX_Z0, h, P, 1, 0);
}

const smooth = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

export interface Glyph {
  transform: string;
  opacity: number;
}

export const GLYPH_SIZE = 8;

// A digit printed on the wheel's surface: `position` is the wheel's angle in digits (position k shows digit k at the front).
export function glyphOf(wheel: number, digit: number, position: number): Glyph {
  const theta = ((position - digit) * Math.PI) / 5;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const facing = c * V[1] + s * V[2];
  const cx = WHEEL_X + WHEEL_W * (wheel + 0.5);
  const lift = WHEEL_R + 0.05;
  const base: [number, number, number] = [cx, WHEEL_Y + lift * c, WHEEL_Z + lift * s];
  const up: [number, number, number] = [0, -s, c];
  const origin: [number, number, number] = [base[0] - up[0] * 0.36 * GLYPH_SIZE, base[1] - up[1] * 0.36 * GLYPH_SIZE, base[2] - up[2] * 0.36 * GLYPH_SIZE];
  const o = iso(origin, P);
  const x = iso([origin[0] + 1, origin[1], origin[2]], P);
  const down = iso([origin[0] - up[0], origin[1] - up[1], origin[2] - up[2]], P);
  const transform = `matrix(${fine(x[0] - o[0])} ${fine(x[1] - o[1])} ${fine(down[0] - o[0])} ${fine(down[1] - o[1])} ${tenth(o[0])} ${tenth(o[1])})`;
  return { transform, opacity: smooth(0.1, 0.5, facing) };
}
