import { cylinder, lineOnTop, lineSvg, solidSvg, type Plane } from "../../iso/iso-kit";
import { CLOCK, CLOCK_TOP, KEY_MAX, KEY_R, KEY_X, KEY_Y, P, PEG_MAX, PEG_R, PEG_X, PEG_Y, PEG_Z, PLUNGER_MIN, KEY_Z } from "./tranche-view";

/*
 * What the composition rebuilds each frame, and nothing else: plungers that rise out of their collars and the clock needle.
 * Everything static is a finished string in tranche.gen.ts.
 */

const rise = (u: number, max: number) => PLUNGER_MIN + (max - PLUNGER_MIN) * Math.min(1, Math.max(0, u));

const plunger = (cx: number, cy: number, r: number, z: number, h: number, lit: boolean) =>
  solidSvg(cylinder(cx, cy, r, z, h, P, 16, 0.3), { tone: "hi", lit });

/** The frame is a pure function of the loop time, so a rebuilt part takes a bounded set of values: remember its markup per value. */
function cached<A extends number[]>(build: (...args: A) => string): (...args: A) => string {
  const memo = new Map<string, string>();
  return (...args) => {
    const id = args.join(",");
    let svg = memo.get(id);
    if (svg === undefined) memo.set(id, (svg = build(...args)));
    return svg;
  };
}

/** Held-days plunger `k` risen by `u` (0..1). */
export const pegSvg = cached((k: number, u: number) => plunger(PEG_X[k]!, PEG_Y, PEG_R, PEG_Z, rise(u, PEG_MAX), u > 0.5));

/** Condition key `k` risen by `u` (0..1). */
export const keySvg = cached((k: number, u: number) => plunger(KEY_X, KEY_Y[k]!, KEY_R, KEY_Z, rise(u, KEY_MAX), u > 0.5));

/** Day-clock needle at `deg` degrees clockwise from the top mark, with a short tail. */
export const needleSvg = cached(needleBuild);

function needleBuild(deg: number): string {
  const a = (deg * Math.PI) / 180;
  const sx = Math.sin(a);
  const sy = -Math.cos(a);
  const from: Plane = [CLOCK.x - sx * 7, CLOCK.y - sy * 7];
  const to: Plane = [CLOCK.x + sx * (CLOCK.r - 6), CLOCK.y + sy * (CLOCK.r - 6)];
  return lineSvg(lineOnTop(from, to, CLOCK_TOP + 2.8, P), { tone: "hi", free: true, className: "ag-needle" });
}
