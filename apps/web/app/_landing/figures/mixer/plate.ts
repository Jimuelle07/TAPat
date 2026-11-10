/*
 * Prisms the kit's floor-standing `extrude` can't draw: any outline in the vertical x–z plane, extruded along y.
 * Levers, racks and gears of the mechanism are this. Pure TypeScript, so the live component can rebuild a turning
 * gear or a tilting lever every frame. The projection and the path text are inlined (same arithmetic and the same
 * tenth-of-a-unit rounding as the kit's `iso` and `pathOf`, so the output is character-for-character the kit's), with
 * the camera worked out once per projection and scratch buffers reused, because the live loop calls this every frame.
 */
import type { Flat, Plane, Projection, SolidPaths } from "../../iso/iso-kit";
import { cameraOf } from "../../iso/iso-kit";

const BANDS = [0, 0.2, 0.42, 0.62];
const LIGHT_UP = 1.2;

// ---------------------------------------------------------------------------------------------- text

const TEXT_FROM = -3000;
const TEXT_TO = 12000;
const TEXTS: string[] = [];

/** A coordinate to a tenth, as the kit writes it: "12.3", "12", "-0.5", never "-0". Shared strings for the usual range. */
export function tenth(value: number): string {
  const r = Math.round(value * 10);
  if (r === 0) return "0";
  if (r >= TEXT_FROM && r < TEXT_TO) return (TEXTS[r - TEXT_FROM] ??= tenthText(r));
  return tenthText(r);
}

function tenthText(r: number): string {
  const a = r < 0 ? -r : r;
  const whole = Math.floor(a / 10);
  const frac = a - whole * 10;
  return (r < 0 ? "-" : "") + whole + (frac ? "." + frac : "");
}

// ---------------------------------------------------------------------------------------------- camera

interface Cam {
  ox: number;
  oy: number;
  sinA: number;
  cosA: number;
  sinE: number;
  cosE: number;
  k: number;
  /** the direction to the viewer and the light, for the x–z plane's normals (y of a normal is 0) */
  view0: number;
  view2: number;
  light0: number;
  light2: number;
  frontTone: number;
}

const toneOf = (score: number) => {
  let tone = 0;
  while (tone < BANDS.length && score >= BANDS[tone]!) tone++;
  return tone;
};

let lastProjection: Projection | null = null;
let lastCam: Cam | null = null;

function camOf(P: Projection): Cam {
  if (P === lastProjection && lastCam) return lastCam;
  const { sinA, cosA, sinE, cosE, k } = cameraOf(P);
  const length = Math.hypot(-sinA, cosA, LIGHT_UP) || 1;
  const light: [number, number, number] = [-sinA / length, cosA / length, LIGHT_UP / length];
  lastCam = {
    ox: P.origin[0],
    oy: P.origin[1],
    sinA,
    cosA,
    sinE,
    cosE,
    k,
    view0: cosA * cosE,
    view2: sinE,
    light0: light[0],
    light2: light[2],
    frontTone: toneOf(0 * light[0] + 1 * light[1] + 0 * light[2]),
  };
  lastProjection = P;
  return lastCam;
}

// ---------------------------------------------------------------------------------------------- scratch

let cap = 0;
let rx = new Float64Array(0);
let rz = new Float64Array(0);
let lowX = new Float64Array(0);
let lowY = new Float64Array(0);
let highX = new Float64Array(0);
let highY = new Float64Array(0);
let nx = new Float64Array(0);
let nz = new Float64Array(0);
let seen = new Uint8Array(0);
/** "x y" of every low and high vertex, written once and shared by the edges that meet there */
let lowS: string[] = [];
let highS: string[] = [];

function room(count: number) {
  if (count <= cap) return;
  cap = Math.max(count, cap * 2, 256);
  rx = new Float64Array(cap);
  rz = new Float64Array(cap);
  lowX = new Float64Array(cap);
  lowY = new Float64Array(cap);
  highX = new Float64Array(cap);
  highY = new Float64Array(cap);
  nx = new Float64Array(cap);
  nz = new Float64Array(cap);
  seen = new Uint8Array(cap);
  lowS = new Array<string>(cap).fill("");
  highS = new Array<string>(cap).fill("");
}

