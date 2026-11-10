import * as k from "../../iso/iso-kit";
import type { Flat, Plan, Plane, Point3 } from "../../iso/iso-kit";
import * as G from "../../iso/lathe.mjs";
import { SLOPE_D, SLOPE_N, WINDOW_H, rollCentre } from "./dyn";
import { dots, halo, line, path, solid, type Part } from "./parts";
import {
  BAR_LIFT,
  BAR_END,
  BAR_S,
  BASE,
  BASE_T,
  BED,
  BED_Z,
  DECK,
  FLANGE,
  GANTRY_H,
  GANTRY_W,
  GANTRY_X,
  GANTRY_Z,
  HEAD,
  LANES,
  LANE_W,
  P,
  PAWL,
  PAPER,
  PAPER_HALF,
  PAPER_TOP,
  PAPER_X0,
  PAPER_X1,
  PAPER_Z,
  PEN_X,
  PX_PER_PHP,
  REEL,
  ROLL_LEN,
  ROLL_Y0,
  SLOPE_DEG,
  SUPPLY,
  TOKEN_R,
  TOKEN_S0,
  TOKEN_T,
  WHEEL,
  WIRE_Z,
} from "./view";

/* ------------------------------------------------------------------------------------------------ helpers */

const RAD = Math.PI / 180;
const sl = (plan: Plan, z: number, h: number, steps = 4, bevel = 0) => k.slabOf(plan, z, h, P, steps, bevel);
const cyl = (cx: number, cy: number, r: number, z: number, h: number, steps = 28, bevel = 0) => k.cylinder(cx, cy, r, z, h, P, steps, bevel);
const seg = (a: Point3, b: Point3) => k.segment(a, b, P);
const join = (paths: string[]) => paths.join("");
const depth = (x: number, y: number) => k.depthOf([x, y, 0], P);
const byDepth = (points: Plane[]) => [...points].sort((a, b) => depth(a[0], a[1]) - depth(b[0], b[1]));
const screwsOf = (plan: Plan, inset: number, z: number): Flat[] => k.corners(plan, inset).map(([x, y]) => k.iso([x, y, z], P));
const rings = (points: Plane[], r: number, z: number) => join(points.map(([x, y]) => k.ring(x, y, r, z, P, 14)));

/** A frame for a part that turns about a horizontal y axis, starting at world point `o`. */
const alongY = (o: Point3) => G.frameAlong(o, [0, 1, 0]);
/** A frame for a vertical axis with angle 0 along +x. */
const alongZ = (o: Point3) => G.frameOf(o, [0, 0, 1], [1, 0, 0], [0, 1, 0]);

/* ------------------------------------------------------------------------------------------------ base */

const FEET: Plane[] = byDepth([-268, 0, 268].flatMap((x) => [-88, 88].map((y): Plane => [x, y])));
const BASE_SCREWS: Plane[] = k.corners(BASE, 9);
const BACK_STRIP: Plan = { x: -186, y: -107, w: 372, d: 7, r: 1 };
const BACK_TICKS = k.topTicks(BACK_STRIP.x + 4, BACK_STRIP.x + BACK_STRIP.w - 4, 4, 5, BACK_STRIP.y, 0.6, [2, 3.6], P);
export const PLATE: Plan = { x: -298, y: 82, w: 66, d: 16, r: 2 };
export const PLATE_TEXT = { transform: k.topMatrix([PLATE.x + 5, PLATE.y + 6.2], 0.8, P) };

export const BASE_PARTS: Part[] = [
  halo(k.haloOf(BASE, -17, 12, P)),
  ...FEET.flatMap(([x, y]): Part[] => [solid(cyl(x, y, 7, -17, 1.6), "lo"), solid(cyl(x, y, 5.4, -15.4, 3.4), "mid")]),
  solid(sl(BASE, -BASE_T, BASE_T, 8, 1.6), "mid", "faint", { inner: k.sideSeam(BASE, -BASE_T / 2, P, 8) }),
  line(k.planOutline(k.insetPlan(BASE, 5), 0, P), "faint"),
  line(rings(BASE_SCREWS, 2.2, 0), "lo"),
  dots(BASE_SCREWS.map(([x, y]) => k.iso([x, y, 0], P)), 0.5, "mid"),
  solid(sl(BACK_STRIP, 0, 0.6, 3), "lo", "none"),
  line(BACK_TICKS.minor, "lo"),
  line(BACK_TICKS.major, "mid"),
  solid(sl(PLATE, 0, 0.8, 4), "lo", "none"),
  line(k.planOutline(k.insetPlan(PLATE, 1.6), 0.8, P), "faint"),
  line(k.lineOnTop([PLATE.x + 5, PLATE.y + 10.4], [PLATE.x + 38, PLATE.y + 10.4], 0.8, P), "lo", { free: true }),
  line(k.lineOnTop([PLATE.x + 5, PLATE.y + 12.6], [PLATE.x + 26, PLATE.y + 12.6], 0.8, P), "lo", { free: true }),
  dots(screwsOf(PLATE, 3.6, 0.8).slice(0, 2).concat(screwsOf(PLATE, 3.6, 0.8).slice(2).map(([x, y]) => [x, y] as Flat)), 0.45, "mid"),
];

