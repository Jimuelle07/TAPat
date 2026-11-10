import { insetPlan, planOutline } from "../../iso/iso-kit";
import { frameOf } from "../../iso/lathe.mjs";
import { dots, dotsY, dotsZ, line, onY, type Frame, type Scene } from "./build";
import {
  CATCH_R,
  CATCH_U,
  CATCH_Y1,
  LATCH_PIVOT,
  LEVER_L,
  XZ_FRAME,
  NOTCH_DEG,
  PIN_R,
  PIN_Y1,
  PIVOT,
  QUAD_FROM,
  QUAD_R,
  QUAD_TO,
  ROLLER_R,
  ROLLER_Y1,
  WEIGHT_R,
  WEIGHT_U,
  WEIGHT_Y1,
  Y_FRONT,
  Y_LATCH,
  Y_LEVER,
  Y_PANEL,
  Y_QUAD,
  latchPoly,
  leverPoly,
  pointAt,
} from "./kin";
import { FLOOR, P } from "./view";

export interface Pose {
  lever: number; // lever angle, degrees
  latch: number; // latch angle, degrees
  gate: number; // how far the release gate has been lifted, world units
}

export const REST_POSE: Pose = { lever: NOTCH_DEG[0]!, latch: 0, gate: 0 };

const XZ: Frame = XZ_FRAME;
const yAxis = (x: number, z: number): Frame => frameOf([x, 0, z], [0, 1, 0], [1, 0, 0], [0, 0, 1]);

// Bay B: the governor. A weighted lever climbs a notched quadrant one notch per day above the mark; a hanging latch holds it at the fourth.
export function govParts(s: Scene, pose: Pose = REST_POSE) {
  const top = FLOOR + 3;
  const plate = { x: -92, y: -32, w: 76, d: 44, r: 2 };
  s.slab("gov.plate", plate, FLOOR, 3, {
    tone: "lo",
    bevel: 0.6,
    lines: [line(planOutline(insetPlan(plate, 3), top, P, 3), "faint")],
    dots: [dots(dotsZ(top, [[-88, 8], [-20, 8], [-20, -28]]), 0.5, "mid")],
  });

  const panelX0 = -91;
  const panelX1 = -36;
  s.slab("gov.panel", { x: panelX0, y: Y_PANEL[0], w: panelX1 - panelX0, d: Y_PANEL[1] - Y_PANEL[0], r: 0.6 }, top, 61, {
    tone: "mid",
    steps: 2,
    bevel: 0.6,
    dots: [dots(dotsY(Y_PANEL[1], [[panelX0 + 4, top + 4], [panelX1 - 4, top + 4], [panelX0 + 4, top + 57], [panelX1 - 4, top + 57]]), 0.5, "mid")],
  });
  for (const [index, x] of [-89, -42].entries()) {
    s.prism(
      `gov.gusset${index}`,
      frameOf([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]),
      [
        [-32, top],
        [Y_PANEL[0], top],
        [Y_PANEL[0], top + 40],
        [-32, top + 9],
      ],
      x,
      x + 2,
      { tone: "lo", crease: "faint" },
    );
  }

  // Quadrant: a fixed sector plate with a notch mark for rest and each day.
  const arc = Array.from({ length: 13 }, (_, step) => pointAt(QUAD_FROM + ((QUAD_TO - QUAD_FROM) * step) / 12, QUAD_R));
  const quadrant = [PIVOT, ...arc] as Array<[number, number]>;
  s.prism("gov.quadrant", XZ, quadrant, Y_QUAD[0], Y_QUAD[1], {
    tone: "mid",
    lines: NOTCH_DEG.map((deg, index) => {
      const from = pointAt(deg, QUAD_R);
      const to = pointAt(deg, QUAD_R - (index === 4 ? 4.6 : 3.2));
      return line(onY(Y_QUAD[1], [from, to]), index === 4 ? "hi" : "mid");
    }),
  });

  // Lever, hub, weight, catch pin and tip roller.
  const lever = leverPoly(pose.lever);
  s.prism("gov.lever", XZ, lever, Y_LEVER[0], Y_LEVER[1], { tone: "hi", lit: true, live: "lever", bevel: 0 });
  s.disc("gov.hub", yAxis(PIVOT[0], PIVOT[1]), Y_FRONT, Y_FRONT + 1.8, 3.6, { tone: "mid", steps: 20 });
  s.disc("gov.hubCap", yAxis(PIVOT[0], PIVOT[1]), Y_FRONT + 1.8, Y_FRONT + 2.8, 1.6, { tone: "lo", steps: 12 });

  const [wx, wz] = pointAt(pose.lever, WEIGHT_U);
  s.disc("gov.weight", yAxis(wx, wz), Y_FRONT, WEIGHT_Y1, WEIGHT_R, { tone: "hi", piece: "weight", steps: 28 });
  const [cx, cz] = pointAt(pose.lever, CATCH_U);
  s.disc("gov.catch", yAxis(cx, cz), Y_FRONT, CATCH_Y1, CATCH_R, { tone: "mid", piece: "catch", steps: 12 });
  const [tx, tz] = pointAt(pose.lever, LEVER_L);
  s.disc("gov.tipPin", yAxis(tx, tz), Y_FRONT, PIN_Y1, PIN_R, { tone: "mid", piece: "tip", steps: 14 });
  s.disc("gov.roller", yAxis(tx, tz), PIN_Y1, ROLLER_Y1, ROLLER_R, { tone: "hi", piece: "tip", steps: 20 });

  // Latch: hangs from a stand-off post on the panel, its toe on the catch pin at the fourth notch.
  s.disc("gov.latchPost", yAxis(LATCH_PIVOT[0], LATCH_PIVOT[1]), Y_PANEL[1], Y_LATCH[0], 2.2, { tone: "mid", steps: 16 });
  s.prism("gov.latch", XZ, latchPoly(pose.latch), Y_LATCH[0], Y_LATCH[1], { tone: "mid", live: "latch" });
}
