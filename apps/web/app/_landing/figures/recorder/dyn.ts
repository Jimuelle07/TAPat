import type { Point3 } from "../../iso/iso-kit";
import { REEL, ROLL_LEN, ROLL_Y0, SLOPE_DEG, SUPPLY, TOKEN_S0, TOKEN_S1 } from "./view";

/* What the live component needs from the machine's geometry, and nothing else: the slope the tokens slide down, the centres the roll faces
   turn about, and the counter window's height. geometry.ts (server only) builds the static art from the same numbers. */

const TH = (SLOPE_DEG * Math.PI) / 180;
export const SLOPE_D: Point3 = [Math.cos(TH), 0, -Math.sin(TH)];
export const SLOPE_N: Point3 = [Math.sin(TH), 0, Math.cos(TH)];

/** Slide offset of a token that has travelled `s` from its resting place against the bar, and the extra rise onto the card. */
export const tokenShift = (s: number, lift: number): Point3 => [SLOPE_D[0] * s + SLOPE_N[0] * lift, 0, SLOPE_D[2] * s + SLOPE_N[2] * lift];
export const TOKEN_TRAVEL = TOKEN_S1 - TOKEN_S0;

/** Where a roll's turning face sits: on the spindle, past the roll face, hub and retainer. */
export const rollCentre = (x: number, z: number): Point3 => [x, ROLL_Y0 + (ROLL_LEN + 1.4 + 1.7), z];
export const TURN_CENTRE = { reel: rollCentre(REEL.x, REEL.z), supply: rollCentre(SUPPLY.x, SUPPLY.z) };

export const WINDOW_H = 11.6;
