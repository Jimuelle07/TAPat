import { circleOf, frameOf } from "../../iso/lathe.mjs";
import { sideSeam } from "../../iso/iso-kit";
import { dots, dotsY, line, onY, textY, type Frame, type Scene } from "./build";
import type { Copy } from "./model";
import { askX, HEAD_W, HEAD_Z, P, RAIL_X0, SLIDE_RATE, STOP_PESO } from "./view";

export const CONSOLE_Z = 46;
export const CONSOLE_H = 38;
export const FACE_Y = 8; // front face of the console
export const RAIL_Z = 55;
export const RAIL_H = 3;
export const HEAD_H = 6;
export const RULER_Z = 49;
export const RULER_H = 4.5;
export const FLAG_Z = 48.2;
export const FLAG_H = 6.5;
export const DISPLAY_Z = 70;

export const yDisc = (x: number, y: number, z: number): Frame => frameOf([x, y, z], [0, 1, 0], [1, 0, 0], [0, 0, 1]);

// Bay D: the card reader. A wall-mounted console; on its front a display, two lamps, a tap pad, and a rail with a plunger that a request flag pushes
// along a peso ruler until the mechanical stop at the cap.
export function readerParts(s: Scene, copy: Copy) {
  const consolePlan = { x: 72, y: -32, w: 76, d: 40, r: 2 };
  s.slab("reader.console", consolePlan, CONSOLE_Z, CONSOLE_H, {
    tone: "mid",
    inner: sideSeam(consolePlan, 66.5, P, 3),
    bevel: 0.9,
    steps: 3,
    dots: [dots(dotsY(FACE_Y, [[75, CONSOLE_Z + 3], [145, CONSOLE_Z + 3], [75, CONSOLE_Z + CONSOLE_H - 3], [145, CONSOLE_Z + CONSOLE_H - 3]]), 0.5, "mid")],
  });
  for (const [index, x] of [78, 134].entries()) s.slab(`reader.bracket${index}`, { x, y: -32, w: 8, d: 22, r: 0.5 }, CONSOLE_Z - 6, 6, { tone: "lo", steps: 2 });

  // Display: bezel, glass, two engraved lines of machine text.
  s.slab("reader.bezel", { x: 76, y: FACE_Y, w: 40, d: 1.6, r: 1.2 }, DISPLAY_Z, 12, { tone: "lo", steps: 3, bevel: 0.4 });
  s.slab("reader.glass", { x: 77.6, y: FACE_Y + 1.6, w: 36.8, d: 0.4, r: 0.8 }, DISPLAY_Z + 1.6, 8.8, {
    tone: "faint",
    steps: 3,
    crease: "faint",
    live: "display",
    texts: [
      textY(96, FACE_Y + 2.1, DISPLAY_Z + 7.4, `STOP ${copy.money[5]!}`, 3.4, "hi", "middle", "line1"),
      textY(96, FACE_Y + 2.1, DISPLAY_Z + 2.8, "TAP CARD", 3.4, "mid", "middle", "line2"),
    ],
  });

  // Lamps: the round one lights for a recorded tap, the square one for a refusal.
  s.disc("reader.lampPaidBezel", yDisc(121, FACE_Y, 76), 0, 1.4, 3.4, { tone: "mid", steps: 20 });
  s.disc("reader.lampPaid", yDisc(121, FACE_Y + 1.4, 76), 0, 1, 2.5, { tone: "hi", steps: 20, live: "lampPaid" });
  s.slab("reader.lampDeclBezel", { x: 124.6, y: FACE_Y, w: 6.8, d: 1.4, r: 0.8 }, 72.6, 6.8, { tone: "mid", steps: 2 });
  s.slab("reader.lampDecl", { x: 126, y: FACE_Y + 1.4, w: 4, d: 1, r: 0.5 }, 74, 4, { tone: "hi", steps: 2, live: "lampDecl" });

  // Tap pad: a ring and a face with a contact ring.
  const pad = yDisc(139, FACE_Y, 74);
  s.disc("reader.tapRing", pad, 0, 1.4, 6, { tone: "mid", steps: 28 });
  s.disc("reader.tapFace", yDisc(139, FACE_Y + 1.4, 74), 0, 0.8, 4.4, { tone: "lo", steps: 24, lines: [line(circleOf(yDisc(139, FACE_Y + 1.4, 74), 0.8, 2.4, P), "faint")] });

  // Rail with end blocks, the ruler under it, the stop at the cap.
  const railX0 = 76;
  const railX1 = 146;
  s.slab("reader.rail", { x: railX0, y: FACE_Y, w: railX1 - railX0, d: 6, r: 0.8 }, RAIL_Z, RAIL_H, { tone: "mid", steps: 2, bevel: 0.4 });
  s.slab("reader.endL", { x: railX0 - 1, y: FACE_Y, w: 2, d: 6, r: 0.5 }, RAIL_Z + RAIL_H, 7, { tone: "lo", steps: 2 });
  s.slab("reader.endR", { x: railX1 - 1, y: FACE_Y, w: 2, d: 6, r: 0.5 }, RAIL_Z + RAIL_H, 7, { tone: "lo", steps: 2 });

  const ruleTop = RULER_Z + RULER_H;
  const rulerLines = [];
  for (let peso = 0; peso <= 800; peso += 50) {
    const big = peso % 100 === 0;
    const x = RAIL_X0 + SLIDE_RATE * peso;
    const length = peso === STOP_PESO ? 4.2 : big ? 3 : 1.8;
    rulerLines.push(line(onY(FACE_Y + 0.8, [[x, ruleTop], [x, ruleTop - length]]), peso === STOP_PESO ? "hi" : big ? "mid" : "lo"));
  }
  s.slab("reader.ruler", { x: 77, y: FACE_Y, w: 68, d: 0.8, r: 0.4 }, RULER_Z, RULER_H, { tone: "lo", steps: 2, crease: "none", lines: rulerLines });

  const stopX = askX(STOP_PESO) + HEAD_W / 2;
  s.slab("reader.stop", { x: stopX, y: FACE_Y + 0.6, w: 6, d: 4.8, r: 0.8 }, HEAD_Z, 9, {
    tone: "hi",
    steps: 2,
    bevel: 0.5,
    dots: [dots(dotsY(FACE_Y + 5.4, [[stopX + 3, HEAD_Z + 6.5], [stopX + 3, HEAD_Z + 2.5]]), 0.45, "mid")],
  });

  // The two movers: the request flag on the ruler, the plunger head on the rail.
  s.slab("reader.ask", { x: askX(0) - 2.5, y: FACE_Y + 0.8, w: 5, d: 1.6, r: 0.6 }, FLAG_Z, FLAG_H, { tone: "hi", steps: 2, bevel: 0.3, piece: "ask", lines: [line(onY(FACE_Y + 2.4, [[askX(0), FLAG_Z], [askX(0), FLAG_Z + FLAG_H]]), "hi")] });
  s.slab("reader.plunger", { x: askX(0) - HEAD_W / 2, y: FACE_Y + 0.6, w: HEAD_W, d: 4.8, r: 0.8 }, HEAD_Z, HEAD_H, {
    tone: "hi",
    steps: 2,
    bevel: 0.5,
    piece: "plunger",
    lines: [line(onY(FACE_Y + 5.4, [[askX(0), HEAD_Z], [askX(0), HEAD_Z + HEAD_H]]), "faint")],
  });
}
