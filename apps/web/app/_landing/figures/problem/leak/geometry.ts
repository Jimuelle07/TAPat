import { corners, insetPlan, iso, pathOf, sideArc, sideSeam, topMatrix, type Flat, type Plan, type Point3, type SolidPaths } from "@/app/_landing/iso/iso-kit";
import * as G from "@/app/_landing/iso/lathe.mjs";
import { kitOf, type Shape } from "../build";
import { join } from "../shared";
import {
  BACK_Y,
  ARM_Z,
  BASE,
  BASE_H,
  BAY_CENTRE,
  BAY_W,
  BAY_X,
  BODY_H,
  BODY_R,
  BODY_TOP,
  BODY_Z,
  CENTRE,
  CONE_LEN,
  CONE_R,
  CRACK_AT,
  CRACK_Z,
  DIVIDER,
  DRAWER_D,
  DRAWER_W,
  DRAWER_Z,
  FLOOR_H,
  FOOT_H,
  FRONT_D,
  FRONT_H,
  GAUGE,
  GAUGE_FACE,
  GAUGE_H,
  GAUGE_Z,
  GANTRY,
  GANTRY_H,
  GANTRY_Z,
  LEG,
  LEG_X,
  LEG_Y,
  LUG_H,
  LUG_Z,
  P,
  PULL,
  RACK,
  RACK_BOTTOM_H,
  RACK_FLOOR,
  RACK_H,
  RIM_H,
  RIM_TOP,
  SHOULDER_H,
  SHOULDER_R,
  SHOULDER_Z,
  SKID_Y,
  SPOUT_LEN,
  SPOUT_R,
  SPOUT_Z,
  WALL,
  WALL_H,
  WINDOW,
  conePoint,
} from "./view";

/** Every solid, as data, for the audit script. */
export const LEDGER: Shape[] = [];
const K = kitOf(P, LEDGER);
const { at, slab, cyl, seg } = K;
const ORIGIN = iso([0, 0, 0], P);
const offset = (point: Point3): Flat => {
  const [x, y] = iso(point, P);
  return [Math.round((x - ORIGIN[0]) * 10) / 10, Math.round((y - ORIGIN[1]) * 10) / 10];
};
const polygon = (points: Point3[]) => pathOf(points.map((point) => at(point)), true);

/* ---------------------------------------------------------------- base */

const FEET = corners(BASE, 16);
const SCREWS = corners(BASE, 7);
const LABEL: Plan = { x: -66, y: 50, w: 44, d: 9, r: 1.6 };

export const BASE_ART = {
  halo: slab("base", BASE, 0, BASE_H, 8).fill,
  feet: FEET.map(([x, y], i) => [cyl(`foot${i}.flange`, x, y, 6.6, -FOOT_H, 1.2, 20), cyl(`foot${i}.pad`, x, y, 5, -FOOT_H + 1.2, FOOT_H - 1.2, 20)]),
  slab: slab("base.slab", BASE, 0, BASE_H, 8, 1.2),
  groove: K.outline(insetPlan(BASE, 4), BASE_H, 8),
  screws: SCREWS.map(([x, y]) => at([x, y, BASE_H])),
  screwRings: join(SCREWS.map(([x, y]) => K.ring(x, y, 2, BASE_H, 14))),
  label: slab("label", LABEL, BASE_H, 0.8, 3),
  labelLine: K.outline(insetPlan(LABEL, 1.4), BASE_H + 0.8, 3),
  labelMatrix: topMatrix([LABEL.x + 5, LABEL.y + 6], BASE_H + 0.8, P, "x"),
  labelScrews: [at([LABEL.x + 2.6, LABEL.y + LABEL.d / 2, BASE_H + 0.8]), at([LABEL.x + LABEL.w - 2.6, LABEL.y + LABEL.d / 2, BASE_H + 0.8])],
};

/* ---------------------------------------------------------------- the rack (ghost) */

