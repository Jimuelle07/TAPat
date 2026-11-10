import { cylinder, extrude, onTop, ring, segment, sideSeam, slabOf, towardViewer, type Flat, type Plan, type Plane, type Point3, type SolidPaths } from "@/app/_landing/iso/iso-kit";
import * as G from "@/app/_landing/iso/lathe.mjs";
import { P, at } from "./view";

/* Small builders over the kit, bound to this figure's projection. Each solid also remembers the true shape it was drawn
   from (held weakly, keyed by the drawn paths), so audit.ts can check painter's order on the real geometry. */

type Frame = { o: Point3; a: Point3; u: Point3; v: Point3 };
export type Shape =
  | { k: "slab"; plan: Plan; z: number; h: number; steps: number }
  | { k: "cyl"; cx: number; cy: number; r: number; z: number; h: number }
  | { k: "disc"; F: Frame; s0: number; s1: number; r: number }
  | { k: "prism"; F: Frame; polygon: Array<[number, number]>; s0: number; s1: number }
  | { k: "poly"; ring: Plane[]; z: number; h: number }
  | { k: "ball"; c: Point3; r: number };

const SHAPES = new WeakMap<object, Shape>();
const remember = <T extends object>(paths: T, shape: Shape): T => (SHAPES.set(paths, shape), paths);
export const shapeOf = (paths: SolidPaths): Shape | undefined => SHAPES.get(paths);

export const slab = (x: number, y: number, w: number, d: number, z: number, h: number, r = 1.2, steps = 3, bevel = 0.5) => slabP({ x, y, w, d, r }, z, h, steps, bevel);
export const slabP = (plan: Plan, z: number, h: number, steps = 3, bevel = 0.5) => remember(slabOf(plan, z, h, P, steps, bevel), { k: "slab", plan, z, h, steps });
/* A trim line round the visible faces of a slab, ending on its silhouette: pass it as the solid's inner. */
export const seam = (x: number, y: number, w: number, d: number, r: number, z: number, steps = 3) => sideSeam({ x, y, w, d, r }, z, P, steps);
export const cyl = (cx: number, cy: number, r: number, z: number, h: number, steps = 24, bevel = 0) => remember(cylinder(cx, cy, r, z, h, P, steps, bevel), { k: "cyl", cx, cy, r, z, h });
export const seg = (a: Point3, b: Point3) => segment(a, b, P);
export const circle = (cx: number, cy: number, r: number, z: number, steps = 24) => ring(cx, cy, r, z, P, steps);
export const top = (points: Plane[], z: number, closed = false) => onTop(points, z, P, closed);
export const dotsAt = (points: Plane[], z: number): Flat[] => points.map(([x, y]) => at([x, y, z]));

/* Frames for round parts. alongY: axis +y (toward the viewer), angle 0 is +x, 90° is +z.
   alongX: axis +x, angle 0 is +y, 90° is +z. */
