import type { Flat, LineTone, SolidPaths, Tone } from "../../iso/iso-kit";

/**
 * A drawable piece of the figure, as plain data so geometry stays in server-only modules and the art
 * component turns it into JSX. `inner` is line markup that sits under a solid's outline (seams, windings).
 */
export type Part =
  | { kind: "halo"; d: string }
  | { kind: "solid"; paths: SolidPaths; tone: Tone; crease: Tone | "none"; lit?: boolean; flat?: boolean; inner?: string }
  | { kind: "line"; d: string; tone: LineTone; dotted?: boolean; free?: boolean | "start" | "end" }
  | { kind: "dots"; points: Array<Flat | [number, number, number]>; size: number; tone: Tone }
  | { kind: "path"; d: string; className: string };

export const solid = (paths: SolidPaths, tone: Tone = "mid", crease: Tone | "none" = "faint", extra: { lit?: boolean; flat?: boolean; inner?: string } = {}): Part => ({
  kind: "solid",
  paths,
  tone,
  crease,
  ...extra,
});

export const line = (d: string, tone: LineTone = "lo", extra: { dotted?: boolean; free?: boolean | "start" | "end" } = {}): Part => ({ kind: "line", d, tone, ...extra });

export const dots = (points: Array<Flat | [number, number, number]>, size = 0.5, tone: Tone = "mid"): Part => ({ kind: "dots", points, size, tone });

export const halo = (d: string): Part => ({ kind: "halo", d });

export const path = (d: string, className: string): Part => ({ kind: "path", d, className });
