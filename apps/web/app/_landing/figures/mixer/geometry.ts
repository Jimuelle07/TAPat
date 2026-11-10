/*
 * Every static path of the machine, computed once on the server. Moving parts are built here at their rest pose (the
 * opening benchmark) and moved by a screen transform; parts that turn or tilt are rebuilt by `frame.ts`.
 */
import {
  corners,
  cylinder,
  depthOf,
  extrude,
  insetPlan,
  knurl,
  onTop,
  pathOf,
  planOutline,
  ring,
  segment,
  sideArc,
  sideMatrix,
  sideSeam,
  slabOf,
  type Flat,
  type Plan,
  type Plane,
  type Point3,
} from "../../iso/iso-kit";
import * as G from "../../iso/lathe.mjs";
import {
  BODY_HIGH,
  BODY_LOW,
  CAL,
  CAM,
  COUNTER,
  COUNTER_FRONT,
  COUNTER_H,
  DIAL_PLATE,
  DIAL_R,
  DIAL_WHEEL,
  DIAL_Z,
  DOT_X,
  DRUM,
  FLOAT_H,
  ARM_HALF,
  FLOAT_R,
  LIP,
  STEM_R,
  FOLLOWER_R,
  GUIDE_Y,
  GUIDE_Z,
  LADDER,
  LADDER_PHP,
  LADDER_Z,
  LINK_Z,
  PALLET,
  POST,
  TUBE,
  WEEK_RULE,
  calendarCell,
  weekX,
  WEIGHT_PLATE_PLAN,
  WHEEL,
  WHEEL_X,
  WINDOW,
  floatZ,
  ladderZ,
} from "./layout";
import {
  EXCISE_H,
  GEAR_A,
  GEAR_B,
  INDEX_PHP,
  MARGIN_H,
  OPENING,
  POST_TOP,
  RACK_X,
  TOWER_H,
  WEEKS_PER_YEAR,
  OPENING_PUMP,
  XH,
  ZH,
  ZM_ZERO,
  REST,
  pointerAngleOf,
  CRUDE_RANGE,
  MODULE,
} from "./model";
import { barPolygon, faceCircle, faceLine, planePrism } from "./plate";
import { BASE, BASE_H, CARRIAGE_Y, FOOT_H, LEVER_Y, MESH_Y, P, RACK_Y, WALL, WALL_FACE, WALL_H, at } from "./view";

const solid = (plan: Plan, z: number, h: number, steps = 4, bevel = 0) => slabOf(plan, z, h, P, steps, bevel);
const cyl = (x: number, y: number, r: number, z: number, h: number, steps = 28, bevel = 0) => cylinder(x, y, r, z, h, P, steps, bevel);
const join = (list: string[]) => list.join("");
const seg = (a: Point3, b: Point3) => segment(a, b, P);
const dots = (points: Point3[]): Flat[] => points.map((point) => at(point));
const byDepth = <T extends Plane>(points: T[]) => [...points].sort((a, b) => depthOf([a[0], a[1], 0], P) - depthOf([b[0], b[1], 0], P));
/** A short round part along y, from y0 (back) to y1 (front). */
const discY = (x: number, z: number, y0: number, y1: number, r: number, options = {}) => G.disc(0, y1 - y0, r, G.frameAlong([x, y0, z], [0, 1, 0]), P, options);
/** A short round part along x, from x0 to x1. */
const discX = (y: number, z: number, x0: number, x1: number, r: number, options = {}) => G.disc(0, x1 - x0, r, G.frameAlong([x0, y, z], [1, 0, 0]), P, options);
// ------------------------------------------------------------------------------------------------ bench and wall

const FEET = byDepth(corners(BASE, 24));
const BASE_SCREWS = corners(BASE, 9);
const LABEL: Plan = { x: BASE.x + 22, y: 54, w: 78, d: 13, r: 2 };

export const BASE_ART = {
  halo: solid(BASE, -BASE_H - FOOT_H, BASE_H).fill,
  feet: FEET.map(([x, y]) => [cyl(x, y, 8, -BASE_H - FOOT_H, 1.8), cyl(x, y, 6.2, -BASE_H - FOOT_H + 1.8, FOOT_H - 1.8)]),
  slab: solid(BASE, -BASE_H, BASE_H, 8, 1.6),
  groove: planOutline(insetPlan(BASE, 4.5), 0, P),
  screws: dots(BASE_SCREWS.map(([x, y]) => [x, y, 0] as Point3)),
  screwRings: join(BASE_SCREWS.map(([x, y]) => ring(x, y, 2.4, 0, P, 16))),
  plate: solid(LABEL, 0, 0.8, 4),
  plateLine: planOutline(insetPlan(LABEL, 1.6), 0.8, P),
  plateScrews: dots([[LABEL.x + 4, LABEL.y + LABEL.d / 2, 0.8], [LABEL.x + LABEL.w - 4, LABEL.y + LABEL.d / 2, 0.8]]),
  plateRule: join([0, 1, 2].map((row) => onTop([[LABEL.x + 10, LABEL.y + 3.6 + row * 2.6], [LABEL.x + (row === 1 ? 46 : 62), LABEL.y + 3.6 + row * 2.6]], 0.8, P))),
};

const WEEK_Z = 1.4;
const WEEK_EDGE = WEEK_RULE.y + 1;

function weekTicks() {
  const minor: string[] = [];
  const major: string[] = [];
  for (let week = 1; week <= WEEKS_PER_YEAR; week++) {
    const big = (week - 1) % 13 === 0 || week === WEEKS_PER_YEAR;
    (big ? major : minor).push(onTop([[weekX(week), WEEK_EDGE], [weekX(week), WEEK_EDGE + (big ? 4.6 : 2.6)]], WEEK_Z, P));
  }
  return { minor: join(minor), major: join(major) };
}

const WEEK_TICKS = weekTicks();
const RIDER_PLAN: Plan = { x: weekX(1) - 1.8, y: WEEK_RULE.y - 0.6, w: 3.6, d: WEEK_RULE.d + 1.2, r: 0.8 };

export const WEEK_ART = {
  strip: solid(WEEK_RULE, 0, WEEK_Z, 3, 0.3),
  base: onTop([[weekX(1), WEEK_EDGE], [weekX(WEEKS_PER_YEAR), WEEK_EDGE]], WEEK_Z, P),
  minor: WEEK_TICKS.minor,
  major: WEEK_TICKS.major,
  screws: dots([[WEEK_RULE.x + 2.6, WEEK_RULE.y + WEEK_RULE.d - 2, WEEK_Z], [WEEK_RULE.x + WEEK_RULE.w - 2.6, WEEK_RULE.y + WEEK_RULE.d - 2, WEEK_Z]]),
  rider: solid(RIDER_PLAN, WEEK_Z, 2.2, 3, 0.3),
  riderLine: onTop([[weekX(1), RIDER_PLAN.y + 0.6], [weekX(1), RIDER_PLAN.y + RIDER_PLAN.d - 0.6]], WEEK_Z + 2.2, P),
};