/* ------------------------------------------------------------------------------------------------ rolls */

/** Turning decorations on the front face of a roll: spokes and rivets, drawn from a fixed starting angle. */
function wheelFace(centre: Point3, r0: number, r1: number, count: number, rivetsAt: number) {
  const F = G.frameOf(centre, [0, 1, 0], [-1, 0, 0], [0, 0, 1]);
  return {
    spokes: G.spokesOf(F, 0, r0, r1, count, P, { phase: 0.35 }),
    rivets: G.dotsOf(F, 0, rivetsAt, count, P, { phase: 0.35 + Math.PI / count, all: true }) as Flat[],
  };
}

interface RollSpec {
  x: number;
  z: number;
  r: number;
  upright: Plan;
  uprightH: number;
  foot: Plan;
  rings: number[];
  core: number;
  retainer: number;
  knob: number;
  knobLen: number;
}

function rollOf(spec: RollSpec) {
  const origin: Point3 = [spec.x, ROLL_Y0, spec.z];
  const F = alongY(origin);
  const faceS = ROLL_LEN;
  const gap = spec.upright.y + spec.upright.d - ROLL_Y0; // spindle length between upright and roll (negative s)
  const hubS = faceS + 1.4;
  const retS = hubS + 1.7;
  const knobS = retS + spec.knobLen;
  const centreAt = (s: number): Point3 => [spec.x, ROLL_Y0 + s, spec.z];
  const back: Part[] = [
    solid(sl(spec.foot, 0, 2.5, 4, 0.4), "lo"),
    dots(screwsOf(spec.foot, 3, 2.5), 0.45, "mid"),
    solid(sl(spec.upright, 2.5, spec.uprightH - 2.5, 4, 0.5), "mid"),
    line(G.circleOf(G.frameOf([spec.x, spec.upright.y + spec.upright.d, spec.z], [0, 1, 0], [-1, 0, 0], [0, 0, 1]), 0, 4.6, P), "lo"),
    solid(G.disc(gap + 1.6, 0, 2.2, F, P, {}), "mid", "none"),
    solid(G.disc(gap, gap + 1.6, 4, F, P, {}), "mid"),
  ];
  const body: Part[] = [
    solid(G.disc(0, faceS, spec.r, F, P), "mid", "faint"),
    ...spec.rings.map((ring): Part => line(G.circleOf(F, faceS, ring, P), "faint")),
    line(G.circleOf(F, faceS, spec.core, P), "lo"),
  ];
  const hub: Part[] = [
    solid(G.disc(faceS, hubS, spec.core, F, P), "mid"),
    solid(G.disc(hubS, retS, spec.retainer, F, P), "mid"),
    line(G.circleOf(F, retS, spec.retainer - 1.2, P), "faint"),
    solid(G.disc(retS, knobS, spec.knob, F, P), "mid"),
    line(G.circleOf(F, knobS, spec.knob - 0.8, P), "lo"),
  ];
  const face = wheelFace(centreAt(retS), spec.knob, spec.retainer - 0.4, 5, (spec.knob + spec.retainer) / 2);
  return { back, body, hub, turning: { spokes: face.spokes, rivets: face.rivets, centre: rollCentre(spec.x, spec.z) } };
}

export const TAKEUP = rollOf({
  x: REEL.x,
  z: REEL.z,
  r: REEL.r,
  upright: { x: REEL.x - 8, y: -65, w: 16, d: 8, r: 1.8 },
  uprightH: 46,
  foot: { x: REEL.x - 16, y: -70, w: 32, d: 16, r: 2 },
  rings: [10.4, 8.2],
  core: 4.4,
  retainer: 7.6,
  knob: 3.2,
  knobLen: 3.4,
});

export const SUPPLY_ROLL = rollOf({
  x: SUPPLY.x,
  z: SUPPLY.z,
  r: SUPPLY.r,
  upright: { x: SUPPLY.x - 8, y: -65, w: 16, d: 8, r: 1.8 },
  uprightH: 56,
  foot: { x: SUPPLY.x - 16, y: -70, w: 32, d: 16, r: 2 },
  rings: [16.4, 13.6, 10.8, 8.2],
  core: 5.4,
  retainer: 9,
  knob: 3.6,
  knobLen: 3.6,
});

/* ------------------------------------------------------------------------------------------------ platen */

const GRID_STEP = PX_PER_PHP;
const gridLines = (major: boolean) => {
  const out: string[] = [];
  for (let n = -13; n <= 13; n++) {
    if ((n % 5 === 0) !== major) continue;
    const y = n * GRID_STEP;
    out.push(k.lineOnTop([PAPER_X0, y], [PAPER_X1, y], PAPER_TOP, P));
  }
  return join(out);
};

