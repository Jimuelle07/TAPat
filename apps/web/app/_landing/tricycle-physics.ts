// Body model for NavTricycle's load brake-in and "Open the app" drive-off: a pitch angle on a damped spring pulled
// toward a target, a constant-acceleration launch, plus the styles that tilt the image and keep its contact shadow on the ground.
export const STEP = 1 / 240; // s; fixed physics step
export const STIFFNESS = 200; // 1/s²: body pitch spring
export const DAMPING = 2 * 0.4 * Math.sqrt(STIFFNESS); // damping ratio 0.4: one visible rock, then still
export const SHADOW_SHRINK = 0.03; // shadow width lost per degree of pitch
export const SHADOW_FADE = 0.06; // shadow opacity lost per degree of pitch
// Ground contact points in the logo image (percent of width/height), from the tyre circles fitted on the source icon.
export const FRONT_WHEEL_X = "86.5%";
export const REAR_WHEEL_X = "18.8%";
export const GROUND_Y = "98.4%";

export type Body = {
  pitch: number; // deg, positive = nose down (clockwise for a right-facing tricycle)
  spin: number; // deg/s
};

/** One fixed step of the pitch spring toward `targetPitchDeg`. */
export function stepPitch(body: Body, targetPitchDeg: number, dt: number) {
  body.spin += (STIFFNESS * (targetPitchDeg - body.pitch) - DAMPING * body.spin) * dt;
  body.pitch += body.spin * dt;
}

export const PITCH_PER_ACCEL = 0.0018; // deg per px/s² of acceleration

export type Drive = {
  x: number; // px
  v: number; // px/s
  pose: Body;
};

// Drive-off (clicking "Open the app"): a constant push, so the body squats noticeably.
export const DEPART_ACCEL = 5000; // px/s²
export const DEPART_MAX_SPEED = 1400; // px/s
export const DEPART_MAX_PITCH = 9; // deg; −PITCH_PER_ACCEL × DEPART_ACCEL is −9°, nose up

/** One fixed step of the drive-off: accelerate right at `DEPART_ACCEL`, pitch pushed by that acceleration. */
export function stepLaunch(drive: Drive, dt: number) {
  const before = drive.v;
  drive.v = Math.min(DEPART_MAX_SPEED, drive.v + DEPART_ACCEL * dt);
  drive.x += drive.v * dt;
  const accel = (drive.v - before) / dt;
  stepPitch(drive.pose, Math.max(-DEPART_MAX_PITCH, Math.min(DEPART_MAX_PITCH, -PITCH_PER_ACCEL * accel)), dt);
}

/**
 * Tilts the body about the wheel still touching the ground (front when nose down, rear when nose up) and draws the
 * shadow in toward that wheel and lighter. The shadow never rotates.
 */
export function applyBody(bodyEl: HTMLElement, shadowEl: HTMLElement, pitch: number) {
  const tilt = Math.abs(pitch);
  const origin = `${pitch >= 0 ? FRONT_WHEEL_X : REAR_WHEEL_X} ${GROUND_Y}`;
  bodyEl.style.transformOrigin = origin;
  bodyEl.style.transform = `rotate(${pitch.toFixed(3)}deg)`;
  shadowEl.style.transformOrigin = origin;
  shadowEl.style.transform = `scaleX(${(1 - SHADOW_SHRINK * tilt).toFixed(4)})`;
  shadowEl.style.opacity = (1 - SHADOW_FADE * tilt).toFixed(3);
}

/** Clears the styles written by `applyBody`. */
export function clearBody(bodyEl: HTMLElement, shadowEl: HTMLElement) {
  bodyEl.style.transform = "";
  shadowEl.style.transform = "";
  shadowEl.style.opacity = "";
}
