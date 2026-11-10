// Kinematics of the governor: a weighted lever on a pivot, a catch pin on the lever, a hanging latch that holds the lever at the fourth notch,
// and a roller on the lever's tip that lifts the release gate once the latch has swung away. All in the (x, z) plane; the lever lies in y -7..-4.
const RAD = Math.PI / 180;

// Frame whose polygon coordinates are (x, z) and whose extrusion runs along +y.
export const XZ_FRAME: { o: [number, number, number]; a: [number, number, number]; u: [number, number, number]; v: [number, number, number] } = { o: [0, 0, 0], a: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1] };

export const PIVOT: [number, number] = [-74, 40];
export const LEVER_L = 44;
export const LEVER_TAIL = 12;
export const NOTCH_DEG = [-8, 0, 8, 16, 24]; // rest, then one notch per day held above the mark
export const MAX_DEG = 44; // after the latch lets go, the lever runs on and lifts the gate
export const LATCH_OUT_DEG = 48;

export const Y_PANEL: [number, number] = [-12, -9];
export const Y_QUAD: [number, number] = [-9, -7];
export const Y_LEVER: [number, number] = [-7, -4];
export const Y_FRONT = -4;

export const WEIGHT_U = -11;
export const WEIGHT_R = 5.4;
export const WEIGHT_Y1 = 0.5;
export const CATCH_U = 26;
export const CATCH_R = 1.6;
export const CATCH_Y1 = -0.5;
export const PIN_R = 1.8;
export const PIN_Y1 = 4;
export const ROLLER_R = 3.2;
export const ROLLER_Y1 = 9;
export const QUAD_R = 30;
export const QUAD_FROM = -16;
export const QUAD_TO = 48;

export const pointAt = (deg: number, u: number, v = 0): [number, number] => [
  PIVOT[0] + u * Math.cos(deg * RAD) - v * Math.sin(deg * RAD),
  PIVOT[1] + u * Math.sin(deg * RAD) + v * Math.cos(deg * RAD),
];

export const LEVER_LOCAL: Array<[number, number]> = [
  [-LEVER_TAIL, -1.7],
  [-LEVER_TAIL, 1.7],
  [0, 3.2],
  [LEVER_L, 1.4],
  [LEVER_L, -1.4],
  [0, -3.2],
];

export const leverPoly = (deg: number): Array<[number, number]> => LEVER_LOCAL.map(([u, v]) => pointAt(deg, u, v));

// The catch pin at the fourth notch, and the latch that hangs from above it with its toe on the pin.
export const CATCH_AT_HOLD = pointAt(NOTCH_DEG[4]!, CATCH_U);
export const LATCH_PIVOT: [number, number] = [CATCH_AT_HOLD[0], 72];
export const LATCH_LENGTH = LATCH_PIVOT[1] - (CATCH_AT_HOLD[1] + CATCH_R);
export const LATCH_W = 2.4;
export const Y_LATCH: [number, number] = [-4, -1];

// Latch angle in degrees: 0 hangs straight down, positive swings its toe toward +x.
export function latchPoly(deg: number): Array<[number, number]> {
  const c = Math.cos(deg * RAD);
  const s = Math.sin(deg * RAD);
  return (
    [
      [-LATCH_W / 2, -LATCH_LENGTH],
      [LATCH_W / 2, -LATCH_LENGTH],
      [LATCH_W / 2, 1.4],
      [-LATCH_W / 2, 1.4],
    ] as Array<[number, number]>
  ).map(([x, z]) => [LATCH_PIVOT[0] + x * c - z * s, LATCH_PIVOT[1] + x * s + z * c]);
}

export const ROLLER_AT_HOLD = pointAt(NOTCH_DEG[4]!, LEVER_L);
export const BAR_Z = ROLLER_AT_HOLD[1] + ROLLER_R; // underside of the gate bar: the roller touches it at the fourth notch
export const GATE_LIFT = LEVER_L * (Math.sin(MAX_DEG * RAD) - Math.sin(NOTCH_DEG[4]! * RAD));

// Chord of each riding part from rest to the lever's far stop, for the audit's replay.
export const chordOf = (u: number): [number, number, number] => {
  const a = pointAt(NOTCH_DEG[0]!, u);
  const b = pointAt(MAX_DEG, u);
  return [b[0] - a[0], 0, b[1] - a[1]];
};

// Lever angle for a notch count (0..4 notches, 5 = run on to the far stop).
export const angleOf = (stage: number) => {
  const s = Math.max(0, Math.min(5, stage));
  if (s <= 4) {
    const i = Math.min(3, Math.floor(s));
    return NOTCH_DEG[i]! + (NOTCH_DEG[i + 1]! - NOTCH_DEG[i]!) * (s - i);
  }
  return NOTCH_DEG[4]! + (MAX_DEG - NOTCH_DEG[4]!) * (s - 4);
};
