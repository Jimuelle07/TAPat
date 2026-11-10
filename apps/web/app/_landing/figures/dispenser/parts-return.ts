import { insetPlan, pathOf, planOutline, sideSeam } from "../../iso/iso-kit";
import { at3, dots, dotsX, dotsY, line, onY, textY, type Scene } from "./build";
import { XZ_FRAME as XZ } from "./kin";
import { BOX_D, BOX_H, BOX_W, BOX_X, BOX_Y, BOX_Z, LIQ_BOX_H, LIQ_BOX_X, LIQ_BOX_Y, LIQ_BOX_Z0, CHUTE_X0, CHUTE_X1, CHUTE_Y0, CHUTE_Y1, chuteZ, FLOOR, P } from "./view";
import type { Copy } from "./model";

// The return chute (a wedge ramp with two side walls) and the LGU lockbox it empties into.
export function returnParts(s: Scene, copy: Copy) {
  s.prism(
    "chute.floor",
    XZ,
    [
      [CHUTE_X0, FLOOR],
      [CHUTE_X1, FLOOR],
      [CHUTE_X1, chuteZ(CHUTE_X1)],
      [CHUTE_X0, chuteZ(CHUTE_X0)],
    ],
    CHUTE_Y0,
    CHUTE_Y1,
    {
      tone: "lo",
      crease: "faint",
      lines: [-7.2, -4.8].map((y) => line(pathOf([at3([CHUTE_X0, y, chuteZ(CHUTE_X0)]), at3([CHUTE_X1, y, chuteZ(CHUTE_X1)])]), "mid", { flow: true, className: "dp-flow" })),
    },
  );
  for (const [index, [y0, y1]] of [
    [-12, CHUTE_Y0],
    [CHUTE_Y1, 0],
  ].entries()) {
    s.prism(
      `chute.wall${index}`,
      XZ,
      [
        [CHUTE_X0, FLOOR],
        [CHUTE_X1, FLOOR],
        [CHUTE_X1, chuteZ(CHUTE_X1) + 5],
        [CHUTE_X0, chuteZ(CHUTE_X0) + 5],
      ],
      y0!,
      y1!,
      { tone: "mid", crease: "faint" },
    );
  }
  const box = { x: BOX_X, y: BOX_Y, w: BOX_W, d: BOX_D, r: 2 };
  s.slab("box.body", box, BOX_Z, BOX_H, {
    tone: "mid",
    bevel: 0.9,
    steps: 3,
    inner: sideSeam(box, BOX_Z + 3, P, 3) + sideSeam(box, BOX_Z + 22, P, 3),
    dots: [dots(dotsY(BOX_Y + BOX_D, [[BOX_X + 4, BOX_Z + 7], [BOX_X + BOX_W - 4, BOX_Z + 7], [BOX_X + 4, BOX_Z + BOX_H - 4], [BOX_X + BOX_W - 4, BOX_Z + BOX_H - 4]]), 0.5, "mid"), dots(dotsX(BOX_X + BOX_W, [[-16, BOX_Z + 7], [16, BOX_Z + 7]]), 0.5, "mid")],
  });
  const lid = { x: BOX_X - 2, y: BOX_Y - 2, w: BOX_W + 4, d: BOX_D + 4, r: 2.5 };
  s.slab("box.lid", lid, BOX_Z + BOX_H, 5, {
    tone: "mid",
    bevel: 1,
    steps: 4,
    lines: [line(planOutline({ x: BOX_X + 10, y: -3, w: 24, d: 4, r: 2 }, BOX_Z + BOX_H + 5, P, 4), "lo"), line(planOutline(insetPlan(lid, 3), BOX_Z + BOX_H + 5, P, 4), "faint")],
  });

  // Gauge window: back plate, frame bars, the level, and a scale of 0 to 4,500 with the full mark long.
  const [gx0, gx1] = LIQ_BOX_X;
  const gz0 = LIQ_BOX_Z0 - 2;
  s.slab("box.gaugeBack", { x: gx0 - 2, y: BOX_Y + BOX_D, w: gx1 - gx0 + 4, d: 0.8, r: 0 }, gz0, LIQ_BOX_H + 6, { tone: "lo", steps: 1 });
  s.slab("box.gaugeL", { x: gx0 - 2, y: LIQ_BOX_Y[0], w: 2, d: 1.6, r: 0.3 }, gz0, LIQ_BOX_H + 6, {
    tone: "mid",
    steps: 2,
    lines: [0, 1, 2, 3].map((k) => line(onY(LIQ_BOX_Y[1], [[gx0 - 2, LIQ_BOX_Z0 + (LIQ_BOX_H * k) / 3], [gx0 - (k === 3 ? 0 : 0.6), LIQ_BOX_Z0 + (LIQ_BOX_H * k) / 3]]), k === 3 ? "hi" : "mid")),
  });
  s.slab("box.gaugeR", { x: gx1, y: LIQ_BOX_Y[0], w: 2, d: 1.6, r: 0.3 }, gz0, LIQ_BOX_H + 6, { tone: "mid", steps: 2 });
  s.slab("box.gaugeBottom", { x: gx0, y: LIQ_BOX_Y[0], w: gx1 - gx0, d: 1.6, r: 0.3 }, gz0, 2, { tone: "mid", steps: 2 });
  s.slab("box.gaugeTop", { x: gx0, y: LIQ_BOX_Y[0], w: gx1 - gx0, d: 1.6, r: 0.3 }, LIQ_BOX_Z0 + LIQ_BOX_H, 4, { tone: "mid", steps: 2 });
  s.slab("box.liquid", { x: gx0, y: LIQ_BOX_Y[0], w: gx1 - gx0, d: LIQ_BOX_Y[1] - LIQ_BOX_Y[0], r: 0 }, LIQ_BOX_Z0, 0.3, { tone: "hi", steps: 1, live: "boxLiquid", crease: "faint" });

  // LGU label plate, hasp and padlock.
  s.slab("box.label", { x: BOX_X + 8, y: BOX_Y + BOX_D, w: BOX_W - 16, d: 0.8, r: 0.5 }, 31, 6, {
    tone: "lo",
    steps: 2,
    crease: "none",
    texts: [textY(BOX_X + BOX_W / 2, BOX_Y + BOX_D + 0.8, 32.9, copy.lgu, 3.4, "hi")],
  });
  s.slab("box.hasp", { x: BOX_X + 16, y: BOX_Y + BOX_D, w: 12, d: 0.8, r: 0.6 }, 44, 6, { tone: "lo", steps: 2, dots: [dots(dotsY(BOX_Y + BOX_D + 0.8, [[BOX_X + 19, 47], [BOX_X + 25, 47]]), 0.45, "mid")] });
  s.slab("box.padlock", { x: BOX_X + 18, y: BOX_Y + BOX_D, w: 8, d: 4, r: 1.4 }, 37.5, 6.5, {
    tone: "hi",
    steps: 3,
    bevel: 0.4,
    dots: [dots(dotsY(BOX_Y + BOX_D + 4, [[BOX_X + 22, 40.5]]), 0.7, "hi")],
  });
}
