import * as A from "../../iso/audit.mjs";
import { cylinder, iso, pathOf, slabOf, sideMatrix, type Flat, type LineTone, type Plan, type Point3, type SolidPaths, type Tone } from "../../iso/iso-kit";
import * as G from "../../iso/lathe.mjs";
import { P, PIECES, PIECE_ORDER, SPRING } from "./view";

// One drawn thing: a solid plus the lines, dots and engraved text that belong to it. Its recorded shapes are what the audit proves.
export interface LineSpec {
  d: string;
  tone: LineTone;
  dotted?: boolean;
  free?: boolean | "start" | "end";
  flow?: boolean;
  className?: string;
}

export interface DotSpec {
  points: Array<Flat | [number, number, number]>;
  size: number;
  tone: Tone;
}

export interface TextSpec {
  transform: string;
  text: string;
  size: number;
  tone: Tone;
  anchor: "start" | "middle" | "end";
  live?: string;
}

export interface Part {
  id: string;
  piece: string;
  ride: string;
  tone: Tone;
  crease: Tone | "none";
  lit: boolean;
  flat: boolean;
  halo: boolean;
  paths: SolidPaths;
  inner: string;
  lines: LineSpec[];
  dots: DotSpec[];
  texts: TextSpec[];
  at: Point3;
  bias: number;
  live: string;
  shapes: unknown[];
}

export interface Opt {
  tone?: Tone;
  crease?: Tone | "none";
  piece?: string;
  ride?: string;
  lit?: boolean;
  flat?: boolean;
  halo?: boolean;
  inner?: string;
  lines?: LineSpec[];
  dots?: DotSpec[];
  texts?: TextSpec[];
  bias?: number;
  ground?: boolean;
  live?: string;
  steps?: number;
  bevel?: number;
}

export interface Frame {
  o: Point3;
  a: Point3;
  u: Point3;
  v: Point3;
}

export interface Recorder {
  items: Array<{ key: number; name: string }>;
  solids: unknown[];
  settled: unknown;
  P: typeof P;
  put: (item: object) => unknown;
  solid: (shape: unknown) => unknown;
}

export interface Scene {
  R: Recorder;
  parts: Part[];
  slab: (id: string, plan: Plan, z: number, h: number, o?: Opt) => Part;
  cyl: (id: string, cx: number, cy: number, r: number, z: number, h: number, o?: Opt) => Part;
  disc: (id: string, frame: Frame, s0: number, s1: number, r: number, o?: Opt) => Part;
  prism: (id: string, frame: Frame, polygon: Array<[number, number]>, s0: number, s1: number, o?: Opt) => Part;
}

export const line = (d: string, tone: LineTone = "lo", extra: Partial<LineSpec> = {}): LineSpec => ({ d, tone, ...extra });
export const dots = (points: Array<Flat | [number, number, number]>, size = 0.5, tone: Tone = "mid"): DotSpec => ({ points, size, tone });

// Engraved text on a +y face: x along the face, baseline at height z, standing on plane y.
export const textY = (x: number, y: number, z: number, text: string, size = 3, tone: Tone = "mid", anchor: TextSpec["anchor"] = "middle", live = ""): TextSpec => ({
  transform: sideMatrix([x, y], z, P, "left"),
  text,
  size,
  tone,
  anchor,
  live: live || undefined,
});

export const at3 = (p: Point3): Flat => iso(p, P);
export const onY = (y: number, points: Array<[number, number]>, closed = false) =>
  pathOf(
    points.map(([x, z]) => at3([x, y, z])),
    closed,
  );
export const onX = (x: number, points: Array<[number, number]>, closed = false) =>
  pathOf(
    points.map(([y, z]) => at3([x, y, z])),
    closed,
  );
export const dotsY = (y: number, points: Array<[number, number]>) => points.map(([x, z]) => at3([x, y, z]));
export const dotsX = (x: number, points: Array<[number, number]>) => points.map(([y, z]) => at3([x, y, z]));
export const dotsZ = (z: number, points: Array<[number, number]>) => points.map(([x, y]) => at3([x, y, z]));

