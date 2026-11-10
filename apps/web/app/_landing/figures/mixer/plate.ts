/*
 * Prisms the kit's floor-standing `extrude` can't draw: any outline in the vertical x–z plane, extruded along y.
 * Levers, racks and gears of the mechanism are this. Pure TypeScript, so the live component can rebuild a turning
 * gear or a tilting lever every frame (about 0.05 ms each).
 */
import { cameraOf, iso, pathOf, type Flat, type Projection, type SolidPaths } from "../../iso/iso-kit";

const BANDS = [0, 0.2, 0.42, 0.62];
const LIGHT_UP = 1.2;

type V3 = [number, number, number];

const unit = ([x, y, z]: V3): V3 => {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
};

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const toneOf = (score: number) => {
  let tone = 0;
  while (tone < BANDS.length && score >= BANDS[tone]!) tone++;
  return tone;
};

function areaOf(points: ArrayLike<Flat>) {
  let area = 0;
  for (let index = 0; index < points.length; index++) {
    const [ax, ay] = points[index]!;
    const [bx, by] = points[(index + 1) % points.length]!;
    area += ax * by - bx * ay;
  }
  return area / 2;
}

const oriented = (points: Flat[]) => (areaOf(points) < 0 ? [...points].reverse() : points);

/** Consecutive indices (closed ring) whose flag equals `want`, as runs that include the closing vertex. */
function runsOf(flags: boolean[], want: boolean) {
  const count = flags.length;
  const start = flags.findIndex((flag, index) => flag !== flags[(index + count - 1) % count]);
  if (start < 0) return flags[0] === want ? [Array.from({ length: count + 1 }, (_, index) => index % count)] : [];
  const runs: number[][] = [];
  let run: number[] | null = null;
  for (let step = 0; step < count; step++) {
    const index = (start + step) % count;
    if (flags[index] === want) {
      if (!run) run = [index];
      run.push((index + 1) % count);
    } else if (run) {
      runs.push(run);
      run = null;
    }
  }
  if (run) runs.push(run);
  return runs;
}

const SHARP = Math.cos(0.35);

/**
 * `polygon` is a closed outline in [x, z] (any winding, concave allowed), extruded from y0 to y1 (y1 > y0, towards the
 * viewer). Returns what `<Solid>` paints: fill, four side tones, the lit top, the crease and the outline.
 */
export function planePrism(polygon: Flat[], y0: number, y1: number, P: Projection): SolidPaths {
  const { sinA, cosA, sinE, cosE } = cameraOf(P);
  const view: V3 = [cosA * cosE, sinA * cosE, sinE];
  const light = unit([-sinA, cosA, LIGHT_UP]);
  // counter-clockwise in x–z, so the outward normal of an edge is (dz, 0, -dx)
  const ring = areaOf(polygon) < 0 ? [...polygon].reverse() : polygon;
  const count = ring.length;
  const low = ring.map(([x, z]) => iso([x, y0, z], P));
  const high = ring.map(([x, z]) => iso([x, y1, z], P));
  const normals = ring.map(([ax, az], index) => {
    const [bx, bz] = ring[(index + 1) % count]!;
    return unit([bz - az, 0, -(bx - ax)]);
  });
  const seen = normals.map((normal) => dot(normal, view) > 1e-6);
  const buckets: string[][] = [[], [], [], [], []];
  const fills: string[] = [];
  const quad = (index: number) => {
    const next = (index + 1) % count;
    return pathOf(oriented([low[index]!, low[next]!, high[next]!, high[index]!]), true);
  };
  for (let index = 0; index < count; index++) {
    if (!seen[index]) continue;
    const quadPath = quad(index);
    fills.push(quadPath);
    buckets[toneOf(dot(normals[index]!, light))]!.push(quadPath);
  }
  const front = pathOf(oriented(high), true);
  fills.push(front);
  buckets[toneOf(dot([0, 1, 0], light))]!.push(front);

  const outline: string[] = [];
  const crease: string[] = [];
  const edge = (points: Flat[], run: number[]) => pathOf(run.map((index) => points[index]!));
  for (const run of runsOf(seen, false)) outline.push(edge(high, run));
  for (const run of runsOf(seen, true)) {
    crease.push(edge(high, run));
    outline.push(edge(low, run));
  }
  for (let index = 0; index < count; index++) {
    const prev = (index + count - 1) % count;
    if (seen[prev] !== seen[index]) outline.push(pathOf([high[index]!, low[index]!]));
    else if (seen[index]) {
      const a = normals[prev]!;
      const b = normals[index]!;
      if (a[0] * b[0] + a[2] * b[2] < SHARP) crease.push(pathOf([high[index]!, low[index]!]));
    }
  }
  return {
    fill: fills.join(""),
    outline: outline.join(""),
    crease: crease.join(""),
    top: buckets[4]!.join(""),
    shades: buckets.slice(0, 4).map((list) => list.join("")),
  };
}