function vertexTexts(count: number) {
  for (let index = 0; index < count; index++) {
    lowS[index] = tenth(lowX[index]!) + " " + tenth(lowY[index]!);
    highS[index] = tenth(highX[index]!) + " " + tenth(highY[index]!);
  }
}

/** The path through the vertices at `at`: M then L. */
function pathAt(texts: string[], at: ArrayLike<number>): string {
  let text = "";
  for (let step = 0; step < at.length; step++) text += (step ? "L" : "M") + texts[at[step]!];
  return text;
}

/** A closed quad a-b-c-d, written counter-clockwise on screen whichever way round it came. */
function quadPath(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number, a: string, b: string, c: string, d: string): string {
  const area = ax * by - bx * ay + (bx * cy - cx * by) + (cx * dy - dx * cy) + (dx * ay - ax * dy);
  if (area < 0) return "M" + d + "L" + c + "L" + b + "L" + a + "Z";
  return "M" + a + "L" + b + "L" + c + "L" + d + "Z";
}

/** The ring of vertices 0 … count-1, closed, written counter-clockwise on screen whichever way round it came. */
function ringPath(xs: Float64Array, ys: Float64Array, texts: string[], count: number): string {
  let area = 0;
  for (let index = 0; index < count; index++) {
    const next = index + 1 === count ? 0 : index + 1;
    area += xs[index]! * ys[next]! - xs[next]! * ys[index]!;
  }
  let text = "";
  if (area < 0) {
    for (let step = 0; step < count; step++) text += (step ? "L" : "M") + texts[count - 1 - step];
  } else {
    for (let index = 0; index < count; index++) text += (index ? "L" : "M") + texts[index];
  }
  return text + "Z";
}

/** Consecutive indices (closed ring) whose flag equals `want`, as runs that include the closing vertex. */
function runsOf(flags: Uint8Array, count: number, want: number) {
  let start = -1;
  for (let index = 0; index < count; index++) {
    if (flags[index] !== flags[(index + count - 1) % count]) {
      start = index;
      break;
    }
  }
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
  const { ox, oy, sinA, cosA, sinE, cosE, k, view0, view2, light0, light2, frontTone } = camOf(P);
  const count = polygon.length;
  room(count);
  // counter-clockwise in x–z, so the outward normal of an edge is (dz, 0, -dx)
  let area = 0;
  for (let index = 0; index < count; index++) {
    const a = polygon[index]!;
    const b = polygon[index + 1 === count ? 0 : index + 1]!;
    area += a[0] * b[1] - b[0] * a[1];
  }
  const flip = area < 0;
  for (let index = 0; index < count; index++) {
    const point = polygon[flip ? count - 1 - index : index]!;
    const x = point[0];
    const z = point[1];
    rx[index] = x;
    rz[index] = z;
    lowX[index] = ox + (x * sinA - y0 * cosA) * k;
    lowY[index] = oy + ((x * cosA + y0 * sinA) * sinE - z * cosE) * k;
    highX[index] = ox + (x * sinA - y1 * cosA) * k;
    highY[index] = oy + ((x * cosA + y1 * sinA) * sinE - z * cosE) * k;
  }
  for (let index = 0; index < count; index++) {
    const next = index + 1 === count ? 0 : index + 1;
    const x = rz[next]! - rz[index]!;
    const z = -(rx[next]! - rx[index]!);
    const length = Math.sqrt(x * x + z * z) || 1;
    nx[index] = x / length;
    nz[index] = z / length;
    seen[index] = nx[index]! * view0 + nz[index]! * view2 > 1e-6 ? 1 : 0;
  }
  vertexTexts(count);
  let fill = "";
  const buckets = ["", "", "", "", ""];
  for (let index = 0; index < count; index++) {
    if (!seen[index]) continue;
    const next = index + 1 === count ? 0 : index + 1;
    const quadText = quadPath(lowX[index]!, lowY[index]!, lowX[next]!, lowY[next]!, highX[next]!, highY[next]!, highX[index]!, highY[index]!, lowS[index]!, lowS[next]!, highS[next]!, highS[index]!);
    fill += quadText;
    buckets[toneOf(nx[index]! * light0 + nz[index]! * light2)] += quadText;
  }
  const front = ringPath(highX, highY, highS, count);
  fill += front;
  buckets[frontTone] += front;

  let outline = "";
  let creases = "";
  for (const run of runsOf(seen, count, 0)) outline += pathAt(highS, run);
  for (const run of runsOf(seen, count, 1)) {
    creases += pathAt(highS, run);
    outline += pathAt(lowS, run);
  }
  for (let index = 0; index < count; index++) {
    const prev = (index + count - 1) % count;
    if (seen[prev] !== seen[index]) outline += "M" + highS[index] + "L" + lowS[index];
    else if (seen[index] && nx[prev]! * nx[index]! + nz[prev]! * nz[index]! < SHARP) creases += "M" + highS[index] + "L" + lowS[index];
  }
  return { fill, outline, crease: creases, top: buckets[4]!, shades: [buckets[0]!, buckets[1]!, buckets[2]!, buckets[3]!] };
}