const RIB_Z: [number, number] = [6, WALL_H - 8];
const RIBS: Plan[] = [-224, -150, 204].map((x) => ({ x, y: WALL_FACE, w: 6, d: 2.4, r: 0.6 }));
const RAIL_TOP: Plan = { x: WALL.x - 5, y: WALL.y - 3, w: WALL.w + 10, d: WALL.d + 6, r: 2 };
const SKIRT: Plan = { x: WALL.x + 4, y: WALL_FACE, w: WALL.w - 8, d: 3.2, r: 0.8 };

export const WALL_ART = {
  plate: solid(WALL, 0, WALL_H, 4, 0.8),
  rail: solid(RAIL_TOP, WALL_H, 5, 4, 0.8),
  skirt: solid(SKIRT, 0, 7, 3, 0.4),
  ribs: RIBS.map((plan) => solid(plan, RIB_Z[0], RIB_Z[1] - RIB_Z[0], 2, 0.3)),
  ribScrews: dots(RIBS.flatMap((plan) => [[plan.x + 3, WALL_FACE + 2.4, RIB_Z[1] - 4], [plan.x + 3, WALL_FACE + 2.4, RIB_Z[0] + 4]] as Point3[])),
  railScrews: dots([-224, -120, 0, 120, 200].map((x) => [x, RAIL_TOP.y + RAIL_TOP.d, WALL_H + 3.4] as Point3)),
  skirtScrews: dots([-214, -90, 90, 200].map((x) => [x, WALL_FACE + 3.2, 3.6] as Point3)),
};

// ------------------------------------------------------------------------------------------------ crude drum and float gauge

const [DX, DY] = [DRUM.x, DRUM.y];
const DRUM_TOP = DRUM.z + DRUM.h;
const HOOPS = [DRUM.z, DRUM.z + 18, DRUM.z + 41, DRUM_TOP - 3];

export const DRUM_ART = {
  halo: solid(PALLET, 0, 4).fill,
  pallet: solid(PALLET, 0, DRUM.z, 5, 0.6),
  palletGroove: planOutline(insetPlan(PALLET, 3.2), DRUM.z, P),
  palletScrews: dots(corners(PALLET, 5.4).map(([x, y]) => [x, y, DRUM.z] as Point3)),
  body: cyl(DX, DY, DRUM.r, DRUM.z, DRUM.h, 72, 0.5),
  hoops: HOOPS.map((z) => ({ paths: cyl(DX, DY, DRUM.r + 0.9, z, 3, 72), seam: sideArc(DX, DY, DRUM.r + 0.9, z + 1.5, P, 40) })),
  ribs: sideArc(DX, DY, DRUM.r, DRUM.z + 30, P, 40),
  topRing: ring(DX, DY, DRUM.r - 2.6, DRUM_TOP, P, 64),
  topRing2: ring(DX, DY, DRUM.r - 5.2, DRUM_TOP, P, 64),
  bungs: [
    [DX + 12, DY + 8],
    [DX - 13, DY - 9],
  ].map(([x, y]) => ({ cap: cyl(x!, y!, 4.4, DRUM_TOP, 2.4, 24, 0.3), knurl: knurl(x!, y!, 4.4, DRUM_TOP, DRUM_TOP + 2.4, 18, P), ring: ring(x!, y!, 2.6, DRUM_TOP + 2.4, P, 16), slot: onTop([[x! - 2.2, y!], [x! + 2.2, y!]], DRUM_TOP + 2.4, P) })),
  spigot: discY(DX + 12, 14, DY + 28, DY + 37, 2.3, { steps: 20 }),
  spigotFlange: discY(DX + 12, 14, DY + 28, DY + 29.6, 4.2, { steps: 24 }),
  spigotHandle: solid({ x: DX + 12 - 1, y: DY + 33, w: 2, d: 2.4, r: 0.5 }, 14, 7, 2, 0.2),
  spigotHandleCap: cyl(DX + 12, DY + 34.2, 2.4, 21, 1.6, 16),
};

const GAUGE_X = [TUBE.x - TUBE.gap - TUBE.rail, TUBE.x + TUBE.gap] as const;
const RAIL_TOP_Z = TUBE.z + TUBE.h;
const LEFT_FACE_X = GAUGE_X[0] + TUBE.rail;
const FRONT_EDGE = TUBE.y + TUBE.half;
const railPlan = (x: number): Plan => ({ x, y: TUBE.y - TUBE.half, w: TUBE.rail, d: TUBE.half * 2, r: 0.8 });

function gaugeTicks() {
  const minor: string[] = [];
  const major: string[] = [];
  for (let crude = CRUDE_RANGE[0]; crude <= CRUDE_RANGE[1]; crude += 5) {
    const big = crude % 10 === 0;
    const z = floatZ(crude);
    (big ? major : minor).push(seg([LEFT_FACE_X, FRONT_EDGE, z], [LEFT_FACE_X, FRONT_EDGE - (big ? 5 : 3), z]));
  }
  return { minor: join(minor), major: join(major) };
}

const GAUGE_TICKS = gaugeTicks();

export const GAUGE_ART = {
  foot: solid({ x: GAUGE_X[0], y: TUBE.y - TUBE.half, w: TUBE.rail * 2 + TUBE.gap * 2, d: TUBE.half * 2, r: 0.3 }, 0, TUBE.z, 2, 0.6),
  footScrews: dots([[GAUGE_X[0] + 2, FRONT_EDGE, TUBE.z - 2.4], [GAUGE_X[1] + TUBE.rail - 2, FRONT_EDGE, TUBE.z - 2.4]]),
  left: solid(railPlan(GAUGE_X[0]), TUBE.z, TUBE.h, 3, 0.4),
  right: solid(railPlan(GAUGE_X[1]), TUBE.z, TUBE.h, 3, 0.4),
  leftTop: solid({ ...railPlan(GAUGE_X[0]), x: GAUGE_X[0] - 0.8, w: TUBE.rail + 1.6, y: TUBE.y - TUBE.half - 0.8, d: TUBE.half * 2 + 1.6 }, RAIL_TOP_Z, 1.6, 3, 0.3),
  rightTop: solid({ ...railPlan(GAUGE_X[1]), x: GAUGE_X[1] - 0.8, w: TUBE.rail + 1.6, y: TUBE.y - TUBE.half - 0.8, d: TUBE.half * 2 + 1.6 }, RAIL_TOP_Z, 1.6, 3, 0.3),
  ticksMinor: GAUGE_TICKS.minor,
  ticksMajor: GAUGE_TICKS.major,
  tickBase: seg([LEFT_FACE_X, FRONT_EDGE, floatZ(CRUDE_RANGE[0])], [LEFT_FACE_X, FRONT_EDGE, floatZ(CRUDE_RANGE[1])]),
  railScrews: dots([[GAUGE_X[1] + TUBE.rail / 2, FRONT_EDGE, TUBE.z + 3], [GAUGE_X[1] + TUBE.rail / 2, FRONT_EDGE, RAIL_TOP_Z - 3]]),
};

