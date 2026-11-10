import { iso, type Plan, type Point3, type Projection } from "@/app/_landing/iso/iso-kit";

export type ProblemKind = "drivers" | "leak" | "unpaid" | "queue";

export interface FitBox {
  azimuth: number;
  elevation?: number;
  /** left, top, right, bottom padding in viewBox px (room for the plate corners). */
  pad: [number, number, number, number];
}

/** Fit points into a viewBox with padding per side, keeping the scale uniform. */
export function fit(points: Point3[], width: number, height: number, { azimuth, elevation = 30, pad }: FitBox): Projection {
  const unit: Projection = { origin: [0, 0], scale: 1, azimuth, elevation };
  const flat = points.map((point) => iso(point, unit));
  const xs = flat.map(([x]) => x);
  const ys = flat.map(([, y]) => y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const up = Math.min(...ys);
  const down = Math.max(...ys);
  const [pl, pt, pr, pb] = pad;
  const scale = Math.min((width - pl - pr) / (right - left), (height - pt - pb) / (down - up));
  const cx = pl + (width - pl - pr) / 2;
  const cy = pt + (height - pt - pb) / 2;
  return { origin: [cx - ((left + right) / 2) * scale, cy - ((up + down) / 2) * scale], scale, azimuth, elevation };
}

export const boxPoints = ({ x, y, w, d }: Plan, z0: number, z1: number): Point3[] => {
  const out: Point3[] = [];
  for (const px of [x, x + w]) for (const py of [y, y + d]) for (const pz of [z0, z1]) out.push([px, py, pz]);
  return out;
};

export const join = (paths: string[]) => paths.filter(Boolean).join("");

export const fine = (value: number) => Math.round(value * 100) / 100;
export const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
export const smooth = (t: number) => {
  const u = clamp(t, 0, 1);
  return u * u * (3 - 2 * u);
};