const ROLLER = { x: 58, z: PAPER_TOP + 4.4, r: 4.4 };
const ROLLER_BRACKETS: Plan[] = [-PAPER_HALF - 5, PAPER_HALF].map((y) => ({ x: ROLLER.x - 4, y, w: 8, d: 5, r: 1 }));
/** The rails stop where the hold-down roller's brackets begin, so the two never share volume. */
const RAIL_END = ROLLER.x - 4;
const RAIL_BACK: Plan = { x: PAPER_X0, y: -PAPER_HALF - 5, w: RAIL_END - PAPER_X0, d: 5, r: 1.2 };
const RAIL_FRONT: Plan = { x: PAPER_X0, y: PAPER_HALF, w: RAIL_END - PAPER_X0, d: 5, r: 1.2 };
const railScrews = (rail: Plan): Flat[] => [-170, -110, -50, 10, 40].map((x) => k.iso([x + 0, rail.y + rail.d / 2, PAPER_Z + 4], P));

/** The paper leaves the platen's right end and runs up to the underside of the supply roll. */
function rightTail() {
  const A: [number, number] = [PAPER_X1, PAPER_Z];
  const C: [number, number] = [SUPPLY.x, SUPPLY.z];
  const r = SUPPLY.r + 0.3;
  const dx = C[0] - A[0];
  const dz = C[1] - A[1];
  const dist = Math.hypot(dx, dz);
  const angle = Math.atan2(dz, dx) - Math.asin(r / dist);
  const length = Math.sqrt(dist * dist - r * r);
  const a: Point3 = [Math.cos(angle), 0, Math.sin(angle)];
  const F = G.frameOf([A[0], 0, A[1]], a, [0, 1, 0], G.cross3(a, [0, 1, 0]));
  return G.prismOf(
    F,
    [
      [-PAPER_HALF, 0],
      [PAPER_HALF, 0],
      [PAPER_HALF, 0.6],
      [-PAPER_HALF, 0.6],
    ],
    0,
    length,
    P,
  );
}

const LEFT_TAIL: Plan = { x: REEL.x, y: -PAPER_HALF, w: PAPER_X0 - REEL.x, d: PAPER_HALF * 2, r: 0.8 };
const BED_SCREWS: Flat[] = [-188, -110, -30, 22].flatMap((x) => [-57.5, 57.5].map((y): Flat => k.iso([x, y, PAPER_Z], P)));

export const PLATEN_BED: Part[] = [
  solid(sl(FLANGE, 0, BED_Z, 5, 0.4), "lo"),
  dots(screwsOf(FLANGE, 3, BED_Z), 0.5, "mid"),
  solid(sl(BED, BED_Z, PAPER_Z - BED_Z, 5, 1), "mid", "faint", { inner: k.sideSeam(BED, 9.5, P, 5) }),
  line(k.planOutline(k.insetPlan(BED, 3.5), PAPER_Z, P, 5), "faint"),
  dots(BED_SCREWS, 0.5, "mid"),
  solid(sl(LEFT_TAIL, PAPER_Z, 0.6, 3), "lo", "none"),
];

export const PLATEN_BACK_RAIL: Part[] = [solid(sl(RAIL_BACK, PAPER_Z, 4, 3, 0.4), "mid"), dots(railScrews(RAIL_BACK), 0.45, "mid")];

export const PLATEN_PAPER: Part[] = [
  solid(sl(PAPER, PAPER_Z, 0.6, 3), "lo", "none"),
  line(gridLines(false), "faint"),
  line(gridLines(true), "lo"),
];

export const PLATEN_FRONT: Part[] = [
  solid(sl(RAIL_FRONT, PAPER_Z, 4, 3, 0.4), "mid"),
  dots(railScrews(RAIL_FRONT), 0.45, "mid"),
];

export const RIGHT_TAIL: Part[] = [solid(rightTail(), "lo", "none")];

export const HOLD_DOWN: Part[] = [
  solid(sl(ROLLER_BRACKETS[0]!, PAPER_Z, 11, 3, 0.4), "mid"),
  solid(
    G.disc(0, PAPER_HALF * 2, ROLLER.r, alongY([ROLLER.x, -PAPER_HALF, ROLLER.z]), P),
    "hi",
    "faint",
  ),
  line(G.circleOf(alongY([ROLLER.x, -PAPER_HALF, ROLLER.z]), PAPER_HALF * 2, ROLLER.r - 1.2, P), "faint"),
];
export const HOLD_DOWN_FRONT: Part[] = [
  solid(sl(ROLLER_BRACKETS[1]!, PAPER_Z, 11, 3, 0.4), "mid"),
  dots([k.iso([ROLLER.x, PAPER_HALF + 5, ROLLER.z], P)], 0.55, "mid"),
];

/* ------------------------------------------------------------------------------------------------ wire frames */

interface Bridge {
  x: number;
  tall: number;
  barZ: number;
  zFloor: number;
}

