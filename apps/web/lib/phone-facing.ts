// The landing page's phone faces the cursor. Full tilt is reached at the edge of the window on each side of the phone,
// and the limit keeps the phone's screen readable at every angle.
export const MAX_TILT = 15;

const toward = (distance: number, reach: number) => (reach <= 0 ? 0 : Math.max(-1, Math.min(1, distance / reach)));

/** Degrees to turn the phone: positive yaw faces right, positive pitch faces up. */
export function phoneFacing(
  cursor: { x: number; y: number },
  phone: { x: number; y: number },
  view: { width: number; height: number },
): { yaw: number; pitch: number } {
  const dx = cursor.x - phone.x;
  const dy = cursor.y - phone.y;
  return {
    yaw: toward(dx, dx < 0 ? phone.x : view.width - phone.x) * MAX_TILT,
    pitch: -toward(dy, dy < 0 ? phone.y : view.height - phone.y) * MAX_TILT,
  };
}
