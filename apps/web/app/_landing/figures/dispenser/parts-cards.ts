import { insetPlan, planOutline, sideSeam } from "../../iso/iso-kit";
import { dots, dotsX, dotsY, dotsZ, line, onY, rrect, type Scene } from "./build";
import { BAR_Z } from "./kin";
import { CARD_H, CARD_W, CARD_X, CARD_Y0, CARD_Z0, FLOOR, LIQ_H, LIQ_MIN, LIQ_Y, LIQ_Z0, MANIFOLD_Z, P } from "./view";


// Bay C: three card cartridges on a collector rack, each a sight window whose level is that card's balance, fed from a manifold behind a release gate.
export function cardParts(s: Scene, lift = 0) {
  const rack = { x: -10, y: -20, w: 74, d: 28, r: 1.5 };
  s.slab("rack.base", rack, FLOOR, CARD_Z0 - FLOOR, {
    tone: "mid",
    inner: sideSeam(rack, FLOOR + 10.5, P, 3),
    bevel: 0.8,
    steps: 3,
    lines: [
      ...CARD_X.map((x) => line(onY(8, rrect(x + 2, FLOOR + 4, 14, 4, 1.4, 3), true), "lo")),
    ],
    dots: [dots(dotsY(8, [[-6, FLOOR + 13], [60, FLOOR + 13]]), 0.5, "mid"), dots(dotsZ(CARD_Z0, [[-6, 4], [60, 4]]), 0.5, "mid")],
  });
  s.slab("rack.wall", { x: -10, y: -14, w: 74, d: 4, r: 0 }, CARD_Z0, CARD_H, { tone: "mid", steps: 1 });
  for (const [index, x] of [-10, 14, 38, 62].entries()) {
    s.slab(`rack.cheek${index}`, { x, y: -10, w: 2, d: 6, r: 0.4 }, CARD_Z0, 26, {
      tone: "mid",
      steps: 2,
      lines: [line(onY(-4, [[x, CARD_Z0 + 13], [x + 2, CARD_Z0 + 13]]), "faint")],
    });
  }

  for (const [index, x0] of CARD_X.entries()) {
    const [y0, y1] = [CARD_Y0, -9.4];
    const front = -7.6;
    s.slab(`card${index}.back`, { x: x0, y: y0, w: CARD_W, d: 0.6, r: 0 }, CARD_Z0, CARD_H, { tone: "lo", steps: 1, crease: "faint" });
    s.slab(`card${index}.barL`, { x: x0, y: y1, w: 2, d: front - y1, r: 0.3 }, CARD_Z0, CARD_H, {
      tone: "mid",
      steps: 2,
      lines: [0, 1, 2, 3].map((k) => line(onY(front, [[x0, LIQ_Z0 + (LIQ_H * k) / 3], [x0 + (k % 3 === 0 ? 2 : 1.4), LIQ_Z0 + (LIQ_H * k) / 3]]), k === 3 ? "hi" : "mid")),
    });
    s.slab(`card${index}.barR`, { x: x0 + 16, y: y1, w: 2, d: front - y1, r: 0.3 }, CARD_Z0, CARD_H, { tone: "mid", steps: 2 });
    s.slab(`card${index}.barBottom`, { x: x0 + 2, y: y1, w: 14, d: front - y1, r: 0.3 }, CARD_Z0, 2, { tone: "mid", steps: 2 });
    s.slab(`card${index}.barTop`, { x: x0 + 2, y: y1, w: 14, d: front - y1, r: 0.3 }, CARD_Z0 + 23, 5, {
      tone: "mid",
      steps: 2,
      dots: [dots(dotsY(front, [[x0 + 13, CARD_Z0 + 25.5]]), 0.45, "mid")],
    });
    s.slab(`card${index}.liquid`, { x: x0 + 2, y: LIQ_Y[0], w: 14, d: LIQ_Y[1] - LIQ_Y[0], r: 0 }, LIQ_Z0, LIQ_MIN, { tone: "hi", steps: 1, live: `liquid${index}`, crease: "faint" });
    s.slab(`card${index}.chip`, { x: x0 + 4, y: front, w: 5, d: 0.5, r: 0.6 }, CARD_Z0 + 24.2, 3.2, {
      tone: "hi",
      steps: 2,
      lines: [line(onY(front + 0.5, [[x0 + 4, CARD_Z0 + 25.8], [x0 + 9, CARD_Z0 + 25.8]]), "faint")],
    });
    s.slab(`card${index}.spout`, { x: x0 + CARD_W / 2 - 4, y: -10, w: 8, d: 8, r: 0.6 }, CARD_Z0 + CARD_H, MANIFOLD_Z - CARD_Z0 - CARD_H, {
      tone: "lo",
      steps: 2,
      lines: [line(onY(-2, [[x0 + CARD_W / 2 - 4, CARD_Z0 + CARD_H + 2], [x0 + CARD_W / 2 + 4, CARD_Z0 + CARD_H + 2]]), "faint")],
    });
  }

  const manifold = { x: -10, y: -32, w: 74, d: 34, r: 1 };
  s.slab("manifold", manifold, MANIFOLD_Z, 12, {
    tone: "mid",
    bevel: 0.8,
    steps: 3,
    lines: [
      line(onY(2, rrect(-6.5, MANIFOLD_Z + 2.5, 7, 6.5, 1.2, 3), true), "lo"),
      line(planOutline(insetPlan(manifold, 3), MANIFOLD_Z + 12, P, 3), "faint"),
    ],
    dots: [dots(dotsY(2, [[-6, MANIFOLD_Z + 10], [60, MANIFOLD_Z + 10], [60, MANIFOLD_Z + 2]]), 0.5, "mid"), dots(dotsX(64, [[-26, MANIFOLD_Z + 10], [-26, MANIFOLD_Z + 2]]), 0.45, "mid")],
  });

  // Release gate: a plate on two guides over the manifold's port; its bar reaches back over the governor's roller.
  s.slab("gate.guideL", { x: -9.4, y: 2, w: 1.4, d: 1.6, r: 0.3 }, MANIFOLD_Z - 2, 26, { tone: "lo", steps: 1 });
  s.slab("gate.guideR", { x: 2, y: 2, w: 1.4, d: 1.6, r: 0.3 }, MANIFOLD_Z - 2, 26, { tone: "lo", steps: 1 });
  s.slab("gate.plate", { x: -8, y: 2, w: 10, d: 1.6, r: 0.4 }, BAR_Z + lift, 12.3, {
    tone: "hi",
    ride: "tip",
    steps: 2,
    bevel: 0.4,
    piece: "gate",
    lines: [line(onY(3.6, [[-8, BAR_Z + lift + 8.3], [2, BAR_Z + lift + 8.3]]), "faint")],
  });
  s.slab("gate.bar", { x: -46, y: 3.6, w: 44, d: 6, r: 0.6 }, BAR_Z + lift, 3, {
    tone: "mid",
    ride: "tip",
    steps: 2,
    bevel: 0.4,
    piece: "gate",
    dots: [dots(dotsZ(BAR_Z + lift + 3, [[-42, 6.6], [-8, 6.6]]), 0.45, "mid")],
  });
}
