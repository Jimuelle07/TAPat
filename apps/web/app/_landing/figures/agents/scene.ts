import * as A from "../../iso/audit.mjs";
import {
  cylinder,
  depthOf,
  slabOf,
  type Flat,
  type LineTone,
  type Plan,
  type Point3,
  type Projection,
  type SolidPaths,
  type Tone,
} from "../../iso/iso-kit";

/*
 * Build-time scene for the two agent figures (never imported by the app: `build.ts` runs it and writes the `*.gen.ts` strings the compositions
 * import). A part is one solid plus the lines, dots and engraved text that belong to it. `slot` names the live group that moves it, empty for
 * static parts. Every part records its true shape, so the kit's audit can prove the geometry and settle the painter's keys.
 */

export interface LineSpec {
  d: string;
  tone: LineTone;
  dotted?: boolean;
  free?: boolean | "start" | "end";
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
}

export interface Part {
  id: string;
  slot: string;
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
  /** Wrapper class, for CSS that restyles a part (lamps that light up, tokens that fade). */
  cls: string;
  /** A drawn copy of another part (a pooled token): it takes that part's painter's key and records no shape. */
  twin: string;
  /** Painter's key just after this part (a token that has passed a gate). Records no shape. */
  after: string;
  shapes: unknown[];
}

export interface Opt {
  tone?: Tone;
  crease?: Tone | "none";
  slot?: string;
  lit?: boolean;
  flat?: boolean;
  halo?: boolean;
  inner?: string;
  lines?: LineSpec[];
  dots?: DotSpec[];
  texts?: TextSpec[];
  bias?: number;
  ground?: boolean;
  steps?: number;
  bevel?: number;
  cls?: string;
  twin?: string;
  after?: string;
}

/** The recorder is untyped (audit.mjs): the members this figure uses. */
export interface Recorder {
  items: Array<{ key: number; name: string }>;
  solids: unknown[];
  P: Projection;
  put: (item: object) => unknown;
  solid: (shape: unknown) => unknown;
}

export interface Scene {
  R: Recorder;
  parts: Part[];
  slab: (id: string, plan: Plan, z: number, h: number, o?: Opt) => Part;
  cyl: (id: string, cx: number, cy: number, r: number, z: number, h: number, o?: Opt) => Part;
}

export const line = (d: string, tone: LineTone = "lo", extra: Partial<LineSpec> = {}): LineSpec => ({ d, tone, ...extra });
export const dots = (points: Array<Flat | [number, number, number]>, size = 0.5, tone: Tone = "mid"): DotSpec => ({ points, size, tone });

/** A pose: how far each slot is moved from its rest position, in world units. The audit builds the scene at the extremes of every slot. */
export type Pose = Record<string, Point3>;

export function createScene(P: Projection, pose: Pose = {}): Scene {
  const R = A.recorder(P, {}) as unknown as Recorder;
  const parts: Part[] = [];
  const ids = new Set<string>();

  const put = (part: Part) => {
    if (ids.has(part.id)) throw new Error(`duplicate part ${part.id}`);
    ids.add(part.id);
    const offset = part.slot ? pose[part.slot] : undefined;
    const shapes = part.shapes.map((shape) => R.solid(offset ? A.moved(shape, offset) : shape));
    if (part.twin || part.after) {
      parts.push(part);
      return part;
    }
    R.put({ at: offset ? ([part.at[0] + offset[0], part.at[1] + offset[1], part.at[2] + offset[2]] as Point3) : part.at, bias: part.bias, name: part.id, shapes });
    parts.push(part);
    return part;
  };

  const base = (id: string, at: Point3, paths: SolidPaths, shapes: unknown[], o: Opt): Part => ({
    id,
    slot: o.slot ?? "",
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
    cls: o.cls ?? "",
    twin: o.twin ?? "",
    after: o.after ?? "",
    shapes: o.twin || o.after ? [] : shapes,
  });

  const slab = (id: string, plan: Plan, z: number, h: number, o: Opt = {}) => {
    const steps = o.steps ?? 3;
    const meta = { name: o.ground ? `stand.${id}` : id };
    return put(base(id, [plan.x + plan.w / 2, plan.y + plan.d / 2, z + h / 2], slabOf(plan, z, h, P, steps, o.bevel ?? 0), [A.slab(plan, z, h, meta, steps)], o));
  };

  const cyl = (id: string, cx: number, cy: number, r: number, z: number, h: number, o: Opt = {}) => {
    const steps = o.steps ?? 20;
    const meta = { name: o.ground ? `stand.${id}` : id };
    return put(base(id, [cx, cy, z + h / 2], cylinder(cx, cy, r, z, h, P, steps, o.bevel ?? 0), [A.cylinder(cx, cy, r, z, h, meta)], o));
  };

  return { R, parts, slab, cyl };
}

/** Painter's key of a part when the audit has not settled one (centre depth plus bias). */
export const keyOf = (part: Part, P: Projection) => depthOf(part.at, P) + part.bias;
