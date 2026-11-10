import { cameraOf, pathOf } from "@/app/_landing/iso/iso-kit";
import { MONTHS } from "./model";
import { DIAL, DIAL_FACE_R, KNOB_FROM, KNOB_R, KNOB_TO, P, here } from "./view";

const RIBS = 18;
const DEGREES = 360 / MONTHS;
const rad = (degrees: number) => (degrees * Math.PI) / 180;

/** A point on the dial's face plane (y = the face), `angle` clockwise from the top. */
const onFace = (r: number, angle: number, s: number): [number, number, number] => [DIAL[0] + r * Math.sin(rad(angle)), DIAL[1] + s, DIAL[2] + r * Math.cos(rad(angle))];

export interface Rib {
  d: string;
  alpha: number;
}

export interface Dial {
  minor: string;
  major: string;
  /** The pointer on the knob's cap, from the hub to the rim. */
  pointer: string;
  ribs: Rib[];
}

const smoothstep = (low: number, high: number, value: number) => {
  const u = Math.min(1, Math.max(0, (value - low) / (high - low)));
  return u * u * (3 - 2 * u);
};

/** The turning parts of the dial at `months`: 24 ticks one month apart, the knob's ribs, its pointer. */
export function dialAt(months: number): Dial {
  const turn = months * DEGREES;
  const minor: string[] = [];
  const major: string[] = [];
  for (let k = 0; k < MONTHS; k++) {
    const big = k % 6 === 0;
    const angle = k * DEGREES + turn;
    const line = pathOf([here(onFace(DIAL_FACE_R - (big ? 3 : 1.7), angle, KNOB_FROM)), here(onFace(DIAL_FACE_R, angle, KNOB_FROM))]);
    (big ? major : minor).push(line);
  }
  const { cosA, cosE, sinE } = cameraOf(P);
  const view = [cosA * cosE, 0, sinE];
  const ribs: Rib[] = [];
  for (let j = 0; j < RIBS; j++) {
    const angle = (j * 360) / RIBS + turn;
    const facing = Math.sin(rad(angle)) * view[0] + Math.cos(rad(angle)) * view[2];
    const alpha = smoothstep(0.02, 0.4, facing);
    ribs.push({
      d: alpha > 0.01 ? pathOf([here(onFace(KNOB_R, angle, KNOB_FROM + 0.45)), here(onFace(KNOB_R, angle, KNOB_TO - 0.45))]) : "",
      alpha,
    });
  }
  return {
    minor: minor.join(""),
    major: major.join(""),
    pointer: pathOf([here(onFace(0, 0, KNOB_TO + 0.8)), here(onFace(KNOB_R - 0.7, turn + 45, KNOB_TO + 0.8))]),
    ribs,
  };
}