function bridgeOf({ x, tall, barZ, zFloor }: Bridge) {
  const post = (y: number): Plan => ({ x: x - 3, y, w: 6, d: 6, r: 1.2 });
  const bar: Plan = { x: x - 4, y: -61, w: 8, d: 122, r: 1.5 };
  const hangerTop = barZ;
  const ferruleTop = WIRE_Z + 2.6;
  return {
    back: [solid(sl(post(-61), zFloor, tall, 3, 0.3), "mid"), dots([k.iso([x, -58, zFloor + tall], P)], 0.45, "mid")] as Part[],
    front: [solid(sl(post(55), zFloor, tall, 3, 0.3), "mid"), dots([k.iso([x, 58, zFloor + tall], P)], 0.45, "mid")] as Part[],
    bar: [
      solid(sl(bar, barZ, 6, 3, 0.4), "mid", "faint"),
      line(k.lineOnTop([x, -61], [x, 61], barZ + 6, P), "faint"),
      solid(cyl(x, 0, 1, ferruleTop, hangerTop - ferruleTop, 10), "mid", "none"),
      solid(cyl(x, 0, 1.7, WIRE_Z - 2.6, 5.2, 14, 0.2), "hi"),
    ] as Part[],
  };
}

export const BRIDGE_LEFT = bridgeOf({ x: -216, tall: 36, barZ: 36, zFloor: 0 });
export const BRIDGE_RIGHT = bridgeOf({ x: 11, tall: 22, barZ: 38, zFloor: PAPER_Z });

export const WIRE_X0 = -206.3;
const COIL_RADIUS = 1.6;
const COIL_CAP_X = -214.3;
const COIL_CAP_T = 0.6;
const COIL = k.coil(COIL_CAP_X + COIL_CAP_T, -206.3, [0, WIRE_Z], COIL_RADIUS, 6, "x", P, 14);
/** A thin cap where the spring is crimped to the left ferrule; the helix starts on its rim. */
export const COIL_CAP: Part[] = [solid(G.disc(0, COIL_CAP_T, COIL_RADIUS, G.frameAlong([COIL_CAP_X, 0, WIRE_Z], [1, 0, 0]), P), "mid")];
export const WIRE_X1 = 9.3;
export const WIRE_PARTS = {
  coilBack: COIL.back,
  coilFront: COIL.front,
  wire: line(seg([WIRE_X0, 0, WIRE_Z], [WIRE_X1, 0, WIRE_Z]), "hi"),
  dots: dots([k.iso([WIRE_X1, 0, WIRE_Z], P)], 0.55, "mid"),
};

/* ------------------------------------------------------------------------------------------------ pen gantry */

const GANTRY_POST_BACK: Plan = { x: GANTRY_X - 1, y: -61, w: 12, d: 7, r: 1.5 };
const GANTRY_POST_FRONT: Plan = { x: GANTRY_X - 1, y: 54, w: 12, d: 7, r: 1.5 };
const GANTRY_TOP = GANTRY_Z + GANTRY_H;
const BAR: Plan = { x: GANTRY_X, y: -54, w: GANTRY_W, d: 108, r: 1.2 };
const BAR_FACE = GANTRY_X + GANTRY_W;
const BAR_TICKS = k.sideTicks(-45, 45, PX_PER_PHP, 5, BAR_FACE, GANTRY_TOP, [1.6, 3.1], P, "y");

export const GANTRY_BACK_POST: Part[] = [
  solid(sl(GANTRY_POST_BACK, PAPER_Z, GANTRY_TOP - PAPER_Z, 3, 0.4), "mid"),
  dots([k.iso([GANTRY_X + 2, -57.5, GANTRY_TOP], P), k.iso([GANTRY_X + 8, -57.5, GANTRY_TOP], P)], 0.5, "mid"),
];
export const GANTRY_FRONT_POST: Part[] = [
  solid(sl(GANTRY_POST_FRONT, PAPER_Z, GANTRY_TOP - PAPER_Z, 3, 0.4), "mid"),
  dots([k.iso([GANTRY_X + 2, 57.5, GANTRY_TOP], P), k.iso([GANTRY_X + 8, 57.5, GANTRY_TOP], P)], 0.5, "mid"),
];
export const GANTRY_BAR: Part[] = [
  solid(sl(BAR, GANTRY_Z, GANTRY_H, 3, 0.5), "mid"),
  line(k.lineOnTop([GANTRY_X + GANTRY_W / 2, -54], [GANTRY_X + GANTRY_W / 2, 54], GANTRY_TOP, P), "faint"),
  line(BAR_TICKS.minor, "lo"),
  line(BAR_TICKS.major, "mid"),
];