const WALL_TOP = DRAWER_Z + RACK_H - RACK_BOTTOM_H;
const rackSlab = (name: string, plan: Plan) => slab(name, plan, DRAWER_Z, RACK_H - RACK_BOTTOM_H, 2, 0.4);

export const RACK_ART = {
  bottom: slab("rack.bottom", RACK, RACK_FLOOR, RACK_BOTTOM_H, 3, 0.6),
  back: rackSlab("rack.back", { x: RACK.x + WALL, y: RACK.y, w: RACK.w - WALL * 2, d: WALL - 1, r: 0.6 }),
  left: rackSlab("rack.left", { x: RACK.x, y: RACK.y, w: WALL, d: RACK.d, r: 0.8 }),
  right: rackSlab("rack.right", { x: RACK.x + RACK.w - WALL, y: RACK.y, w: WALL, d: RACK.d, r: 0.8 }),
  dividers: [0, 1].map((i) => rackSlab(`rack.divider${i}`, { x: BAY_X[i] + BAY_W, y: RACK.y + WALL - 1, w: DIVIDER, d: RACK.d - WALL + 1, r: 0.5 })),
  screws: [at([RACK.x + WALL / 2, RACK.y + RACK.d - 3, WALL_TOP]), at([RACK.x + RACK.w - WALL / 2, RACK.y + RACK.d - 3, WALL_TOP])],
};

/* ---------------------------------------------------------------- the drawers (ghost) */

const drawerX = (i: number) => BAY_CENTRE[i] - DRAWER_W / 2;
const drawerY = (i: number) => BACK_Y + PULL[i];
const WALL_T = 2;

export interface Drawer {
  floor: SolidPaths;
  back: SolidPaths;
  left: SolidPaths;
  right: SolidPaths;
  front: SolidPaths;
  /** The label holder, and the ghost bust on its card: a head and a pair of shoulders. */
  holder: string;
  head: string;
  shoulders: string;
  pullPosts: SolidPaths[];
  pullBar: SolidPaths;
  rivets: Flat[];
}

export const DRAWERS: Drawer[] = [0, 1, 2].map((i) => {
  const x = drawerX(i);
  const y = drawerY(i);
  const frontY = y + DRAWER_D;
  const face = frontY + FRONT_D;
  const z = DRAWER_Z;
  const cx = x + DRAWER_W / 2;
  const z0 = z + 2.2;
  const z1 = z + FRONT_H - 2;
  const head: Point3[] = [];
  for (let step = 0; step < 14; step++) {
    const angle = (step / 14) * Math.PI * 2;
    head.push([cx + 1.15 * Math.cos(angle), face, z0 + 3.5 + 1.15 * Math.sin(angle)]);
  }
  const shoulders: Point3[] = [];
  for (let step = 0; step <= 12; step++) {
    const angle = (step / 12) * Math.PI;
    shoulders.push([cx + 3.8 * Math.cos(angle), face, z0 + 2.3 * Math.sin(angle)]);
  }
  return {
    floor: slab(`drawer${i}.floor`, { x, y, w: DRAWER_W, d: DRAWER_D, r: 1 }, z, FLOOR_H, 2, 0.3),
    back: slab(`drawer${i}.back`, { x, y, w: DRAWER_W, d: WALL_T, r: 0.5 }, z + FLOOR_H, WALL_H - FLOOR_H, 2),
    left: slab(`drawer${i}.left`, { x, y: y + WALL_T, w: WALL_T, d: DRAWER_D - WALL_T, r: 0.5 }, z + FLOOR_H, WALL_H - FLOOR_H, 2),
    right: slab(`drawer${i}.right`, { x: x + DRAWER_W - WALL_T, y: y + WALL_T, w: WALL_T, d: DRAWER_D - WALL_T, r: 0.5 }, z + FLOOR_H, WALL_H - FLOOR_H, 2),
    front: slab(`drawer${i}.front`, { x: x - 1, y: frontY, w: DRAWER_W + 2, d: FRONT_D, r: 0.8 }, z, FRONT_H, 3, 0.4),
    holder: polygon([
      [cx - 5.2, face, z0],
      [cx + 5.2, face, z0],
      [cx + 5.2, face, z1],
      [cx - 5.2, face, z1],
    ]),
    head: polygon(head),
    shoulders: pathOf(shoulders.map((point) => at(point))),
    pullPosts: [cx - 4, cx + 4].map((px, k) => slab(`drawer${i}.post${k}`, { x: px - 0.8, y: face, w: 1.6, d: 1.8, r: 0.3 }, z + FRONT_H - 1.9, 1.5, 2)),
    pullBar: slab(`drawer${i}.pull`, { x: cx - 5, y: face + 1.8, w: 10, d: 1.4, r: 0.6 }, z + FRONT_H - 2.2, 1.9, 2),
    rivets: [at([x + 0.4, face, z + 1.1]), at([x + DRAWER_W - 0.4, face, z + 1.1])],
  };
});

