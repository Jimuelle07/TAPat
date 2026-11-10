import {
  corners,
  insetPlan,
  iso,
  knurl,
  lineOnTop,
  pathOf,
  planOutline,
  radialTicks,
  ring,
  segment,
  sideArc,
  topTicks,
  type Plan,
} from "../../iso/iso-kit";
import { POOL } from "./freeze-model";
import { dots, line, type Scene } from "./scene";
import {
  BASE,
  BASE_H,
  BASE_Z,
  CAN_BACK,
  CAN_FRONT,
  CAN_X0,
  CAN_X1,
  CELL_PITCH,
  CELL_W,
  CELL_X0,
  CELL_Z,
  COLS,
  COL_MAX,
  COL_MIN,
  DIAL,
  DIAL_FROM,
  DIAL_SPAN,
  DIAL_TOP,
  FASCIA_H,
  FASCIA_Z,
  LAMP_BAR,
  LAMP_X,
  LAMP_Y,
  LANE,
  LANE_Y,
  LANE_Z,
  P,
  PAD,
  POST_TOP,
  POST_W,
  ROWS,
  ROW_Y,
  SENSOR_X,
  SHUTTER,
  TAP_X0,
  THRESHOLD,
  TOKEN_H,
  TOKEN_R,
  TRAY,
  TRAY_Z,
  angleOfScore,
} from "./freeze-view";

const top = (x: number, y: number, z: number) => iso([x, y, z], P);
/** A polyline on a face that looks along y, from (x, z) points. */
const onY = (y: number, points: Array<[number, number]>, closed = false) =>
  pathOf(
    points.map(([x, z]) => top(x, y, z)),
    closed,
  );
const rect = (x: number, z: number, w: number, h: number): Array<[number, number]> => [
  [x, z],
  [x + w, z],
  [x + w, z + h],
  [x, z + h],
];

const stroke = (min: number, max: number, level: number) => min + (max - min) * level;

/**
 * The Freeze rig. Static parts, a shutter that drops, tap tokens and trigger lamps carry their rest geometry; the sketch's thirty-two
 * columns and the dial needle are rebuilt per frame by the composition, so here they only reserve their place in the painter's order.
 */
