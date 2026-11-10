import { translateAlong, type Plan, type Point3 } from "@/app/_landing/iso/iso-kit";
import { boxPoints, fit } from "../shared";
import { COLS, ROWS } from "./model";

export const WIDTH = 410;
export const HEIGHT = 232;
export const AZIMUTH = 40;

export const PITCH = 6;
export const BOARD: Plan = { x: 0, y: 0, w: COLS * PITCH, d: ROWS * PITCH, r: 2 };
export const BOARD_Z = 8;
export const BOARD_H = 1.2;
export const BOARD_TOP = BOARD_Z + BOARD_H;
export const PEG_R = 2;
export const PEG_H = 4.6;

export const BASE: Plan = { x: -16, y: -16, w: 218, d: 208, r: 7 };
export const BASE_H = 4;
export const FOOT_H = 4;
export const TRAY: Plan = { x: -8, y: -8, w: 202, d: 160, r: 4 };
export const TRAY_H = 4;
export const RIM = 7;
export const RIM_TOP = BOARD_Z + 4.5;
export const RAIL_TOP = RIM_TOP + 2;

/** The rail carriages ride on the rims; the beam sits on them above the pegs. */
export const BLOCK_H = 8;
export const BEAM_Z = RAIL_TOP + BLOCK_H;
export const BEAM_H = 7;
export const BEAM_TOP = BEAM_Z + BEAM_H;
export const NOZZLE_DY = 7;
export const BEAM_D = 8;

export const COUNTER: Plan = { x: 128, y: 158, w: 56, d: 26, r: 2 };
export const COUNTER_Z = BASE_H;
export const COUNTER_H = 14;

export const P = fit(
  [
    ...boxPoints(BASE, -FOOT_H, BASE_H),
    ...boxPoints({ x: -10, y: -8, w: 208, d: 20, r: 0 }, BEAM_Z, BEAM_TOP + 11),
    ...boxPoints(COUNTER, COUNTER_Z, COUNTER_Z + COUNTER_H),
  ] as Point3[],
  WIDTH,
  HEIGHT,
  { azimuth: AZIMUTH, pad: [8, 8, 8, 10] },
);

export const pegAt = (row: number, col: number): [number, number] => [(col + 0.5) * PITCH, (row + 0.5) * PITCH];
/** Beam centre line for a (fractional) row: the nozzle sits NOZZLE_DY in front of it. */
export const beamY = (row: number) => (row + 0.5) * PITCH - NOZZLE_DY;
export const beamShift = (row: number) => translateAlong(P, [0, beamY(row) - beamY(0), 0]);
export const headShift = (col: number) => translateAlong(P, [col * PITCH, 0, 0]);
/** A peg's lift above its hole while it drops in. */
export const dropShift = (height: number) => translateAlong(P, [0, 0, height]);

/** Digit strips: one digit every DIGIT_PITCH of height, raised to bring a value into its window. */
export const DIGIT_PITCH = 9;
export const stripShift = (value: number) => translateAlong(P, [0, 0, (value % 10) * DIGIT_PITCH]);