const CAR_X = GANTRY_X - 2;
const CAR_W = GANTRY_W + 4;
export const CARRIAGE_BACK: Part[] = [solid(sl({ x: CAR_X, y: -8, w: 2, d: 16, r: 0.6 }, GANTRY_Z - 2, GANTRY_H + 3, 2, 0.2), "mid")];
export const CARRIAGE_FRONT: Part[] = [
  solid(sl({ x: BAR_FACE, y: -8, w: 2, d: 16, r: 0.6 }, GANTRY_Z - 2, GANTRY_H + 3, 2, 0.2), "mid"),
  line(seg([BAR_FACE + 2, 0, GANTRY_Z - 2], [BAR_FACE + 2, 0, GANTRY_TOP + 1]), "lit"),
  solid(sl({ x: BAR_FACE + 2, y: -3, w: PEN_X + 3 - BAR_FACE - 2, d: 6, r: 1.2 }, GANTRY_Z - 1, 4.4, 3, 0.3), "mid"),
  dots([k.iso([BAR_FACE + 5, 0, GANTRY_Z + 3.4], P)], 0.5, "mid"),
  solid(cyl(PEN_X, 0, 2.4, GANTRY_Z - 8, 7.4, 16, 0.2), "mid"),
  line(k.sideArc(PEN_X, 0, 2.4, GANTRY_Z - 4, P, 10), "faint"),
  solid(cyl(PEN_X, 0, 0.9, PAPER_TOP + 1.8, GANTRY_Z - 8 - PAPER_TOP - 1.8, 10), "mid", "none"),
  solid(cyl(PEN_X, 0, 0.55, PAPER_TOP, 1.8, 8), "hi", "none", { lit: true }),
  solid(sl({ x: CAR_X, y: -8, w: CAR_W, d: 16, r: 2 }, GANTRY_TOP + 1, 3.4, 3, 0.5), "mid"),
  dots(
    [
      [CAR_X + 2.4, -5.6],
      [CAR_X + CAR_W - 2.4, -5.6],
      [CAR_X + 2.4, 5.6],
      [CAR_X + CAR_W - 2.4, 5.6],
    ].map(([x, y]) => k.iso([x!, y!, GANTRY_TOP + 4.4], P)),
    0.45,
    "mid",
  ),
  solid(cyl(GANTRY_X + GANTRY_W / 2, 0, 3, GANTRY_TOP + 4.4, 3.6, 18, 0.3), "mid"),
  line(k.knurl(GANTRY_X + GANTRY_W / 2, 0, 3, GANTRY_TOP + 4.4, GANTRY_TOP + 8, 18, P), "lo"),
  line(k.lineOnTop([GANTRY_X + GANTRY_W / 2, 0], [GANTRY_X + GANTRY_W / 2 + 3, 0], GANTRY_TOP + 8, P), "hi"),
];

/* ------------------------------------------------------------------------------------------------ counter and dial */

export const COUNTER = { x: -116, y: 72, w: 80, d: 38, h: 20 } as const;
const COUNTER_PLAN: Plan = { x: COUNTER.x, y: COUNTER.y, w: COUNTER.w, d: COUNTER.d, r: 3 };
const FASCIA_Y = COUNTER.y + COUNTER.d;
export const WINDOW = { z0: 16, w: 16, h: WINDOW_H, xs: [COUNTER.x + 10, COUNTER.x + 10 + 16 + 6] as const, y: FASCIA_Y + 2.2 } as const;

export const COUNTER_PARTS: Part[] = [
  solid(sl(COUNTER_PLAN, 0, COUNTER.h, 4, 0.8), "mid", "faint", { inner: k.sideSeam(COUNTER_PLAN, COUNTER.h - 4.4, P, 4) }),
  solid(sl(k.insetPlan(COUNTER_PLAN, 2), COUNTER.h, 1.2, 3, 0.3), "mid"),
  dots(screwsOf(COUNTER_PLAN, 5.5, COUNTER.h + 1.2), 0.5, "mid"),
  ...[0, 1, 2, 3, 4].map((i): Part => line(k.planOutline({ x: COUNTER.x + 38 + i * 5, y: COUNTER.y + 7, w: 2, d: 24, r: 1 }, COUNTER.h + 1.2, P, 3), "lo")),
  solid(cyl(COUNTER.x + 14, COUNTER.y + 19, 4, COUNTER.h + 1.2, 3, 18, 0.3), "mid"),
  line(k.knurl(COUNTER.x + 14, COUNTER.y + 19, 4, COUNTER.h + 1.2, COUNTER.h + 4.2, 18, P), "lo"),
  line(k.lineOnTop([COUNTER.x + 14, COUNTER.y + 19], [COUNTER.x + 18, COUNTER.y + 19], COUNTER.h + 4.2, P), "hi"),
  solid(sl({ x: COUNTER.x + 3, y: FASCIA_Y, w: COUNTER.w - 6, d: 1.2, r: 0.4 }, 2.6, COUNTER.h - 4.4, 2, 0.2), "lo", "none"),
  ...WINDOW.xs.map((x): Part => solid(sl({ x: x - 2, y: FASCIA_Y + 1.2, w: WINDOW.w + 4, d: 1, r: 0.4 }, WINDOW.z0 - WINDOW.h - 1.6, WINDOW.h + 3.2, 2, 0.2), "mid", "faint")),
];

export const DIAL_C: Plane = [-152, 92];
const DIAL_R = 17.5;
const DIAL_TOP = 15;
export const DIAL_FROM = -0.75 * Math.PI;
export const DIAL_SPAN = 1.5 * Math.PI;
const SCALE_R = 14.2;
const DIAL_TICKS = k.radialTicks(DIAL_C[0], DIAL_C[1], SCALE_R, 20, 5, DIAL_TOP, [1.6, 3.4], P, DIAL_FROM, DIAL_SPAN);
const DIAL_STAND: Plan = { x: DIAL_C[0] - 22, y: DIAL_C[1] - 22, w: 44, d: 44, r: 4 };
const TRIP_ANGLE = DIAL_FROM + 0.9 * DIAL_SPAN;