const FLOAT_Z0 = floatZ(OPENING.crudeUsd);
const ARM_Z0 = REST.pusher[1];
const STEM_BOTTOM = FLOAT_Z0 + FLOAT_H / 2;
const ARM_BACK_END = TUBE.y - TUBE.half;
const ARM_X0 = TUBE.x - ARM_HALF;

/** The arm behind the rails: from the lever pin forward to where the rails start. */
export const ARM_ART = {
  rear: solid({ x: ARM_X0, y: LEVER_Y[1], w: ARM_HALF * 2, d: ARM_BACK_END - LEVER_Y[1], r: 0.8 }, ARM_Z0 - ARM_HALF, ARM_HALF * 2, 3, 0.3),
  rearLine: onTop([[TUBE.x, LEVER_Y[1]], [TUBE.x, ARM_BACK_END]], ARM_Z0 + ARM_HALF, P),
  rearDots: dots([[TUBE.x, LEVER_Y[1] + 2.6, ARM_Z0 + ARM_HALF], [TUBE.x, ARM_BACK_END - 3, ARM_Z0 + ARM_HALF]]),
  mid: solid({ x: ARM_X0, y: ARM_BACK_END, w: ARM_HALF * 2, d: FRONT_EDGE - ARM_BACK_END - 1, r: 0.8 }, ARM_Z0 - ARM_HALF, ARM_HALF * 2, 3, 0.3),
  midLine: onTop([[TUBE.x, ARM_BACK_END], [TUBE.x, FRONT_EDGE - 1]], ARM_Z0 + ARM_HALF, P),
  stem: cyl(TUBE.x, TUBE.y, STEM_R, STEM_BOTTOM, ARM_Z0 - ARM_HALF - STEM_BOTTOM, 14),
  stemMarks: join([6, 12, 18].map((rise) => sideArc(TUBE.x, TUBE.y, STEM_R, STEM_BOTTOM + rise, P, 8))),
};

/** The float between the rails. */
export const FLOAT_ART = {
  float: cyl(TUBE.x, TUBE.y, FLOAT_R, FLOAT_Z0 - FLOAT_H / 2, FLOAT_H, 22, 0.3),
  floatRing: ring(TUBE.x, TUBE.y, FLOAT_R - 1.1, FLOAT_Z0 + FLOAT_H / 2, P, 14),
  floatBand: sideArc(TUBE.x, TUBE.y, FLOAT_R, FLOAT_Z0, P, 12),
};

// ------------------------------------------------------------------------------------------------ the lever's hinge

const HINGE_FOOT: Plan = { x: XH - 17, y: LEVER_Y[0] - 4, w: 34, d: 17, r: 2 };
const HINGE_TOP = ZH + 10;
const CHEEK_BACK: Plan = { x: XH - 8, y: LEVER_Y[0] - 3.4, w: 16, d: 3.4, r: 1 };
const CHEEK_FRONT: Plan = { x: XH - 8, y: LEVER_Y[1], w: 16, d: 3.4, r: 1 };

export const HINGE_ART = {
  foot: solid(HINGE_FOOT, 0, 2.4, 4, 0.4),
  footScrews: dots([[HINGE_FOOT.x + 4, HINGE_FOOT.y + HINGE_FOOT.d / 2, 2.4], [HINGE_FOOT.x + HINGE_FOOT.w - 4, HINGE_FOOT.y + HINGE_FOOT.d / 2, 2.4]]),
  back: solid(CHEEK_BACK, 2.4, HINGE_TOP - 2.4, 3, 0.4),
  front: solid(CHEEK_FRONT, 2.4, HINGE_TOP - 2.4, 3, 0.4),
  pin: discY(XH, ZH, LEVER_Y[1] + 3.4, LEVER_Y[1] + 4.6, 3.2, { steps: 20 }),
  pinRing: faceCircle(XH, ZH, 1.7, LEVER_Y[1] + 4.6, P, 14),
  pinCap: faceCircle(XH, ZH, 3.2, LEVER_Y[1] + 4.6, P, 20),
  cheekScrews: dots([[XH - 5.4, LEVER_Y[1] + 3.4, 5.4], [XH + 5.4, LEVER_Y[1] + 3.4, 5.4], [XH - 5.4, LEVER_Y[1] + 3.4, HINGE_TOP - 3], [XH + 5.4, LEVER_Y[1] + 3.4, HINGE_TOP - 3]]),
};

// ------------------------------------------------------------------------------------------------ carriage and its guide rod

export const [XC0, PZ0] = REST.carriage;
const TOWER_HALF = 22;
const BODY: Plan = { x: XC0 - 11, y: CARRIAGE_Y[0], w: 22, d: CARRIAGE_Y[1] - CARRIAGE_Y[0], r: 1.6 };
const COLUMN: Plan = { x: XC0 - 4, y: CARRIAGE_Y[0] + 1, w: 8, d: CARRIAGE_Y[1] - CARRIAGE_Y[0] - 2, r: 1 };
const TOWER: Plan = { x: XC0 - TOWER_HALF, y: CARRIAGE_Y[0] + 1, w: TOWER_HALF * 2, d: CARRIAGE_Y[1] - CARRIAGE_Y[0] - 2, r: 1.8 };
const TOWER_FRONT = TOWER.y + TOWER.d;
const SHOE_Y0 = LEVER_Y[1];
const SHOE_BACK = 1.2;
const STRAP: Plan = { x: XC0 - 4.3, y: SHOE_Y0 + SHOE_BACK, w: 1.9, d: CARRIAGE_Y[0] - SHOE_Y0 - SHOE_BACK, r: 0.5 };

/** The shoe that holds the carriage on its rod: a back plate and two straps either side of the rod. */
export const SHOE_ART = {
  back: solid({ x: XC0 - 4.3, y: SHOE_Y0, w: 8.6, d: SHOE_BACK, r: 0.5 }, PZ0 - 6, 12, 3, 0.3),
  left: solid(STRAP, PZ0 - 6, 12, 2, 0.3),
  right: solid({ ...STRAP, x: XC0 + 2.4 }, PZ0 - 6, 12, 2, 0.3),
};

