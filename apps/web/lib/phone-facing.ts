// The landing page's phone faces the cursor. The phone sits on the right of the page, so the cursor is mostly to its
// left: that side turns furthest, and every side reaches full tilt before the edge of the window so the phone never
// looks stiff. The limits keep its screen readable.
export const MAX_TILT = 28;
const LIMIT = { left: 28, right: 16, up: 18, down: 18 };
// Share of the way to the window's edge at which the full tilt is reached.
const REACH = 0.6;

const toward = (distance: number, reach: number) => (reach <= 0 ? 0 : Math.max(-1, Math.min(1, distance / (reach * REACH))));
// Eases in, so small movements near the phone still register, then flattens at the limit.
const curve = (t: number) => Math.sign(t) * Math.sqrt(Math.abs(t));

/** Degrees to turn the phone: positive yaw faces right, positive pitch faces up. */
export function phoneFacing(
  cursor: { x: number; y: number },
  phone: { x: number; y: number },
  view: { width: number; height: number },
): { yaw: number; pitch: number } {
  const dx = cursor.x - phone.x;
  const dy = cursor.y - phone.y;
  const sideways = curve(toward(dx, dx < 0 ? phone.x : view.width - phone.x));
  const upright = curve(toward(dy, dy < 0 ? phone.y : view.height - phone.y));
  return {
    yaw: sideways * (dx < 0 ? LIMIT.left : LIMIT.right),
    pitch: -upright * (dy < 0 ? LIMIT.up : LIMIT.down),
  };
}
