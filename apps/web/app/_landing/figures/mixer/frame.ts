/*
 * What changes shape or place from frame to frame, rebuilt from the model's state. Shipped to the client: it imports only
 * the kit's camera and `plate.ts`, never the lathe. Parts that only slide are a screen transform; parts that tilt or
 * turn (lever, balance arm, three gears, pointer, dial wheel, calendar cam) are rebuilt as paths.
 */
import type { Flat, SolidPaths } from "../../iso/iso-kit";
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
import { barPolygon, faceCircle, faceLine, floorSegment, gearPolygon, planePrism, ringPrism, slotPolygon } from "./plate";
import { BEAM_Y, EX, EZ, LEVER_Y, MESH_Y, P, RACK_Y, at, shift } from "./view";

const RAD = Math.PI / 180;
const FRONT_FLOOR = DIAL_Z[1];
const tenth = (value: number) => Math.round(value * 10) / 10;


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

interface LeverParts {
  lever: SolidPaths;
  slots: string;
  groove: string;
}

function leverOf(tilt: number): LeverParts {
  const ux = -Math.cos(tilt);
  const uz = Math.sin(tilt);
  const hinge: Flat = [XH, ZH];
  const along = (s: number): Flat => [hinge[0] + ux * s, hinge[1] + uz * s];
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

interface BeamParts {
  beam: SolidPaths;
  groove: string;
  rings: string;
  pins: Flat[];
}

function beamOf(left: Flat, right: Flat, mid: Flat): BeamParts {
  const length = Math.hypot(right[0] - left[0], right[1] - left[1]);
  const ux = (right[0] - left[0]) / length;
  const uz = (right[1] - left[1]) / length;
  const from: Flat = [left[0] - ux * 14, left[1] - uz * 14];
  const to: Flat = [right[0] + ux * 14, right[1] + uz * 14];
  const front = BEAM_Y[1];
  return {
    beam: planePrism(barPolygon(from, to, 5.2, [true, true], 7), BEAM_Y[0], front, P),
    groove: faceLine([left, right], front, P),
    rings: faceCircle(left[0], left[1], 2.5, front, P, 14) + faceCircle(mid[0], mid[1], 2.5, front, P, 14) + faceCircle(right[0], right[1], 2.5, front, P, 14),
    pins: [at([left[0], front, left[1]]), at([mid[0], front, mid[1]]), at([right[0], front, right[1]])],
  };
}

// -------------------------------------------------------------------- gears

function gearOf(centre: Flat, teeth: number, module: number, angle: number, y0: number, y1: number) {
  return planePrism(gearPolygon(teeth, module, angle, centre[0], centre[1]), y0, y1, P);
}

function spokes(centre: Flat, angle: number, count: number, r0: number, r1: number, y: number) {
  let text = "";
  for (let index = 0; index < count; index++) {
    const a = angle + (index / count) * Math.PI * 2;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    text += faceLine(
      [
        [centre[0] + r0 * cos, centre[1] + r0 * sin],
        [centre[0] + r1 * cos, centre[1] + r1 * sin],
      ],
      y,
      P,
    );
  }
  return text;
}

// -------------------------------------------------------------------- floor-plane parts: dial wheel and calendar cam

interface FloorParts {
  solid: SolidPaths;
  minor: string;
  major: string;
}

function dialOf(carriageX: number, fx: number): FloorParts {
  const phi = (carriageX - REST.carriage[0]) / DIAL_R;
  const [cx, cy] = [DIAL_WHEEL.x, DIAL_WHEEL.y];
  const wheel = ringPrism(gearPolygon(DIAL_WHEEL.teeth, DIAL_WHEEL.module, -Math.PI / 2 + phi, cx, cy), DIAL_Z[0], DIAL_Z[1] - DIAL_Z[0], P);
  let minor = "";
  let major = "";
  const rim = DIAL_R - 3.4;
  for (let value = 54; value <= 61 + 1e-9; value += 0.5) {
    const angle = Math.PI / 2 + (KAPPA * (value - fx)) / DIAL_R;
    const big = Math.abs(value - Math.round(value)) < 1e-9;
    const inner = rim - (big ? 4.2 : 2.4);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const path = floorSegment(cx + rim * cos, cy + rim * sin, cx + inner * cos, cy + inner * sin, FRONT_FLOOR, P);
    if (big) major += path;
    else minor += path;
  }
  return { solid: wheel, minor, major };
}

function camOf(deg: number): FloorParts {
  const steps = 132;
  const centre = Math.PI + deg * RAD;
  const ring: [number, number][] = new Array(steps);
  for (let step = 0; step < steps; step++) {
    const a = (step / steps) * Math.PI * 2;
    const r = CAM.r - notchDepth((a - centre) / RAD);
    ring[step] = [CAM.x + r * Math.cos(a), CAM.y + r * Math.sin(a)];
  }
  const cam = ringPrism(ring, CAM.z, CAM.h, P, 0.5);
  let minor = "";
  let major = "";
  const base = CAM.r - 6.4;
  const zTop = CAM.z + CAM.h;
  for (let day = 0; day < 7; day++) {
    const a = centre + (day / 7) * Math.PI * 2;
    const length = day === 0 ? 4.4 : 2.6;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const path = floorSegment(CAM.x + base * cos, CAM.y + base * sin, CAM.x + (base + length) * cos, CAM.y + (base + length) * sin, zTop, P);
    if (day === 0) major += path;
    else minor += path;
  }
  return { solid: cam, minor, major };
}

// -------------------------------------------------------------------- counter digits

const FACE_Y = WHEEL.axisY + WHEEL.r - 0.4;
const DIGIT_ANGLE = 36 * RAD;
const HIDDEN: Digit = { transform: "", opacity: 0 };

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
      if (facing <= 0.45) return HIDDEN;
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

/*
 * Each part is built from a few numbers, and most of those hold still for whole stretches of the loop (the counter outside
 * Tuesday's roll, the week for 0.8 s, the market while paused or held at the year's end). The last build of each kind is
 * kept, keyed on exactly those numbers, so an unchanged part comes back as the same strings and the live loop's write
 * check is a pointer comparison. Everything here is a pure function of its key, so the cache never changes what is drawn.
 */
interface Linkage {
  crude: number;
  fx: number;
  guide: string;
  carriage: string;
  rack: string;
  pusherRise: number;
  lever: LeverParts;
  beam: BeamParts;
  pinion: SolidPaths;
  gearA: SolidPaths;
  gearASpokes: string;
  gearB: SolidPaths;
  gearBSpokes: string;
  pointer: SolidPaths;
}

let linkage: Linkage | null = null;
let leverTilt = NaN;
let leverMemo: LeverParts | null = null;
let dial: (FloorParts & { fx: number }) | null = null;
let cam: (FloorParts & { deg: number }) | null = null;
let digits: { counter: number; value: Digit[][] } | null = null;
let bead: { counter: number; value: string } | null = null;
let calendar: { week: number; rider: string; calendar: string } | null = null;

function linkageOf(crude: number, fx: number): Linkage {
  if (linkage && linkage.crude === crude && linkage.fx === fx) return linkage;
  const k = kin(crude, fx);
  if (leverMemo === null || leverTilt !== k.tilt) {
    leverMemo = leverOf(k.tilt);
    leverTilt = k.tilt;
  }
  const alpha = k.pinion;
  const pointerTip: Flat = [GEAR_B[0] + 33.6 * Math.cos(k.pointer), GEAR_B[1] + 33.6 * Math.sin(k.pointer)];
  const pointerTail: Flat = [GEAR_B[0] - 8 * Math.cos(k.pointer), GEAR_B[1] - 8 * Math.sin(k.pointer)];
  linkage = {
    crude,
    fx,
    guide: shift(k.carriage[0] - XC0),
    carriage: shift(k.carriage[0] - XC0, k.carriage[1] - PZ0),
    rack: shift(0, k.beamM[1] - ZM0),
    pusherRise: k.pusher[1] - PUSH0,
    lever: leverMemo,
    beam: beamOf(k.beamL, k.beamR, k.beamM),
    pinion: gearOf(GEAR_A, TEETH.pinion, MODULE, alpha + Math.PI, RACK_Y[0], RACK_Y[1]),
    gearA: gearOf(GEAR_A, TEETH.a, MODULE, alpha, MESH_Y[0], MESH_Y[1]),
    gearASpokes: spokes(GEAR_A, alpha, 5, 13.4, 17, MESH_Y[1]),
    gearB: gearOf(GEAR_B, TEETH.b, MODULE, k.gearB + Math.PI - Math.PI / TEETH.b, MESH_Y[0], MESH_Y[1]),
    gearBSpokes: spokes(GEAR_B, k.gearB, 5, 5.6, 14.4, MESH_Y[1]),
    pointer: planePrism(barPolygon(pointerTail, pointerTip, 2.2, [true, false], 6), MESH_Y[1], MESH_Y[1] + 1.8, P),
  };
  dial = dial !== null && dial.fx === fx ? dial : { ...dialOf(k.carriage[0], fx), fx };
  return linkage;
}

/** `bob`: the crude float's swell in model units; `click`: the cam follower's rebound as it seats in the Tuesday notch. Both are zero for a still frame. */
export function frameOf(state: State, bob = 0, click = 0): Frame {
  const l = linkageOf(state.crude, state.fx);
  const d = dial!;
  if (cam === null || cam.deg !== state.camDeg) cam = { ...camOf(state.camDeg), deg: state.camDeg };
  const counter = Math.min(LADDER_PHP[1], Math.max(LADDER_PHP[0], state.counter));
  if (bead === null || bead.counter !== counter) bead = { counter, value: shift(0, ladderZ(counter) - ladderZ(OPENING_PUMP)) };
  const week = Math.max(1, state.week);
  if (calendar === null || calendar.week !== week) calendar = { week, rider: shift(weekX(week) - weekX(1)), calendar: calendarShift(week) };
  if (digits === null || digits.counter !== state.counter) digits = { counter: state.counter, value: digitsOf(state.counter) };
  return {
    float: shift(0, l.pusherRise + bob),
    guide: l.guide,
    carriage: l.carriage,
    rack: l.rack,
    bead: bead.value,
    follower: shift(state.gate + click),
    rider: calendar.rider,
    calendar: calendar.calendar,
    lever: l.lever.lever,
    leverSlots: l.lever.slots,
    leverGroove: l.lever.groove,
    beam: l.beam.beam,
    beamGroove: l.beam.groove,
    beamRings: l.beam.rings,
    beamPins: l.beam.pins,
    pinion: l.pinion,
    gearA: l.gearA,
    gearASpokes: l.gearASpokes,
    gearB: l.gearB,
    gearBSpokes: l.gearBSpokes,
    pointer: l.pointer,
    dialWheel: d.solid,
    dialMinor: d.minor,
    dialMajor: d.major,
    cam: cam.solid,
    camMinor: cam.minor,
    camMajor: cam.major,
    digits: digits.value,
    above: state.counter >= INDEX_PHP,
  };
}

