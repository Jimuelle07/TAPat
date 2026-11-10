import { extrude, iso, lineOnTop, onTop, pathOf, ring, type Flat, type Plane, type Point3, type SolidPaths } from "../../iso/iso-kit";
import { type LandingScenario, SWING_FROM, penPrice, pointOf } from "./model";
import { DAY_UNITS, P, PAPER_HALF, PAPER_TOP, PAPER_X0, PAPER_X1, PAWL, PEN_X, ROOT_R, TEETH, TIP_R, WHEEL, yOfPrice } from "./view";

const RAD = Math.PI / 180;
const fine = (value: number) => Math.round(value * 1000) / 1000;

/* ------------------------------------------------------------------------------------------------ paper */

/**
 * The ink on the paper, grid lines and feed holes for clock `d`. The paper carries each day DAY_UNITS toward
 * -x past the pen at PEN_X; day i is at paper time i. The pen holds a day's price, then swings to the next
 * one over the last 30% of the day, so the trace is a staircase with slanted risers and ends at the nib.
 */
export function paperAt(scenario: LandingScenario, d: number) {
  const days = scenario.points.length;
  const clock = Math.min(days, Math.max(1, d));
  const xOf = (t: number) => PEN_X - (clock - t) * DAY_UNITS;
  const yOf = (day: number) => yOfPrice(pointOf(scenario, day).pricePhp);
  const nodes: Plane[] = [];
  for (let day = 1; day <= days; day++) {
    if (day > clock) break;
    nodes.push([xOf(day), yOf(day)]);
    const hold = day + SWING_FROM;
    if (day < days && hold < clock) nodes.push([xOf(hold), yOf(day)]);
  }
  const head: Plane = [PEN_X, yOfPrice(penPrice(scenario, clock))];
  nodes.push(head);
  // Clip the ink at the paper's left edge, ending exactly on the edge.
  const clipped: Plane[] = [];
  for (let index = 0; index < nodes.length; index++) {
    const [x, y] = nodes[index]!;
    if (x >= PAPER_X0) {
      if (!clipped.length && index > 0) {
        const [px, py] = nodes[index - 1]!;
        const along = (PAPER_X0 - px) / (x - px);
        clipped.push([PAPER_X0, py + (y - py) * along]);
      }
      clipped.push([x, y]);
    }
  }
  const trace = clipped.length > 1 ? onTop(clipped, PAPER_TOP, P) : "";
  const first = Math.ceil(clock - (PEN_X - PAPER_X0) / DAY_UNITS);
  const last = Math.floor(clock + (PAPER_X1 - PEN_X) / DAY_UNITS);
  const minor: string[] = [];
  const major: string[] = [];
  const holes: string[] = [];
  for (let day = first; day <= last + 1; day++) {
    const x = xOf(day);
    if (x > PAPER_X0 + 0.01 && x < PAPER_X1 - 0.01) (day % 5 === 0 ? major : minor).push(lineOnTop([x, -PAPER_HALF], [x, PAPER_HALF], PAPER_TOP, P));
    const hx = xOf(day + 0.5);
    if (hx > PAPER_X0 + 2 && hx < PAPER_X1 - 2) {
      for (const hy of [-PAPER_HALF + 3.2, PAPER_HALF - 3.2]) {
        const [sx, sy] = iso([hx, hy, PAPER_TOP], P);
        holes.push(`M${fine(sx)} ${fine(sy)}h0`);
      }
    }
  }
  return { trace, minor: minor.join(""), major: major.join(""), holes: holes.join(""), penY: head[1] };
}

/* ------------------------------------------------------------------------------------------------ turning faces */

/**
 * A matrix that turns a drawing on a y-facing face (x–z plane) by `beta` radians about a point,
 * positive when the face's bottom moves toward -x. Exact for a flat drawing in that plane.
 */