/* ---------------------------------------------------------------- the stand */

const LEG_PLANS: Plan[] = [-1, 1].map((sx) => ({ x: sx * LEG_X - LEG / 2, y: LEG_Y - LEG / 2, w: LEG, d: LEG, r: 1 }));
const SKIDS: Plan[] = [-1, 1].map((sx) => ({ x: sx * LEG_X - LEG / 2, y: SKID_Y[0], w: LEG, d: SKID_Y[1] - SKID_Y[0], r: 1.4 }));
const SKID_H = 2.6;
const LEG_Z = BASE_H + SKID_H;
const BRACE_Z = 24;
const BRACE: Plan = { x: -LEG_X + LEG / 2, y: LEG_Y - 2, w: LEG_X * 2 - LEG, d: 4, r: 0.8 };
const COLLAR_Z = GANTRY_Z - 8;
const ARM_PLANS: Plan[] = [-1, 1].map((sign) => ({ x: sign > 0 ? BODY_R + 0.2 : -BODY_R - 4.2, y: GANTRY.y + GANTRY.d, w: 4, d: CENTRE[1] + 3.5 - (GANTRY.y + GANTRY.d), r: 0.8 }));

export const STAND_ART = {
  skids: SKIDS.map((skid, i) => slab(`stand.skid${i}`, skid, BASE_H, SKID_H, 3, 0.4)),
  skidScrews: SKIDS.flatMap((skid) => [at([skid.x + LEG / 2, skid.y + 5, BASE_H + SKID_H]), at([skid.x + LEG / 2, skid.y + skid.d - 5, BASE_H + SKID_H])]),
  legs: LEG_PLANS.map((leg, i) => slab(`stand.leg${i}`, leg, LEG_Z, GANTRY_Z - LEG_Z, 3, 0.4)),
  collars: LEG_PLANS.map((leg) => sideSeam(leg, COLLAR_Z, P, 3)),
  gantry: slab("stand.gantry", GANTRY, GANTRY_Z, GANTRY_H, 3, 0.6),
  gantryScrews: [-LEG_X, LEG_X, 0].map((x) => at([x, GANTRY.y + GANTRY.d / 2, GANTRY_Z + GANTRY_H])),
  brace: slab("stand.brace", BRACE, BRACE_Z, 4, 2, 0.4),
  arms: ARM_PLANS.map((arm, i) => slab(`stand.arm${i}`, arm, ARM_Z, 4, 2, 0.4)),
  armScrews: ARM_PLANS.map((arm) => at([arm.x + arm.w / 2, arm.y + arm.d - 3, ARM_Z + 4])),
};

/* ---------------------------------------------------------------- the hopper */

