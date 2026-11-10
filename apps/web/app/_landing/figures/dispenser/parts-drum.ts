import { insetPlan, planOutline, ring, sideSeam } from "../../iso/iso-kit";
import { arcOf, circleOf, frameOf } from "../../iso/lathe.mjs";
import { dots, dotsX, dotsY, dotsZ, line, onY, textY, type Frame, type Scene } from "./build";
import { FLOOR, INDEX_PER_PESO, P, WHEEL_R, WHEEL_W, WHEEL_X, WHEEL_Y, WHEEL_Z } from "./view";

export const WHEEL_COUNT = 4;
export const RULER_LEFT = -104; // left edge of the price ruler: its ticks grow from it
export const RULER_FACE = 24;

export const wheelFrame = (index: number): Frame => frameOf([WHEEL_X + WHEEL_W * index, WHEEL_Y, WHEEL_Z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);

// Height on the ruler of a price in pesos per litre: the 65.00 mark sits at the drum's axis.
export const rulerZ = (price: number) => WHEEL_Z + INDEX_PER_PESO * (price - 65);

// Bay A: the price drum. Four number wheels between two cheeks behind a window, a comparator ruler with a sliding index, a motor behind.
export function drumParts(s: Scene) {
  const left = WHEEL_X;
  const right = WHEEL_X + WHEEL_W * WHEEL_COUNT; // -110
  const plan = { x: -152, y: -28, w: 52, d: 52, r: 2 };
  const top = FLOOR + 3;

  s.slab("drum.plate", plan, FLOOR, 3, {
    tone: "lo",
    bevel: 0.6,
    lines: [line(planOutline(insetPlan(plan, 3), top, P, 3), "faint")],
    dots: [dots(dotsZ(top, [[-148, -24], [-148, 20], [-104, -24]]), 0.5, "mid")],
  });

  s.slab("drum.cheekL", { x: left - 4, y: -6, w: 4, d: 30, r: 1 }, top, 41, {
    tone: "mid",
    steps: 2,
    bevel: 0.5,
    dots: [dots(dotsX(left, [[20, top + 36], [20, top + 6]]), 0.45, "mid")],
  });
  s.slab("drum.cheekR", { x: right, y: -6, w: 4, d: 30, r: 1 }, top, 41, {
    tone: "mid",
    steps: 2,
    bevel: 0.5,
    dots: [dots(dotsX(right + 4, [[20, top + 36], [20, top + 6]]), 0.45, "mid")],
  });

  for (let index = 0; index < WHEEL_COUNT; index++) {
    const frame = wheelFrame(index);
    s.disc(`drum.wheel${index}`, frame, 0, WHEEL_W, WHEEL_R, { tone: "hi", live: `wheel${index}`, lines: [line(circleOf(frame, WHEEL_W, WHEEL_R - 1.4, P), "faint")] });
  }
  s.disc("drum.hubL", frameOf([left - 6, WHEEL_Y, WHEEL_Z], [1, 0, 0], [0, 1, 0], [0, 0, 1]), 0, 2, 3.2, { tone: "mid", steps: 16 });
  s.disc("drum.hubR", frameOf([right + 4, WHEEL_Y, WHEEL_Z], [1, 0, 0], [0, 1, 0], [0, 0, 1]), 0, 2, 3.2, { tone: "mid", steps: 16 });

  s.slab("drum.hood", { x: left, y: -6, w: right - left, d: 26, r: 0 }, top + 37, 4, {
    tone: "mid",
    steps: 1,
    bevel: 0.5,
    dots: [dots(dotsZ(top + 41, [[left + 3, -2], [right - 3, -2], [left + 3, 16], [right - 3, 16]]), 0.45, "mid")],
  });
  s.slab("drum.barTop", { x: left, y: 20, w: right - left, d: 4, r: 0.6 }, top + 29, 12, { tone: "mid", steps: 2, bevel: 0.5 });
  s.slab("drum.barBottom", { x: left, y: 20, w: right - left, d: 4, r: 0.6 }, top + 5, 12, {
    tone: "mid",
    steps: 2,
    bevel: 0.5,
    dots: [dots(dotsY(24, [[left + 3, top + 8], [right - 3, top + 8]]), 0.45, "mid")],
  });

  // The 65.00 mark: an engraved plate on the window's top bar.
  s.slab("drum.markPlate", { x: left + 2, y: 24, w: right - left - 4, d: 0.8, r: 0.4 }, top + 31.5, 7, {
    tone: "lo",
    steps: 2,
    crease: "none",
    texts: [textY(left + (right - left) / 2, 24.8, top + 33.3, "65.00", 3.6, "hi")],
  });

  // Price ruler: ticks hang from its right edge; the 65.00 tick is the long mark. The index slides on it with the price.
  s.slab("drum.ruler", { x: -104, y: 12, w: 5, d: 12, r: 0.8 }, top, 41, {
    tone: "mid",
    steps: 2,
    bevel: 0.5,
    lines: [
      ...Array.from({ length: 11 }, (_, index) => {
        const price = 60 + index;
        const length = price === 65 ? 4.4 : price % 5 === 0 ? 3.4 : 2.2;
        const z = rulerZ(price);
        return line(onY(RULER_FACE, [[RULER_LEFT, z], [RULER_LEFT + length, z]]), price === 65 ? "hi" : price % 5 === 0 ? "mid" : "lo");
      }),
    ],
  });
  const index0 = rulerZ(63.84);
  s.slab("drum.index", { x: -105.5, y: RULER_FACE, w: 8, d: 2.4, r: 0.8 }, index0 - 1.2, 2.4, {
    tone: "hi",
    steps: 2,
    bevel: 0.4,
    piece: "index",
    lines: [line(onY(RULER_FACE + 2.4, [[-105.5, index0], [-97.5, index0]]), "hi")],
  });

  // Behind the drum: gearbox, drive stub and motor, resting on the plate and the divider.
  const box = { x: -146, y: -26, w: 28, d: 18, r: 2 };
  s.slab("drum.gearbox", box, top, 20, {
    tone: "mid",
    steps: 3,
    bevel: 0.6,
    inner: sideSeam(box, top + 14, P, 3),
    dots: [dots(dotsZ(top + 20, [[-142, -22], [-122, -22], [-142, -12], [-122, -12]]), 0.45, "mid")],
    lines: [line(planOutline(insetPlan(box, 3), top + 20, P, 3), "faint")],
  });
  s.disc("drum.stub", frameOf([-132, -8, 27], [0, 1, 0], [1, 0, 0], [0, 0, 1]), 0, 2, 2.2, { tone: "lo", steps: 12 });
  const motor = frameOf([-118, -17, 27], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  s.disc("drum.motor", motor, 0, 20.5, 7, { tone: "hi", steps: 32, inner: arcOf(motor, 3.5, 7, P) + arcOf(motor, 17, 7, P) });

  // Over-the-mark lamp on the hood.
  s.cyl("drum.lampBezel", -140, 0, 3.6, top + 41, 1.6, { tone: "mid", steps: 20 });
  s.cyl("drum.lamp", -140, 0, 2.6, top + 42.6, 1.2, { tone: "hi", steps: 20, live: "lamp", lines: [line(ring(-140, 0, 1.4, top + 43.8, P, 16), "faint")] });
}
