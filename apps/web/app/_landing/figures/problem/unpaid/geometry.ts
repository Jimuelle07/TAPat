import { corners, insetPlan, iso, knurl, pathOf, sideMatrix, sideSeam, type Flat, type Plan, type Point3, type SolidPaths } from "@/app/_landing/iso/iso-kit";
import * as G from "@/app/_landing/iso/lathe.mjs";
import { kitOf, type Shape } from "../build";
import { join } from "../shared";
import { COIN_H, COIN_PITCH, COIN_R, COIN_X0, PER_ROW, PUSH_X0, ROWS } from "./model";
import {
  BASE,
  BASE_H,
  BIN,
  BIN_FLOOR_TOP,
  BIN_FRONT,
  BIN_RIM,
  BIN_WALL,
  BODY,
  BOTTOM_RAIL_Z,
  CHUTE_END,
  CHUTE_Y,
  COIN_GROUND,
  DIAL,
  DIAL_FACE_R,
  DIAL_PLATE_R,
  DIAL_RING_R,
  FLOOR_H,
  FOOT_H,
  GATE_D,
  GATE_TOP,
  GATE_W,
  GATE_X,
  GATE_Y,
  GATE_Z,
  INNER_Z,
  KNOB_FROM,
  KNOB_R,
  KNOB_TO,
  LOCK,
  LOCK_H,
  LOCK_Z,
  OUTLET_TOP,
  P,
  PLINTH,
  PLINTH_TOP,
  POST,
  RAIL,
  RAIL_H,
  ROOF_H,
  TOP_RAIL_Z,
  WALL,
  WALL_TOP,
} from "./view";

/** Every solid, as data, for the audit script. */
export const LEDGER: Shape[] = [];
const K = kitOf(P, LEDGER);
const { at, slab, cyl, seg } = K;
const ORIGIN = iso([0, 0, 0], P);
export const offsetOf = (point: Point3): Flat => {
  const [x, y] = iso(point, P);
  return [Math.round((x - ORIGIN[0]) * 10) / 10, Math.round((y - ORIGIN[1]) * 10) / 10];
};
const polygon = (points: Point3[]) => pathOf(points.map((point) => at(point)), true);
/** A rectangle on the plane y = `face` (a front face), from x0..x1 and z0..z1. */
const frontRect = (face: number, x0: number, x1: number, z0: number, z1: number): Point3[] => [
  [x0, face, z0],
  [x1, face, z0],
  [x1, face, z1],
  [x0, face, z1],
];
/** A rectangle on the plane x = `face` (a side face), from y0..y1 and z0..z1. */
const sideRect = (face: number, y0: number, y1: number, z0: number, z1: number): Point3[] => [
  [face, y0, z0],
  [face, y1, z0],
  [face, y1, z1],
  [face, y0, z1],
];
const SIDE = G.frameOf([0, 0, 0], [0, 1, 0], [1, 0, 0], [0, 0, 1]);

/* ---------------------------------------------------------------- base and plinth */

const FEET = corners(BASE, 16);
const SCREWS = corners(BASE, 7);
const SLOTS = [0, 1, 2, 3].map((i) => frontRect(PLINTH.y + PLINTH.d, 8 + i * 16, 18 + i * 16, 8, 11));

export const BASE_ART = {
  halo: slab("base", BASE, 0, BASE_H, 8).fill,
  feet: FEET.map(([x, y], i) => [cyl(`foot${i}.flange`, x, y, 6.6, -FOOT_H, 1.2, 20), cyl(`foot${i}.pad`, x, y, 5, -FOOT_H + 1.2, FOOT_H - 1.2, 20)]),
  slab: slab("base.slab", BASE, 0, BASE_H, 8, 1.2),
  groove: K.outline(insetPlan(BASE, 4), BASE_H, 8),
  screws: SCREWS.map(([x, y]) => at([x, y, BASE_H])),
  screwRings: join(SCREWS.map(([x, y]) => K.ring(x, y, 2, BASE_H, 14))),
  plinth: slab("plinth", PLINTH, BASE_H, PLINTH_TOP - BASE_H, 5, 0.8),
  plinthSeam: sideSeam(PLINTH, BASE_H + 13, P, 5),
  slots: SLOTS.map((points) => polygon(points)),
};