export const CARRIAGE_ART = {
  body: solid(BODY, PZ0 - 9, 18, 4, 0.7),
  bodyLine: planOutline(insetPlan(BODY, 2.4), PZ0 + 9, P),
  pinHead: faceCircle(XC0, PZ0, 3, BODY.y + BODY.d, P, 18),
  pinDot: dots([[XC0, BODY.y + BODY.d, PZ0]]),
  index: seg([XC0, BODY.y + BODY.d, PZ0 + 9], [XC0, BODY.y + BODY.d, PZ0 + 4]),
  indexBelow: seg([XC0, BODY.y + BODY.d, PZ0 - 9], [XC0, BODY.y + BODY.d, PZ0 - 4]),
  rivets: dots([[XC0 - 7.6, BODY.y + BODY.d, PZ0 + 6.4], [XC0 + 7.6, BODY.y + BODY.d, PZ0 + 6.4], [XC0 - 7.6, BODY.y + BODY.d, PZ0 - 6.4], [XC0 + 7.6, BODY.y + BODY.d, PZ0 - 6.4]]),
  column: solid(COLUMN, PZ0 + 9, 7, 2, 0.3),
  tower: solid(TOWER, PZ0 + TOWER_H - 6, 12, 4, 0.6),
  towerSlot: faceLine(
    barPolygon([XC0 - 15, PZ0 + TOWER_H], [XC0 + 15, PZ0 + TOWER_H], 4.4, [true, true], 6),
    TOWER_FRONT,
    P,
    true,
  ),
  towerScrews: dots([[XC0 - 19, TOWER_FRONT, PZ0 + TOWER_H], [XC0 + 19, TOWER_FRONT, PZ0 + TOWER_H]]),
  towerBevel: seg([XC0 - TOWER_HALF, TOWER_FRONT, PZ0 + TOWER_H - 3.6], [XC0 + TOWER_HALF, TOWER_FRONT, PZ0 + TOWER_H - 3.6]),
};

/** Fixed to the dial's drag link: the guide rod the carriage slides on, and the link itself. */
export const GUIDE_ART = {
  rod: cyl(XC0, GUIDE_Y, 2.4, GUIDE_Z[0], GUIDE_Z[1] - GUIDE_Z[0], 16),
  rodMarks: join([20, 34, 48, 62, 76].map((rise) => sideArc(XC0, GUIDE_Y, 2.4, GUIDE_Z[0] + rise, P, 8))),
  cap: cyl(XC0, GUIDE_Y, 3.4, GUIDE_Z[1], 2.4, 18, 0.3),
  foot: cyl(XC0, GUIDE_Y, 4.6, LINK_Z[1], 2.6, 20, 0.3),
};

// ------------------------------------------------------------------------------------------------ dial (front left): plate, link, rack, index

export const [WX, WY] = [DIAL_WHEEL.x, DIAL_WHEEL.y];
const RACK_PITCH = Math.PI * DIAL_WHEEL.module;
export const RACK_YP = WY - DIAL_R; // pitch line

export function dialRack(): Plane[] {
  const root = RACK_YP - 1.25 * DIAL_WHEEL.module;
  const tip = RACK_YP + DIAL_WHEEL.module;
  const body = root - 7;
  const x0 = XC0 - 3;
  const x1 = XC0 + 56;
  const ring: Plane[] = [[x0, body], [x1, body], [x1, root]];
  // gap centres at WX + k·pitch (the wheel's tooth enters there when the carriage sits at rest)
  const first = Math.ceil((x0 + 4 - WX) / RACK_PITCH);
  const last = Math.floor((x1 - 4 - WX) / RACK_PITCH);
  for (let k = last; k >= first; k--) {
    const gap = WX + k * RACK_PITCH;
    // walking back along x: this tooth is between gap k and gap k-1
    const centre = gap - RACK_PITCH / 2;
    ring.push([centre + 0.37 * RACK_PITCH, root], [centre + 0.15 * RACK_PITCH, tip], [centre - 0.15 * RACK_PITCH, tip], [centre - 0.37 * RACK_PITCH, root]);
  }
  ring.push([x0, root]);
  return ring;
}

export const DIAL_ART = {
  halo: solid(DIAL_PLATE, 0, 4).fill,
  plate: solid(DIAL_PLATE, 0, 4, 6, 0.8),
  plateGroove: planOutline(insetPlan(DIAL_PLATE, 3.4), 4, P),
  plateScrews: dots(corners(DIAL_PLATE, 6).map(([x, y]) => [x, y, 4] as Point3)),
  /** Tilted by a rest carriage x: rack and drag link ride with the guide rod. */
  rack: extrude(dialRack(), LINK_Z[0], LINK_Z[1] - LINK_Z[0], P, { convex: false }),
  rackRail: onTop([[XC0 + 1, RACK_YP - 8.4], [XC0 + 54, RACK_YP - 8.4]], LINK_Z[1], P),
  link: solid({ x: XC0 - 3, y: GUIDE_Y - 3, w: 6, d: RACK_YP - 9.5 - (GUIDE_Y - 3), r: 1.4 }, LINK_Z[0], LINK_Z[1] - LINK_Z[0], 3, 0.4),
  linkLine: onTop([[XC0, GUIDE_Y - 3], [XC0, RACK_YP - 9.5]], LINK_Z[1], P),
  linkScrews: dots([[XC0, RACK_YP - 6.6, LINK_Z[1]], [XC0, GUIDE_Y + 8, LINK_Z[1]]]),
  /** Straight under the rack: the channel it slides in */
  runners: [-52, -20].map((y) => solid({ x: XC0 - 18, y, w: 36, d: 6, r: 1 }, 0, LINK_Z[0], 3, 0.3)),
  runnerLines: join([-52, -20].map((y) => onTop([[XC0 - 18 + 1, y + 3], [XC0 + 18 - 1, y + 3]], LINK_Z[0], P))),
  bearings: [22, 46].map((at) => solid({ x: XC0 + at, y: RACK_YP - 11.7, w: 8, d: 2.2, r: 0.5 }, DIAL_Z[0], 6.2, 2, 0.2)),
  bearingScrews: dots([22, 46].map((at) => [XC0 + at + 4, RACK_YP - 9.5, DIAL_Z[0] + 6.2] as Point3)),
  knob: cyl(WX, WY, 4.6, DIAL_Z[1], 5.4, 24, 0.3),
  knobKnurl: knurl(WX, WY, 4.6, DIAL_Z[1], DIAL_Z[1] + 5.4, 24, P, 0.3),
  knobRing: ring(WX, WY, 2.8, DIAL_Z[1] + 5.4, P, 16),
  face: ring(WX, WY, DIAL_R - 3.4, DIAL_Z[1], P, 48),
  inner: ring(WX, WY, 9.4, DIAL_Z[1], P, 32),
  post: cyl(WX, WY + DIAL_R + 11.4, 2.7, 0, 9, 16),
  postCap: cyl(WX, WY + DIAL_R + 11.4, 3.7, 9, 2, 18, 0.2),
  finger: solid({ x: WX - 1.3, y: WY + 12.6, w: 2.6, d: DIAL_R + 11.4 - 12.6, r: 0.8 }, 11, 1.8, 2, 0.2),
  fingerLine: onTop([[WX, WY + 12.6], [WX, WY + DIAL_R + 11.4]], 12.8, P),
};

