/*
 * What changes shape or place from frame to frame, rebuilt from the model's state. Shipped to the client: it imports only
 * the kit's camera and `plate.ts`, never the lathe. Parts that only slide are a screen transform; parts that tilt or
 * turn (lever, balance arm, three gears, pointer, dial wheel, calendar cam) are rebuilt as paths.
 */
import { extrude, onTop, type Flat, type SolidPaths } from "../../iso/iso-kit";
import { CAM, DIAL_R, DIAL_WHEEL, DIAL_Z, LADDER_PHP, LEVER_LENGTH, LEVER_THICK, SLOT_W, WHEEL, WHEEL_X, calendarCell, ladderZ, weekX } from "./layout";
import {
  D1,
  FX_RANGE,
  GEAR_A,
  GEAR_B,
  INDEX_PHP,
  KAPPA,
  MODULE,
  REST,
  TEETH,
  XH,
  ZH,
  kin,
  notchDepth,
  wheelsOf,
  OPENING_PUMP,
  type State,
} from "./model";
import { barPolygon, faceCircle, faceLine, gearPolygon, planePrism, slotPolygon } from "./plate";
import { BEAM_Y, EX, EZ, LEVER_Y, MESH_Y, P, RACK_Y, at, shift } from "./view";

const RAD = Math.PI / 180;
const FRONT_FLOOR = DIAL_Z[1];
const tenth = (value: number) => Math.round(value * 10) / 10;
const offset = (points: Flat[], [dx, dz]: Flat): Flat[] => points.map(([x, z]) => [x + dx, z + dz]);

export interface Digit {
  transform: string;
  opacity: number;
}

export interface Frame {
  /** screen transforms for parts that only slide */
  float: string;
  guide: string;
  carriage: string;
  rack: string;
  bead: string;
  follower: string;
  rider: string;
  calendar: string;
  /** rebuilt solids */
  lever: SolidPaths;
  leverSlots: string;
  leverGroove: string;
  beam: SolidPaths;
  beamGroove: string;
  beamRings: string;
  beamPins: Flat[];
  pinion: SolidPaths;
  gearA: SolidPaths;
  gearASpokes: string;
  gearB: SolidPaths;
  gearBSpokes: string;
  pointer: SolidPaths;
  dialWheel: SolidPaths;
  dialMinor: string;
  dialMajor: string;
  cam: SolidPaths;
  camMinor: string;
  camMajor: string;
  digits: Digit[][];
  above: boolean;
}

// -------------------------------------------------------------------- lever and balance arm

function leverOf(tilt: number) {
  const u: Flat = [-Math.cos(tilt), Math.sin(tilt)];
  const hinge: Flat = [XH, ZH];
  const along = (s: number): Flat => [hinge[0] + u[0] * s, hinge[1] + u[1] * s];
  const lever = planePrism(barPolygon(hinge, along(LEVER_LENGTH), LEVER_THICK, [true, false], 8), LEVER_Y[0], LEVER_Y[1], P);
  const slot = (from: number, to: number) => faceLine(slotPolygon(along(from), along(to), SLOT_W, 6), LEVER_Y[1], P, true);
  const groove = (from: number, to: number) => faceLine([along(from), along(to)], LEVER_Y[1], P);
  const cos = Math.cos(tilt);
  const carriageFrom = (KAPPA * FX_RANGE[0]) / cos;
  const carriageTo = (KAPPA * FX_RANGE[1]) / cos;
  const pusher = D1 / cos;
  return {
    lever,
    slots: slot(carriageFrom - 5, carriageTo + 5) + slot(pusher - 8, pusher + 8),
    groove: groove(carriageTo + 5 + SLOT_W / 2 - 0.8, pusher - 8 - SLOT_W / 2 + 0.8) + groove(pusher + 8 + SLOT_W / 2 - 0.8, LEVER_LENGTH),
  };
}

function beamOf(left: Flat, right: Flat, mid: Flat) {
  const length = Math.hypot(right[0] - left[0], right[1] - left[1]);
  const ux = (right[0] - left[0]) / length;
  const uz = (right[1] - left[1]) / length;
  const from: Flat = [left[0] - ux * 14, left[1] - uz * 14];
  const to: Flat = [right[0] + ux * 14, right[1] + uz * 14];
  const front = BEAM_Y[1];
  return {
    beam: planePrism(barPolygon(from, to, 5.2, [true, true], 7), BEAM_Y[0], front, P),
    groove: faceLine([left, right], front, P),
    rings: [left, mid, right].map(([x, z]) => faceCircle(x, z, 2.5, front, P, 14)).join(""),
    pins: [left, mid, right].map(([x, z]) => at([x, front, z])),
  };
}