/* ---------------------------------------------------------------- the strongroom */

const BACK: Plan = { x: BODY.x, y: BODY.y, w: BODY.w, d: WALL, r: 0.8 };
const LEFT: Plan = { x: BODY.x, y: BODY.y + WALL, w: WALL, d: BODY.d - WALL, r: 0.8 };
const BRIDGE: Plan = { x: BODY.x + BODY.w - WALL, y: BODY.y + WALL, w: WALL, d: BODY.d - WALL, r: 0.8 };
const ROOF: Plan = { x: BODY.x - 1, y: BODY.y - 1, w: BODY.w + 2, d: BODY.d - 0.5, r: 1.6 };
const WALL_H = WALL_TOP - INNER_Z;

export const BODY_ART = {
  floor: slab("body.floor", { x: BODY.x, y: BODY.y, w: BODY.w, d: BODY.d, r: 0.6 }, PLINTH_TOP, FLOOR_H, 3, 0.4),
  floorGroove: K.outline({ x: 8, y: 6, w: BODY.w - 16, d: BODY.d - 12, r: 1.5 }, INNER_Z, 4),
  back: slab("body.back", BACK, INNER_Z, WALL_H, 3, 0.4),
  backPanel: polygon(frontRect(WALL, 8, BODY.w - 8, INNER_Z + 5, WALL_TOP - 5)),
  backMid: seg([8, WALL, INNER_Z + 17], [BODY.w - 8, WALL, INNER_Z + 17]),
  left: slab("body.left", LEFT, INNER_Z, WALL_H, 3, 0.4),
  leftPanel: polygon(sideRect(WALL, BODY.y + 10, BODY.d - 6, INNER_Z + 5, WALL_TOP - 5)),
  bridge: slab("body.bridge", BRIDGE, OUTLET_TOP, WALL_TOP - OUTLET_TOP, 3, 0.4),
  bridgeSeam: sideSeam(BRIDGE, OUTLET_TOP + 8, P, 3),
  roof: slab("body.roof", ROOF, WALL_TOP, ROOF_H, 5, 0.8),
  roofGroove: K.outline(insetPlan(ROOF, 3), WALL_TOP + ROOF_H, 5),
  roofScrews: corners(ROOF, 5).map(([x, y]) => at([x, y, WALL_TOP + ROOF_H])),
  /** The jamb screws on the front edge of the left wall and the outlet's lip. */
  lipScrews: [at([BODY.x + 2, BODY.y + BODY.d, INNER_Z + 6]), at([BODY.x + 2, BODY.y + BODY.d, WALL_TOP - 6])],
};

/* ---------------------------------------------------------------- rails, post, gate */

export const RAIL_ART = {
  post: slab("rail.post", POST, BASE_H, TOP_RAIL_Z + RAIL_H - BASE_H, 3, 0.6),
  postScrews: [BOTTOM_RAIL_Z + 2.5, TOP_RAIL_Z + 2.5].map((z) => at([POST.x + POST.w / 2, POST.y + POST.d, z])),
  bottom: slab("rail.bottom", RAIL, BOTTOM_RAIL_Z, RAIL_H, 3, 0.6),
  bottomScrews: [-48, -24, 56].map((x) => at([x, RAIL.y + RAIL.d, BOTTOM_RAIL_Z + RAIL_H - 1.4])),
  top: slab("rail.top", RAIL, TOP_RAIL_Z, RAIL_H, 3, 0.6),
  topScrews: [-48, -24, 56].map((x) => at([x, RAIL.y + RAIL.d, TOP_RAIL_Z + RAIL_H - 1.4])),
};

