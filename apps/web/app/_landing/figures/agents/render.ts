import { dotsSvg, faceTextSvg, lineSvg, solidSvg, type Projection } from "../../iso/iso-kit";
import { compactPath, compactSolid } from "../compact";
import type { Part, Scene } from "./scene";
import * as A from "../../iso/audit.mjs";

/** One layer of the finished drawing, in painter's order: a static group of markup, a group that a slot moves, or (slot starting "@") a part rebuilt per frame. */
export type Layer = readonly [slot: string, svg: string];

export function partSvg(part: Part): string {
  const solid = solidSvg(compactSolid(part.paths), {
    tone: part.tone,
    crease: part.crease,
    halo: part.halo,
    lit: part.lit,
    flat: part.flat,
    inner: part.inner ? lineSvg(compactPath(part.inner), { tone: "faint" }) : "",
  });
  const lines = part.lines.map((spec) => lineSvg(compactPath(spec.d), { tone: spec.tone, dotted: spec.dotted, free: spec.free, className: spec.className })).join("");
  const texts = part.texts.map((spec) => faceTextSvg(spec.transform, spec.text, { size: spec.size, tone: spec.tone, anchor: spec.anchor })).join("");
  const spots = part.dots.map((spec) => dotsSvg(spec.points, { size: spec.size, tone: spec.tone })).join("");
  const body = solid + lines + texts + spots;
  return part.cls ? `<g class="${part.cls}">${body}</g>` : `<g>${body}</g>`;
}

/** Settles the painter's keys from the recorded shapes and returns the parts back to front. */
export function settled(scene: Scene, P: Projection): Part[] {
  A.settle(scene.R, P);
  const keys = new Map(scene.R.items.map((item) => [item.name, item.key]));
  for (const part of scene.parts) {
    if (part.twin) keys.set(part.id, keys.get(part.twin) ?? 0);
    else if (part.after) keys.set(part.id, (keys.get(part.after) ?? 0) + 0.02);
  }
  return [...scene.parts].sort((a, b) => (keys.get(a.id) ?? 0) - (keys.get(b.id) ?? 0));
}

/** Parts in order → layers: neighbours in the same slot share one group. */
export function layersOf(parts: Part[]): Layer[] {
  const out: Array<[string, string]> = [];
  for (const part of parts) {
    const svg = part.slot.startsWith("@") ? "" : partSvg(part);
    const last = out[out.length - 1];
    if (last && last[0] === part.slot && !part.slot.startsWith("@")) last[1] += svg;
    else out.push([part.slot, svg]);
  }
  return out;
}