export function freezeParts(s: Scene, level = 0) {
  /* ---------------------------------------------------------------- bench */
  corners(BASE, 24).forEach(([x, y], index) => {
    s.cyl(`foot.flange${index}`, x, y, 7, BASE_Z - 5, 1.6, { tone: "lo", steps: 20, ground: true });
    s.cyl(`foot.pad${index}`, x, y, 5.4, BASE_Z - 3.4, 3.4, { tone: "mid", steps: 20, ground: true });
  });
  const screws = corners(BASE, 10);
  s.slab("base", BASE, BASE_Z, BASE_H, {
    tone: "mid",
    steps: 8,
    bevel: 1.6,
    halo: true,
    lines: [line(planOutline(insetPlan(BASE, 5), 0, P, 8), "faint"), ...screws.map(([x, y]) => line(ring(x, y, 2.2, 0, P, 14), "lo"))],
    dots: [dots(screws.map(([x, y]) => top(x, y, 0)), 0.5, "mid")],
  });
  const label: Plan = { x: 128, y: 78, w: 66, d: 15, r: 1.8 };
  s.slab("label", label, 0, 0.8, {
    tone: "lo",
    steps: 4,
    flat: true,
    lines: [
      line(planOutline(insetPlan(label, 1.8), 0.8, P, 4), "faint"),
      line(lineOnTop([label.x + 6, label.y + 4.2], [label.x + 46, label.y + 4.2], 0.8, P), "lo", { free: true }),
      line(lineOnTop([label.x + 6, label.y + 7.5], [label.x + 38, label.y + 7.5], 0.8, P), "lo", { free: true }),
      line(lineOnTop([label.x + 6, label.y + 10.8], [label.x + 50, label.y + 10.8], 0.8, P), "lo", { free: true }),
    ],
    dots: [dots([top(label.x + 3.4, label.y + 3.4, 0.8), top(label.x + label.w - 3.4, label.y + label.d - 3.4, 0.8)], 0.45, "mid")],
  });

  /* ---------------------------------------------------------------- station */
  s.slab("station.pad", PAD, 0, 3, {
    tone: "lo",
    steps: 4,
    lines: [line(planOutline(insetPlan(PAD, 4), 3, P, 4), "faint")],
    dots: [dots(corners(PAD, 2.2).map(([x, y]) => top(x, y, 3)), 0.5, "mid")],
  });

  const pump: Plan = { x: -232, y: -36, w: 30, d: 20, r: 2 };
  const faceY = pump.y + pump.d;
  s.slab("station.pump", pump, 3, 40, {
    tone: "mid",
    steps: 4,
    bevel: 0.7,
    lines: [
      line(onY(faceY, rect(pump.x + 4, 22, pump.w - 8, 12), true), "lo"),
      line(onY(faceY, rect(pump.x + 4, 8, pump.w - 8, 8), true), "faint"),
    ],
  });
  s.slab("station.pumpCap", { ...pump, x: pump.x - 1, w: pump.w + 2, y: pump.y - 1, d: pump.d + 2 }, 43, 4, { tone: "hi", steps: 4, bevel: 0.6 });
  s.slab("station.holster", { x: pump.x + pump.w, y: pump.y + 5, w: 5, d: 10, r: 1 }, 18, 12, { tone: "lo", steps: 3, bevel: 0.4 });

  const term: Plan = { x: -188, y: -34, w: 26, d: 18, r: 2 };
  s.slab("station.terminal", term, 3, 26, {
    tone: "hi",
    steps: 4,
    bevel: 0.7,
    lines: [
      line(onY(term.y + term.d, rect(term.x + 4, 14, term.w - 8, 9), true), "lo"),
      line(ring(term.x + term.w / 2, term.y + term.d / 2, 2.4, 29, P, 14), "lo"),
      line(ring(term.x + term.w / 2, term.y + term.d / 2, 4.6, 29, P, 18), "lo"),
    ],
    dots: [dots([top(term.x + term.w / 2, term.y + term.d / 2, 29)], 0.6, "mid")],
  });

  // Canopy: four posts, a back beam, two side beams, two rafters and the front fascia, an open frame so the bay stays in view.
  for (const [index, [x, y]] of (
    [
      [CAN_X0, CAN_BACK],
      [CAN_X1 - POST_W, CAN_BACK],
      [CAN_X0, CAN_FRONT],
      [CAN_X1 - POST_W, CAN_FRONT],
    ] as const
  ).entries()) {
    s.slab(`canopy.post${index}`, { x, y, w: POST_W, d: POST_W, r: 1 }, 3, POST_TOP - 3, {
      tone: "mid",
      steps: 3,
      bevel: 0.4,
      dots: [dots([top(x + POST_W / 2, y + POST_W / 2, POST_TOP)], 0.5, "mid")],
    });
  }
  s.slab("canopy.back", { x: CAN_X0, y: CAN_BACK, w: CAN_X1 - CAN_X0, d: POST_W, r: 1 }, POST_TOP, 8, { tone: "mid", steps: 3, bevel: 0.5 });
  for (const [index, x] of [CAN_X0, CAN_X1 - POST_W].entries()) {
    s.slab(`canopy.side${index}`, { x, y: CAN_BACK + POST_W, w: POST_W, d: CAN_FRONT - CAN_BACK - POST_W, r: 1 }, POST_TOP, 8, { tone: "mid", steps: 3, bevel: 0.5 });
  }
  for (const [index, y] of [-38, -8].entries()) {
    s.slab(`canopy.rafter${index}`, { x: CAN_X0 + POST_W, y, w: CAN_X1 - CAN_X0 - 2 * POST_W, d: 4, r: 0.8 }, POST_TOP + 3, 5, { tone: "lo", steps: 2, bevel: 0.3 });
  }
  s.slab("canopy.fascia", { x: CAN_X0, y: CAN_FRONT, w: CAN_X1 - CAN_X0, d: 8, r: 1 }, FASCIA_Z, FASCIA_H, {
    tone: "hi",
    steps: 3,
    bevel: 0.6,
    lines: [line(segment([CAN_X0, CAN_FRONT + 8, FASCIA_Z + 5], [CAN_X1, CAN_FRONT + 8, FASCIA_Z + 5], P), "faint")],
  });

  // Shutter: a slatted panel on the shutter plane. At rest it is rolled up behind the fascia; the composition clips it at its lower edge.
  const sh = SHUTTER;
  const shutterLines: string[] = [];
  for (let z = sh.z + 6; z < sh.z + sh.h - 1; z += 6) shutterLines.push(segment([sh.x, sh.y + sh.d, z], [sh.x + sh.w, sh.y + sh.d, z], P));
  s.slab("shutter.panel", { x: sh.x, y: sh.y, w: sh.w, d: sh.d, r: 0.6 }, sh.z + 4, sh.h - 4, {
    tone: "mid",
    steps: 2,
    slot: "shutter",
    lines: [line(shutterLines.join(""), "blue")],
  });
  s.slab("shutter.bar", { x: sh.x, y: sh.y - 0.5, w: sh.w, d: sh.d + 1, r: 0.8 }, sh.z, 4, { tone: "hi", lit: true, steps: 2, slot: "shutter", bias: 0.2 });

  /* ---------------------------------------------------------------- tap lane, reader and sensor arch */
  s.slab("lane.channel", LANE, 0, LANE_Z, { tone: "lo", steps: 4 });
  for (const [index, y] of [LANE.y, LANE.y + LANE.d - 3].entries()) {
    s.slab(`lane.rail${index}`, { x: LANE.x, y, w: LANE.w, d: 3, r: 0.8 }, LANE_Z, 4, { tone: "mid", steps: 3, bevel: 0.4 });
  }
  const reader: Plan = { x: LANE.x + 6, y: LANE_Y - 9, w: 14, d: 18, r: 2 };
  s.slab("lane.reader", reader, LANE_Z, 14, {
    tone: "hi",
    steps: 4,
    bevel: 0.6,
    lines: [line(ring(reader.x + 7, LANE_Y, 2.6, LANE_Z + 14, P, 14), "lo"), line(ring(reader.x + 7, LANE_Y, 4.8, LANE_Z + 14, P, 18), "lo")],
    dots: [dots([top(reader.x + 7, LANE_Y, LANE_Z + 14)], 0.6, "mid")],
  });
  for (const [index, y] of [LANE.y - 5, LANE.y + LANE.d].entries()) {
    s.slab(`sensor.post${index}`, { x: SENSOR_X - 4, y, w: 8, d: 4, r: 1 }, 0, LANE_Z + 26, { tone: "mid", steps: 3, bevel: 0.4 });
  }
  s.slab("sensor.beam", { x: SENSOR_X - 4, y: LANE.y - 5, w: 8, d: LANE.d + 9, r: 1.2 }, LANE_Z + 26, 4, { tone: "mid", steps: 3, bevel: 0.5 });
  s.cyl("sensor.lamp", SENSOR_X, LANE_Y, 3.6, LANE_Z + 30, 3, { tone: "hi", steps: 14 });
  s.cyl("sensor.flash", SENSOR_X, LANE_Y, 3.6, LANE_Z + 30, 3, { tone: "hi", lit: true, steps: 14, slot: "sense", bias: 0.3 });

  // Cable from the arch to the sketch tray: a flat strip with a terminal dot on each end.
  const cable: Plan = { x: SENSOR_X - 1.2, y: TRAY.y + TRAY.d, w: 2.4, d: LANE.y - 5 - (TRAY.y + TRAY.d), r: 0.6 };
  s.slab("sensor.cable", cable, 0, 0.5, {
    tone: "lo",
    flat: true,
    steps: 2,
    dots: [dots([top(SENSOR_X, cable.y + 0.6, 0.5), top(SENSOR_X, cable.y + cable.d - 0.6, 0.5)], 1, "mid")],
  });

  /* ---------------------------------------------------------------- sketch tray */
  s.slab("sketch.tray", TRAY, 0, TRAY_Z, {
    tone: "mid",
    steps: 4,
    bevel: 0.8,
    lines: [line(planOutline(insetPlan(TRAY, 3.4), TRAY_Z, P, 4), "faint")],
    dots: [dots(corners(TRAY, 2).map(([x, y]) => top(x, y, TRAY_Z)), 0.5, "mid")],
  });
  const ruler: Plan = { x: CELL_X0 - 2, y: TRAY.y + TRAY.d - 11, w: CELL_PITCH * COLS + 3, d: 6.5, r: 0.8 };
  const ticks = topTicks(CELL_X0 - 0.5, CELL_X0 + CELL_PITCH * COLS, CELL_PITCH, 4, ruler.y + 0.4, TRAY_Z + 0.6, [1.8, 3.4], P);
  s.slab("sketch.ruler", ruler, TRAY_Z, 0.6, { tone: "lo", crease: "none", flat: true, steps: 2, lines: [line(ticks.minor, "lo"), line(ticks.major, "mid")] });
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = CELL_X0 + col * CELL_PITCH;
      const y = ROW_Y[row]!;
      s.slab(`sketch.socket${row}_${col}`, { x: x - 0.6, y: y - 0.6, w: CELL_W + 1.2, d: CELL_W + 1.2, r: 0.8 }, TRAY_Z, 0.6, { tone: "lo", flat: true, steps: 2 });
    }
  }
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      s.slab(`sketch.col${row}_${col}`, { x: CELL_X0 + col * CELL_PITCH, y: ROW_Y[row]!, w: CELL_W, d: CELL_W, r: 0.8 }, CELL_Z, stroke(COL_MIN, COL_MAX, level), {
        tone: "hi",
        steps: 2,
        slot: `@col${row}_${col}`,
      });
    }
  }

  /* ---------------------------------------------------------------- score dial */
  const d = DIAL;
  const scale = radialTicks(d.x, d.y, d.r - 2.4, 20, 5, DIAL_TOP, [2.2, 4.4], P, DIAL_FROM, DIAL_SPAN);
  s.cyl("dial.puck", d.x, d.y, d.r, 0, DIAL_TOP, {
    tone: "hi",
    steps: 56,
    bevel: 0.8,
    inner: sideArc(d.x, d.y, d.r, DIAL_TOP - 3.4, P, 30),
    lines: [
      line(knurl(d.x, d.y, d.r, DIAL_TOP - 3.4, DIAL_TOP, 84, P, 0.3), "lo"),
      line(ring(d.x, d.y, d.r - 2.4, DIAL_TOP, P, 56), "lo"),
      line(scale.minor, "lo"),
      line(scale.major, "mid"),
    ],
  });
  const a = angleOfScore(THRESHOLD);
  const stopR = d.r - 2.4;
  s.cyl("dial.stop", d.x + Math.sin(a) * (stopR - 4.6), d.y - Math.cos(a) * (stopR - 4.6), 1.8, DIAL_TOP, 3.4, { tone: "hi", lit: true, steps: 12 });
  s.cyl("dial.hub", d.x, d.y, 3.2, DIAL_TOP, 2.4, { tone: "mid", steps: 14, lines: [line(ring(d.x, d.y, 1.4, DIAL_TOP + 2.4, P, 10), "lo")] });
  s.cyl("dial.needle", d.x, d.y, 0.8, DIAL_TOP + 2.4, 0.4, { tone: "hi", steps: 6, slot: "@needle", flat: true });

  /* ---------------------------------------------------------------- trigger lamps */
  s.slab("lamps.bar", LAMP_BAR, 0, 4, {
    tone: "mid",
    steps: 4,
    bevel: 0.7,
    lines: [
      line(planOutline(insetPlan(LAMP_BAR, 3), 4, P, 4), "faint"),
      line(lineOnTop([LAMP_X[0] - 6, LAMP_BAR.y + LAMP_BAR.d - 4.4], [LAMP_X[0] + 6, LAMP_BAR.y + LAMP_BAR.d - 4.4], 4, P), "lo", { free: true }),
      line(lineOnTop([LAMP_X[1] - 6, LAMP_BAR.y + LAMP_BAR.d - 4.4], [LAMP_X[1] + 4, LAMP_BAR.y + LAMP_BAR.d - 4.4], 4, P), "lo", { free: true }),
      line(lineOnTop([LAMP_X[2] - 6, LAMP_BAR.y + LAMP_BAR.d - 4.4], [LAMP_X[2] + 5, LAMP_BAR.y + LAMP_BAR.d - 4.4], 4, P), "lo", { free: true }),
    ],
    dots: [dots(corners(LAMP_BAR, 2).map(([x, y]) => top(x, y, 4)), 0.5, "mid")],
  });
  for (const [index, x] of LAMP_X.entries()) {
    s.cyl(`lamps.base${index}`, x, LAMP_Y, 5.4, 4, 5, { tone: "mid", steps: 20, lines: [line(knurl(x, LAMP_Y, 5.4, 4, 9, 20, P), "lo")] });
    s.cyl(`lamps.cap${index}`, x, LAMP_Y, 4, 9, 3.2, { tone: "hi", steps: 18 });
  }
  s.cyl("lamps.midas", LAMP_X[0], LAMP_Y, 4, 9, 3.2, { tone: "hi", lit: true, steps: 18, slot: "lamp", bias: 0.3 });

  /* ---------------------------------------------------------------- tap tokens: two kinds per pool slot, an ordinary tap and a near-cap tap */
  for (let k = 0; k < POOL; k++) {
    for (const [kind, tone] of [["", "hi"] as const, ["n", "hi"] as const]) {
      s.cyl(`tap${k}${kind}`, TAP_X0, LANE_Y, TOKEN_R, LANE_Z, TOKEN_H, {
        tone,
        lit: kind === "n",
        steps: 24,
        bevel: 0.4,
        slot: `tap${k}${kind}`,
        bias: 0.4,
        twin: k === 0 && kind === "" ? undefined : `tap0`,
        lines: [line(ring(TAP_X0, LANE_Y, TOKEN_R - 2, LANE_Z + TOKEN_H, P, 24), "faint")],
      });
    }
  }
}