const BAR_COUNT = 11;
const BAR_W = 1.6;
const STILE = 4;
const BACKPLATE: Plan = { x: GATE_X + STILE, y: GATE_Y, w: LOCK.x + LOCK.w + 1.5 - (GATE_X + STILE), d: GATE_D, r: 0.6 };
const BARS = Array.from({ length: BAR_COUNT }, (_, k) => {
  const x = GATE_X + STILE + ((GATE_W - STILE * 2) / (BAR_COUNT + 1)) * (k + 1) - BAR_W / 2;
  return { x, y: GATE_Y + (GATE_D - BAR_W) / 2, w: BAR_W, d: BAR_W, r: 0.3 } as Plan;
}).filter((bar) => bar.x + bar.w < BACKPLATE.x || bar.x > BACKPLATE.x + BACKPLATE.w);
const FRAME_H = 4;
const STILE_Z0 = GATE_Z + FRAME_H;
const STILE_Z1 = GATE_TOP - FRAME_H;
const FACE = LOCK.y + LOCK.d;

export const GATE_ART = {
  bottom: slab("gate.bottom", { x: GATE_X, y: GATE_Y, w: GATE_W, d: GATE_D, r: 0.6 }, GATE_Z, FRAME_H, 2, 0.4),
  top: slab("gate.top", { x: GATE_X, y: GATE_Y, w: GATE_W, d: GATE_D, r: 0.6 }, STILE_Z1, FRAME_H, 2, 0.4),
  stiles: [GATE_X, GATE_X + GATE_W - STILE].map((x, i) => slab(`gate.stile${i}`, { x, y: GATE_Y, w: STILE, d: GATE_D, r: 0.6 }, STILE_Z0, STILE_Z1 - STILE_Z0, 2, 0.4)),
  backplate: slab("gate.backplate", BACKPLATE, STILE_Z0, STILE_Z1 - STILE_Z0, 2, 0.4),
  bars: BARS.map((plan, i) => slab(`gate.bar${i}`, plan, STILE_Z0, STILE_Z1 - STILE_Z0, 2)),
  rivets: [GATE_X + 2, GATE_X + GATE_W - 2].flatMap((x) => [at([x, GATE_Y + GATE_D, GATE_Z + 2]), at([x, GATE_Y + GATE_D, GATE_TOP - 2])]),
  lock: slab("gate.lock", LOCK, LOCK_Z, LOCK_H, 3, 0.7),
  lockScrews: [
    at([LOCK.x + 2.2, FACE, LOCK_Z + LOCK_H - 2.2]),
    at([LOCK.x + LOCK.w - 2.2, FACE, LOCK_Z + LOCK_H - 2.2]),
    at([LOCK.x + 2.2, FACE, LOCK_Z + 2.2]),
    at([LOCK.x + LOCK.w - 2.2, FACE, LOCK_Z + 2.2]),
  ],
};

/* ---------------------------------------------------------------- the dial (static parts; the ticks and ribs turn) */

const DIAL_FRAME = G.frameAlong(DIAL, [0, 1, 0]);
const sine = (degrees: number) => Math.sin((degrees * Math.PI) / 180);
const cosine = (degrees: number) => Math.cos((degrees * Math.PI) / 180);
const ringOnFace = (r: number, s: number, steps = 40): Point3[] =>
  Array.from({ length: steps }, (_, i) => {
    const angle = (i / steps) * 360;
    return [DIAL[0] + r * sine(angle), DIAL[1] + s, DIAL[2] + r * cosine(angle)] as Point3;
  });

