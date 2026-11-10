import { insetPlan, iso, pathOf, sideArc, sideMatrix, sideRing, sideSeam, type Flat, type Plan, type Point3, type SolidPaths } from "@/app/_landing/iso/iso-kit";
import * as G from "@/app/_landing/iso/lathe.mjs";
import { tubePieces } from "@/app/_landing/iso/tube.mjs";
import { kitOf, type Shape } from "../build";
import { join } from "../shared";
import { LANE_Y, POOL_R, POOL_X, SLOT_X } from "./model";
import {
  ARM_Z,
  BOOTH,
  BOOTH_H,
  BOOTH_Z,
  COLLAR_R,
  COLLAR_Z,
  FLOOR,
  FLOOR_H,
  FRONT,
  GROUND,
  LAMP_Y,
  MAST,
  MAST_TOP,
  P,
  PLINTH,
  PLINTH_H,
  POST_H,
  POST_X,
  ROOF,
  ROOF_H,
  ROOF_Z,
  ROPE_R,
  ROPE_SAG,
  ROW_Y,
  SHADE_H,
  SHADE_R,
  SHADE_TOP,
  SHELF,
  SHELF_Z,
  WINDOW,
} from "./view";

/** Every solid, as data, for the audit script. */
export const LEDGER: Shape[] = [];
const K = kitOf(P, LEDGER);
const { at, slab, cyl, seg } = K;
const polygon = (points: Point3[]) => pathOf(points.map((point) => at(point)), true);
const frontRect = (face: number, x0: number, x1: number, z0: number, z1: number): Point3[] => [
  [x0, face, z0],
  [x1, face, z0],
  [x1, face, z1],
  [x0, face, z1],
];
const sideRect = (face: number, y0: number, y1: number, z0: number, z1: number): Point3[] => [
  [face, y0, z0],
  [face, y1, z0],
  [face, y1, z1],
  [face, y0, z1],
];
const ORIGIN = iso([0, 0, 0], P);
const offset = (point: Point3): Flat => {
  const [x, y] = iso(point, P);
  return [Math.round((x - ORIGIN[0]) * 10) / 10, Math.round((y - ORIGIN[1]) * 10) / 10];
};

/* ---------------------------------------------------------------- pavement, slots, the pool of sunlight */

const SLOT = 20;
const slotPlan = (slot: number): Plan => ({ x: SLOT_X(slot) - SLOT / 2, y: LANE_Y - SLOT / 2, w: SLOT, d: SLOT, r: 2 });

const POOL_RING = (r: number) => Array.from({ length: 40 }, (_, i) => [POOL_X + r * Math.cos((i / 40) * Math.PI * 2), LANE_Y + r * Math.sin((i / 40) * Math.PI * 2)] as [number, number]);

/** Paving joints run from edge to edge of the slab. */
function joints() {
  const lines: string[] = [];
  for (let x = FLOOR.x + 28; x < FLOOR.x + FLOOR.w - 10; x += 28) lines.push(seg([x, FLOOR.y, GROUND], [x, FLOOR.y + FLOOR.d, GROUND]));
  for (const y of [FLOOR.y + 22, FLOOR.y + 66]) lines.push(seg([FLOOR.x, y, GROUND], [FLOOR.x + FLOOR.w, y, GROUND]));
  return join(lines);
}

export const FLOOR_ART = {
  halo: slab("floor", FLOOR, 0, FLOOR_H, 8).fill,
  slab: slab("floor.slab", FLOOR, 0, FLOOR_H, 8, 1),
  groove: K.outline(insetPlan(FLOOR, 3.5), GROUND, 8),
  joints: joints(),
  slots: Array.from({ length: 8 }, (_, slot) => K.outline(slotPlan(slot), GROUND, 3)),
  pool: K.cyl("pool", POOL_X, LANE_Y, POOL_R, GROUND, 0.3, 48),
  poolRings: [POOL_R * 0.66, POOL_R * 0.34].map((r) => K.top(POOL_RING(r), GROUND + 0.3, true)),
};

/* ---------------------------------------------------------------- the booth */

const WINDOW_Z = (WINDOW.z0 + WINDOW.z1) / 2;
const SIGN: Plan = { x: 14, y: FRONT, w: 38, d: 3, r: 1 };
const SIGN_Z = BOOTH_Z + BOOTH_H - 7;
const DOOR = BOOTH.x + BOOTH.w;
const SLOTS_Z = BOOTH_Z + 4;

