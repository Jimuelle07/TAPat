import { BELT_Z, CHIP_H, STATION } from "./view";

/* Numbers shared by the geometry (server) and the pose (client). Nothing here reads data or time. */

export const [X1, X2, X3, X4, X5, X6, X7, X8] = STATION as [number, number, number, number, number, number, number, number];

/* 01 price sensor: a dial gauge standing on its face plane. */
export const GAUGE = { x: X1, y: -42, z: 31, r: 17 };
export const DIAL = { from: 225, span: 270, lo: 55, hi: 80 };

/* 02 Tranche Agent: a fly-ball governor. Arms pivot on the yoke, links run to the sleeve on the spindle. */
export const GOV = { x: X2, y: -35.4, spindleY: -38, pivotZ: 52, pivotX: 3, arm: 24, attach: 14, link: 17, from: 20, to: 55, ball: 5, sleeveR: 4, sleeveH: 5 };
export const govSleeve = (deg: number) => {
  const t = (deg * Math.PI) / 180;
  const h = GOV.pivotX + GOV.attach * Math.sin(t);
  return GOV.pivotZ - GOV.attach * Math.cos(t) - Math.sqrt(GOV.link * GOV.link - h * h);
};
export const GOV_LIFT = govSleeve(GOV.to) - govSleeve(GOV.from);
export const STOP_X = (x: number) => x + 11;

/* 03 fund_escrow() vault: the drawer travels this far in. */
export const TRAY = { x: X3, travel: 34 };

/* 04 card reader: the card goes down this far to touch the pad. */
export const READER = { x: X4, padY: -37, stroke: 22 };

/* 05 authorize() tumbler: plug axis along x, three pins on the shear line. */
export const LOCK = { x: X5, plugY: -30, plugZ: 11.5, plugR: 5, pins: [-16, -6, 4], start: [5.5, -4.2, 6.4], armX: 15, arm: 43, tail: 6 };

/* 06 Freeze Agent watch post. */
export const POST = { x: X6, mastX: X6 - 1, mastY: -46, mastTop: 58 };

/* 07 claim() chute and the hold latch. PUSH_TIP is where the pusher paddle rests, in y. */
export const PUSH_TIP = 13;
export const CLAIM = { x: X7, push: 27, ramp: { y0: -9.4, z0: BELT_Z + CHIP_H * 2, y1: -50, z1: 3 }, bin: { y: -61, floor: 1.6 }, gate: 16 };

/* 08 sweep_on_revoke(): lever, stop plate, and the chute down to the lockbox. */
export const SWEEP = { x: X8, lever: { x: X8 - 2, y: -34, z: 20, len: 24, from: -32, to: 32 }, rampX0: 533.4, rampX1: 556, box: { x: 578 } };