export const DIAL_ART = {
  plate: G.disc(0, KNOB_FROM - 0.8, DIAL_PLATE_R, DIAL_FRAME, P) as SolidPaths,
  ring: G.disc(KNOB_FROM - 0.8, KNOB_FROM, DIAL_RING_R, DIAL_FRAME, P) as SolidPaths,
  face: polygon(ringOnFace(DIAL_FACE_R, KNOB_FROM)),
  knob: G.disc(KNOB_FROM, KNOB_TO, KNOB_R, DIAL_FRAME, P) as SolidPaths,
  cap: G.disc(KNOB_TO, KNOB_TO + 0.8, KNOB_R - 0.7, DIAL_FRAME, P) as SolidPaths,
  hub: at([DIAL[0], DIAL[1] + KNOB_TO + 0.8, DIAL[2]]),
  index: polygon([
    [DIAL[0] - 1.4, DIAL[1] + KNOB_FROM, DIAL[2] + DIAL_RING_R - 0.1],
    [DIAL[0] + 1.4, DIAL[1] + KNOB_FROM, DIAL[2] + DIAL_RING_R - 0.1],
    [DIAL[0], DIAL[1] + KNOB_FROM, DIAL[2] + DIAL_FACE_R - 1.6],
  ]),
};
LEDGER.push({ name: "dial.plate", kind: "lathe", origin: DIAL_FRAME.o as Point3, axis: DIAL_FRAME.a as Point3, profile: [[0, 0], [0, DIAL_PLATE_R], [KNOB_FROM - 0.8, DIAL_PLATE_R], [KNOB_FROM - 0.8, 0]] });
LEDGER.push({ name: "dial.ring", kind: "lathe", origin: DIAL_FRAME.o as Point3, axis: DIAL_FRAME.a as Point3, profile: [[KNOB_FROM - 0.8, 0], [KNOB_FROM - 0.8, DIAL_RING_R], [KNOB_FROM, DIAL_RING_R], [KNOB_FROM, 0]] });
LEDGER.push({ name: "dial.knob", kind: "lathe", origin: DIAL_FRAME.o as Point3, axis: DIAL_FRAME.a as Point3, profile: [[KNOB_FROM, 0], [KNOB_FROM, KNOB_R], [KNOB_TO, KNOB_R], [KNOB_TO, 0]] });

/* ---------------------------------------------------------------- the pusher (built at PUSH_X0) */

const PLATE: Plan = { x: PUSH_X0 - 1.5, y: 6, w: 3, d: 42, r: 0.5 };
const PLATE_Z = INNER_Z;
export const PUSHER_ART = {
  plate: slab("pusher.plate", PLATE, PLATE_Z, 8.2, 2, 0.3),
  block: slab("pusher.block", { x: PUSH_X0 - 1.5, y: 16, w: 4, d: 22, r: 0.8 }, PLATE_Z + 8.2, 2.6, 2, 0.3),
  dots: [20, 27, 34].map((y) => at([PUSH_X0 + 0.5, y, PLATE_Z + 10.8])),
};

/* ---------------------------------------------------------------- coins */

export const COIN = cyl("coin", 0, 0, COIN_R, 0, COIN_H, 14);
/** Where each coin starts: the offset of its `use`, and the start itself. */
export const COIN_SPOTS = ROWS.flatMap((y) => Array.from({ length: PER_ROW }, (_, k) => offsetOf([COIN_X0 + COIN_PITCH * k, y, COIN_GROUND])));

/* ---------------------------------------------------------------- chute and Treasury box */

const CHUTE_START = 70;
const TOP_START = INNER_Z;
const TOP_END = INNER_Z - 7;
const CHUTE_PLATE: Array<[number, number]> = [
  [CHUTE_START, PLINTH_TOP],
  [CHUTE_START, TOP_START],
  [CHUTE_END, TOP_END],
  [CHUTE_END, TOP_END - 3],
];
const chuteRail = (): Array<[number, number]> => [
  [CHUTE_START, TOP_START],
  [CHUTE_START, TOP_START + 3],
  [CHUTE_END, TOP_END + 3],
  [CHUTE_END, TOP_END],
];
const [Y0, Y1] = CHUTE_Y;
const LEGS: Plan[] = [Y0 + 4, Y1 - 8].map((y) => ({ x: 98, y, w: 4, d: 4, r: 0.8 }));
const legTop = (x: number) => PLINTH_TOP - (7 * (x - CHUTE_START)) / (CHUTE_END - CHUTE_START);

const prism = (name: string, polygonUV: Array<[number, number]>, y0: number, y1: number) => {
  LEDGER.push({ name, kind: "prism", polygon: polygonUV, y0, y1 });
  return G.prismOf(SIDE, polygonUV, y0, y1, P) as SolidPaths;
};