export function faceTurn(centre: Point3, beta: number) {
  const [ox, oy] = iso(centre, P);
  const ex = iso([centre[0] + 1, centre[1], centre[2]], P);
  const ez = iso([centre[0], centre[1], centre[2] + 1], P);
  const a: Flat = [ex[0] - ox, ex[1] - oy];
  const b: Flat = [ez[0] - ox, ez[1] - oy];
  const det = a[0] * b[1] - a[1] * b[0];
  const c = Math.cos(beta);
  const s = Math.sin(beta);
  // plane rotation about +y: x' = x c + z s, z' = -x s + z c; screen = a x + b z.
  // Build M = A R A^-1 explicitly.
  const inv: [number, number, number, number] = [b[1] / det, -b[0] / det, -a[1] / det, a[0] / det];
  const R: [number, number, number, number] = [c, s, -s, c];
  const AR: [number, number, number, number] = [a[0] * R[0] + b[0] * R[2], a[0] * R[1] + b[0] * R[3], a[1] * R[0] + b[1] * R[2], a[1] * R[1] + b[1] * R[3]];
  const M: [number, number, number, number] = [
    AR[0] * inv[0] + AR[1] * inv[2],
    AR[0] * inv[1] + AR[1] * inv[3],
    AR[2] * inv[0] + AR[3] * inv[2],
    AR[2] * inv[1] + AR[3] * inv[3],
  ];
  const tx = ox - (M[0] * ox + M[1] * oy);
  const ty = oy - (M[2] * ox + M[3] * oy);
  return `matrix(${fine(M[0])} ${fine(M[2])} ${fine(M[1])} ${fine(M[3])} ${fine(tx)} ${fine(ty)})`;
}

/* ------------------------------------------------------------------------------------------------ dial */

export const DIAL_CENTRE: Plane = [-152, 92];
export const DIAL_FROM_RAD = -0.75 * Math.PI;
export const DIAL_SPAN_RAD = 1.5 * Math.PI;
const DIAL_NEEDLE_Z = 15.35;

/** The needle at probability p (0–1); a negative p parks it just left of zero, off the scale (warm-up). */
export function needleAt(p: number | null) {
  const angle = DIAL_FROM_RAD + (p === null ? -0.07 : Math.min(1.02, Math.max(-0.1, p))) * DIAL_SPAN_RAD;
  const dx = Math.sin(angle);
  const dy = -Math.cos(angle);
  const [cx, cy] = DIAL_CENTRE;
  return lineOnTop([cx - dx * 4.2, cy - dy * 4.2], [cx + dx * 12.8, cy + dy * 12.8], DIAL_NEEDLE_Z, P);
}

/* ------------------------------------------------------------------------------------------------ ratchet */

const PITCH = 360 / TEETH;
const STEEP_FROM = PITCH - 0.8;
const RAMP_TO = 25;

/** Tooth-local radius at tooth angle `phi` (degrees, 0 to 30): a long ramp up to the tip, a flat root, then the steep face. */
function toothRadius(phi: number) {
  if (phi < RAMP_TO) return TIP_R - ((TIP_R - ROOT_R) * phi) / RAMP_TO;
  if (phi < STEEP_FROM) return ROOT_R;
  return ROOT_R + ((TIP_R - ROOT_R) * (phi - STEEP_FROM)) / (PITCH - STEEP_FROM);
}

const wheelRing = (theta: number): Plane[] => {
  const [cx, cy] = [WHEEL.x, WHEEL.y];
  const out: Plane[] = [];
  for (let tooth = 0; tooth < TEETH; tooth++) {
    for (const phi of [0, 5, 10, 15, 20, RAMP_TO, STEEP_FROM - 0.4]) {
      const angle = theta + (tooth * PITCH + phi) * RAD;
      const r = phi === STEEP_FROM - 0.4 ? ROOT_R : toothRadius(phi);
      out.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
    }
  }
  return out;
};

const PAWL_PIVOT: Plane = [PAWL.pivot[0], PAWL.pivot[1]];
const PAWL_LEN = PAWL.length;
const PAWL_LIFT = 34 * RAD;