export const BOOTH_ART = {
  plinth: slab("booth.plinth", PLINTH, GROUND, PLINTH_H, 4, 0.6),
  body: slab("booth.body", BOOTH, BOOTH_Z, BOOTH_H, 4, 0.8),
  seam: sideSeam(BOOTH, BOOTH_Z + 11, P, 4),
  roof: slab("booth.roof", ROOF, ROOF_Z, ROOF_H, 5, 1),
  roofGroove: K.outline(insetPlan(ROOF, 3), ROOF_Z + ROOF_H, 5),
  roofScrews: [at([ROOF.x + 5, ROOF.y + ROOF.d - 5, ROOF_Z + ROOF_H]), at([ROOF.x + ROOF.w - 5, ROOF.y + ROOF.d - 5, ROOF_Z + ROOF_H])],
  vent: cyl("booth.vent", 54, 12, 4.4, ROOF_Z + ROOF_H, 3, 18, 0.4),
  ventCap: cyl("booth.ventCap", 54, 12, 5.6, ROOF_Z + ROOF_H + 3, 1, 18, 0.3),
  window: polygon(frontRect(FRONT, WINDOW.x0, WINDOW.x1, WINDOW.z0, WINDOW.z1)),
  windowFrame: polygon(frontRect(FRONT, WINDOW.x0 - 2, WINDOW.x1 + 2, WINDOW.z0 - 2, WINDOW.z1 + 2)),
  mullion: seg([(WINDOW.x0 + WINDOW.x1) / 2, FRONT, WINDOW.z0], [(WINDOW.x0 + WINDOW.x1) / 2, FRONT, WINDOW.z1]),
  tray: polygon(frontRect(FRONT, WINDOW.x0 + 4, WINDOW.x0 + 14, WINDOW.z0 - 0.6, WINDOW.z0 + 3)),
  shelf: slab("booth.shelf", SHELF, SHELF_Z, 2.4, 3, 0.4),
  shelfEdge: K.outline(insetPlan(SHELF, 1.2), SHELF_Z + 2.4, 3),
  sign: slab("booth.sign", SIGN, SIGN_Z, 5, 2, 0.4),
  signText: sideMatrix([SIGN.x + 19 - 8.8, FRONT + SIGN.d], SIGN_Z + 1.2, P, "left"),
  signScrews: [at([SIGN.x + 2, FRONT + SIGN.d, SIGN_Z + 2.5]), at([SIGN.x + SIGN.w - 2, FRONT + SIGN.d, SIGN_Z + 2.5])],
  slots: [0, 1, 2].map((i) => polygon(frontRect(FRONT, 8 + i * 4, 10 + i * 4, SLOTS_Z, SLOTS_Z + 6))),
  door: polygon(sideRect(DOOR, 6, 30, BOOTH_Z + 3, BOOTH_Z + 30)),
  doorPanel: polygon(sideRect(DOOR, 9, 27, BOOTH_Z + 14, BOOTH_Z + 27)),
  handle: slab("booth.handle", { x: DOOR, y: 24.5, w: 1.6, d: 3.4, r: 0.5 }, BOOTH_Z + 14, 1.6, 2),
  hingePins: [9, 27].map((y) => seg([DOOR, y, BOOTH_Z + 6], [DOOR, y, BOOTH_Z + 9])),
  lamp: at([2.4, FRONT, WINDOW_Z + 8]),
};

/* ---------------------------------------------------------------- stanchions and ropes */

const POST_FRAME = [0, 0] as const;
const KNOB_Z = GROUND + POST_H;
export const POST_ART = {
  base: cyl("post.base", POST_FRAME[0], POST_FRAME[1], 4.6, GROUND, 1.4, 20, 0.3),
  pole: cyl("post.pole", POST_FRAME[0], POST_FRAME[1], 1.3, GROUND + 1.4, COLLAR_Z - 0.5 - GROUND - 1.4, 12),
  collar: cyl("post.collar", POST_FRAME[0], POST_FRAME[1], COLLAR_R, COLLAR_Z - 0.5, 2.4, 14, 0.2),
  upper: cyl("post.upper", POST_FRAME[0], POST_FRAME[1], 1.3, COLLAR_Z + 1.9, KNOB_Z - COLLAR_Z - 1.9, 12),
  knob: cyl("post.knob", POST_FRAME[0], POST_FRAME[1], 2.4, KNOB_Z, 2.2, 14, 0.3),
  ring: K.ring(0, 0, 3.4, GROUND + 1.4, 16),
};
export const POSTS = ROW_Y.map((y) => POST_X.map((x) => offset([x, y, 0])));

export interface RopePiece {
  body: string;
  shine: string;
  shade: string;
  edges: string;
  wide: boolean;
}

const ropeOf = (y: number, from: number, to: number): Point3[] =>
  Array.from({ length: 13 }, (_, i) => {
    const u = i / 12;
    return [from + (to - from) * u, y, COLLAR_Z + 0.7 - ROPE_SAG * 4 * u * (1 - u)] as Point3;
  });

export const ROPES: RopePiece[][][] = ROW_Y.map((y, row) =>
  POST_X.slice(0, -1).map((x, i) => {
    const points = ropeOf(y, x + COLLAR_R - 0.02, POST_X[i + 1] - COLLAR_R + 0.02);
    LEDGER.push({ name: `rope${row}.${i}`, kind: "route", points, r: ROPE_R });
    return tubePieces(points, ROPE_R, P, { maxLength: 200 }) as RopePiece[];
  }),
);

