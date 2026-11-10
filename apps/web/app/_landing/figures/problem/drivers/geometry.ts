import { cameraOf, corners, insetPlan, iso, knurl, pathOf, sideMatrix, topMatrix, type Flat, type Plan, type Plane } from "@/app/_landing/iso/iso-kit";
import { kitOf, type Shape } from "../build";
import { join } from "../shared";
import { COLS, PEGS, ROWS, rowCount } from "./model";
import {
  BASE,
  BASE_H,
  BEAM_D,
  BEAM_H,
  BEAM_TOP,
  BEAM_Z,
  BLOCK_H,
  BOARD,
  BOARD_H,
  BOARD_TOP,
  BOARD_Z,
  COUNTER,
  COUNTER_H,
  COUNTER_Z,
  DIGIT_PITCH,
  FOOT_H,
  P,
  PEG_H,
  PEG_R,
  PITCH,
  RAIL_TOP,
  RIM,
  RIM_TOP,
  TRAY,
  TRAY_H,
  beamY,
  pegAt,
} from "./view";

/** Every solid, as data, for the audit script. */
export const LEDGER: Shape[] = [];
const K = kitOf(P, LEDGER);
const { at, slab, cyl, seg } = K;
const ORIGIN = iso([0, 0, 0], P);
const offset = ([x, y]: Flat): Flat => [x - ORIGIN[0], y - ORIGIN[1]];

/* ---------------------------------------------------------------- base, tray, board */

const FEET = corners(BASE, 18).map(([x, y]) => [x, y] as Plane);
const BASE_SCREWS = corners(BASE, 7);

export const BASE_ART = {
  halo: slab("base", BASE, 0, BASE_H, 8).fill,
  feet: FEET.map(([x, y], i) => [cyl(`foot${i}.flange`, x, y, 7, -FOOT_H, 1.4, 20), cyl(`foot${i}.pad`, x, y, 5.4, -FOOT_H + 1.4, FOOT_H - 1.4, 20)]),
  slab: slab("base.slab", BASE, 0, BASE_H, 8, 1.2),
  groove: K.outline(insetPlan(BASE, 4), BASE_H, 8),
  screws: BASE_SCREWS.map(([x, y]) => at([x, y, BASE_H])),
  screwRings: join(BASE_SCREWS.map(([x, y]) => K.ring(x, y, 2.1, BASE_H, 14))),
};

const BACK: Plan = { x: -1, y: TRAY.y, w: BOARD.w + 2, d: RIM, r: 1 };
const LEFT: Plan = { x: TRAY.x, y: TRAY.y, w: RIM, d: TRAY.d, r: 1.2 };
const RIGHT: Plan = { x: TRAY.x + TRAY.w - RIM, y: TRAY.y, w: RIM, d: TRAY.d, r: 1.2 };
const LIP: Plan = { x: -1, y: BOARD.d, w: BOARD.w + 2, d: TRAY.y + TRAY.d - BOARD.d, r: 1 };
const RAIL_W = 4;
const RAIL_LEFT: Plan = { x: LEFT.x + (RIM - RAIL_W) / 2, y: TRAY.y + 1, w: RAIL_W, d: TRAY.d - 2, r: 0.6 };
const RAIL_RIGHT: Plan = { x: RIGHT.x + (RIM - RAIL_W) / 2, y: TRAY.y + 1, w: RAIL_W, d: TRAY.d - 2, r: 0.6 };
const STRIP: Plan = { x: 2, y: BACK.y + 1.5, w: BOARD.w - 4, d: 4, r: 0.6 };
const FRONT_EDGE = STRIP.y + STRIP.d;
const COLUMN_CENTRES = Array.from({ length: COLS }, (_, c) => (c + 0.5) * PITCH);

function columnTicks() {
  const minor: string[] = [];
  const major: string[] = [];
  COLUMN_CENTRES.forEach((x, c) => {
    const big = c % 5 === 0;
    (big ? major : minor).push(K.top([[x, FRONT_EDGE], [x, FRONT_EDGE - (big ? 2.8 : 1.6)]], RIM_TOP + 0.6));
  });
  return { minor: join(minor), major: join(major) };
}

