import { boxCorners, fitProjection, iso, type Flat, type Plan, type Point3 } from "../../iso/iso-kit";

/**
 * World layout of the Freeze rig (units about 1 mm of the real bench, z up, +y toward the viewer).
 *
 * Left: a fuel station under a frame canopy with a roll-down shutter. In front of it a tap lane carries one token per tap past a
 * sensor arch to the station's reader. Back: the Count-Min sketch, two rows of sixteen columns that rise with each tap and fall by 0.6 a
 * tick. Right: the score dial with its threshold mark and the three trigger lamps. Client and build both read these numbers.
 */
export const WIDTH = 640;
export const HEIGHT = 350;
export const AZIMUTH = 58;
export const ELEVATION = 30;

export const BASE: Plan = { x: -262, y: -108, w: 462, d: 216, r: 10 };
export const BASE_Z = -12;
export const BASE_H = 12;

/** Station: forecourt pad, four canopy posts, a fascia on the front and the shutter plane behind it. */
export const PAD: Plan = { x: -252, y: -72, w: 152, d: 116, r: 3 };
export const CAN_X0 = -248;
export const CAN_X1 = -104;
export const CAN_BACK = -64;
export const CAN_FRONT = 30;
export const POST_W = 6;
export const POST_TOP = 52;
export const FASCIA_Z = 52;
export const FASCIA_H = 16;
export const SHUTTER = { x: CAN_X0 + POST_W, w: CAN_X1 - CAN_X0 - 2 * POST_W, y: 23, d: 3, z: 3, h: 48 } as const;
/** The shutter rests this far up, rolled into the fascia and clipped away above its lower edge. */
export const SHUTTER_UP = 50;
export const CLIP_TOP = 60;

/** Tap lane along the front: tokens start at the right, pass the sensor arch and end at the reader. */
export const LANE: Plan = { x: -244, y: 46, w: 404, d: 32, r: 2 };
export const LANE_Y = 62;
export const LANE_Z = 2.4;
export const TAP_X0 = 150;
export const TAP_X1 = -206;
export const SENSOR_X = -56;
export const TOKEN_R = 8;
export const TOKEN_H = 3.4;

/** Sketch: two rows of sixteen columns, each column summing 64 of the 1,024 bins. */
export const COLS = 16;
export const ROWS = 2;
export const TRAY: Plan = { x: -86, y: -98, w: 148, d: 50, r: 3 };
export const TRAY_Z = 5;
export const CELL_PITCH = 8.6;
export const CELL_X0 = -78.4;
export const ROW_Y = [-85, -63] as const;
export const CELL_W = 6.2;
export const CELL_Z = 5.6;
export const COL_MIN = 0.7;
export const COL_MAX = 30;
export const PER_COUNT = 1.5;

/** Score dial: face up, 270 degrees for a score of 0 to 4, the freeze line at the configured threshold. */
export const DIAL = { x: 130, y: -52, r: 34 } as const;
export const DIAL_TOP = 9;
export const SCORE_MAX = 4;
export const DIAL_FROM = -0.75 * Math.PI;
export const DIAL_SPAN = 1.5 * Math.PI;
export const THRESHOLD = 2.2;
export const angleOfScore = (score: number) => DIAL_FROM + (Math.min(SCORE_MAX, Math.max(0, score)) / SCORE_MAX) * DIAL_SPAN;

/** Trigger lamps: MIDAS-F, near-cap streak, volume spike. */
export const LAMP_BAR: Plan = { x: 98, y: 0, w: 66, d: 22, r: 3 };
export const LAMP_X = [114, 131, 148] as const;
export const LAMP_Y = 11;

const fitPoints: Point3[] = [...boxCorners(BASE, -17, 0), [CAN_X0, CAN_BACK, 70], [CAN_X1, CAN_FRONT, 70], [-64, 46, 36], [130, -52, 30], [150, 12, 30]];

export const P = fitProjection(fitPoints, WIDTH, HEIGHT, { pad: 22, azimuth: AZIMUTH, elevation: ELEVATION });

export const at = (point: Point3): Flat => iso(point, P);
