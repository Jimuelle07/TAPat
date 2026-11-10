/* Where things stand. World units, x along the bench, y towards the viewer, z up. Shared by geometry (server) and frame (client). */
import type { Plan } from "../../iso/iso-kit";
import { D1, XH, ZH, S1 } from "./model";

// ---- crude drum and its sight gauge (left)
export const DRUM = { x: -192, y: -30, r: 30, z: 4, h: 60 };
export const PALLET: Plan = { x: -228, y: -66, w: 72, d: 72, r: 4 };
/** Float gauge: two guide rails with a float between them, on a foot. Rails are `rail` thick, `gap` clear each side of the float. */
export const TUBE = { x: XH - D1, y: -30, gap: 3.6, rail: 3, half: 3.2, z: 8, h: 64 };
/** Float centre up to the lever pin its arm drives. */
export const ROD_LEN = 38;
export const FLOAT_R = 3.3;
export const FLOAT_H = 6;
export const STEM_R = 1.4;
export const ARM_HALF = 2.2;
export const floatZ = (crude: number) => ZH + S1 * crude - ROD_LEN;

// ---- product lever
export const LEVER_THICK = 7;
export const LEVER_LENGTH = 234;
export const SLOT_W = 4.4;

// ---- carriage, guide rod and the peso dial (front left)
export const GUIDE_Y = -64.4;
export const GUIDE_Z: [number, number] = [11.6, 96];
export const DIAL_WHEEL = { x: -83, y: 36, teeth: 22, module: 2 };
export const DIAL_R = (DIAL_WHEEL.teeth * DIAL_WHEEL.module) / 2;
export const DIAL_Z: [number, number] = [4, 9];
export const DIAL_PLATE: Plan = { x: DIAL_WHEEL.x - 33, y: DIAL_WHEEL.y - 42, w: 66, d: 68, r: 5 };
export const LINK_Z: [number, number] = [4.5, 9];

// ---- fixed weights and their post
export const POST: Plan = { x: 22, y: -62, w: 12, d: 7, r: 1.5 };
export const WEIGHT_PLATE_PLAN: Plan = { x: 14, y: -62, w: 28, d: 8, r: 1.5 };

// ---- counter (front right)
export const COUNTER: Plan = { x: 38, y: -30, w: 92, d: 34, r: 3 };
export const COUNTER_H = 44;
export const COUNTER_FRONT = COUNTER.y + COUNTER.d;
export const WHEEL = { r: 15, w: 17, axisY: COUNTER.y + COUNTER.d - 17, axisZ: 24 };
export const WHEEL_X = [53.5, 73, 97, 116.5]; // tens, units, tenths, hundredths
export const DOT_X = 85;
export const WINDOW = { x0: 45, x1: 125, z0: 14, z1: 34 };
/** The counter is a hollow box: bottom and top bodies carry the wheels between them. */
export const BODY_LOW = 8.5;
export const BODY_HIGH = 39.5;
export const LIP = 1.5;
export const DIGIT_SIZE = 13;

// ---- price ladder next to the counter, with the ₱65.00 index
export const LADDER: Plan = { x: 12, y: -22, w: 9, d: 6, r: 1 };
export const LADDER_Z: [number, number] = [5, 63];
export const LADDER_PHP: [number, number] = [40, 85];
export const ladderZ = (php: number) => LADDER_Z[0] + ((php - LADDER_PHP[0]) / (LADDER_PHP[1] - LADDER_PHP[0])) * (LADDER_Z[1] - LADDER_Z[0]);

// ---- calendar cam and follower
export const CAM = { x: 178, y: -13, r: 22, z: 6, h: 5 };
export const FOLLOWER_R = 3;

// ---- week rule along the front edge
export const WEEK_RULE: Plan = { x: -44, y: 58, w: 218, d: 8, r: 1 };
export const WEEK_X0 = -36;
export const WEEK_PITCH = 4.1;
export const weekX = (week: number) => WEEK_X0 + (week - 1) * WEEK_PITCH;

// ---- wall calendar: 52 weeks as 13 columns by 4 rows, with a marker on the current week
export const CAL = { x: 82, z: 84, w: 112, h: 44, pitch: 7.6, cell: 5.6, cols: 13, rows: 4 };
export const calendarCell = (week: number): [number, number] => {
  const index = Math.min(51, Math.max(0, week - 1));
  const col = index % CAL.cols;
  const row = Math.floor(index / CAL.cols);
  return [CAL.x + (CAL.w - CAL.cols * CAL.pitch) / 2 + (col + 0.5) * CAL.pitch, CAL.z + CAL.h - 7 - (row + 0.5) * CAL.pitch];
};