export const DIAL_PARTS: Part[] = [
  solid(sl(DIAL_STAND, 0, 3, 4, 0.4), "lo"),
  dots(screwsOf(DIAL_STAND, 3.6, 3), 0.45, "mid"),
  solid(cyl(DIAL_C[0], DIAL_C[1], 12.5, 3, 4, 28), "mid"),
  solid(sl({ x: DIAL_C[0] + 17.3, y: DIAL_C[1] - 2.6, w: 5.7, d: 5.2, r: 1 }, 6, 4.4, 3), "mid"),
  solid(cyl(DIAL_C[0], DIAL_C[1], DIAL_R, 7, DIAL_TOP - 7, 56, 0.8), "hi"),
  line(k.knurl(DIAL_C[0], DIAL_C[1], DIAL_R, DIAL_TOP - 3.6, DIAL_TOP, 84, P, 0.3), "faint"),
  line(k.sideArc(DIAL_C[0], DIAL_C[1], DIAL_R, DIAL_TOP - 3.6, P, 40), "faint"),
  line(k.ring(DIAL_C[0], DIAL_C[1], DIAL_R - 2.4, DIAL_TOP, P, 64), "lo"),
  line(k.ring(DIAL_C[0], DIAL_C[1], 14.8, DIAL_TOP, P, 64), "faint"),
  line(DIAL_TICKS.minor, "lo"),
  line(DIAL_TICKS.major, "mid"),
  line(
    k.lineOnTop(
      [DIAL_C[0] + Math.sin(TRIP_ANGLE) * 9.2, DIAL_C[1] - Math.cos(TRIP_ANGLE) * 9.2],
      [DIAL_C[0] + Math.sin(TRIP_ANGLE) * SCALE_R, DIAL_C[1] - Math.cos(TRIP_ANGLE) * SCALE_R],
      DIAL_TOP,
      P,
    ),
    "lit",
  ),
];
export const DIAL_HUB: Part[] = [solid(cyl(DIAL_C[0], DIAL_C[1], 2.4, DIAL_TOP, 1.8, 16), "hi", "faint")];

/* ------------------------------------------------------------------------------------------------ desk items (ink, spare pens) */

const INK: Plane = [-190, 92];
const PEN_BLOCK: Plan = { x: -206, y: 70, w: 22, d: 8, r: 1.6 };
export const DESK_PARTS: Part[] = [
  solid(sl(PEN_BLOCK, 0, 5, 3, 0.4), "lo"),
  ...[0, 1, 2].map((i): Part => solid(cyl(PEN_BLOCK.x + 4 + i * 7, PEN_BLOCK.y + 4, 0.9, 5, 11, 10), "mid", "none")),
  ...[0, 1, 2].map((i): Part => line(k.ring(PEN_BLOCK.x + 4 + i * 7, PEN_BLOCK.y + 4, 1.9, 5, P, 12), "lo")),
  solid(cyl(INK[0], INK[1], 6, 0, 11, 24, 0.4), "mid"),
  line(k.sideArc(INK[0], INK[1], 6, 8, P, 20), "faint"),
  solid(cyl(INK[0], INK[1], 2.6, 11, 3, 14), "mid"),
  solid(cyl(INK[0], INK[1], 3.2, 14, 2.4, 16, 0.2), "hi"),
  line(k.knurl(INK[0], INK[1], 3.2, 14, 16.4, 12, P, 0.3), "lo"),
];

/* ------------------------------------------------------------------------------------------------ ratchet unit */

export const WHEEL_C: Plane = [WHEEL.x, WHEEL.y];
const DECK_TOP = 4;

export const RATCHET_PARTS: Part[] = [
  solid(sl(DECK, 0, DECK_TOP, 4, 0.6), "mid"),
  line(k.planOutline(k.insetPlan(DECK, 3.6), DECK_TOP, P, 4), "faint"),
  line(rings(k.corners(DECK, 7), 2, DECK_TOP), "lo"),
  dots(k.corners(DECK, 7).map(([x, y]) => k.iso([x, y, DECK_TOP], P)), 0.5, "mid"),
  solid(cyl(WHEEL_C[0], WHEEL_C[1], 6, DECK_TOP, WHEEL.z - DECK_TOP, 22, 0.3), "mid"),
  solid(cyl(PAWL.pivot[0], PAWL.pivot[1], 3, DECK_TOP, WHEEL.z - DECK_TOP, 14, 0.2), "mid"),
];
export const RATCHET_NUTS: Part[] = [
  solid(cyl(WHEEL_C[0], WHEEL_C[1], 3.4, WHEEL.z + WHEEL.h, 2.4, 16, 0.2), "hi"),
  line(k.ring(WHEEL_C[0], WHEEL_C[1], 1.4, WHEEL.z + WHEEL.h + 2.4, P, 10), "lo"),
  solid(cyl(PAWL.pivot[0], PAWL.pivot[1], 2, WHEEL.z + WHEEL.h, 1.8, 10), "hi"),
];

