import { lineOnTop, lineSvg, slabOf, solidSvg, type Plane } from "../../iso/iso-kit";
import { CELL_PITCH, CELL_W, CELL_X0, CELL_Z, COL_MAX, COL_MIN, DIAL, DIAL_TOP, P, PER_COUNT, ROW_Y, angleOfScore } from "./freeze-view";

/*
 * What the composition rebuilds each frame, and nothing else: the sketch's columns, which rise out of their sockets with the count,
 * and the dial needle. Everything static is a finished string in freeze.gen.ts.
 */

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

/** Column height for a count of taps in that stretch of bins. */
export const heightOf = (count: number) => Math.min(COL_MAX, COL_MIN + count * PER_COUNT);

/** Sketch column `col` of row `row` holding `count` taps. */
export const colSvg = cached((row: number, col: number, count: number) =>
  solidSvg(slabOf({ x: CELL_X0 + col * CELL_PITCH, y: ROW_Y[row]!, w: CELL_W, d: CELL_W, r: 0.8 }, CELL_Z, heightOf(count), P, 2), { tone: "hi", lit: count > 8 }),
);

/** Dial needle at `score`, with a short tail. */
export const needleSvg = cached(needleBuild);

function needleBuild(score: number): string {
  const a = angleOfScore(score);
  const sx = Math.sin(a);
  const sy = -Math.cos(a);
  const from: Plane = [DIAL.x - sx * 7, DIAL.y - sy * 7];
  const to: Plane = [DIAL.x + sx * (DIAL.r - 6), DIAL.y + sy * (DIAL.r - 6)];
  return lineSvg(lineOnTop(from, to, DIAL_TOP + 2.8, P), { tone: "hi", free: true, className: "ag-needle" });
}
