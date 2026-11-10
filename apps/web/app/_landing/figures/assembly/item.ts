import { pathOf, type Flat, type LineTone, type Point3, type SolidPaths, type Tone } from "@/app/_landing/iso/iso-kit";

/* What one drawn item is made of. Geometry modules return Items; art.tsx turns them into JSX in painter's order. */

export type Spec =
  | { k: "solid"; paths: SolidPaths; tone?: Tone; crease?: Tone | "none"; lit?: boolean; flat?: boolean; inner?: string; halo?: boolean; flag?: string }
  | { k: "line"; d: string; tone?: LineTone; dotted?: boolean; dashed?: boolean; free?: boolean | "start" | "end"; cls?: string; flag?: string }
  | { k: "dots"; pts: Array<Flat | [number, number, number]>; size?: number; tone?: Tone; pulse?: boolean }
  | { k: "text"; tf: string; text: string; size?: number; tone?: Tone; anchor?: "start" | "middle" | "end" }
  | { k: "wire"; from: Flat; to: Flat; via?: Flat[]; tone?: LineTone; flow?: boolean; flag?: string }
  | { k: "dline"; name: string; tone?: LineTone; cls?: string; free?: boolean | "start" | "end" }
  | { k: "dsolid"; name: string; tone?: Tone; crease?: Tone | "none" }
  | { k: "halo"; d: string };

/* layer 0 is the bench, 1 stands behind the chips, 2 is the chips, 3 stands in front of them. Inside a layer
   items sort by depth of c, plus bias. m names a group that moves; its transform is written by the live loop. */
export interface Item {
  id: string;
  layer: 0 | 1 | 2 | 3;
  c: Point3;
  bias?: number;
  m?: string;
  /* Shown while this flag is on; a leading ! shows it while the flag is off. Written by the live loop. */
  vis?: string;
  clip?: string;
  specs: Spec[];
}

export const solid = (paths: SolidPaths, tone: Tone = "mid", crease: Tone | "none" = "faint", extra: Partial<Extract<Spec, { k: "solid" }>> = {}): Spec => ({ k: "solid", paths, tone, crease, ...extra });
export const line = (d: string, tone: LineTone = "lo", extra: Partial<Extract<Spec, { k: "line" }>> = {}): Spec => ({ k: "line", d, tone, ...extra });
export const dots = (pts: Array<Flat | [number, number, number]>, size = 0.5, tone: Tone = "mid", pulse = false): Spec => ({ k: "dots", pts, size, tone, pulse });
export const join = (...paths: string[]) => paths.filter(Boolean).join("");
export const poly = (points: Flat[], closed = false) => pathOf(points, closed);