// -------------------------------------------------------------------- gears

function gearOf(centre: Flat, teeth: number, module: number, angle: number, y0: number, y1: number) {
  return planePrism(offset(gearPolygon(teeth, module, angle), centre), y0, y1, P);
}

function spokes(centre: Flat, angle: number, count: number, r0: number, r1: number, y: number) {
  const lines: string[] = [];
  for (let index = 0; index < count; index++) {
    const a = angle + (index / count) * Math.PI * 2;
    lines.push(
      faceLine(
        [
          [centre[0] + r0 * Math.cos(a), centre[1] + r0 * Math.sin(a)],
          [centre[0] + r1 * Math.cos(a), centre[1] + r1 * Math.sin(a)],
        ],
        y,
        P,
      ),
    );
  }
  return lines.join("");
}

// -------------------------------------------------------------------- floor-plane parts: dial wheel and calendar cam

function dialOf(carriageX: number, fx: number) {
  const phi = (carriageX - REST.carriage[0]) / DIAL_R;
  const [cx, cy] = [DIAL_WHEEL.x, DIAL_WHEEL.y];
  const ring = gearPolygon(DIAL_WHEEL.teeth, DIAL_WHEEL.module, -Math.PI / 2 + phi).map(([x, y]) => [x + cx, y + cy] as [number, number]);
  const wheel = extrude(ring, DIAL_Z[0], DIAL_Z[1] - DIAL_Z[0], P, { convex: false });
  const minor: string[] = [];
  const major: string[] = [];
  const rim = DIAL_R - 3.4;
  for (let value = 54; value <= 61 + 1e-9; value += 0.5) {
    const angle = Math.PI / 2 + (KAPPA * (value - fx)) / DIAL_R;
    const big = Math.abs(value - Math.round(value)) < 1e-9;
    const inner = rim - (big ? 4.2 : 2.4);
    const path = onTop(
      [
        [cx + rim * Math.cos(angle), cy + rim * Math.sin(angle)],
        [cx + inner * Math.cos(angle), cy + inner * Math.sin(angle)],
      ],
      FRONT_FLOOR,
      P,
    );
    (big ? major : minor).push(path);
  }
  return { wheel, minor: minor.join(""), major: major.join("") };
}

function camOf(deg: number) {
  const steps = 132;
  const centre = Math.PI + deg * RAD;
  const ring: [number, number][] = [];
  for (let step = 0; step < steps; step++) {
    const a = (step / steps) * Math.PI * 2;
    const r = CAM.r - notchDepth((a - centre) / RAD);
    ring.push([CAM.x + r * Math.cos(a), CAM.y + r * Math.sin(a)]);
  }
  const cam = extrude(ring, CAM.z, CAM.h, P, { convex: false, bevel: 0.5 });
  const minor: string[] = [];
  const major: string[] = [];
  const base = CAM.r - 6.4;
  for (let day = 0; day < 7; day++) {
    const a = centre + (day / 7) * Math.PI * 2;
    const length = day === 0 ? 4.4 : 2.6;
    const path = onTop(
      [
        [CAM.x + base * Math.cos(a), CAM.y + base * Math.sin(a)],
        [CAM.x + (base + length) * Math.cos(a), CAM.y + (base + length) * Math.sin(a)],
      ],
      CAM.z + CAM.h,
      P,
    );
    (day === 0 ? major : minor).push(path);
  }
  return { cam, minor: minor.join(""), major: major.join("") };
}

// -------------------------------------------------------------------- counter digits

const FACE_Y = WHEEL.axisY + WHEEL.r - 0.4;
const DIGIT_ANGLE = 36 * RAD;