// ------------------------------------------------------------------------------------------------ fixed weights and the arm's right bracket

const WEIGHT_Z0 = POST_TOP;
const WEIGHT_BOTTOM: Plan = { x: POST.x - 4.5, y: POST.y - 0.8, w: POST.w + 9, d: POST.d + 0.8, r: 1.2 };
const WEIGHT_TOP: Plan = { x: POST.x - 3, y: POST.y - 0.8, w: POST.w + 6, d: POST.d + 0.8, r: 1.2 };
const BRACKET_Z = WEIGHT_Z0 + MARGIN_H + EXCISE_H;
const BRACKET: Plan = { ...WEIGHT_PLATE_PLAN, y: CARRIAGE_Y[0] + 1, d: CARRIAGE_Y[1] - CARRIAGE_Y[0] - 2 };
const BRACKET_FRONT = BRACKET.y + BRACKET.d;
const POST_FRONT = POST.y + POST.d;

export const WEIGHTS_ART = {
  foot: solid({ x: POST.x - 7, y: POST.y - 3, w: POST.w + 14, d: POST.d + 5, r: 2 }, 0, 2.4, 4, 0.4),
  footScrews: dots([[POST.x - 4, POST.y + POST.d / 2, 2.4], [POST.x + POST.w + 4, POST.y + POST.d / 2, 2.4]]),
  post: solid(POST, 2.4, WEIGHT_Z0 - 2.4, 3, 0.5),
  postLine: seg([POST.x + POST.w / 2, POST_FRONT, 2.4], [POST.x + POST.w / 2, POST_FRONT, WEIGHT_Z0]),
  margin: solid(WEIGHT_BOTTOM, WEIGHT_Z0, MARGIN_H, 3, 0.5),
  excise: solid(WEIGHT_TOP, WEIGHT_Z0 + MARGIN_H, EXCISE_H, 3, 0.5),
  bracket: solid(BRACKET, BRACKET_Z, 6, 3, 0.4),
  bracketSlot: faceLine(barPolygon([BRACKET.x + 6, BRACKET_Z + 3], [BRACKET.x + BRACKET.w - 6, BRACKET_Z + 3], 4.4, [true, true], 6), BRACKET_FRONT, P, true),
  bracketScrews: dots([[BRACKET.x + 2.4, BRACKET_FRONT, BRACKET_Z + 3], [BRACKET.x + BRACKET.w - 2.4, BRACKET_FRONT, BRACKET_Z + 3]]),
  marginLabel: sideMatrix([WEIGHT_BOTTOM.x + WEIGHT_BOTTOM.w / 2, WEIGHT_BOTTOM.y + WEIGHT_BOTTOM.d], WEIGHT_Z0 + MARGIN_H / 2 - 1.7, P, "left"),
  exciseLabel: sideMatrix([WEIGHT_TOP.x + WEIGHT_TOP.w / 2, WEIGHT_TOP.y + WEIGHT_TOP.d], WEIGHT_Z0 + MARGIN_H + EXCISE_H / 2 - 1.5, P, "left"),
  /** a dovetail seam round each weight so it reads as a cast block, not a box */
  marginSeam: sideSeam(WEIGHT_BOTTOM, WEIGHT_Z0 + 3, P, 3),
  exciseSeam: sideSeam(WEIGHT_TOP, WEIGHT_Z0 + MARGIN_H + 2.4, P, 3),
};

// ------------------------------------------------------------------------------------------------ rack and gear train hubs

const RACK_U0 = -6;
export const RACK_LOCAL: Flat[] = (() => {
  const root = RACK_X - 1.25 * MODULE;
  const tip = RACK_X + MODULE;
  const pitch = Math.PI * MODULE;
  const out: Flat[] = [[RACK_X - 18, RACK_U0], [RACK_X + 5, RACK_U0], [RACK_X + 5, 6], [root, 6]];
  const gap0 = GEAR_A[1] - ZM_ZERO; // where a gear tooth sits when the rack is at its zero
  const k0 = Math.ceil((8 - gap0) / pitch);
  const k1 = Math.floor((72 - gap0) / pitch);
  for (let k = k0; k <= k1; k++) {
    const centre = gap0 + k * pitch + pitch / 2; // tooth between gap k and gap k+1
    out.push([root, centre - 0.37 * pitch], [tip, centre - 0.15 * pitch], [tip, centre + 0.15 * pitch], [root, centre + 0.37 * pitch]);
  }
  out.push([root, 72], [RACK_X - 9, 72], [RACK_X - 9, 6], [RACK_X - 18, 6]);
  return out;
})();

const REST_ZM = REST.beamM[1];

export const RACK_ART = {
  rack: planePrism(RACK_LOCAL.map(([x, u]) => [x, u + REST_ZM] as Flat), RACK_Y[0], RACK_Y[1], P),
  yokeScrews: dots([[RACK_X - 14, RACK_Y[1], REST_ZM + 2.6], [RACK_X - 14, RACK_Y[1], REST_ZM - 2.6]]),
  stop: planePrism([[RACK_X - 9, 72 + REST_ZM], [RACK_X - 9, 78 + REST_ZM], [RACK_X - 1, 78 + REST_ZM], [RACK_X - 1, 72 + REST_ZM]], RACK_Y[0], RACK_Y[1], P),
};

const GEAR_PLATE_FRONT = WALL_FACE + 1.8;

/** Rims and hubs on the turning gears (they are circles, so they never need to turn). */
export const GEAR_STATIC = {
  aRim: faceCircle(GEAR_A[0], GEAR_A[1], 17, MESH_Y[1], P, 56),
  bRim: faceCircle(GEAR_B[0], GEAR_B[1], 14.4, MESH_Y[1], P, 48),
  bHub: faceCircle(GEAR_B[0], GEAR_B[1], 5.6, MESH_Y[1], P, 24),
};

/** Standoffs carry each shaft from the gear plate to the back of its gear; heads hold the front. */
export const AXLE_HEAD_Y = [RACK_Y[1], MESH_Y[1] + 1.8] as const;
export const AXLE_ART = [GEAR_A, GEAR_B].map(([x, z], index) => {
  const front = AXLE_HEAD_Y[index]!;
  return {
    standoff: discY(x, z, GEAR_PLATE_FRONT, MESH_Y[0], 3.4, { steps: 22 }),
    washer: discY(x, z, GEAR_PLATE_FRONT, GEAR_PLATE_FRONT + 1.6, 6.4, { steps: 28 }),
    head: discY(x, z, front, front + 2.2, 4.6, { steps: 24 }),
    headRing: faceCircle(x, z, 2.2, front + 2.2, P, 16),
    headDot: dots([[x, front + 2.2, z]]),
  };
});

