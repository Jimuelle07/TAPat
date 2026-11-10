import { cameraOf, extrude, pathOf, type Flat, type Plane, type SolidPaths } from "@/app/_landing/iso/iso-kit";
import { DIAL, GAUGE, GOV, govSleeve, LOCK, POST, SWEEP, X2, X5 } from "./consts";
import { BELT_X0, BELT_X1, BELT_Z, LANE, P, PIT_HALF, STATION, at } from "./view";

/* Everything that is rebuilt while the figure moves: needle, governor arms, springs, gate arm, keyway, radar bar,
   lever. It imports the kit's core only, so the client ships these and none of the static geometry. */

const RAD = Math.PI / 180;
type V3 = [number, number, number];

/* The belt's cleats: one line across the lane per pitch, only where the belt is (it runs either side of the vault pit),
   so every end sits on the belt's edge. They slide with the belt, so they are rebuilt per frame. */
export const CLEAT = 9;
const BELT_RUNS: Array<[number, number]> = [
  [BELT_X0 + 0.4, STATION[2]! - PIT_HALF - 0.4],
  [STATION[2]! + PIT_HALF + 0.4, BELT_X1 - 0.4],
];
export const cleatsAt = (shift: number) => {
  const lines: string[] = [];
  for (let x = BELT_X0 - CLEAT + shift; x <= BELT_X1 + CLEAT; x += CLEAT)
    if (BELT_RUNS.some(([a, b]) => x >= a && x <= b)) lines.push(pathOf([at([x, -LANE, BELT_Z]), at([x, LANE, BELT_Z])]));
  return lines.join("");
};

/* 01: dial gauge. */
export const R_FACE = GAUGE.r - 2.8;
export const dialAngle = (price: number) => (DIAL.from - ((price - DIAL.lo) / (DIAL.hi - DIAL.lo)) * DIAL.span) * RAD;
export const onFace = (r: number, a: number): Flat => at([GAUGE.x + r * Math.cos(a), GAUGE.y, GAUGE.z + r * Math.sin(a)]);
export const needleAt = (price: number) => {
  const a = dialAngle(price);
  return pathOf([onFace(-3.4, a), onFace(R_FACE - 1.2, a)]);
};

/* 02: fly-ball governor. */
export function governorAt(deg: number) {
  const t = deg * RAD;
  const sleeve = govSleeve(deg);
  /* A link ends in a pin on the sleeve's surface, level with the sleeve's middle; the pin rides with the sleeve (s2.ts draws it). */
  const edge = Math.sqrt(GOV.sleeveR * GOV.sleeveR - (GOV.y - GOV.spindleY) ** 2);
  const side = (s: number) => {
    const sin = Math.sin(t);
    const cos = Math.cos(t);
    const foot = [X2 + s * (GOV.pivotX + GOV.attach * sin), GOV.y, GOV.pivotZ - GOV.attach * cos] as V3;
    return {
      pivot: [X2 + s * GOV.pivotX, GOV.y, GOV.pivotZ] as V3,
      ball: [X2 + s * (GOV.pivotX + GOV.arm * sin), GOV.y, GOV.pivotZ - GOV.arm * cos] as V3,
      foot,
      rim: [X2 + s * (GOV.pivotX + (GOV.arm - GOV.ball) * sin), GOV.y, GOV.pivotZ - (GOV.arm - GOV.ball) * cos] as V3,
      meet: [X2 + s * edge, GOV.y, sleeve] as V3,
    };
  };
  const left = side(-1);
  const right = side(1);
  /* An arm is painted over its ball, so it stops on the ball's outline rather than running to its centre. */
  const arm = (pivot: V3, ball: V3) => {
    const [px, py] = at(pivot);
    const [bx, by] = at(ball);
    const length = Math.hypot(bx - px, by - py) || 1;
    const reach = (length - GOV.ball * cameraOf(P).k) / length;
    return pathOf([[px, py], [px + (bx - px) * reach, py + (by - py) * reach]]);
  };
  const rod = (a: V3, b: V3) => pathOf([at(a), at(b)]);
  return {
    sleeve,
    left,
    right,
    lines: { armL: arm(left.pivot, left.ball), armR: arm(right.pivot, right.ball), linkL: rod(left.foot, left.meet), linkR: rod(right.foot, right.meet) },
  };
}

/* 05: tumbler. */
const { plugY, plugZ, plugR } = LOCK;
export const SHEAR = plugZ + plugR;
export const BAR_Z = 44;
export const PIN = { r: 1.9, driver: 7, key: 4, cap: 0.9, spring: 2.2 };
export const PIN_X = LOCK.pins.map((dx) => X5 + dx);

const hull = (points: Flat[]): Flat[] => {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Flat, a: Flat, b: Flat) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const build = (list: Flat[]) => {
    const out: Flat[] = [];
    for (const point of list) {
      while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, point) <= 0) out.pop();
      out.push(point);
    }
    return out.slice(0, -1);
  };
  return [...build(sorted), ...build([...sorted].reverse())];
};