/**
 * The kit's `extrude` for a concave floor-standing ring ({ convex: false }), with the same output, minus its per-call
 * allocations: the live loop rebuilds the dial wheel and the calendar cam with it every frame.
 */
export function ringPrism(ring: Plane[], z: number, height: number, P: Projection, bevel = 0): SolidPaths {
  const { ox, oy, sinA, cosA, sinE, cosE, k } = camOf(P);
  const count = ring.length;
  room(count);
  let area = 0;
  for (let index = 0; index < count; index++) {
    const a = ring[index]!;
    const b = ring[index + 1 === count ? 0 : index + 1]!;
    area += a[0] * b[1] - b[0] * a[1];
  }
  const counter = area / 2 > 0;
  const zTop = z + height;
  const SHADE = 4;
  const vx = cosA;
  const vy = sinA;
  const lx = -sinA;
  const ly = cosA;
  for (let index = 0; index < count; index++) {
    const [x, y] = ring[index]!;
    rx[index] = x;
    rz[index] = y;
    highX[index] = ox + (x * sinA - y * cosA) * k;
    highY[index] = oy + ((x * cosA + y * sinA) * sinE - zTop * cosE) * k;
    lowX[index] = highX[index]!;
    lowY[index] = oy + ((x * cosA + y * sinA) * sinE - z * cosE) * k;
  }
  for (let index = 0; index < count; index++) {
    const next = index + 1 === count ? 0 : index + 1;
    const dx = rx[next]! - rx[index]!;
    const dy = rz[next]! - rz[index]!;
    const length = Math.sqrt(dx * dx + dy * dy) || 1;
    nx[index] = counter ? dy / length : -dy / length;
    nz[index] = counter ? -dx / length : dx / length;
    seen[index] = nx[index]! * vx + nz[index]! * vy > 1e-9 ? 1 : 0;
  }
  vertexTexts(count);
  let outline = "";
  let crease = "";
  for (const run of runsOf(seen, count, 0)) outline += pathAt(highS, run);
  for (const run of runsOf(seen, count, 1)) {
    crease += pathAt(highS, run);
    if (height > 0) outline += pathAt(lowS, run);
  }
  if (height > 0) {
    for (let index = 0; index < count; index++) {
      if (seen[(index + count - 1) % count] !== seen[index]) outline += "M" + highS[index] + "L" + lowS[index];
    }
  }
  let fill = ringPath(highX, highY, highS, count) + ringPath(lowX, lowY, lowS, count);
  const shades = ["", "", "", ""];
  for (let index = 0; index < count; index++) {
    if (!seen[index]) continue;
    const next = index + 1 === count ? 0 : index + 1;
    const quadText = quadPath(highX[index]!, highY[index]!, highX[next]!, highY[next]!, lowX[next]!, lowY[next]!, lowX[index]!, lowY[index]!, highS[index]!, highS[next]!, lowS[next]!, lowS[index]!);
    fill += quadText;
    if (height > 0) {
      const lit = (nx[index]! * lx + nz[index]! * ly + 1) / 2;
      shades[Math.min(SHADE - 1, Math.max(0, Math.floor(lit * SHADE)))] += quadText;
    }
  }
  let bevelText: string | undefined;
  if (bevel > 0) {
    bevelText = "";
    for (const run of runsOf(seen, count, 1)) {
      for (let step = 0; step < run.length; step++) {
        const index = run[step]!;
        let x = highX[index]!;
        let y = highY[index]!;
        if (step > 0 && step < run.length - 1) {
          const prev = (index + count - 1) % count;
          const mx = nx[prev]! + nx[index]!;
          const my = nz[prev]! + nz[index]!;
          const length = Math.sqrt(mx * mx + my * my) || 1;
          const px = rx[index]! - (mx / length) * bevel;
          const py = rz[index]! - (my / length) * bevel;
          x = ox + (px * sinA - py * cosA) * k;
          y = oy + ((px * cosA + py * sinA) * sinE - zTop * cosE) * k;
        }
        bevelText += (step ? "L" : "M") + tenth(x) + " " + tenth(y);
      }
    }
  }
  return { fill, outline, crease, top: ringPath(highX, highY, highS, count), shades, bevel: bevelText };
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

/** Involute-ish spur gear, counter-clockwise from +x, tooth centred on `angle`; module `m`, `teeth` teeth. `dx`, `dz` move its centre. */
export function gearPolygon(teeth: number, module: number, angle: number, dx = 0, dz = 0): Flat[] {
  const pitch = (teeth * module) / 2;
  const tip = pitch + module;
  const root = pitch - 1.25 * module;
  const tau = (Math.PI * 2) / teeth;
  const out: Flat[] = new Array(teeth * 5);
  let at = 0;
  for (let tooth = 0; tooth < teeth; tooth++) {
    const centre = angle + tooth * tau;
    for (let corner = 0; corner < 5; corner++) {
      const offset = OFFSETS[corner]!;
      const radius = RADII[corner] === 0 ? root : tip;
      out[at++] = [radius * Math.cos(centre + offset * tau) + dx, radius * Math.sin(centre + offset * tau) + dz];
    }
  }
  return out;
}

/** A tooth's five corners: angle in teeth, then root (0) or tip (1). */
const OFFSETS = [-0.29, -0.15, 0.15, 0.29, 0.5];
const RADII = [0, 1, 1, 0, 0];

/** Points on the front face (plane y) for a polyline given in [x, z]. */
export function faceLine(points: Flat[], y: number, P: Projection, closed = false): string {
  const { ox, oy, sinA, cosA, sinE, cosE, k } = camOf(P);
  let text = "";
  for (let index = 0; index < points.length; index++) {
    const [x, z] = points[index]!;
    text += (index ? "L" : "M") + tenth(ox + (x * sinA - y * cosA) * k) + " " + tenth(oy + ((x * cosA + y * sinA) * sinE - z * cosE) * k);
  }
  return text && closed ? text + "Z" : text;
}

/** The kit's `onTop` for one segment on a floor plane at height z: the path from [ax, ay] to [bx, by]. */
export function floorSegment(ax: number, ay: number, bx: number, by: number, z: number, P: Projection): string {
  const { ox, oy, sinA, cosA, sinE, cosE, k } = camOf(P);
  return (
    "M" + tenth(ox + (ax * sinA - ay * cosA) * k) + " " + tenth(oy + ((ax * cosA + ay * sinA) * sinE - z * cosE) * k) +
    "L" + tenth(ox + (bx * sinA - by * cosA) * k) + " " + tenth(oy + ((bx * cosA + by * sinA) * sinE - z * cosE) * k)
  );
}

/** A circle in the x–z plane at y. */
export function faceCircle(cx: number, cz: number, radius: number, y: number, P: Projection, steps = 28) {
  const { ox, oy, sinA, cosA, sinE, cosE, k } = camOf(P);
  let text = "";
  for (let step = 0; step < steps; step++) {
    const angle = (step / steps) * Math.PI * 2;
    const x = cx + radius * Math.cos(angle);
    const z = cz + radius * Math.sin(angle);
    text += (step ? "L" : "M") + tenth(ox + (x * sinA - y * cosA) * k) + " " + tenth(oy + ((x * cosA + y * sinA) * sinE - z * cosE) * k);
  }
  return text && steps > 0 ? text + "Z" : text;
}

/** Rotate [x, z] about the origin by `angle` (counter-clockwise from +x towards +z). */
export const turned = ([x, z]: Flat, angle: number): Flat => [x * Math.cos(angle) - z * Math.sin(angle), x * Math.sin(angle) + z * Math.cos(angle)];
