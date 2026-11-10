import {
  corners,
  insetPlan,
  iso,
  knurl,
  lineOnTop,
  planOutline,
  radialTicks,
  ring,
  sideArc,
  topMatrix,
  topTicks,
  segment,
  type Plan,
} from "../../iso/iso-kit";
import { dots, line, type Scene } from "./scene";
import {
  BASE,
  BASE_H,
  BASE_Z,
  CARD_D,
  CARD_W,
  CARD_X0,
  CARRIAGE_D,
  CARRIAGE_W,
  CARRIAGE_Z,
  CLOCK,
  CLOCK_TOP,
  CURSOR_D,
  CURSOR_H,
  GATE_H,
  GATE_X,
  GATE_Z,
  KEY_MAX,
  KEY_R,
  KEY_X,
  KEY_Y,
  KEY_Z,
  LANE_W,
  LANE_Y,
  LANE_Z,
  MARK_PHP,
  P,
  PEG_MAX,
  PEG_R,
  PEG_X,
  PEG_Y,
  PEG_Z,
  PLUNGER_MIN,
  RAIL_X0,
  RAIL_X1,
  RAIL_Y,
  REST_PHP,
  REST_PROB,
  SCALE_PHP0,
  SCALE_PHP1,
  SCALE_PLATE,
  TOKEN_H,
  TOKEN_R,
  TOKEN_X0,
  TOWER_TOP,
  TRIP_P,
  xOfProb,
  zOfPrice,
} from "./tranche-view";

const top = (x: number, y: number, z: number) => iso([x, y, z], P);

const GATE_PLAN: Plan = { x: GATE_X - 3.5, y: -82, w: 7, d: 164, r: 1.2 };
export const TRACK: Plan = { x: -168, y: 50, w: 156, d: 30, r: 2 };
export const BLOCK: Plan = { x: -152, y: -80, w: 124, d: 32, r: 3 };
const BUS: Plan = { x: KEY_X - 13, y: -82, w: 26, d: 164, r: 3 };
const TOWER_PED: Plan = { x: -214, y: -36, w: 62, d: 30, r: 3 };

/** Plunger heights while the audit builds: `level` 0 is the rest height, 1 the full stroke. */
const stroke = (min: number, max: number, level: number) => min + (max - min) * level;

/**
 * The Tranche relay. Static parts and translated parts (cursor, slider, gate, tokens, card chips) carry their rest geometry; plungers and the
 * clock needle are rebuilt per frame by the composition, so here they only reserve their place in the painter's order (slot starts with "@").
 */