const FRAME = G.frameAlong([CENTRE[0], CENTRE[1], SPOUT_Z], [0, 0, 1]);
const FUNNEL: Array<[number, number]> = [
  [0, SPOUT_R],
  [SPOUT_LEN, SPOUT_R],
  [SPOUT_LEN + CONE_LEN, CONE_R],
];
LEDGER.push({ name: "hopper.funnel", kind: "lathe", origin: FRAME.o as Point3, axis: FRAME.a as Point3, profile: FUNNEL });

const SEAM_Z = [BODY_Z + 5, BODY_TOP - 5];

/** A sliver of crack on the funnel: the closed outline of a jagged gap. */
function crack(angle: number, z0: number, z1: number) {
  const left: Point3[] = [];
  const right: Point3[] = [];
  const jag = [0, 0.07, -0.05, 0.08, -0.03, 0.05, 0];
  jag.forEach((wobble, i) => {
    const u = i / (jag.length - 1);
    const width = 0.1 * Math.sin(Math.PI * u) ** 0.7;
    left.push(conePoint(z0 + (z1 - z0) * u, angle + wobble - width, 0.05));
    right.push(conePoint(z0 + (z1 - z0) * u, angle + wobble + width, 0.05));
  });
  return pathOf([...left, ...right.reverse()].map((point) => at(point)), true);
}

const MOUTH_R = BODY_R - 1.2;
const RIM_BOLTS: Point3[] = Array.from({ length: 16 }, (_, i) => {
  const angle = (i / 16) * Math.PI * 2;
  return [CENTRE[0] + (SHOULDER_R + 0.6) * Math.cos(angle), CENTRE[1] + (SHOULDER_R + 0.6) * Math.sin(angle), RIM_TOP] as Point3;
});

export const HOPPER_ART = {
  funnel: G.solidOf(FUNNEL, FRAME, P) as SolidPaths,
  cracks: CRACK_AT.map((angle) => crack(angle, SPOUT_Z + 2.5, CRACK_Z + 6)),
  shoulder: cyl("hopper.shoulder", CENTRE[0], CENTRE[1], SHOULDER_R, SHOULDER_Z, SHOULDER_H, 40, 0.3),
  body: cyl("hopper.body", CENTRE[0], CENTRE[1], BODY_R, BODY_Z, BODY_H, 44),
  seams: SEAM_Z.map((z) => sideArc(CENTRE[0], CENTRE[1], BODY_R, z, P, 28)),
  rim: cyl("hopper.rim", CENTRE[0], CENTRE[1], SHOULDER_R + 1.2, BODY_TOP, RIM_H, 44, 0.4),
  mouthRing: K.ring(CENTRE[0], CENTRE[1], MOUTH_R, RIM_TOP, 40),
  mouth: polygon(Array.from({ length: 36 }, (_, i) => [CENTRE[0] + MOUTH_R * Math.cos((i / 36) * Math.PI * 2), CENTRE[1] + MOUTH_R * Math.sin((i / 36) * Math.PI * 2), RIM_TOP] as Point3)),
  bolts: RIM_BOLTS.map((point) => at(point)),
  lugs: [-1, 1].map((sign, i) =>
    slab(`hopper.lug${i}`, { x: sign > 0 ? BODY_R - 0.4 : -BODY_R - 4.6, y: CENTRE[1] - 3.5, w: 5, d: 7, r: 1 }, LUG_Z, LUG_H, 3, 0.4),
  ),
};

/* ---------------------------------------------------------------- the level gauge */

const BRACKET: Plan = { x: -1.7, y: CENTRE[1] + BODY_R, w: 3.4, d: GAUGE.y - CENTRE[1] - BODY_R, r: 0.5 };
const SCALE_X = GAUGE.x + GAUGE.w;

function scale() {
  const minor: string[] = [];
  const major: string[] = [];
  for (let tick = 0; tick <= 8; tick++) {
    const z = WINDOW.z0 + ((WINDOW.z1 - WINDOW.z0) * tick) / 8;
    const big = tick % 2 === 0;
    (big ? major : minor).push(seg([SCALE_X, GAUGE_FACE, z], [SCALE_X - (big ? 3 : 1.7), GAUGE_FACE, z]));
  }
  return { minor: join(minor), major: join(major) };
}