export const alongY = (x: number, y: number, z: number) => G.frameOf([x, y, z], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
export const alongX = (x: number, y: number, z: number) => G.frameOf([x, y, z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);

/* A round part lying along y: from y0 for len. */
export const discY = (x: number, y0: number, z: number, r: number, len: number) => {
  const F = alongY(x, y0, z);
  return remember(G.disc(0, len, r, F, P), { k: "disc", F, s0: 0, s1: len, r });
};
/* A round part lying along x: from x0 for len. */
export const discX = (x0: number, y: number, z: number, r: number, len: number) => {
  const F = alongX(x0, y, z);
  return remember(G.disc(0, len, r, F, P), { k: "disc", F, s0: 0, s1: len, r });
};

/* Convex prisms from a polygon in a vertical plane: yz extruded along x, xz extruded along y. */
export const prismYZ = (x0: number, x1: number, polygon: Array<[number, number]>) => {
  const F = G.frameOf([x0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  return remember(G.prismOf(F, polygon, 0, x1 - x0, P), { k: "prism", F, polygon, s0: 0, s1: x1 - x0 });
};
export const prismXZ = (y0: number, y1: number, polygon: Array<[number, number]>) => {
  const F = G.frameOf([0, y0, 0], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  return remember(G.prismOf(F, polygon, 0, y1 - y0, P), { k: "prism", F, polygon, s0: 0, s1: y1 - y0 });
};

/* A ring on a face that stands in a plane. */
export const faceRingY = (cx: number, y: number, cz: number, r: number, steps = 28) => G.circleOf(alongY(cx, y, cz), 0, r, P, steps);
export const faceRingX = (x: number, cy: number, cz: number, r: number, steps = 28) => G.circleOf(alongX(x, cy, cz), 0, r, P, steps);

export const ball = (cx: number, cy: number, cz: number, r: number) => remember(G.sphereOf([cx, cy, cz], r, P), { k: "ball", c: [cx, cy, cz], r });

/* Split round parts. A part that wraps another (a sleeve round a spindle) is cut by the plane through its axis that faces
   the camera: the back half is painted before the wrapped part and the front half after it. The cut runs through the
   silhouette, so the halves meet without a seam. side: 1 is the front half, -1 the back half. */
const arc = (from: number, to: number, steps: number) => Array.from({ length: steps + 1 }, (_, i) => from + ((to - from) * i) / steps);

/* A half of an upright ring (a sleeve): outer radius rOut, bore rIn. */
export const halfRing = (cx: number, cy: number, rIn: number, rOut: number, z: number, h: number, side: 1 | -1, steps = 12) => {
  const [vx, vy] = towardViewer(P);
  const mid = Math.atan2(vy, vx) + (side === 1 ? 0 : Math.PI);
  const outer = arc(mid - Math.PI / 2, mid + Math.PI / 2, steps);
  const ringPlan: Plane[] = [...outer.map((a): Plane => [cx + rOut * Math.cos(a), cy + rOut * Math.sin(a)]), ...[...outer].reverse().map((a): Plane => [cx + rIn * Math.cos(a), cy + rIn * Math.sin(a)])];
  return remember(extrude(ringPlan, z, h, P, { convex: false }), { k: "poly", ring: ringPlan, z, h });
};

/* The same cut for a circle drawn on the ring's top face: the arc of the half that faces the camera (side 1) or away from it. */
export const halfCircle = (cx: number, cy: number, r: number, z: number, side: 1 | -1, steps = 12) => {
  const [vx, vy] = towardViewer(P);
  const mid = Math.atan2(vy, vx) + (side === 1 ? 0 : Math.PI);
  return onTop(arc(mid - Math.PI / 2, mid + Math.PI / 2, steps).map((a): Plane => [cx + r * Math.cos(a), cy + r * Math.sin(a)]), z, P);
};

/* A closed rectangle on a vertical plane (a recess or window outline). */
export const rectY = (x0: number, x1: number, y: number, z0: number, z1: number) =>
  `M${at([x0, y, z0]).map((v) => Math.round(v * 10) / 10).join(" ")}L${at([x1, y, z0]).map((v) => Math.round(v * 10) / 10).join(" ")}L${at([x1, y, z1]).map((v) => Math.round(v * 10) / 10).join(" ")}L${at([x0, y, z1]).map((v) => Math.round(v * 10) / 10).join(" ")}Z`;
export const rectX = (x: number, y0: number, y1: number, z0: number, z1: number) =>
  `M${at([x, y0, z0]).map((v) => Math.round(v * 10) / 10).join(" ")}L${at([x, y1, z0]).map((v) => Math.round(v * 10) / 10).join(" ")}L${at([x, y1, z1]).map((v) => Math.round(v * 10) / 10).join(" ")}L${at([x, y0, z1]).map((v) => Math.round(v * 10) / 10).join(" ")}Z`;

export const RAD = Math.PI / 180;