/** Reset coil: pulls the pawl's tail clear of the teeth on a dip and when the latch trips. */
export function resetCoil(centre: Plane): Part[] {
  const F = alongZ([centre[0], centre[1], DECK_TOP]);
  return [
    solid(G.solidOf([[0, 6.2], [1.4, 6.2], [1.4, 4.6], [7.2, 4.6], [7.2, 6.2], [8.6, 6.2]], F, P), "mid", "faint", {
      inner: [2.8, 4, 5.2, 6.4].map((s) => G.arcOf(F, s, 4.6, P)).join(""),
    }),
    dots([k.iso([centre[0] + 4.6, centre[1] + 6.2, DECK_TOP], P), k.iso([centre[0] - 4.6, centre[1] + 6.2, DECK_TOP], P)], 0.55, "mid"),
  ];
}

/* ------------------------------------------------------------------------------------------------ solenoid */

export const SOL = { x: HEAD[0] + BAR_S * Math.cos(SLOPE_DEG * RAD), y: BAR_END - 10 } as const;
const SOL_F = alongZ([SOL.x, SOL.y, 2]);
const SOL_BASE: Plan = { x: SOL.x - 11, y: SOL.y - 11, w: 22, d: 22, r: 2.5 };
const BAR_UNDER = HEAD[1] - BAR_S * Math.sin(SLOPE_DEG * RAD) + 0.4 * Math.cos(SLOPE_DEG * RAD);
export const PLUNGER_TOP = BAR_UNDER;
const SOL_TOP_S = 20;
const PLUNGER = G.rodOut(SOL_F, SOL_TOP_S, PLUNGER_TOP - 2, 2.4, P, { stroke: BAR_LIFT });
export const PLUNGER_CLIP = PLUNGER.clip as string;
export const LAMP = { x: SOL.x + 15, y: SOL.y - 3 } as const;

export const SOLENOID_PARTS: Part[] = [
  solid(sl(SOL_BASE, 0, 2, 4, 0.4), "lo"),
  dots(screwsOf(SOL_BASE, 2.6, 2), 0.45, "mid"),
  solid(
    G.solidOf([[0, 9], [2, 9], [2, 7.4], [17, 7.4], [17, 9], [19, 9], [19, 4], [SOL_TOP_S, 4]], SOL_F, P),
    "mid",
    "faint",
    { inner: [3.6, 5.2, 6.8, 8.4, 10, 11.6, 13.2, 14.8, 16.4].map((s) => G.arcOf(SOL_F, s, 7.4, P)).join("") },
  ),
  line(G.circleOf(SOL_F, SOL_TOP_S, 2.9, P), "faint"),
  solid(cyl(LAMP.x, LAMP.y, 3.8, 0, 3.6, 16, 0.2), "lo"),
];
export const PLUNGER_PARTS: Part[] = [solid(PLUNGER.paths, "hi", "none")];
export const LAMP_PART: Part = solid(cyl(LAMP.x, LAMP.y, 2.6, 3.6, 3.6, 16, 0.3), "hi", "faint");

/* ------------------------------------------------------------------------------------------------ chute */

export const slopePoint = (s: number, y: number, v = 0): Point3 => [HEAD[0] + SLOPE_D[0] * s + SLOPE_N[0] * v, y, HEAD[1] + SLOPE_D[2] * s + SLOPE_N[2] * v];
const SF = G.frameOf([HEAD[0], 0, HEAD[1]], SLOPE_D, [0, 1, 0], SLOPE_N);
const box = (u0: number, u1: number, v0: number, v1: number, s0: number, s1: number) =>
  G.prismOf(
    SF,
    [
      [u0, v0],
      [u1, v0],
      [u1, v1],
      [u0, v1],
    ],
    s0,
    s1,
    P,
  );
const slopeLine = (a: [number, number], b: [number, number], y: number, v: number) => k.segment(slopePoint(a[0], y + a[1], v), slopePoint(b[0], y + b[1], v), P);

export const CHUTE_END = 110;
const RAIL_AT = [-1.5, -0.5, 0.5, 1.5].map((n) => n * LANE_W);
const RAIL_CUT: [number, number] = [BAR_S - 1.5, BAR_S + 1.5];
const CARD = { s0: 62, s1: 104, half: 13.5, t: 0.9 };
const BUMPER_S = 105;
export const TRAY_LIFT = CARD.t;

function trestle(s: number): Part[] {
  const [x, , z] = slopePoint(s, 0);
  const under = z - (s >= 56 ? 6.7 : 3.1) - 0.2;
  const out = 1.5 * LANE_W - 4;
  const leg = (y: number): Plan => ({ x: x - 2.5, y: y - 2.5, w: 5, d: 5, r: 0.8 });
  const beam: Plan = { x: x - 2.5, y: -(out + 4), w: 5, d: (out + 4) * 2, r: 1 };
  return [
    solid(sl(leg(-out), 0, under - 3.6, 2, 0.2), "lo"),
    solid(sl(leg(out), 0, under - 3.6, 2, 0.2), "lo"),
    solid(sl(beam, under - 3.6, 3.6, 2, 0.2), "lo"),
  ];
}

export const TRESTLES: Part[] = [trestle(14), trestle(52), trestle(92)].flat();

const BOSS: Plan = { x: SOL.x - 7, y: -BAR_END - 6, w: 14, d: 12, r: 2 };
export const BAR_BOSS: Part[] = [solid(sl(BOSS, 0, BAR_UNDER - 0.2, 3, 0.4), "mid"), dots([k.iso([SOL.x, -BAR_END, BAR_UNDER - 0.2], P)], 0.5, "mid")];