export const GAUGE_ART = {
  panel: slab("gauge.panel", GAUGE, GAUGE_Z, GAUGE_H, 2, 0.6),
  brackets: [BODY_Z + 6.5, BODY_TOP - 6.5].map((z, i) => slab(`gauge.bracket${i}`, BRACKET, z - 1.5, 3, 2, 0.3)),
  frame: polygon([
    [WINDOW.x0 - 0.8, GAUGE_FACE, WINDOW.z0 - 0.8],
    [WINDOW.x1 + 0.8, GAUGE_FACE, WINDOW.z0 - 0.8],
    [WINDOW.x1 + 0.8, GAUGE_FACE, WINDOW.z1 + 0.8],
    [WINDOW.x0 - 0.8, GAUGE_FACE, WINDOW.z1 + 0.8],
  ]),
  window: polygon([
    [WINDOW.x0, GAUGE_FACE, WINDOW.z0],
    [WINDOW.x1, GAUGE_FACE, WINDOW.z0],
    [WINDOW.x1, GAUGE_FACE, WINDOW.z1],
    [WINDOW.x0, GAUGE_FACE, WINDOW.z1],
  ]),
  scale: scale(),
  screws: [at([GAUGE.x + 2.2, GAUGE_FACE, GAUGE_Z + 1.2]), at([GAUGE.x + GAUGE.w - 2.2, GAUGE_FACE, GAUGE_Z + GAUGE_H - 1.2])],
};

/* ---------------------------------------------------------------- coins */

const COIN_R = 2.8;
const COIN_H = 0.9;
export const COIN = cyl("coin", 0, 0, COIN_R, 0, COIN_H, 14);
export const coinAt = (point: Point3): Flat => offset(point);

/** Where coins pile up in a drawer (offsets from the drawer's inner back corner) and how tall each pile gets. */
const SLOTS: Array<[number, number]> = [
  [-7, 8],
  [7, 8],
  [-7, 15],
  [7, 15],
  [-7, 22],
  [7, 22],
];
const PILES = [
  [2, 1, 1, 0, 1, 0],
  [3, 2, 3, 2, 2, 1],
  [1, 2, 0, 1, 1, 1],
];

export interface HeapCoin {
  at: Flat;
  /** The share leaked at which this coin lands. */
  threshold: number;
}

/** Heap coins per drawer, in painter's order (back to front, low to high); each lands at a share of the leak. */
export const HEAP: HeapCoin[][] = PILES.map((counts, drawer) => {
  const coins = counts.flatMap((count, slot) => Array.from({ length: count }, (_, level) => ({ slot, level })));
  const landing = [...coins].sort((a, b) => a.level - b.level || a.slot - b.slot);
  return coins.map(({ slot, level }) => {
    const [dx, dy] = SLOTS[slot];
    const x = BAY_CENTRE[drawer] + dx;
    const y = drawerY(drawer) + WALL_T + dy;
    const rank = landing.findIndex((coin) => coin.slot === slot && coin.level === level) + 1;
    return { at: offset([x, y, DRAWER_Z + FLOOR_H + level * COIN_H]), threshold: rank / coins.length };
  });
});

/** The hopper's mouth: coins heaped in it, vanishing from the top as it drains. */
const MOUTH_SLOTS: Array<[number, number]> = [
  [-5, -4],
  [0, -6.5],
  [5, -4],
  [-7, 1],
  [-2, -1],
  [3, 0],
  [7, 2],
  [-4, 5],
  [1, 4.5],
  [5.5, 5.5],
];
export const MOUTH_COINS: Flat[] = MOUTH_SLOTS.map(([dx, dy]) => offset([CENTRE[0] + dx, CENTRE[1] + dy, RIM_TOP - 0.9]));