// Rounded rectangle outline on a vertical face (corner radius r), as (u, z) points.
export function rrect(x: number, z: number, w: number, h: number, r: number, steps = 4): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const corners: Array<[number, number, number]> = [
    [x + w - r, z + r, -90],
    [x + w - r, z + h - r, 0],
    [x + r, z + h - r, 90],
    [x + r, z + r, 180],
  ];
  for (const [cx, cz, start] of corners) {
    for (let step = 0; step <= (r > 0 ? steps : 0); step++) {
      const angle = ((start + (r > 0 ? (90 * step) / steps : 45)) * Math.PI) / 180;
      out.push([cx + r * Math.cos(angle), cz + r * Math.sin(angle)]);
    }
  }
  return out;
}

export function createScene(order: string[] = PIECE_ORDER): Scene {
  // The kit's audit.mjs is untyped: its recorder is declared here by the members this figure uses.
  const R: Recorder = A.recorder(P, { order: order as never[], spring: SPRING }) as unknown as Recorder;
  const parts: Part[] = [];
  const ids = new Set<string>();

  function put(part: Part) {
    if (ids.has(part.id)) throw new Error(`duplicate part ${part.id}`);
    ids.add(part.id);
    const move = part.piece ? PIECES[part.piece] : undefined;
    if (part.piece && !move) throw new Error(`unknown piece ${part.piece}`);
    R.put({ at: part.at, bias: part.bias, name: part.id, piece: part.piece, ride: part.ride || part.piece, move: move ?? [0, 0, 0], shapes: part.shapes });
    parts.push(part);
    return part;
  }

  const recorded = (shapes: unknown[]) => shapes.map((shape) => R.solid(shape));

  const base = (id: string, at: Point3, paths: SolidPaths, shapes: unknown[], o: Opt): Part => ({
    id,
    piece: o.piece ?? "",
    ride: o.ride ?? "",
    tone: o.tone ?? "mid",
    crease: o.crease ?? "faint",
    lit: o.lit ?? false,
    flat: o.flat ?? false,
    halo: o.halo ?? false,
    paths,
    inner: o.inner ?? "",
    lines: o.lines ?? [],
    dots: o.dots ?? [],
    texts: o.texts ?? [],
    at,
    bias: o.bias ?? 0,
    live: o.live ?? "",
    shapes: recorded(shapes),
  });

  const slab = (id: string, plan: Plan, z: number, h: number, o: Opt = {}) => {
    const steps = o.steps ?? 3;
    const meta = { name: o.ground ? `stand.${id}` : id };
    return put(base(id, [plan.x + plan.w / 2, plan.y + plan.d / 2, z + h / 2], slabOf(plan, z, h, P, steps, o.bevel ?? 0), [A.slab(plan, z, h, meta, steps)], o));
  };

  const cyl = (id: string, cx: number, cy: number, r: number, z: number, h: number, o: Opt = {}) => {
    const steps = o.steps ?? 24;
    return put(base(id, [cx, cy, z + h / 2], cylinder(cx, cy, r, z, h, P, steps, o.bevel ?? 0), [A.cylinder(cx, cy, r, z, h, { name: id })], o));
  };

  // A round part along any axis: s0..s1 from the frame origin, radius r.
  const disc = (id: string, frame: Frame, s0: number, s1: number, r: number, o: Opt = {}) => {
    const mid = G.add3(frame.o, G.mul3(frame.a, (s0 + s1) / 2)) as Point3;
    return put(base(id, mid, G.disc(s0, s1, r, frame, P, o.steps ? { steps: o.steps } : {}), [A.disc(frame, s0, s1, r, { name: id })], o));
  };

  // Any convex polygon in the frame's u,v plane, extruded along F.a from s0 to s1.
  const prism = (id: string, frame: Frame, polygon: Array<[number, number]>, s0: number, s1: number, o: Opt = {}) => {
    const cu = polygon.reduce((sum, [u]) => sum + u, 0) / polygon.length;
    const cv = polygon.reduce((sum, [, v]) => sum + v, 0) / polygon.length;
    const mid = G.add3(G.add3(frame.o, G.mul3(frame.a, (s0 + s1) / 2)), G.add3(G.mul3(frame.u, cu), G.mul3(frame.v, cv))) as Point3;
    return put(base(id, mid, G.prismOf(frame, polygon, s0, s1, P), [A.prism(frame, polygon, s0, s1, { name: id })], o));
  };

  return { R, parts, slab, cyl, disc, prism };
}
