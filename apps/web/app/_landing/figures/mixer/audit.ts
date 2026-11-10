/*
 * The mixer's audit. Records the true shape of every drawn solid at the opening pose, in the painter's order that
 * live.tsx uses (one key per item, in paint order), and runs the kit's own checks on it: nothing sunk into anything,
 * every solid held by the bench, and wherever two solids overlap on screen the later-painted one is the nearer.
 *
 *   pnpm --filter server exec tsx apps/web/app/_landing/figures/mixer/audit.ts
 *
 * Poses: the opening benchmark, and the extremes of the benchmark range for the lever, carriage, arm and rack. Those are
 * checked by re-recording the figure at each pose (the kinematics in model.ts are pure), not by an explode spring.
 */
import * as A from "../../iso/audit.mjs";
import * as G from "../../iso/lathe.mjs";
import type { Plan } from "../../iso/iso-kit";
import {
  ARM_HALF,
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
  DRUM,
  FLOAT_H,
  FLOAT_R,
  FOLLOWER_R,
  GUIDE_Y,
  GUIDE_Z,
  LADDER,
  LADDER_PHP,
  LADDER_Z,
  LEVER_LENGTH,
  LEVER_THICK,
  LIP,
  LINK_Z,
  PALLET,
  POST,
  STEM_R,
  TUBE,
  WEEK_RULE,
  WEIGHT_PLATE_PLAN,
  WHEEL,
  WHEEL_X,
  WINDOW,
  floatZ,
  ladderZ,
} from "./layout";
import {
  CRUDE_RANGE,
  EXCISE_H,
  FX_RANGE,
  GEAR_A,
  GEAR_B,
  INDEX_PHP,
  MARGIN_H,
  MODULE,
  POST_TOP,
  TEETH,
  TOWER_H,
  XH,
  ZH,
  kin,
  pointerAngleOf,
  type Kin,
} from "./model";
import { barPolygon, gearPolygon } from "./plate";
import { BASE, BASE_H, BEAM_Y, CARRIAGE_Y, FOOT_H, LEVER_Y, MESH_Y, P, RACK_Y, WALL, WALL_FACE, WALL_H } from "./view";
import { RACK_LOCAL, RACK_YP, WX, WY, XC0, dialRack } from "./geometry";
const TOWER_HALF = 22;

type Flat = [number, number];
interface Meta {
  owner?: string;
  ground?: boolean;
}

