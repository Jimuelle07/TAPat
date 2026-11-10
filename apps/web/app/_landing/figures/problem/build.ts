import {
  circleRing,
  extrude,
  iso,
  onTop,
  pathOf,
  planOutline,
  ring as ringOn,
  slabOf,
  type Flat,
  type Plan,
  type Plane,
  type Point3,
  type Projection,
} from "@/app/_landing/iso/iso-kit";

/** A recorded solid, plain data, read only by the audit script (never shipped to the client). */
export type Shape =
  | { name: string; kind: "slab"; plan: Plan; z: number; h: number; steps: number }
  | { name: string; kind: "ring"; ring: Plane[]; z: number; h: number }
  | { name: string; kind: "route"; points: Point3[]; r: number }
  | { name: string; kind: "prism"; polygon: Array<[number, number]>; y0: number; y1: number }
  | { name: string; kind: "lathe"; origin: Point3; axis: Point3; profile: Array<[number, number] | [number, number, number]> };

/** The kit bound to one projection, recording what it builds into `ledger`. */
export function kitOf(P: Projection, ledger: Shape[]) {
  const at = (point: Point3): Flat => iso(point, P);
  const slab = (name: string, plan: Plan, z: number, h: number, steps = 4, bevel = 0) => {
    ledger.push({ name, kind: "slab", plan, z, h, steps });
    return slabOf(plan, z, h, P, steps, bevel);
  };
  const cyl = (name: string, cx: number, cy: number, r: number, z: number, h: number, steps = 20, bevel = 0) => {
    const points = circleRing(cx, cy, r, steps);
    ledger.push({ name, kind: "ring", ring: points, z, h });
    return extrude(points, z, h, P, { convex: true, bevel });
  };
  const prism = (name: string, points: Plane[], z: number, h: number, convex = true) => {
    ledger.push({ name, kind: "ring", ring: points, z, h });
    return extrude(points, z, h, P, { convex });
  };
  const seg = (a: Point3, b: Point3) => pathOf([at(a), at(b)]);
  const top = (points: Plane[], z: number, closed = false) => onTop(points, z, P, closed);
  const ring = (cx: number, cy: number, r: number, z: number, steps = 24) => ringOn(cx, cy, r, z, P, steps);
  const outline = (plan: Plan, z: number, steps = 4) => planOutline(plan, z, P, steps);
  return { at, slab, cyl, prism, seg, top, ring, outline };
}