/* ---------------------------------------------------------------- people (built at the world origin) */

const HEAD_Z = GROUND + 18 + 3.1;
const SWEAT: Point3 = [3.4, -1.4, HEAD_Z + 1.6];

export interface PersonArt {
  halo: string;
  legs: SolidPaths;
  torso: SolidPaths;
  belt: string;
  head: SolidPaths;
  brim?: SolidPaths;
  crown?: SolidPaths;
}

const person = (name: string, hat: boolean): PersonArt => ({
  halo: cyl(`${name}.halo`, 0, 0, 5.6, GROUND, 0.1, 16).fill,
  legs: cyl(`${name}.legs`, 0, 0, 3.2, GROUND, 8, 14),
  torso: cyl(`${name}.torso`, 0, 0, 4.3, GROUND + 8, 10, 16, 0.3),
  belt: sideArc(0, 0, 4.3, GROUND + 9, P, 12),
  head: G.sphereOf([0, 0, HEAD_Z], 3.3, P) as SolidPaths,
  ...(hat
    ? {
        brim: cyl(`${name}.brim`, 0, 0, 4.4, HEAD_Z + 1.9, 0.9, 16, 0.2),
        crown: cyl(`${name}.crown`, 0, 0, 3, HEAD_Z + 2.8, 1.6, 14, 0.2),
      }
    : {}),
});
LEDGER.push({ name: "head", kind: "lathe", origin: [0, 0, HEAD_Z], axis: [0, 0, 1], profile: [[-3.3, 0], [0, 3.3], [3.3, 0]] });

export const PEOPLE_ART = { plain: person("person", false), hat: person("person.hat", true), sweat: sideRing(SWEAT, 0.9, "y", P, 12) };

/* ---------------------------------------------------------------- the sun lamp */

const ARM: Plan = { x: POOL_X - 2, y: MAST.y + MAST.d, w: 4, d: LAMP_Y + 2 - (MAST.y + MAST.d), r: 0.8 };
const BASE_PLATE: Plan = { x: POOL_X - 8, y: MAST.y - 4, w: 16, d: 13, r: 2 };
const SHADE = G.frameAlong([POOL_X, LAMP_Y, SHADE_TOP], [0, 0, -1]);
const SHADE_PROFILE: Array<[number, number]> = [
  [0, 2.6],
  [1.6, 2.6],
  [SHADE_H, SHADE_R],
];
LEDGER.push({ name: "lamp.shade", kind: "lathe", origin: SHADE.o as Point3, axis: SHADE.a as Point3, profile: SHADE_PROFILE });
const RIM_Z = SHADE_TOP - SHADE_H;
const BULB: Point3 = [POOL_X, LAMP_Y, RIM_Z - 1.6];

/** Beams: from the shade's rim down to the pool's edge, on the side facing the viewer. */
function beams() {
  const lines: string[] = [];
  for (let step = -3; step <= 3; step++) {
    const angle = ((62 + step * 26) * Math.PI) / 180;
    lines.push(
      seg(
        [POOL_X + SHADE_R * Math.cos(angle), LAMP_Y + SHADE_R * Math.sin(angle), RIM_Z],
        [POOL_X + (POOL_R - 1) * Math.cos(angle), LANE_Y + (POOL_R - 1) * Math.sin(angle), GROUND + 0.3],
      ),
    );
  }
  return join(lines);
}

export const LAMP_ART = {
  plate: slab("lamp.plate", BASE_PLATE, GROUND, 2, 3, 0.4),
  plateScrews: [at([BASE_PLATE.x + 2.2, BASE_PLATE.y + BASE_PLATE.d - 2.2, GROUND + 2]), at([BASE_PLATE.x + BASE_PLATE.w - 2.2, BASE_PLATE.y + BASE_PLATE.d - 2.2, GROUND + 2])],
  mast: slab("lamp.mast", MAST, GROUND + 2, MAST_TOP - GROUND - 2, 3, 0.5),
  mastBand: sideSeam(MAST, GROUND + 14, P, 3),
  arm: slab("lamp.arm", ARM, ARM_Z, 4, 3, 0.4),
  armScrews: [at([POOL_X, ARM.y + 5, ARM_Z + 4]), at([POOL_X, ARM.y + ARM.d - 4, ARM_Z + 4])],
  stem: cyl("lamp.stem", POOL_X, LAMP_Y, 1.3, SHADE_TOP, ARM_Z - SHADE_TOP, 12),
  shade: G.solidOf(SHADE_PROFILE, SHADE, P) as SolidPaths,
  shadeSeam: G.arcOf(SHADE, 5.4, 2.6 + (5.4 - 1.6) * ((SHADE_R - 2.6) / (SHADE_H - 1.6)), P, { slope: (SHADE_R - 2.6) / (SHADE_H - 1.6) }),
  bulb: G.sphereOf(BULB, 3.6, P) as SolidPaths,
  beams: beams(),
};