export function trancheParts(s: Scene, level = 0) {
  /* ---------------------------------------------------------------- bench */
  const front = corners(BASE, 24);
  front.forEach(([x, y], index) => {
    s.cyl(`foot.flange${index}`, x, y, 7, BASE_Z - 5, 1.6, { tone: "lo", steps: 20, ground: true });
    s.cyl(`foot.pad${index}`, x, y, 5.4, BASE_Z - 3.4, 3.4, { tone: "mid", steps: 20, ground: true });
  });
  const screws = corners(BASE, 10);
  s.slab("base", BASE, BASE_Z, BASE_H, {
    tone: "mid",
    steps: 8,
    bevel: 1.6,
    halo: true,
    lines: [
      line(planOutline(insetPlan(BASE, 5), 0, P, 8), "faint"),
      ...screws.map(([x, y]) => line(ring(x, y, 2.2, 0, P, 14), "lo")),
    ],
    dots: [dots(screws.map(([x, y]) => top(x, y, 0)), 0.5, "mid")],
  });

  const label: Plan = { x: -246, y: 78, w: 66, d: 15, r: 1.8 };
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

  /* ---------------------------------------------------------------- price tower */
  const tp = TOWER_PED;
  s.slab("tower.pedestal", tp, 0, 10, {
    tone: "mid",
    steps: 4,
    bevel: 0.8,
    lines: [line(planOutline(insetPlan(tp, 4), 10, P, 4), "faint")],
    dots: [dots(corners(tp, 2.2).map(([x, y]) => top(x, y, 10)), 0.5, "mid")],
  });

  // Scale plate with ticks rooted on its left edge; the ₱65 line crosses the whole face.
  const plate = SCALE_PLATE;
  const faceY = plate.y + plate.d;
  const tickLines: string[] = [];
  const majorLines: string[] = [];
  for (let php = SCALE_PHP0; php <= SCALE_PHP1; php++) {
    const major = php % 5 === 0;
    (major ? majorLines : tickLines).push(segment([plate.x, faceY, zOfPrice(php)], [plate.x + (major ? 8 : 4.5), faceY, zOfPrice(php)], P));
  }
  const zMark = zOfPrice(MARK_PHP);
  s.slab("tower.scale", plate, 10, TOWER_TOP - 10 - 4, {
    tone: "lo",
    steps: 2,
    lines: [
      line(tickLines.join(""), "lo"),
      line(majorLines.join(""), "mid"),
      line(segment([plate.x, faceY, zMark], [plate.x + plate.w, faceY, zMark], P), "hi"),
    ],
  });
  // Frame: two guides flush against the plate's sides and a bridge over both.
  const guides: Plan[] = [
    { x: plate.x - 6, y: plate.y - 2, w: 6, d: 11, r: 1 },
    { x: plate.x + plate.w, y: plate.y - 2, w: 6, d: 11, r: 1 },
  ];
  guides.forEach((plan, index) => {
    s.slab(`tower.guide${index}`, plan, 10, TOWER_TOP - 10, {
      tone: "mid",
      steps: 3,
      bevel: 0.5,
      dots: [dots([30, 60, 90, 120, 148].map((z) => top(plan.x + plan.w / 2, plan.y + plan.d, z)), 0.5, "mid")],
    });
  });
  s.slab("tower.bridge", { x: plate.x - 6, y: plate.y - 2, w: plate.w + 12, d: 11, r: 1.2 }, TOWER_TOP, 4, {
    tone: "mid",
    steps: 3,
    bevel: 0.6,
    lines: [line(planOutline({ x: plate.x - 3, y: plate.y, w: plate.w + 6, d: 7, r: 1 }, TOWER_TOP + 4, P, 3), "faint")],
    dots: [dots([top(plate.x - 3, plate.y + 2, TOWER_TOP + 4), top(plate.x + plate.w + 3, plate.y + 2, TOWER_TOP + 4)], 0.5, "mid")],
  });
  s.slab("tower.pennant", { x: plate.x + plate.w + 6, y: plate.y, w: 8, d: 4, r: 0.6 }, zMark - 1.6, 3.2, { tone: "hi", steps: 2 });

  // Cursor: a bar that slides up the plate between the guides and reads the price on its hairline.
  const zc = zOfPrice(REST_PHP);
  s.slab("cursor.bar", { x: plate.x, y: faceY, w: plate.w, d: CURSOR_D, r: 0.6 }, zc - CURSOR_H / 2, CURSOR_H, {
    tone: "hi",
    lit: true,
    steps: 2,
    slot: "cursor",
    lines: [line(segment([plate.x, faceY + CURSOR_D, zc], [plate.x + plate.w, faceY + CURSOR_D, zc], P), "hi")],
  });

  /* ---------------------------------------------------------------- probability rail */
  s.slab("rail.track", TRACK, 0, 4, {
    tone: "mid",
    steps: 4,
    bevel: 0.6,
    lines: [line(planOutline(insetPlan(TRACK, 2.6), 4, P, 4), "faint")],
  });
  for (const [index, y] of [RAIL_Y - 11 + 1.5, RAIL_Y + 11 - 5.5].entries()) {
    s.slab(`rail.bar${index}`, { x: RAIL_X0 - 11, y, w: RAIL_X1 - RAIL_X0 + 23, d: 4, r: 1 }, 4, 3, { tone: "lo", steps: 3, bevel: 0.3 });
  }
  for (const [index, x] of [RAIL_X0 - 16, RAIL_X1 + 12].entries()) {
    s.slab(`rail.stop${index}`, { x, y: TRACK.y + 2, w: 5, d: TRACK.d - 4, r: 1.2 }, 4, 8, {
      tone: "mid",
      steps: 3,
      bevel: 0.5,
      dots: [dots([top(x + 2.5, TRACK.y + 6, 12), top(x + 2.5, TRACK.y + TRACK.d - 6, 12)], 0.5, "mid")],
    });
  }
  const strip: Plan = { x: RAIL_X0 - 6, y: 74, w: RAIL_X1 - RAIL_X0 + 12, d: 5, r: 0.8 };
  const ticks = topTicks(RAIL_X0, RAIL_X1, 6, 5, strip.y + 0.4, 4.6, [2, 3.6], P);
  s.slab("rail.ruler", strip, 4, 0.6, { tone: "lo", crease: "none", flat: true, steps: 2, lines: [line(ticks.minor, "lo"), line(ticks.major, "mid")] });
  const stopX = xOfProb(TRIP_P);
  s.cyl("rail.trip", stopX, strip.y + 2.5, 2.1, 4.6, 5, { tone: "hi", steps: 12, lines: [line(ring(stopX, strip.y + 2.5, 2.1, 9.6, P, 12), "lo")] });

  // Carriage on the rails: moves with the changepoint probability.
  const cx = xOfProb(REST_PROB);
  s.slab("slider.carriage", { x: cx - CARRIAGE_W / 2, y: RAIL_Y - CARRIAGE_D / 2, w: CARRIAGE_W, d: CARRIAGE_D, r: 2.5 }, CARRIAGE_Z, 6, {
    tone: "mid",
    steps: 5,
    bevel: 0.6,
    slot: "slider",
    dots: [dots(corners({ x: cx - CARRIAGE_W / 2, y: RAIL_Y - CARRIAGE_D / 2, w: CARRIAGE_W, d: CARRIAGE_D, r: 0 }, 2.4).map(([x, y]) => top(x, y, CARRIAGE_Z + 6)), 0.5, "mid")],
  });
  s.cyl("slider.knob", cx, RAIL_Y, 4.6, CARRIAGE_Z + 6, 4, {
    tone: "hi",
    steps: 20,
    slot: "slider",
    lines: [line(knurl(cx, RAIL_Y, 4.6, CARRIAGE_Z + 6, CARRIAGE_Z + 10, 24, P), "lo"), line(lineOnTop([cx - 2.2, RAIL_Y], [cx + 2.2, RAIL_Y + 3], CARRIAGE_Z + 10, P), "hi")],
  });
  s.slab("slider.pointer", { x: cx - 1, y: RAIL_Y + CARRIAGE_D / 2, w: 2, d: 74 - (RAIL_Y + CARRIAGE_D / 2) + 1.5, r: 0.4 }, CARRIAGE_Z + 1.2, 2.4, { tone: "hi", lit: true, steps: 2, slot: "slider", bias: 0.2 });

  /* ---------------------------------------------------------------- held-days counter */
  s.slab("hold.block", BLOCK, 0, 6, {
    tone: "mid",
    steps: 4,
    bevel: 0.8,
    lines: [line(planOutline(insetPlan(BLOCK, 4), 6, P, 4), "faint")],
    dots: [dots(corners(BLOCK, 2.4).map(([x, y]) => top(x, y, 6)), 0.5, "mid")],
  });
  for (const [index, x] of PEG_X.entries()) {
    s.cyl(`hold.collar${index}`, x, PEG_Y, 6.4, 6, PEG_Z - 6, {
      tone: "lo",
      steps: 18,
      lines: [line(ring(x, PEG_Y, 6.4, PEG_Z, P, 18), "faint")],
    });
    s.cyl(`hold.plunger${index}`, x, PEG_Y, PEG_R, PEG_Z, stroke(PLUNGER_MIN, PEG_MAX, level), { tone: "hi", steps: 16, slot: `@peg${index}` });
  }
  const hlabel: Plan = { x: -124, y: -52, w: 82, d: 4, r: 1 };
  s.slab("hold.label", hlabel, 6, 0.6, {
    tone: "lo",
    flat: true,
    steps: 2,
    lines: [line(lineOnTop([hlabel.x + 5, hlabel.y + 2], [hlabel.x + hlabel.w - 5, hlabel.y + 2], 6.6, P), "lo", { free: true })],
  });

  /* ---------------------------------------------------------------- day clock */
  const c = CLOCK;
  s.cyl("clock.puck", c.x, c.y, c.r, 0, CLOCK_TOP, {
    tone: "hi",
    steps: 56,
    bevel: 0.8,
    inner: sideArc(c.x, c.y, c.r, CLOCK_TOP - 3.4, P, 30),
    lines: [
      line(knurl(c.x, c.y, c.r, CLOCK_TOP - 3.4, CLOCK_TOP, 84, P, 0.3), "lo"),
      line(ring(c.x, c.y, c.r - 2.4, CLOCK_TOP, P, 56), "lo"),
      line(radialTicks(c.x, c.y, c.r - 2.4, 18, 3, CLOCK_TOP, [2.2, 4.4], P).minor, "lo"),
      line(radialTicks(c.x, c.y, c.r - 2.4, 18, 3, CLOCK_TOP, [2.2, 4.4], P).major, "mid"),
    ],
  });
  s.cyl("clock.hub", c.x, c.y, 3.2, CLOCK_TOP, 2.4, { tone: "mid", steps: 14, lines: [line(ring(c.x, c.y, 1.4, CLOCK_TOP + 2.4, P, 10), "lo")] });
  s.cyl("clock.needle", c.x, c.y, 0.8, CLOCK_TOP + 2.4, 0.4, { tone: "hi", steps: 6, slot: "@needle", flat: true });

  /* ---------------------------------------------------------------- interlock: three condition keys */
  s.slab("keys.bus", BUS, 0, 4, {
    tone: "mid",
    steps: 4,
    bevel: 0.7,
    lines: [line(planOutline(insetPlan(BUS, 3.6), 4, P, 4), "faint")],
    dots: [dots(corners(BUS, 2.2).map(([x, y]) => top(x, y, 4)), 0.5, "mid")],
  });
  for (const [index, y] of KEY_Y.entries()) {
    s.cyl(`keys.collar${index}`, KEY_X, y, 7.4, 4, KEY_Z - 4, { tone: "lo", steps: 20, lines: [line(ring(KEY_X, y, 7.4, KEY_Z, P, 20), "faint")] });
    s.cyl(`keys.plunger${index}`, KEY_X, y, KEY_R, KEY_Z, stroke(PLUNGER_MIN, KEY_MAX, level), { tone: "hi", steps: 18, slot: `@key${index}` });
  }

  /* ---------------------------------------------------------------- gate portal and bar */
  for (const [index, y] of [-92, 82].entries()) {
    s.slab(`gate.post${index}`, { x: GATE_X - 6, y, w: 12, d: 10, r: 1.6 }, 0, 40, {
      tone: "mid",
      steps: 3,
      bevel: 0.6,
      dots: [dots([top(GATE_X, y + 5, 40)], 0.5, "mid")],
    });
  }
  s.slab("gate.beam", { x: GATE_X - 6, y: -92, w: 12, d: 184, r: 1.6 }, 40, 5, {
    tone: "mid",
    steps: 3,
    bevel: 0.6,
    lines: [line(planOutline({ x: GATE_X - 3, y: -88, w: 6, d: 176, r: 1 }, 45, P, 3), "faint")],
  });
  s.cyl("gate.solenoid", GATE_X, 0, 8, 45, 12, {
    tone: "lo",
    steps: 24,
    inner: [48, 51, 54].map((z) => sideArc(GATE_X, 0, 8, z, P, 14)).join(""),
    lines: [line(ring(GATE_X, 0, 4.4, 57, P, 16), "lo")],
  });
  s.slab("gate.bar", GATE_PLAN, GATE_Z, GATE_H, {
    tone: "hi",
    steps: 3,
    bevel: 0.6,
    slot: "gate",
  });
  for (const [index, y] of LANE_Y.entries()) {
    s.slab(`gate.tooth${index}`, { x: GATE_X - 3, y: y - 8, w: 6, d: 16, r: 1 }, LANE_Z, GATE_Z - LANE_Z, { tone: "mid", steps: 3, bevel: 0.4, slot: "gate", bias: -0.1 });
  }

  /* ---------------------------------------------------------------- lanes, tokens, cards */
  for (const [index, y] of LANE_Y.entries()) {
    const channel: Plan = { x: 60, y: y - LANE_W / 2, w: 190, d: LANE_W, r: 2 };
    s.slab(`lane${index}.channel`, channel, 0, LANE_Z, { tone: "lo", steps: 4 });
    for (const [side, yy] of [y - LANE_W / 2, y + LANE_W / 2 - 3].entries()) {
      s.slab(`lane${index}.rail${side}`, { x: 60, y: yy, w: 190, d: 3, r: 0.8 }, LANE_Z, 4, { tone: "mid", steps: 3, bevel: 0.4 });
    }
    const card: Plan = { x: CARD_X0, y: y - CARD_D / 2, w: CARD_W, d: CARD_D, r: 3 };
    const chip: Plan = { x: CARD_X0 + CARD_W - 20, y: y - 6, w: 12, d: 12, r: 1.4 };
    s.slab(`card${index}.chip`, chip, LANE_Z, 0.8, {
      tone: "mid",
      steps: 3,
      flat: true,
      lines: [line(planOutline(card, LANE_Z, P, 5), "faint")].concat([
        line(lineOnTop([CARD_X0 + 8, y + 12], [CARD_X0 + 36, y + 12], LANE_Z, P), "lo", { free: true }),
      ]),
    });
    s.slab(`card${index}.lit`, chip, LANE_Z + 0.8, 0.5, { tone: "hi", lit: true, steps: 3, flat: true, slot: `chip${index}`, bias: 0.3 });
    const tx = TOKEN_X0;
    s.cyl(`token${index}`, tx, y, TOKEN_R, LANE_Z, TOKEN_H, {
      tone: "hi",
      steps: 28,
      bevel: 0.5,
      slot: `token${index}`,
      bias: 0.4,
      lines: [line(ring(tx, y, TOKEN_R - 2, LANE_Z + TOKEN_H, P, 28), "faint")],
      texts: [{ transform: topMatrix([tx, y + 1.2], LANE_Z + TOKEN_H, P), text: "₱1,500", size: 3.4, tone: "mid", anchor: "middle" }],
    });
  }
}