/** Row boundaries on the left rail: a tick every row, a long one every fifth. */
function rowTicks() {
  const minor: string[] = [];
  const major: string[] = [];
  for (let k = 0; k <= ROWS; k++) {
    const y = k * PITCH;
    if (y < RAIL_LEFT.y + 1 || y > RAIL_LEFT.y + RAIL_LEFT.d - 1) continue;
    (k % 5 === 0 ? major : minor).push(K.top([[RAIL_LEFT.x, y], [RAIL_LEFT.x + (k % 5 === 0 ? 2.6 : 1.5), y]], RAIL_TOP));
  }
  return { minor: join(minor), major: join(major) };
}

const HOLES = (() => {
  const ex = PEG_R * 0.9 * cameraOf(P).k;
  const ey = ex * cameraOf(P).sinE;
  let last: Flat | null = null;
  let d = "";
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < rowCount(row); col++) {
      const [px, py] = pegAt(row, col);
      const [sx, sy] = at([px, py, BOARD_TOP]);
      const start: Flat = [sx - ex, sy];
      const t = (v: number) => Math.round(v * 10) / 10;
      d += last ? `m${t(start[0] - last[0])} ${t(start[1] - last[1])}` : `M${t(start[0])} ${t(start[1])}`;
      d += `a${t(ex)} ${t(ey)} 0 1 0 ${t(ex * 2)} 0a${t(ex)} ${t(ey)} 0 1 0 ${t(-ex * 2)} 0z`;
      last = [Math.round(start[0] * 10) / 10, Math.round(start[1] * 10) / 10];
    }
  }
  return d;
})();

export const TRAY_ART = {
  plate: slab("tray", TRAY, BASE_H, TRAY_H, 5, 1),
  back: slab("tray.back", BACK, BOARD_Z, RIM_TOP - BOARD_Z, 3, 0.6),
  left: slab("tray.left", LEFT, BOARD_Z, RIM_TOP - BOARD_Z, 3, 0.6),
  right: slab("tray.right", RIGHT, BOARD_Z, RIM_TOP - BOARD_Z, 3, 0.6),
  board: slab("board", BOARD, BOARD_Z, BOARD_H, 4, 0.4),
  boardGroove: K.outline(insetPlan(BOARD, 1.6), BOARD_TOP, 4),
  boardScrews: corners(BOARD, 3.4).map(([x, y]) => at([x, y, BOARD_TOP])),
  holes: HOLES,
  lip: slab("tray.lip", LIP, BOARD_Z, 2.2, 3, 0.4),
  lipScrews: [at([6, LIP.y + LIP.d / 2, BOARD_Z + 2.2]), at([BOARD.w - 6, LIP.y + LIP.d / 2, BOARD_Z + 2.2])],
  strip: slab("tray.strip", STRIP, RIM_TOP, 0.6, 2),
  ticks: columnTicks(),
  railLeft: slab("rail.left", RAIL_LEFT, RIM_TOP, RAIL_TOP - RIM_TOP, 2, 0.3),
  railRight: slab("rail.right", RAIL_RIGHT, RIM_TOP, RAIL_TOP - RIM_TOP, 2, 0.3),
  railTicks: rowTicks(),
  railScrews: [RAIL_LEFT, RAIL_RIGHT].flatMap((rail) => [at([rail.x + RAIL_W / 2, rail.y + 4, RAIL_TOP]), at([rail.x + RAIL_W / 2, rail.y + rail.d - 4, RAIL_TOP])]),
  trayScrews: [LEFT, RIGHT].flatMap((rim) => [at([rim.x + RIM / 2, rim.y + 5, RIM_TOP]), at([rim.x + RIM / 2, rim.y + rim.d - 5, RIM_TOP])]),
};

/* ---------------------------------------------------------------- pegs */

const peg = cyl("peg", 0, 0, PEG_R, BOARD_TOP, PEG_H, 10);
export const PEG_ART = { peg, bevel: K.ring(0, 0, PEG_R * 0.55, BOARD_TOP + PEG_H, 10) };