// ------------------------------------------------------------------------------------------------ pointer arc (over the last shaft)

const ARC_R = [29, 36] as const;
const arcAngles = [pointerAngleOf(LADDER_PHP[0]) - 0.1, pointerAngleOf(LADDER_PHP[1]) + 0.1] as const;
const ARC_Y: [number, number] = [MESH_Y[0], MESH_Y[1] - 1.6];

function arcPolygon(): Flat[] {
  const out: Flat[] = [];
  const steps = 48;
  for (let step = 0; step <= steps; step++) {
    const a = arcAngles[0] + ((arcAngles[1] - arcAngles[0]) * step) / steps;
    out.push([GEAR_B[0] + ARC_R[1] * Math.cos(a), GEAR_B[1] + ARC_R[1] * Math.sin(a)]);
  }
  for (let step = steps; step >= 0; step--) {
    const a = arcAngles[0] + ((arcAngles[1] - arcAngles[0]) * step) / steps;
    out.push([GEAR_B[0] + ARC_R[0] * Math.cos(a), GEAR_B[1] + ARC_R[0] * Math.sin(a)]);
  }
  return out;
}

const onArc = (php: number, r: number): Flat => {
  const a = pointerAngleOf(php);
  return [GEAR_B[0] + r * Math.cos(a), GEAR_B[1] + r * Math.sin(a)];
};

const ARC_FACE_Y = ARC_Y[1];
const arcTicks = () => {
  const minor: string[] = [];
  const major: string[] = [];
  for (let php = LADDER_PHP[0]; php <= LADDER_PHP[1]; php += 1) {
    const big = php % 5 === 0;
    const half = php % 10 === 0;
    const len = half ? 5.4 : big ? 4 : 2.4;
    (big ? major : minor).push(faceLine([onArc(php, ARC_R[1] - 0.2), onArc(php, ARC_R[1] - 0.2 - len)], ARC_FACE_Y, P));
  }
  return { minor: join(minor), major: join(major) };
};

const ARC_TICKS = arcTicks();

export const ARC_ART = {
  strip: planePrism(arcPolygon(), ARC_Y[0], ARC_Y[1], P),
  rimInner: faceLine(
    Array.from({ length: 49 }, (_, step) => {
      const a = arcAngles[0] + ((arcAngles[1] - arcAngles[0]) * step) / 48;
      return [GEAR_B[0] + (ARC_R[1] - 0.2) * Math.cos(a), GEAR_B[1] + (ARC_R[1] - 0.2) * Math.sin(a)] as Flat;
    }),
    ARC_FACE_Y,
    P,
  ),
  minor: ARC_TICKS.minor,
  major: ARC_TICKS.major,
  /** the ₱65.00 index: a lug standing off the outer rim with its own line across the band */
  indexLug: planePrism(
    barPolygon(onArc(INDEX_PHP, ARC_R[1] - 0.4), onArc(INDEX_PHP, ARC_R[1] + 4.4), 3, [false, false]),
    ARC_Y[0],
    ARC_Y[1] + 0.4,
    P,
  ),
  indexLine: faceLine([onArc(INDEX_PHP, ARC_R[0] + 0.4), onArc(INDEX_PHP, ARC_R[1] + 4)], ARC_Y[1] + 0.4, P),
  endScrews: dots([onArc(LADDER_PHP[0] - 0.4, (ARC_R[0] + ARC_R[1]) / 2), onArc(LADDER_PHP[1] + 0.4, (ARC_R[0] + ARC_R[1]) / 2)].map(([x, z]) => [x, ARC_FACE_Y, z] as Point3)),
};
/** Three standoffs hold the arc to the gear plate. */
export const ARC_STANDOFFS = [LADDER_PHP[0] + 3, INDEX_PHP, LADDER_PHP[1] - 3].map((php) => {
  const [x, z] = onArc(php, (ARC_R[0] + ARC_R[1]) / 2);
  return { rod: discY(x, z, GEAR_PLATE_FRONT, ARC_Y[0], 2.2, { steps: 16 }), washer: discY(x, z, GEAR_PLATE_FRONT, GEAR_PLATE_FRONT + 1.4, 4, { steps: 20 }) };
});

/** A sub-plate behind the gear train, and the wall calendar. */
const GEAR_PLATE: Plan = { x: GEAR_A[0] - 36, y: WALL_FACE, w: GEAR_B[0] + 54 - (GEAR_A[0] - 36), d: 1.8, r: 5 };
const GEAR_PLATE_Z: [number, number] = [84, 166];

export const GEAR_PLATE_ART = {
  plate: solid(GEAR_PLATE, GEAR_PLATE_Z[0], GEAR_PLATE_Z[1] - GEAR_PLATE_Z[0], 6, 0.5),
  groove: faceLine(
    [
      [GEAR_PLATE.x + 4, GEAR_PLATE_Z[0] + 4],
      [GEAR_PLATE.x + GEAR_PLATE.w - 4, GEAR_PLATE_Z[0] + 4],
      [GEAR_PLATE.x + GEAR_PLATE.w - 4, GEAR_PLATE_Z[1] - 4],
      [GEAR_PLATE.x + 4, GEAR_PLATE_Z[1] - 4],
    ],
    GEAR_PLATE.y + GEAR_PLATE.d,
    P,
    true,
  ),
  screws: dots(
    [
      [GEAR_PLATE.x + 8, GEAR_PLATE_Z[0] + 8],
      [GEAR_PLATE.x + GEAR_PLATE.w - 8, GEAR_PLATE_Z[0] + 8],
      [GEAR_PLATE.x + 8, GEAR_PLATE_Z[1] - 8],
      [GEAR_PLATE.x + GEAR_PLATE.w - 8, GEAR_PLATE_Z[1] - 8],
    ].map(([x, z]) => [x, GEAR_PLATE.y + GEAR_PLATE.d, z] as Point3),
  ),
};

const CAL_FRONT = WALL_FACE + 2.2;
const CAL_PLAN: Plan = { x: CAL.x, y: WALL_FACE, w: CAL.w, d: 2.2, r: 3 };
const [CAL0X, CAL0Z] = calendarCell(1);

function calendarCells() {
  const cells: string[] = [];
  const h = CAL.cell / 2;
  for (let week = 1; week <= CAL.cols * CAL.rows; week++) {
    const [x, z] = calendarCell(week);
    cells.push(faceLine([[x - h, z - h], [x + h, z - h], [x + h, z + h], [x - h, z + h]], CAL_FRONT, P, true));
  }
  return cells.join("");
}