/** Outline of a rotated rectangle: centre line from `from` to `to`, `thick` across, optionally with rounded ends. */
export function barPolygon(from: Flat, to: Flat, thick: number, round: [boolean, boolean] = [false, false], steps = 7): Flat[] {
  const heading = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const h = thick / 2;
  const left = heading + Math.PI / 2;
  const out: Flat[] = [];
  const arc = (centre: Flat, start: number) => {
    for (let step = 0; step <= steps; step++) {
      const angle = start + Math.PI * (step / steps);
      out.push([centre[0] + h * Math.cos(angle), centre[1] + h * Math.sin(angle)]);
    }
  };
  const corner = (centre: Flat, side: 1 | -1) => out.push([centre[0] + side * h * Math.cos(left), centre[1] + side * h * Math.sin(left)]);
  // right side forward, far end, left side back, near end
  if (round[1]) arc(to, heading - Math.PI / 2);
  else {
    corner(to, -1);
    corner(to, 1);
  }
  if (round[0]) arc(from, left);
  else {
    corner(from, 1);
    corner(from, -1);
  }
  return out;
}

/** A slot's outline (a stadium) along `from` → `to`, `width` across, as points to project. */
export function slotPolygon(from: Flat, to: Flat, width: number, steps = 6): Flat[] {
  return barPolygon(from, to, width, [true, true], steps);
}

/** Involute-ish spur gear, counter-clockwise from +x, tooth centred on `angle`; module `m`, `teeth` teeth. */
export function gearPolygon(teeth: number, module: number, angle: number): Flat[] {
  const pitch = (teeth * module) / 2;
  const tip = pitch + module;
  const root = pitch - 1.25 * module;
  const tau = (Math.PI * 2) / teeth;
  const out: Flat[] = [];
  for (let tooth = 0; tooth < teeth; tooth++) {
    const centre = angle + tooth * tau;
    const point = (offset: number, radius: number): Flat => [radius * Math.cos(centre + offset * tau), radius * Math.sin(centre + offset * tau)];
    out.push(point(-0.29, root), point(-0.15, tip), point(0.15, tip), point(0.29, root), point(0.5, root));
  }
  return out;
}

/** Points on the front face (plane y) for a polyline given in [x, z]. */
export const faceLine = (points: Flat[], y: number, P: Projection, closed = false) => pathOf(points.map(([x, z]) => iso([x, y, z], P)), closed);

/** A circle in the x–z plane at y. */
export function faceCircle(cx: number, cz: number, radius: number, y: number, P: Projection, steps = 28) {
  const points: Flat[] = [];
  for (let step = 0; step < steps; step++) {
    const angle = (step / steps) * Math.PI * 2;
    points.push([cx + radius * Math.cos(angle), cz + radius * Math.sin(angle)]);
  }
  return faceLine(points, y, P, true);
}

/** Rotate [x, z] about the origin by `angle` (counter-clockwise from +x towards +z). */
export const turned = ([x, z]: Flat, angle: number): Flat => [x * Math.cos(angle) - z * Math.sin(angle), x * Math.sin(angle) + z * Math.cos(angle)];