export interface PegSpot {
  row: number;
  col: number;
  at: Flat;
}
export const ROW_SPOTS: PegSpot[][] = Array.from({ length: ROWS }, (_, row) =>
  Array.from({ length: rowCount(row) }, (_, col) => {
    const [px, py] = pegAt(row, col);
    return { row, col, at: offset(at([px, py, 0])).map((v) => Math.round(v * 10) / 10) as Flat };
  }),
);
export const PEG_TOTAL = ROW_SPOTS.reduce((sum, row) => sum + row.length, 0);
if (PEG_TOTAL !== PEGS) throw new Error(`drivers pegboard has ${PEG_TOTAL} pegs, expected ${PEGS}`);

/* ---------------------------------------------------------------- the gantry (built at row 0, column 0) */

const BY0 = beamY(0);
const BLOCK_L: Plan = { x: -10, y: BY0 - BEAM_D / 2, w: 12, d: 16, r: 1.5 };
const BLOCK_R: Plan = { x: TRAY.x + TRAY.w - RIM - 2 + 0, y: BY0 - BEAM_D / 2, w: 12, d: 16, r: 1.5 };
const BEAM: Plan = { x: -10, y: BY0 - BEAM_D / 2, w: 208, d: BEAM_D, r: 1.5 };
const FACE = BEAM.y + BEAM.d;
const CARRIAGE: Plan = { x: -8, y: FACE, w: 16, d: 6, r: 1.2 };
const NOZZLE_Y = FACE + 3;

function beamTicks() {
  const minor: string[] = [];
  const major: string[] = [];
  COLUMN_CENTRES.forEach((x, c) => {
    const big = c % 5 === 0;
    (big ? major : minor).push(seg([x, FACE, BEAM_TOP], [x, FACE, BEAM_TOP - (big ? 3.2 : 1.8)]));
  });
  return { minor: join(minor), major: join(major) };
}

export const BEAM_ART = {
  halo: slab("beam.halo", BEAM, BEAM_Z, BEAM_H, 3).fill,
  blockLeft: slab("beam.blockL", BLOCK_L, RAIL_TOP, BLOCK_H, 3, 0.5),
  blockRight: slab("beam.blockR", BLOCK_R, RAIL_TOP, BLOCK_H, 3, 0.5),
  blockScrews: [BLOCK_L, BLOCK_R].map((block) => at([block.x + block.w / 2, block.y + block.d / 2, RAIL_TOP + BLOCK_H])),
  beam: slab("beam", BEAM, BEAM_Z, BEAM_H, 3, 0.8),
  ticks: beamTicks(),
  beamScrews: [at([-6, BEAM.y + BEAM.d / 2, BEAM_TOP]), at([BEAM.x + BEAM.w - 4, BEAM.y + BEAM.d / 2, BEAM_TOP])],
};

export const HEAD_ART = {
  carriage: slab("head.carriage", CARRIAGE, BEAM_Z, BEAM_H, 3, 0.6),
  screws: [at([-5.2, NOZZLE_Y, BEAM_TOP]), at([5.2, NOZZLE_Y, BEAM_TOP])],
  magazine: cyl("head.magazine", 0, NOZZLE_Y, 4.2, BEAM_TOP, 9, 22),
  magazineBand: K.ring(0, NOZZLE_Y, 4.2, BEAM_TOP + 4.5, 22),
  cap: cyl("head.cap", 0, NOZZLE_Y, 4.9, BEAM_TOP + 9, 1.6, 22, 0.3),
  collar: cyl("head.collar", 0, NOZZLE_Y, 3.2, BEAM_Z - 2, 2, 16),
  stem: cyl("head.stem", 0, NOZZLE_Y, 2.1, BOARD_TOP + PEG_H + 2.4, BEAM_Z - 2 - (BOARD_TOP + PEG_H + 2.4), 14),
  tip: cyl("head.tip", 0, NOZZLE_Y, 1.7, BOARD_TOP + PEG_H + 0.8, 1.6, 14),
};

/* ---------------------------------------------------------------- the tally counter */