export const CAL_ART = {
  plate: solid(CAL_PLAN, CAL.z, CAL.h, 5, 0.4),
  groove: faceLine([[CAL.x + 3, CAL.z + 3], [CAL.x + CAL.w - 3, CAL.z + 3], [CAL.x + CAL.w - 3, CAL.z + CAL.h - 3], [CAL.x + 3, CAL.z + CAL.h - 3]], CAL_FRONT, P, true),
  cells: calendarCells(),
  rules: faceLine([[CAL.x + 8, CAL.z + CAL.h - 5.6], [CAL.x + 62, CAL.z + CAL.h - 5.6]], CAL_FRONT, P),
  screws: dots([[CAL.x + 6, CAL.z + 6], [CAL.x + CAL.w - 6, CAL.z + 6], [CAL.x + 6, CAL.z + CAL.h - 6], [CAL.x + CAL.w - 6, CAL.z + CAL.h - 6]].map(([x, z]) => [x, CAL_FRONT, z] as Point3)),
  marker: solid({ x: CAL0X - CAL.cell / 2 - 0.8, y: CAL_FRONT, w: CAL.cell + 1.6, d: 1.4, r: 0.5 }, CAL0Z - CAL.cell / 2 - 0.8, CAL.cell + 1.6, 2, 0.2),
};

// ------------------------------------------------------------------------------------------------ counter (front right)

const WIN_Y = COUNTER_FRONT;
const winCorner = (x: number, z: number) => at([x, WIN_Y, z]);
const BEZEL = 2.2;
const BOX = (x: number, w: number, z: number, h: number, y = COUNTER.y, d = COUNTER.d, r = 0.8) => solid({ x, y, w, d, r }, z, h, 3, 0.3);
const WINDOW_PATH = pathOf([winCorner(WINDOW.x0, WINDOW.z0), winCorner(WINDOW.x1, WINDOW.z0), winCorner(WINDOW.x1, WINDOW.z1), winCorner(WINDOW.x0, WINDOW.z1)], true);

export const COUNTER_ART = {
  halo: solid(COUNTER, 0, 4).fill,
  /** Behind the wheels: the floor of the box, its back panel and the left pillar the first wheel rests on. */
  low: solid(COUNTER, 0, BODY_LOW, 5, 0.6),
  back: BOX(WINDOW.x0, WINDOW.x1 - WINDOW.x0, BODY_LOW, BODY_HIGH - BODY_LOW, COUNTER.y, 1.6),
  left: BOX(COUNTER.x, WINDOW.x0 - COUNTER.x, BODY_LOW, BODY_HIGH - BODY_LOW),
  /** In front of the wheels. */
  right: BOX(WINDOW.x1, COUNTER.x + COUNTER.w - WINDOW.x1, BODY_LOW, BODY_HIGH - BODY_LOW),
  lipLow: BOX(WINDOW.x0, WINDOW.x1 - WINDOW.x0, BODY_LOW, WINDOW.z0 - BODY_LOW, COUNTER_FRONT - LIP, LIP, 0.3),
  lipHigh: BOX(WINDOW.x0, WINDOW.x1 - WINDOW.x0, WINDOW.z1, BODY_HIGH - WINDOW.z1, COUNTER_FRONT - LIP, LIP, 0.3),
  top: solid(COUNTER, BODY_HIGH, COUNTER_H - BODY_HIGH, 5, 0.6),
  topInset: planOutline(insetPlan(COUNTER, 4.4), COUNTER_H, P),
  topScrews: dots(corners(COUNTER, 8).map(([x, y]) => [x, y, COUNTER_H] as Point3)),
  topVent: join([0, 1, 2, 3, 4].map((col) => planOutline({ x: COUNTER.x + 18 + col * 13, y: COUNTER.y + 11, w: 2.6, d: 12, r: 1.3 }, COUNTER_H, P, 3))),
  /** The opening, in the plane of the counter front: digits are clipped by it, and the recess behind the wheels is drawn in it. */
  clip: WINDOW_PATH,
  recess: WINDOW_PATH,
  wheels: WHEEL_X.map((x) => ({ body: discX(WHEEL.axisY, WHEEL.axisZ, x - WHEEL.w / 2, x + WHEEL.w / 2, WHEEL.r, { steps: 64 }) })),
  axles: [0, 1, 2].map((gap) => discX(WHEEL.axisY, WHEEL.axisZ, WHEEL_X[gap]! + WHEEL.w / 2, WHEEL_X[gap + 1]! - WHEEL.w / 2, 2, { steps: 14 })),
  bezel: [
    solid({ x: WINDOW.x0, y: WIN_Y, w: WINDOW.x1 - WINDOW.x0, d: 1.4, r: 0.3 }, WINDOW.z0 - BEZEL, BEZEL, 2, 0.2),
    solid({ x: WINDOW.x0, y: WIN_Y, w: WINDOW.x1 - WINDOW.x0, d: 1.4, r: 0.3 }, WINDOW.z1, BEZEL, 2, 0.2),
    solid({ x: WINDOW.x0 - BEZEL, y: WIN_Y, w: BEZEL, d: 1.4, r: 0.3 }, WINDOW.z0 - BEZEL, WINDOW.z1 - WINDOW.z0 + BEZEL * 2, 2, 0.2),
    solid({ x: WINDOW.x1, y: WIN_Y, w: BEZEL, d: 1.4, r: 0.3 }, WINDOW.z0 - BEZEL, WINDOW.z1 - WINDOW.z0 + BEZEL * 2, 2, 0.2),
  ],
  dotPoint: dots([[DOT_X, WIN_Y - 1.6, WHEEL.axisZ - 8.4]]),
  dividers: join(
    [(WHEEL_X[0]! + WHEEL_X[1]!) / 2, DOT_X - 5.2, DOT_X + 5.2, (WHEEL_X[2]! + WHEEL_X[3]!) / 2].map((x) => seg([x, WIN_Y - 1.4, WINDOW.z0], [x, WIN_Y - 1.4, WINDOW.z1])),
  ),
  plate: solid({ x: COUNTER.x + 10, y: WIN_Y, w: COUNTER.w - 20, d: 0.8, r: 0.4 }, 2.2, 5, 2, 0.1),
  plateRule: join([0, 1].map((row) => seg([COUNTER.x + 17, WIN_Y + 0.8, 3.4 + row * 2.2], [COUNTER.x + (row ? 50 : 66), WIN_Y + 0.8, 3.4 + row * 2.2]))),
  plateScrews: dots([[COUNTER.x + 13.6, WIN_Y + 0.8, 4.7], [COUNTER.x + COUNTER.w - 13.6, WIN_Y + 0.8, 4.7]]),
  slotOutline: (() => {
    const x = COUNTER.x + COUNTER.w;
    return pathOf([at([x, CAM.y - 2.2, 11.2]), at([x, CAM.y + 2.2, 11.2]), at([x, CAM.y + 2.2, 14.6]), at([x, CAM.y - 2.2, 14.6])], true);
  })(),
  sideScrews: dots([[COUNTER.x + COUNTER.w, CAM.y - 9, 14], [COUNTER.x + COUNTER.w, CAM.y + 9, 14], [COUNTER.x + COUNTER.w, CAM.y - 9, COUNTER_H - 6], [COUNTER.x + COUNTER.w, CAM.y + 9, COUNTER_H - 6]]),
};