/* A thin bar turning about the x axis: a prism with a rectangle in the y–z plane, shaded like the kit's solids. */
export function barAbout(deg: number, x0: number, x1: number, from: number, to: number, half: number): SolidPaths {
  const t = deg * RAD;
  const dir: Plane = [Math.cos(t), Math.sin(t)];
  const side: Plane = [-Math.sin(t), Math.cos(t)];
  const corner = (s: number, w: number): [number, number] => [plugY + dir[0] * s + side[0] * w, plugZ + dir[1] * s + side[1] * w];
  const ring = [corner(from, -half), corner(to, -half), corner(to, half), corner(from, half)];
  const a = (P.azimuth ?? 45) * RAD;
  const e = (P.elevation ?? 30) * RAD;
  const view: V3 = [Math.cos(a) * Math.cos(e), Math.sin(a) * Math.cos(e), Math.sin(e)];
  const light: V3 = [-Math.sin(a), Math.cos(a), 1.2];
  const length = Math.hypot(...light);
  const lit = (n: V3) => (n[0] * light[0] + n[1] * light[1] + n[2] * light[2]) / length;
  const bands = [0, 0.2, 0.42, 0.62];
  const bucket = (n: V3) => bands.filter((b) => lit(n) >= b).length;
  const lo = ring.map(([y, z]) => at([x0, y, z]));
  const hi = ring.map(([y, z]) => at([x1, y, z]));
  const buckets: string[][] = [[], [], [], [], []];
  for (let j = 0; j < 4; j++) {
    const [y0, z0] = ring[j]!;
    const [y1, z1] = ring[(j + 1) % 4]!;
    const length2 = Math.hypot(y1 - y0, z1 - z0) || 1;
    // outward normal of a counter-clockwise ring in (y, z)
    const n: V3 = [0, (z1 - z0) / length2, -(y1 - y0) / length2];
    const turn = (ring[2]![0] - ring[0]![0]) * (ring[1]![1] - ring[0]![1]) - (ring[2]![1] - ring[0]![1]) * (ring[1]![0] - ring[0]![0]);
    const out: V3 = turn > 0 ? n : [0, -n[1], -n[2]];
    if (out[0] * view[0] + out[1] * view[1] + out[2] * view[2] > 1e-6) buckets[bucket(out)]!.push(pathOf([lo[j]!, lo[(j + 1) % 4]!, hi[(j + 1) % 4]!, hi[j]!], true));
  }
  buckets[bucket([1, 0, 0])]!.push(pathOf(hi, true));
  const outline = pathOf(hull([...lo, ...hi]), true);
  return { fill: outline, outline, crease: "", top: buckets[4]!.join(""), shades: buckets.slice(0, 4).map((list) => list.join("")) };
}

export const gateAt = (deg: number) => barAbout(deg, X5 + LOCK.armX, X5 + LOCK.armX + 3.2, -LOCK.tail, LOCK.arm, 2.2);

export function keywayAt(deg: number) {
  const t = deg * RAD;
  const pt = (u: number, v: number): V3 => [X5 + 10, plugY + u * Math.cos(t) - v * Math.sin(t), plugZ + u * Math.sin(t) + v * Math.cos(t)];
  return pathOf([pt(-3.4, -0.7), pt(3.4, -0.7), pt(3.4, 0.7), pt(-3.4, 0.7)].map((p) => at(p)), true);
}

/* A vertical coil split into its back half and its front half. */
export function coilZ(cx: number, cy: number, z0: number, z1: number, r: number, turns: number, perTurn = 12) {
  const count = Math.max(1, Math.round(turns * perTurn));
  const back: string[] = [];
  const front: string[] = [];
  const vx = Math.cos((P.azimuth ?? 45) * RAD);
  const vy = Math.sin((P.azimuth ?? 45) * RAD);
  let run: Flat[] = [];
  let near: boolean | null = null;
  for (let index = 0; index <= count; index++) {
    const share = index / count;
    const angle = share * turns * Math.PI * 2;
    const flat = at([cx + r * Math.cos(angle), cy + r * Math.sin(angle), z0 + (z1 - z0) * share]);
    const facing = Math.cos(angle) * vx + Math.sin(angle) * vy > 0;
    if (near === null) near = facing;
    if (facing !== near) {
      run.push(flat);
      (near ? front : back).push(pathOf(run));
      run = [flat];
      near = facing;
      continue;
    }
    run.push(flat);
  }
  if (run.length > 1) (near ? front : back).push(pathOf(run));
  return { back: back.join(""), front: front.join("") };
}

/* The coil's top end runs into the bar's underside (COIL_TOP above BAR_Z), so it ends under the bar's fill. */
export const COIL_TOP = BAR_Z + 1.5;
export const springAt = (index: number, delta: number) => coilZ(PIN_X[index] ?? X5, plugY, SHEAR + PIN.driver + PIN.cap + delta, COIL_TOP, PIN.spring, 5);

/* 06: the radar bar, turning about the mast. */
export const RADAR = { z: POST.mastTop, half: 13, bar: 2.4 };
export function radarAt(deg: number) {
  const t = deg * RAD;
  const c = Math.cos(t);
  const s = Math.sin(t);
  const half = 1.5;
  const corner = (u: number, v: number): Plane => [POST.mastX + u * c - v * s, POST.mastY + u * s + v * c];
  return extrude([corner(-RADAR.half, -half), corner(RADAR.half, -half), corner(RADAR.half, half), corner(-RADAR.half, half)], RADAR.z, RADAR.bar, P, { convex: true });
}

/* 08: the sweep lever. */
const { lever } = SWEEP;
export const leverAt = (deg: number) => {
  const t = deg * RAD;
  const tip: V3 = [lever.x + lever.len * Math.sin(t), lever.y, lever.z + lever.len * Math.cos(t)];
  return { tip, d: pathOf([at([lever.x, lever.y, lever.z]), at(tip)]) };
};