const Y_AXIS = (x: number, y: number, z: number) => G.frameOf([x, y, z], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
const X_AXIS = (x: number, y: number, z: number) => G.frameOf([x, y, z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
/** The x–z plane extruded along y: polygon points are [x, z]. */
const PLANE = G.frameOf([0, 0, 0], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
const prismXZ = (polygon: Flat[], y0: number, y1: number, name: string) => A.prism(PLANE, polygon, y0, y1, { name });
const shifted = (polygon: Flat[], [dx, dz]: Flat): Flat[] => polygon.map(([x, z]) => [x + dx, z + dz]);

interface Recorder {
  items: { name: string }[];
  solids: object[];
  put(entry: { name: string; key: number; shapes: object[] }): void;
  solid<T extends object>(shape: T): T;
}

function record(pose: Kin) {
  const R = A.recorder(P, {}) as unknown as Recorder;
  let key = 0;
  const put = (name: string, shape: object, owner = name) => {
    (shape as Meta).owner = owner;
    R.put({ name, key: key++, shapes: [R.solid(shape)] });
  };
  const slab = (name: string, plan: Plan, z: number, h: number, owner?: string) => put(name, A.slab(plan, z, h, { name }), owner);
  const cyl = (name: string, x: number, y: number, r: number, z: number, h: number, owner?: string) => put(name, A.cylinder(x, y, r, z, h, { name }), owner);
  const discY = (name: string, x: number, z: number, y0: number, y1: number, r: number, owner?: string) => put(name, A.disc(Y_AXIS(x, y0, z), 0, y1 - y0, r, { name }), owner);
  const discX = (name: string, y: number, z: number, x0: number, x1: number, r: number, owner?: string) => put(name, A.disc(X_AXIS(x0, y, z), 0, x1 - x0, r, { name }), owner);
  const plane = (name: string, polygon: Flat[], y0: number, y1: number, owner?: string) => put(name, prismXZ(polygon, y0, y1, name), owner);
  const ground = (name: string, shape: object) => {
    (shape as Meta).ground = true;
    put(name, shape);
  };

  const { carriage, beamL, beamR, beamM, pusher } = pose;
  const [XC, PZ] = carriage;
  const dx = XC - XC0;
  const plateX = GEAR_A[0] - 36;
  const plateFront = WALL_FACE + 1.8;

  // ---- paint order, back to front (the same order live.tsx puts the groups in)
  for (const [x, y] of [
    [BASE.x + 24, BASE.y + 24],
    [BASE.x + BASE.w - 24, BASE.y + 24],
    [BASE.x + 24, BASE.y + BASE.d - 24],
    [BASE.x + BASE.w - 24, BASE.y + BASE.d - 24],
  ] as Flat[]) ground(`stand.foot@${Math.round(x)},${Math.round(y)}`, A.cylinder(x, y, 6.2, -BASE_H - FOOT_H, FOOT_H, { name: "stand.foot" }));
  ground("stand.base", A.slab(BASE, -BASE_H, BASE_H, { name: "stand.base" }));
  slab("week.strip", WEEK_RULE, 0, 1.4);
  ground("stand.wall", A.slab(WALL, 0, WALL_H, { name: "stand.wall" }));
  slab("wall.rail", { x: WALL.x - 5, y: WALL.y - 3, w: WALL.w + 10, d: WALL.d + 6, r: 2 }, WALL_H, 5);
  slab("plate.gear", { x: plateX, y: WALL_FACE, w: GEAR_B[0] + 54 - plateX, d: 1.8, r: 5 }, 84, 82);
  discY("axle.a.standoff", GEAR_A[0], GEAR_A[1], plateFront, MESH_Y[0], 3.4, "axle.a");
  discY("axle.b.standoff", GEAR_B[0], GEAR_B[1], plateFront, MESH_Y[0], 3.4, "axle.b");
  slab("plate.calendar", { x: CAL.x, y: WALL_FACE, w: CAL.w, d: 2.2, r: 3 }, CAL.z, CAL.h);
  const sector = (r0: number, r1: number, s0: number, s1: number): Flat[] => {
    const out: Flat[] = [];
    for (let s = 0; s <= 48; s++) out.push([GEAR_B[0] + r1 * Math.cos(s0 + ((s1 - s0) * s) / 48), GEAR_B[1] + r1 * Math.sin(s0 + ((s1 - s0) * s) / 48)]);
    for (let s = 48; s >= 0; s--) out.push([GEAR_B[0] + r0 * Math.cos(s0 + ((s1 - s0) * s) / 48), GEAR_B[1] + r0 * Math.sin(s0 + ((s1 - s0) * s) / 48)]);
    return out;
  };
  for (const php of [LADDER_PHP[0] + 3, INDEX_PHP, LADDER_PHP[1] - 3]) {
    const at: Flat = [GEAR_B[0] + 32.5 * Math.cos(pointerAngleOf(php)), GEAR_B[1] + 32.5 * Math.sin(pointerAngleOf(php))];
    discY(`arc.standoff@${php}`, at[0], at[1], plateFront, MESH_Y[0], 2.2, "arc");
  }
  plane("arc.strip", sector(29, 36, pointerAngleOf(LADDER_PHP[0]) - 0.1, pointerAngleOf(LADDER_PHP[1]) + 0.1), MESH_Y[0], MESH_Y[1] - 1.6, "arc");

  slab("hinge.foot", { x: XH - 17, y: LEVER_Y[0] - 4, w: 34, d: 17, r: 2 }, 0, 2.4);
  slab("hinge.back", { x: XH - 8, y: LEVER_Y[0] - 3.4, w: 16, d: 3.4, r: 1 }, 2.4, ZH + 10 - 2.4, "hinge");
  const u: Flat = [-Math.cos(pose.tilt), Math.sin(pose.tilt)];
  const along = (s: number): Flat => [XH + u[0] * s, ZH + u[1] * s];
  plane("lever", barPolygon([XH, ZH], along(LEVER_LENGTH), LEVER_THICK, [true, false], 8), LEVER_Y[0], LEVER_Y[1]);
  slab("hinge.front", { x: XH - 8, y: LEVER_Y[1], w: 16, d: 3.4, r: 1 }, 2.4, ZH + 10 - 2.4, "hinge");
  discY("hinge.pin", XH, ZH, LEVER_Y[1] + 3.4, LEVER_Y[1] + 4.6, 3.2, "hinge");

  put("gear.a", prismXZ(shifted(gearPolygon(TEETH.a, MODULE, pose.pinion), GEAR_A), MESH_Y[0], MESH_Y[1], "gear.a"), "axle.a");
  put("gear.b", prismXZ(shifted(gearPolygon(TEETH.b, MODULE, pose.gearB + Math.PI - Math.PI / TEETH.b), GEAR_B), MESH_Y[0], MESH_Y[1], "gear.b"), "axle.b");

  slab("dial.plate", DIAL_PLATE, 0, 4);
  slab("dial.runner.a", { x: XC0 - 18, y: -52, w: 36, d: 6, r: 1 }, 0, LINK_Z[0]);
  slab("dial.runner.b", { x: XC0 - 18, y: -20, w: 36, d: 6, r: 1 }, 0, LINK_Z[0]);
  for (const at of [22, 46]) slab(`dial.bearing@${at}`, { x: XC0 + at, y: RACK_YP - 11.7, w: 8, d: 2.2, r: 0.5 }, DIAL_Z[0], 6.2);
  slab("link", { x: XC - 3, y: GUIDE_Y - 3, w: 6, d: RACK_YP - 9.5 - (GUIDE_Y - 3), r: 1.4 }, LINK_Z[0], LINK_Z[1] - LINK_Z[0], "link");
  put("dial.rack", A.extruded(dialRack().map(([x, y]) => [x + dx, y]), LINK_Z[0], LINK_Z[1] - LINK_Z[0], { name: "dial.rack" }), "link");
  cyl("link.foot", XC, GUIDE_Y, 4.6, LINK_Z[1], 2.6, "link");
  put("dial.wheel", A.extruded(gearPolygon(DIAL_WHEEL.teeth, DIAL_WHEEL.module, -Math.PI / 2 + dx / DIAL_R).map(([x, y]) => [x + WX, y + WY]), DIAL_Z[0], DIAL_Z[1] - DIAL_Z[0], { name: "dial.wheel" }), "wheel");
  cyl("dial.knob", WX, WY, 4.6, DIAL_Z[1], 5.4, "wheel");
  cyl("dial.post", WX, WY + DIAL_R + 11.4, 2.7, 0, 9, "finger");
  cyl("dial.post.cap", WX, WY + DIAL_R + 11.4, 3.7, 9, 2, "finger");
  slab("dial.finger", { x: WX - 1.3, y: WY + 12.6, w: 2.6, d: DIAL_R + 11.4 - 12.6, r: 0.8 }, 11, 1.8, "finger");

  const SHOE_Y0 = LEVER_Y[1];
  slab("shoe.back", { x: XC - 4.3, y: SHOE_Y0, w: 8.6, d: 1.2, r: 0.5 }, PZ - 6, 12, "carriage");
  slab("shoe.left", { x: XC - 4.3, y: SHOE_Y0 + 1.2, w: 1.9, d: CARRIAGE_Y[0] - SHOE_Y0 - 1.2, r: 0.5 }, PZ - 6, 12, "carriage");
  cyl("guide.rod", XC, GUIDE_Y, 2.4, GUIDE_Z[0], GUIDE_Z[1] - GUIDE_Z[0], "guide");
  cyl("guide.cap", XC, GUIDE_Y, 3.4, GUIDE_Z[1], 2.4, "guide");

  plane("rack", shifted(RACK_LOCAL, [0, beamM[1]]), RACK_Y[0], RACK_Y[1], "rack");
  put("pinion", prismXZ(shifted(gearPolygon(TEETH.pinion, MODULE, pose.pinion + Math.PI), GEAR_A), RACK_Y[0], RACK_Y[1], "pinion"), "axle.a");
  discY("axle.a.head", GEAR_A[0], GEAR_A[1], RACK_Y[1], RACK_Y[1] + 2.2, 4.6, "axle.a");
  const tip: Flat = [GEAR_B[0] + 33.6 * Math.cos(pose.pointer), GEAR_B[1] + 33.6 * Math.sin(pose.pointer)];
  const tail: Flat = [GEAR_B[0] - 8 * Math.cos(pose.pointer), GEAR_B[1] - 8 * Math.sin(pose.pointer)];
  plane("pointer", barPolygon(tail, tip, 2.2, [true, false], 6), MESH_Y[1], MESH_Y[1] + 1.8, "axle.b");
  discY("axle.b.head", GEAR_B[0], GEAR_B[1], MESH_Y[1] + 1.8, MESH_Y[1] + 4, 4.6, "axle.b");

  slab("shoe.right", { x: XC + 2.4, y: SHOE_Y0 + 1.2, w: 1.9, d: CARRIAGE_Y[0] - SHOE_Y0 - 1.2, r: 0.5 }, PZ - 6, 12, "carriage");
  slab("carriage.body", { x: XC - 11, y: CARRIAGE_Y[0], w: 22, d: CARRIAGE_Y[1] - CARRIAGE_Y[0], r: 1.6 }, PZ - 9, 18, "carriage");
  slab("carriage.column", { x: XC - 4, y: CARRIAGE_Y[0] + 1, w: 8, d: CARRIAGE_Y[1] - CARRIAGE_Y[0] - 2, r: 1 }, PZ + 9, 7, "carriage");
  slab("carriage.tower", { x: XC - TOWER_HALF, y: CARRIAGE_Y[0] + 1, w: TOWER_HALF * 2, d: CARRIAGE_Y[1] - CARRIAGE_Y[0] - 2, r: 1.8 }, PZ + TOWER_H - 6, 12, "carriage");

  slab("weights.foot", { x: POST.x - 7, y: POST.y - 3, w: POST.w + 14, d: POST.d + 5, r: 2 }, 0, 2.4, "weights");
  slab("weights.post", POST, 2.4, POST_TOP - 2.4, "weights");
  slab("weights.margin", { x: POST.x - 4.5, y: POST.y - 0.8, w: POST.w + 9, d: POST.d + 0.8, r: 1.2 }, POST_TOP, MARGIN_H, "weights");
  slab("weights.excise", { x: POST.x - 3, y: POST.y - 0.8, w: POST.w + 6, d: POST.d + 0.8, r: 1.2 }, POST_TOP + MARGIN_H, EXCISE_H, "weights");
  slab("weights.bracket", { ...WEIGHT_PLATE_PLAN, y: CARRIAGE_Y[0] + 1, d: CARRIAGE_Y[1] - CARRIAGE_Y[0] - 2 }, POST_TOP + MARGIN_H + EXCISE_H, 6, "weights");
  const length = Math.hypot(beamR[0] - beamL[0], beamR[1] - beamL[1]);
  const ux = (beamR[0] - beamL[0]) / length;
  const uz = (beamR[1] - beamL[1]) / length;
  plane("beam", barPolygon([beamL[0] - ux * 14, beamL[1] - uz * 14], [beamR[0] + ux * 14, beamR[1] + uz * 14], 5.2, [true, true], 7), BEAM_Y[0], BEAM_Y[1]);

  slab("drum.pallet", PALLET, 0, DRUM.z);
  cyl("drum.body", DRUM.x, DRUM.y, DRUM.r, DRUM.z, DRUM.h, "drum");
  const gx0 = TUBE.x - TUBE.gap - TUBE.rail;
  const gx1 = TUBE.x + TUBE.gap;
  const armZ = pusher[1] - ARM_HALF;
  const backEnd = TUBE.y - TUBE.half;
  const front = TUBE.y + TUBE.half;
  slab("arm.rear", { x: TUBE.x - ARM_HALF, y: LEVER_Y[1], w: ARM_HALF * 2, d: backEnd - LEVER_Y[1], r: 0.8 }, armZ, ARM_HALF * 2, "arm");
  slab("gauge.foot", { x: gx0, y: backEnd, w: TUBE.rail * 2 + TUBE.gap * 2, d: TUBE.half * 2, r: 0.3 }, 0, TUBE.z);
  slab("gauge.left", { x: gx0, y: backEnd, w: TUBE.rail, d: TUBE.half * 2, r: 0.8 }, TUBE.z, TUBE.h);
  slab("gauge.left.top", { x: gx0 - 0.8, y: backEnd - 0.8, w: TUBE.rail + 1.6, d: TUBE.half * 2 + 1.6, r: 0.8 }, TUBE.z + TUBE.h, 1.6);
  const floatZ0 = floatZ(pose.crude);
  cyl("float", TUBE.x, TUBE.y, FLOAT_R, floatZ0 - FLOAT_H / 2, FLOAT_H, "arm");
  cyl("stem", TUBE.x, TUBE.y, STEM_R, floatZ0 + FLOAT_H / 2, armZ - (floatZ0 + FLOAT_H / 2), "arm");
  slab("arm.mid", { x: TUBE.x - ARM_HALF, y: backEnd, w: ARM_HALF * 2, d: front - backEnd - 1, r: 0.8 }, armZ, ARM_HALF * 2, "arm");
  slab("gauge.right", { x: gx1, y: backEnd, w: TUBE.rail, d: TUBE.half * 2, r: 0.8 }, TUBE.z, TUBE.h);
  slab("gauge.right.top", { x: gx1 - 0.8, y: backEnd - 0.8, w: TUBE.rail + 1.6, d: TUBE.half * 2 + 1.6, r: 0.8 }, TUBE.z + TUBE.h, 1.6);

  slab("ladder.foot", { x: LADDER.x - 3, y: LADDER.y - 2, w: LADDER.w + 6, d: LADDER.d + 4, r: 1.6 }, 0, 3);
  slab("ladder.strip", LADDER, 3, LADDER_Z[1] - 3 + 2, "ladder");
  slab("ladder.cap", { x: LADDER.x - 1, y: LADDER.y - 1, w: LADDER.w + 2, d: LADDER.d + 2, r: 1.2 }, LADDER_Z[1] + 2, 2, "ladder");
  slab("ladder.flag", { x: LADDER.x + LADDER.w, y: LADDER.y + LADDER.d - 3.4, w: 15, d: 3.4, r: 0.6 }, ladderZ(INDEX_PHP) - 1.2, 7.4, "ladder");

  slab("counter.low", COUNTER, 0, BODY_LOW);
  slab("counter.back", { x: WINDOW.x0, y: COUNTER.y, w: WINDOW.x1 - WINDOW.x0, d: 1.6, r: 0.8 }, BODY_LOW, BODY_HIGH - BODY_LOW, "counter");
  slab("counter.left", { x: COUNTER.x, y: COUNTER.y, w: WINDOW.x0 - COUNTER.x, d: COUNTER.d, r: 0.8 }, BODY_LOW, BODY_HIGH - BODY_LOW, "counter");
  WHEEL_X.forEach((x, index) => {
    discX(`counter.wheel@${x}`, WHEEL.axisY, WHEEL.axisZ, x - WHEEL.w / 2, x + WHEEL.w / 2, WHEEL.r, "counter");
    if (index < 3) discX(`counter.axle@${index}`, WHEEL.axisY, WHEEL.axisZ, x + WHEEL.w / 2, WHEEL_X[index + 1]! - WHEEL.w / 2, 2, "counter");
  });
  slab("counter.lip.low", { x: WINDOW.x0, y: COUNTER_FRONT - LIP, w: WINDOW.x1 - WINDOW.x0, d: LIP, r: 0.3 }, BODY_LOW, WINDOW.z0 - BODY_LOW, "counter");
  slab("counter.lip.high", { x: WINDOW.x0, y: COUNTER_FRONT - LIP, w: WINDOW.x1 - WINDOW.x0, d: LIP, r: 0.3 }, WINDOW.z1, BODY_HIGH - WINDOW.z1, "counter");
  slab("counter.right", { x: WINDOW.x1, y: COUNTER.y, w: COUNTER.x + COUNTER.w - WINDOW.x1, d: COUNTER.d, r: 0.8 }, BODY_LOW, BODY_HIGH - BODY_LOW, "counter");
  slab("counter.top", COUNTER, BODY_HIGH, COUNTER_H - BODY_HIGH);

  const followerX = CAM.x - CAM.r - FOLLOWER_R;
  const plateEdge = CAM.x - 30;
  slab("cam.bed", { x: COUNTER.x + COUNTER.w, y: CAM.y - 3.2, w: plateEdge - (COUNTER.x + COUNTER.w), d: 6.4, r: 0.8 }, 0, CAM.z + CAM.h);
  slab("cam.plate", { x: plateEdge, y: CAM.y - 30, w: 60, d: 60, r: 6 }, 0, CAM.z);
  slab("cam.guide.a", { x: plateEdge, y: CAM.y - 6.4, w: followerX + 1.5 - plateEdge, d: 2.2, r: 0.5 }, CAM.z, 8.4);
  cyl("follower.roller", followerX, CAM.y, FOLLOWER_R, CAM.z, CAM.h, "follower");
  slab("follower.rod", { x: COUNTER.x + COUNTER.w, y: CAM.y - 1.8, w: followerX - (COUNTER.x + COUNTER.w), d: 3.6, r: 0.8 }, CAM.z + CAM.h, 3.4, "follower");
  cyl("cam", CAM.x, CAM.y, CAM.r, CAM.z, CAM.h);
  cyl("cam.hub", CAM.x, CAM.y, 6.2, CAM.z + CAM.h, 5);
  slab("cam.guide.b", { x: plateEdge, y: CAM.y + 4.2, w: followerX + 1.5 - plateEdge, d: 2.2, r: 0.5 }, CAM.z, 8.4);
  return R;
}

/**
 * Teeth that mesh interleave in one plane, so each gear is nearer than the other somewhere: a true interlock that no painter's
 * order can resolve. Drawn in the order that leaves the least wrong (under 3 px² at 1×, looked at in a 4× close-up).
 */
const MESHES: [string, string][] = [
  ["gear.a", "gear.b"],
  ["rack", "pinion"],
  ["dial.rack", "dial.wheel"],
];

function run(label: string, pose: Kin) {
  const R = record(pose);
  const overlaps = A.overlapsOf(R.items, P, { states: [0] });
  const result = {
    depth: A.depthOrder(R.items, P, { overlaps, rest: [0], allow: MESHES }),
    supports: A.supports(R.solids, [], { ground: A.grounded }),
  };
  const problems = result.depth.problems.length + result.supports.loose.length + result.supports.sunk.length;
  console.log(`\n== ${label}: ${R.items.length} items, ${R.solids.length} solids, ${overlaps.pairs.length} overlapping pairs`);
  console.log(`depth order: ${result.depth.problems.length} problems`);
  for (const p of result.depth.problems.slice(0, 40)) console.log(`  ${p.front} drawn under ${p.back}  area ${p.area.toFixed?.(2) ?? p.area}`);
  console.log(`support: ${result.supports.loose.length} unsupported solids · ${result.supports.sunk.length} sunk pairs`);
  for (const p of result.supports.loose.slice(0, 40)) console.log(`  loose ${typeof p === "string" ? p : (p.name ?? JSON.stringify(p))}`);
  for (const p of result.supports.sunk.slice(0, 40)) console.log(`  sunk ${JSON.stringify(p)}`);
  return problems;
}

const poses: [string, Kin][] = [
  ["opening", kin(80, 57.5)],
  ["low crude, strong peso", kin(CRUDE_RANGE[0], FX_RANGE[0])],
  ["high crude, weak peso", kin(CRUDE_RANGE[1], FX_RANGE[1])],
  ["high crude, strong peso", kin(CRUDE_RANGE[1], FX_RANGE[0])],
  ["low crude, weak peso", kin(CRUDE_RANGE[0], FX_RANGE[1])],
];
let total = 0;
for (const [label, pose] of poses) total += run(label, pose);
console.log(total ? `\naudit failed: ${total} problems` : "\naudit passed");
process.exitCode = total ? 1 : 0;