const WINDOW_W = 9;
const WINDOW_H = 9;
export const WHEEL_X = [COUNTER.x + 18, COUNTER.x + 33, COUNTER.x + 48].map((x) => x - 2);
const FACE_Y = COUNTER.y + COUNTER.d;
const WINDOW_Z0 = COUNTER_Z + 3;

const windowPoints = (cx: number): Point[] => [
  [cx - WINDOW_W / 2, FACE_Y, WINDOW_Z0],
  [cx + WINDOW_W / 2, FACE_Y, WINDOW_Z0],
  [cx + WINDOW_W / 2, FACE_Y, WINDOW_Z0 + WINDOW_H],
  [cx - WINDOW_W / 2, FACE_Y, WINDOW_Z0 + WINDOW_H],
];
type Point = [number, number, number];
const flat = (points: Point[]) => points.map((point) => at(point));

const LABEL: Plan = { x: -6, y: 164, w: 78, d: 20, r: 2 };

export const COUNTER_ART = {
  body: slab("counter", COUNTER, COUNTER_Z, COUNTER_H, 3, 0.8),
  topPlate: slab("counter.top", { x: COUNTER.x + 4, y: COUNTER.y + 4, w: COUNTER.w - 8, d: 8, r: 1.4 }, COUNTER_Z + COUNTER_H, 0.7, 3),
  topLine: K.outline({ x: COUNTER.x + 5.6, y: COUNTER.y + 5.6, w: COUNTER.w - 11.2, d: 4.8, r: 0.8 }, COUNTER_Z + COUNTER_H + 0.7, 3),
  windows: WHEEL_X.map((cx) => pathOf(flat(windowPoints(cx)), true)),
  frames: WHEEL_X.map((cx) => pathOf(flat(windowPoints(cx).map(([x, y, z]) => [x + Math.sign(x - cx) * 1.2, y, z + (z === WINDOW_Z0 ? -1.2 : 1.2)] as Point)), true)),
  dividers: WHEEL_X.slice(0, 2).map((cx, i) => seg([(cx + WHEEL_X[i + 1]) / 2, FACE_Y, WINDOW_Z0 - 1.2], [(cx + WHEEL_X[i + 1]) / 2, FACE_Y, WINDOW_Z0 + WINDOW_H + 1.2])),
  screws: [at([COUNTER.x + 5, FACE_Y, COUNTER_Z + COUNTER_H - 2.2]), at([COUNTER.x + COUNTER.w - 5, FACE_Y, COUNTER_Z + COUNTER_H - 2.2])],
  knob: cyl("counter.knob", COUNTER.x + COUNTER.w - 9, COUNTER.y + 17, 3.4, COUNTER_Z + COUNTER_H, 3.2, 20, 0.3),
  knobKnurl: knurl(COUNTER.x + COUNTER.w - 9, COUNTER.y + 17, 3.4, COUNTER_Z + COUNTER_H, COUNTER_Z + COUNTER_H + 3.2, 20, P),
  clips: WHEEL_X.map((cx) => pathOf(flat(windowPoints(cx)), true)),
};

export const DIGITS = WHEEL_X.map((cx) =>
  Array.from({ length: 11 }, (_, index) => ({
    digit: index % 10,
    matrix: sideMatrix([cx, FACE_Y], WINDOW_Z0 + 1.6 - DIGIT_PITCH * index, P, "left"),
  })),
);
export const DIGIT_SIZE = 6.6;

export const LABEL_ART = {
  plate: slab("label", LABEL, BASE_H, 0.8, 3),
  line: K.outline(insetPlan(LABEL, 1.6), BASE_H + 0.8, 3),
  matrix: topMatrix([LABEL.x + 5, LABEL.y + 8.6], BASE_H + 0.8, P, "x"),
  rule: K.top([[LABEL.x + 5, LABEL.y + 13], [LABEL.x + 38, LABEL.y + 13]], BASE_H + 0.8),
  screws: [at([LABEL.x + 3.4, LABEL.y + LABEL.d - 3.4, BASE_H + 0.8]), at([LABEL.x + LABEL.w - 3.4, LABEL.y + LABEL.d - 3.4, BASE_H + 0.8])],
};