/** Is the pawl tip, at lever angle psi, inside the wheel's material? */
function biting(psi: number, theta: number) {
  const tx = PAWL_PIVOT[0] + PAWL_LEN * Math.cos(psi) - WHEEL.x;
  const ty = PAWL_PIVOT[1] + PAWL_LEN * Math.sin(psi) - WHEEL.y;
  const rr = Math.hypot(tx, ty);
  const local = ((((Math.atan2(ty, tx) - theta) / RAD) % PITCH) + PITCH) % PITCH;
  return rr < toothRadius(local);
}

const TOWARD_WHEEL = Math.atan2(WHEEL.y - PAWL_PIVOT[1], WHEEL.x - PAWL_PIVOT[0]);

/** The lever angle at which the pawl's tip rests on the wheel's outline for wheel angle theta (radians). */
export function pawlAngle(theta: number) {
  const steps = 48;
  const from = TOWARD_WHEEL - 60 * RAD;
  const to = TOWARD_WHEEL + 4 * RAD;
  let low = from;
  for (let step = 1; step <= steps; step++) {
    const high = from + ((to - from) * step) / steps;
    if (biting(high, theta)) {
      let a = low;
      let b = high;
      for (let round = 0; round < 14; round++) {
        const mid = (a + b) / 2;
        if (biting(mid, theta)) b = mid;
        else a = mid;
      }
      return a;
    }
    low = high;
  }
  return to;
}

const ringPoints = (cx: number, cy: number, r: number, z: number, count = 12) =>
  pathOf(Array.from({ length: count }, (_, index) => iso([cx + r * Math.cos((index / count) * Math.PI * 2), cy + r * Math.sin((index / count) * Math.PI * 2), z], P)), true);

export interface RatchetFrame {
  wheel: SolidPaths;
  holes: string;
  ticks: string;
  pawl: SolidPaths;
  pawlHole: string;
  tail: Plane;
}

/** Wheel (angle in radians, counter-clockwise from +x) and pawl, lifted by `lift` (0 engaged, 1 clear). */
export function ratchetAt(theta: number, lift: number): RatchetFrame {
  const top = WHEEL.z + WHEEL.h;
  const wheel = extrude(wheelRing(theta), WHEEL.z, WHEEL.h, P, { convex: false, bevel: 0.5 });
  const holes: string[] = [];
  const ticks: string[] = [];
  for (let index = 0; index < 4; index++) {
    const angle = theta + (index * 90 + 45) * RAD;
    holes.push(ringPoints(WHEEL.x + 11.6 * Math.cos(angle), WHEEL.y + 11.6 * Math.sin(angle), 2.8, top, 12));
  }
  for (let tooth = 0; tooth < TEETH; tooth++) {
    const angle = theta + (tooth * PITCH + 14) * RAD;
    ticks.push(lineOnTop([WHEEL.x + 2.8 * Math.cos(angle), WHEEL.y + 2.8 * Math.sin(angle)], [WHEEL.x + 8.4 * Math.cos(angle), WHEEL.y + 8.4 * Math.sin(angle)], top, P));
  }
  const psi = pawlAngle(theta) - lift * PAWL_LIFT;
  const e: Plane = [Math.cos(psi), Math.sin(psi)];
  const n: Plane = [-e[1], e[0]];
  const at = (a: number, b: number): Plane => [PAWL_PIVOT[0] + e[0] * a + n[0] * b, PAWL_PIVOT[1] + e[1] * a + n[1] * b];
  const pawl = extrude([at(-10.2, -3.3), at(-10.2, 3.3), at(PAWL_LEN - 2.6, 1.4), at(PAWL_LEN + 0.2, 0), at(PAWL_LEN - 2.6, -1.4)], WHEEL.z, WHEEL.h, P, { convex: true, bevel: 0.3 });
  return { wheel, holes: holes.join(""), ticks: ticks.join("") + ringPoints(WHEEL.x, WHEEL.y, 8.4, top, 36), pawl, pawlHole: ring(PAWL_PIVOT[0], PAWL_PIVOT[1], 1.4, top, P, 10), tail: at(-10.2, 0) };
}

export const PAWL_LIFT_DEG = 34;