export interface Lane {
  y: number;
  rail: Part[];
  deck: Part[];
  card: Part[];
  bumper: Part[];
  bar: Part[];
}

function railOf(yb: number): Part[] {
  const u0 = yb - 1.5;
  const u1 = yb + 1.5;
  return [
    solid(box(u0, u1, 0, 6.5, -4, RAIL_CUT[0]), "mid", "faint"),
    solid(box(u0, u1, 0, 6.5, RAIL_CUT[1], CHUTE_END), "mid", "faint"),
    dots(
      [10, 40, 80].map((s) => k.iso(slopePoint(s, yb, 6.5), P)),
      0.45,
      "mid",
    ),
  ];
}

function laneOf(y: number, index: number): Lane {
  const u0 = y - LANE_W / 2;
  const u1 = y + LANE_W / 2;
  const cardTop = CARD.t;
  const chipD = k.pathOf(
    (
      [
        [CARD.s0 + 5, -9],
        [CARD.s0 + 5, -2],
        [CARD.s0 + 13, -2],
        [CARD.s0 + 13, -9],
      ] as Array<[number, number]>
    ).map(([s, u]) => k.iso(slopePoint(s, y + u, cardTop), P)),
    true,
  );
  const waves = [3.5, 6.5, 9.5]
    .map((r) =>
      k.pathOf(
        Array.from({ length: 11 }, (_, j) => {
          const a = (-40 + (j / 10) * 80) * RAD;
          return k.iso(slopePoint(CARD.s0 + 24 + r * Math.cos(a), y + 3 + r * Math.sin(a), cardTop), P);
        }),
      ),
    )
    .join("");
  return {
    y,
    rail: index === 0 ? railOf(RAIL_AT[0]!) : [],
    deck: [
      solid(box(u0 - (index === 0 ? 1.5 : 0), u1 + (index === LANES.length - 1 ? 1.5 : 0), -6.5, -3, 56, CHUTE_END), "lo", "faint"),
      solid(box(u0, u1, -3, 0, -4, CHUTE_END), "mid", "faint", { inner: slopeLine([CARD.s0 - 3, -LANE_W / 2], [CARD.s0 - 3, LANE_W / 2], y, 0) }),
      line(slopeLine([-4, 0], [CHUTE_END, 0], y, 0), "faint"),
    ],
    card: [
      solid(box(y - CARD.half, y + CARD.half, 0, cardTop, CARD.s0, CARD.s1), "hi", "faint"),
      line(chipD, "lo"),
      line(waves, "faint", { free: true }),
      line(slopeLine([CARD.s1 - 12, -8], [CARD.s1 - 4, -8], y, cardTop), "lo", { free: true }),
      line(slopeLine([CARD.s1 - 12, -5.4], [CARD.s1 - 7, -5.4], y, cardTop), "lo", { free: true }),
    ],
    bumper: [solid(box(y - 17, y + 17, 0, 6.5, BUMPER_S, BUMPER_S + 3.5), "mid", "faint")],
    bar: [solid(box(u0, u1, 0.4, 9.4, BAR_S - 1.5, BAR_S + 1.5), "mid", "faint")],
  };
}

export const LANE_ART: Lane[] = LANES.map((y, index) => laneOf(y, index));
export const RAIL_ART: Part[][] = RAIL_AT.slice(1).map(railOf);
export const BAR_END_BACK: Part[] = [solid(box(-BAR_END, -1.5 * LANE_W, 0.4, 9.4, BAR_S - 1.5, BAR_S + 1.5), "mid", "faint")];
export const BAR_END_FRONT: Part[] = [solid(box(1.5 * LANE_W, BAR_END, 0.4, 9.4, BAR_S - 1.5, BAR_S + 1.5), "mid", "faint")];

/* ------------------------------------------------------------------------------------------------ tokens */

const TOKEN_FRAME = (y: number) => G.frameOf(slopePoint(TOKEN_S0, y, 0), SLOPE_N, [0, 1, 0], G.cross3(SLOPE_N, [0, 1, 0]));

export const TOKEN_ART = LANES.map((y): Part[] => {
  const F = TOKEN_FRAME(y);
  const face = G.dotsOf(F, TOKEN_T, TOKEN_R - 1.1, 18, P, { all: true }) as Flat[];
  return [
    solid(G.disc(0, TOKEN_T, TOKEN_R, F, P), "hi", "faint", { lit: true }),
    line(G.circleOf(F, TOKEN_T, TOKEN_R - 1.9, P), "faint"),
    line(G.circleOf(F, TOKEN_T, 4.2, P), "lo"),
    dots(face, 0.4, "mid"),
  ];
});

/* ------------------------------------------------------------------------------------------------ misc exports for live code */

export const TURN = {
  reel: TAKEUP.turning,
  supply: SUPPLY_ROLL.turning,
};

export const PAPER_CLIP_D = k.planOutline(PAPER, PAPER_TOP, P, 3);
export const LABEL_TEXT = "LIMIT ₱65.00/L";
export { path };