export const CHUTE_ART = {
  legs: LEGS.map((leg, i) => slab(`chute.leg${i}`, leg, BASE_H, legTop(leg.x + 2) - BASE_H, 2, 0.3)),
  plate: prism("chute.plate", CHUTE_PLATE, Y0, Y1),
  railBack: prism("chute.railBack", chuteRail(), Y0, Y0 + 2),
  railFront: prism("chute.railFront", chuteRail(), Y1 - 2, Y1),
};

const BIN_BACK: Plan = { x: BIN.x, y: BIN.y, w: BIN.w, d: BIN_WALL, r: 0.5 };
const BIN_LEFT: Plan = { x: BIN.x, y: BIN.y + BIN_WALL, w: BIN_WALL, d: BIN.d - BIN_WALL * 2, r: 0.5 };
const BIN_RIGHT: Plan = { x: BIN.x + BIN.w - BIN_WALL, y: BIN.y + BIN_WALL, w: BIN_WALL, d: BIN.d - BIN_WALL * 2, r: 0.5 };
const BIN_FRONT_PLAN: Plan = { x: BIN.x, y: BIN.y + BIN.d - BIN_WALL, w: BIN.w, d: BIN_WALL, r: 0.5 };
const FRONT_FACE = BIN.y + BIN.d;
const COLUMN_X = [BIN.x + 4, BIN.x + BIN.w - 4];
const COLUMN_Y = FRONT_FACE + 3;
const COLUMN_TOP = 26;
const PORTICO: Plan = { x: BIN.x, y: FRONT_FACE, w: BIN.w, d: 5, r: 0.6 };

export const BIN_ART = {
  floor: slab("bin.floor", BIN, BASE_H, BIN_FLOOR_TOP - BASE_H, 3, 0.4),
  back: slab("bin.back", BIN_BACK, BIN_FLOOR_TOP, BIN_RIM - BIN_FLOOR_TOP, 2, 0.3),
  left: slab("bin.left", BIN_LEFT, BIN_FLOOR_TOP, BIN_RIM - BIN_FLOOR_TOP, 2, 0.3),
  right: slab("bin.right", BIN_RIGHT, BIN_FLOOR_TOP, BIN_RIM - BIN_FLOOR_TOP, 2, 0.3),
  front: slab("bin.front", BIN_FRONT_PLAN, BIN_FLOOR_TOP, BIN_FRONT - BIN_FLOOR_TOP, 2, 0.3),
  frontPanel: polygon(frontRect(FRONT_FACE, BIN.x + 9, BIN.x + BIN.w - 9, BIN_FLOOR_TOP + 1.4, BIN_FRONT - 1.4)),
  label: sideMatrix([BIN.x + BIN.w / 2 - 6.2, FRONT_FACE], BIN_FLOOR_TOP + 4.6, P, "left"),
  columns: COLUMN_X.map((x, i) => ({
    base: cyl(`column${i}.base`, x, COLUMN_Y, 2.6, BASE_H, 1.4, 14),
    shaft: cyl(`column${i}.shaft`, x, COLUMN_Y, 1.9, BASE_H + 1.4, COLUMN_TOP - BASE_H - 2.8, 16),
    flutes: knurl(x, COLUMN_Y, 1.9, BASE_H + 1.4, COLUMN_TOP - 1.4, 10, P),
    capital: cyl(`column${i}.capital`, x, COLUMN_Y, 2.6, COLUMN_TOP - 1.4, 1.4, 14),
  })),
  entablature: slab("portico.entablature", PORTICO, COLUMN_TOP, 2.6, 2, 0.4),
  pediment: prism("portico.pediment", [[BIN.x, COLUMN_TOP + 2.6], [BIN.x + BIN.w, COLUMN_TOP + 2.6], [BIN.x + BIN.w / 2, COLUMN_TOP + 8.6]], FRONT_FACE, FRONT_FACE + 5),
  pedimentRing: pathOf(
    Array.from({ length: 18 }, (_, i) => {
      const angle = (i / 18) * Math.PI * 2;
      return at([BIN.x + BIN.w / 2 + 1.6 * Math.cos(angle), FRONT_FACE + 5, COLUMN_TOP + 4.6 + 1.6 * Math.sin(angle)]);
    }),
    true,
  ),
};