// ------------------------------------------------------------------------------------------------ price ladder and its ₱65.00 index

const LADDER_FRONT = LADDER.y + LADDER.d;
const INDEX_Z = ladderZ(INDEX_PHP);
const BEAD: Plan = { x: LADDER.x - 1.2, y: LADDER_FRONT, w: LADDER.w + 2.4, d: 2.8, r: 0.6 };

export const LADDER_ART = {
  foot: solid({ x: LADDER.x - 3, y: LADDER.y - 2, w: LADDER.w + 6, d: LADDER.d + 4, r: 1.6 }, 0, 3, 3, 0.4),
  footScrews: dots([[LADDER.x - 0.6, LADDER.y + 3, 3], [LADDER.x + LADDER.w + 0.6, LADDER.y + 3, 3]]),
  strip: solid(LADDER, 3, LADDER_Z[1] - 3 + 2, 2, 0.3),
  base: seg([LADDER.x + LADDER.w, LADDER_FRONT, LADDER_Z[0]], [LADDER.x + LADDER.w, LADDER_FRONT, LADDER_Z[1]]),
  ticks: (() => {
    const minor: string[] = [];
    const major: string[] = [];
    for (let php = LADDER_PHP[0]; php <= LADDER_PHP[1]; php += 5) {
      const big = php % 10 === 0;
      const z = ladderZ(php);
      (big ? major : minor).push(seg([LADDER.x + LADDER.w, LADDER_FRONT, z], [LADDER.x + LADDER.w - (big ? 5.2 : 3), LADDER_FRONT, z]));
    }
    return { minor: join(minor), major: join(major) };
  })(),
  cap: solid({ x: LADDER.x - 1, y: LADDER.y - 1, w: LADDER.w + 2, d: LADDER.d + 2, r: 1.2 }, LADDER_Z[1] + 2, 2, 3, 0.3),
  flag: solid({ x: LADDER.x + LADDER.w, y: LADDER_FRONT - 3.4, w: 15, d: 3.4, r: 0.6 }, INDEX_Z - 1.2, 7.4, 2, 0.3),
  flagLine: seg([LADDER.x, LADDER_FRONT, INDEX_Z], [LADDER.x + LADDER.w + 15, LADDER_FRONT, INDEX_Z]),
  flagLabel: sideMatrix([LADDER.x + LADDER.w + 7.5, LADDER_FRONT], INDEX_Z + 2.4, P, "left"),
  flagScrews: dots([[LADDER.x + LADDER.w + 12.6, LADDER_FRONT, INDEX_Z + 5.2]]),
  bead: solid(BEAD, ladderZ(OPENING_PUMP) - 2.4, 4.8, 3, 0.4),
  beadLine: seg([BEAD.x, BEAD.y + BEAD.d, ladderZ(OPENING_PUMP)], [BEAD.x + BEAD.w, BEAD.y + BEAD.d, ladderZ(OPENING_PUMP)]),
};


// ------------------------------------------------------------------------------------------------ calendar cam (front right) and its follower

const FOLLOWER_X0 = CAM.x - CAM.r - FOLLOWER_R;
const CAM_PLATE: Plan = { x: CAM.x - 30, y: CAM.y - 30, w: 60, d: 60, r: 6 };

export const CAM_ART = {
  halo: solid(CAM_PLATE, 0, CAM.z).fill,
  plate: solid(CAM_PLATE, 0, CAM.z, 6, 0.8),
  plateGroove: planOutline(insetPlan(CAM_PLATE, 3.4), CAM.z, P),
  plateScrews: dots(corners(CAM_PLATE, 6).map(([x, y]) => [x, y, CAM.z] as Point3)),
  hub: cyl(CAM.x, CAM.y, 6.2, CAM.z + CAM.h, 5, 28, 0.4),
  hubKnurl: knurl(CAM.x, CAM.y, 6.2, CAM.z + CAM.h, CAM.z + CAM.h + 5, 24, P, 0.3),
  hubRing: ring(CAM.x, CAM.y, 3.6, CAM.z + CAM.h + 5, P, 18),
  dayRing: ring(CAM.x, CAM.y, CAM.r - 6.4, CAM.z + CAM.h, P, 44),
  hubSlot: onTop([[CAM.x - 3.6, CAM.y], [CAM.x + 3.6, CAM.y]], CAM.z + CAM.h + 5, P),
  guide: [
    solid({ x: CAM_PLATE.x, y: CAM.y - 6.4, w: FOLLOWER_X0 + 1.5 - CAM_PLATE.x, d: 2.2, r: 0.5 }, CAM.z, 8.4, 2, 0.2),
    solid({ x: CAM_PLATE.x, y: CAM.y + 4.2, w: FOLLOWER_X0 + 1.5 - CAM_PLATE.x, d: 2.2, r: 0.5 }, CAM.z, 8.4, 2, 0.2),
  ],
  /** Block the follower rod rides on, from the counter wall to the cam plate. */
  bed: solid({ x: COUNTER.x + COUNTER.w, y: CAM.y - 3.2, w: CAM_PLATE.x - (COUNTER.x + COUNTER.w), d: 6.4, r: 0.8 }, 0, CAM.z + CAM.h, 3, 0.3),
  bedLine: onTop([[COUNTER.x + COUNTER.w + 1, CAM.y], [CAM_PLATE.x - 1, CAM.y]], CAM.z + CAM.h, P),
  /** The follower: roller on the cam rim, and the rod that carries the pin to the counter. */
  roller: cyl(FOLLOWER_X0, CAM.y, FOLLOWER_R, CAM.z, CAM.h, 18, 0.2),
  rollerRing: ring(FOLLOWER_X0, CAM.y, 1.2, CAM.z + CAM.h, P, 10),
  rod: solid({ x: COUNTER.x + COUNTER.w, y: CAM.y - 1.8, w: FOLLOWER_X0 - (COUNTER.x + COUNTER.w), d: 3.6, r: 0.8 }, CAM.z + CAM.h, 3.4, 2, 0.2),
  rodLine: onTop([[COUNTER.x + COUNTER.w, CAM.y], [FOLLOWER_X0, CAM.y]], CAM.z + CAM.h + 3.4, P),
};
/** Where the follower roller sits against the full-radius cam (it moves +x as the notch passes). */
export const FOLLOWER_X_REST = FOLLOWER_X0;