function digitsOf(counter: number): Digit[][] {
  const positions = wheelsOf(counter);
  return WHEEL_X.map((x, wheel) => {
    const position = positions[3 - wheel]! % 10;
    return Array.from({ length: 10 }, (_, digit) => {
      let turn = (digit - position) % 10;
      if (turn > 5) turn -= 10;
      if (turn < -5) turn += 10;
      const angle = turn * DIGIT_ANGLE;
      const facing = Math.cos(angle);
      if (facing <= 0.45) return { transform: "", opacity: 0 };
      const z = WHEEL.axisZ - WHEEL.r * Math.sin(angle);
      const [ox, oy] = at([x, FACE_Y, z]);
      const down: Flat = [-EZ[0] * facing, -EZ[1] * facing];
      return {
        transform: `matrix(${tenth(EX[0] * 1000) / 1000} ${tenth(EX[1] * 1000) / 1000} ${tenth(down[0] * 1000) / 1000} ${tenth(down[1] * 1000) / 1000} ${tenth(ox * 10) / 10} ${tenth(oy * 10) / 10})`,
        opacity: Math.min(1, (facing - 0.45) * 3),
      };
    });
  });
}

// -------------------------------------------------------------------- the whole frame

/** Rest values, to move parts relative to the pose they were built at. */
const [XC0, PZ0] = REST.carriage;
const calendarShift = (week: number) => {
  const [x, z] = calendarCell(week);
  const [x0, z0] = calendarCell(1);
  return shift(x - x0, z - z0);
};
const ZM0 = REST.beamM[1];
const PUSH0 = REST.pusher[1];

/** `bob`: the crude float's swell in model units; `click`: the cam follower's rebound as it seats in the Tuesday notch. Both are zero for a still frame. */
export function frameOf(state: State, bob = 0, click = 0): Frame {
  const k = kin(state.crude, state.fx);
  const lever = leverOf(k.tilt);
  const beam = beamOf(k.beamL, k.beamR, k.beamM);
  const alpha = k.pinion;
  const gearAAngle = alpha;
  const dial = dialOf(k.carriage[0], state.fx);
  const camParts = camOf(state.camDeg);
  const pointerTip: Flat = [GEAR_B[0] + 33.6 * Math.cos(k.pointer), GEAR_B[1] + 33.6 * Math.sin(k.pointer)];
  const pointerTail: Flat = [GEAR_B[0] - 8 * Math.cos(k.pointer), GEAR_B[1] - 8 * Math.sin(k.pointer)];
  const pointer = planePrism(barPolygon(pointerTail, pointerTip, 2.2, [true, false], 6), MESH_Y[1], MESH_Y[1] + 1.8, P);
  const counter = Math.min(LADDER_PHP[1], Math.max(LADDER_PHP[0], state.counter));
  return {
    float: shift(0, k.pusher[1] - PUSH0 + bob),
    guide: shift(k.carriage[0] - XC0),
    carriage: shift(k.carriage[0] - XC0, k.carriage[1] - PZ0),
    rack: shift(0, k.beamM[1] - ZM0),
    bead: shift(0, ladderZ(counter) - ladderZ(OPENING_PUMP)),
    follower: shift(state.gate + click),
    rider: shift(weekX(Math.max(1, state.week)) - weekX(1)),
    calendar: calendarShift(Math.max(1, state.week)),
    lever: lever.lever,
    leverSlots: lever.slots,
    leverGroove: lever.groove,
    beam: beam.beam,
    beamGroove: beam.groove,
    beamRings: beam.rings,
    beamPins: beam.pins,
    pinion: gearOf(GEAR_A, TEETH.pinion, MODULE, gearAAngle + Math.PI, RACK_Y[0], RACK_Y[1]),
    gearA: gearOf(GEAR_A, TEETH.a, MODULE, gearAAngle, MESH_Y[0], MESH_Y[1]),
    gearASpokes: spokes(GEAR_A, gearAAngle, 5, 13.4, 17, MESH_Y[1]),
    gearB: gearOf(GEAR_B, TEETH.b, MODULE, k.gearB + Math.PI - Math.PI / TEETH.b, MESH_Y[0], MESH_Y[1]),
    gearBSpokes: spokes(GEAR_B, k.gearB, 5, 5.6, 14.4, MESH_Y[1]),
    pointer,
    dialWheel: dial.wheel,
    dialMinor: dial.minor,
    dialMajor: dial.major,
    cam: camParts.cam,
    camMinor: camParts.minor,
    camMajor: camParts.major,
    digits: digitsOf(state.counter),
    above: state.counter >= INDEX_PHP,
  };
}

