import { pathOf } from "@/app/_landing/iso/iso-kit";
import { STREAMS } from "./model";
import { GAUGE_FACE, WINDOW, here } from "./view";

/** The coins in the gauge's window: a column from the bottom to `level` (0 to 1). */
export function levelPath(level: number) {
  if (level <= 0.002) return "";
  const top = WINDOW.z0 + (WINDOW.z1 - WINDOW.z0) * Math.min(1, level);
  return pathOf(
    [
      [WINDOW.x0, GAUGE_FACE, WINDOW.z0],
      [WINDOW.x1, GAUGE_FACE, WINDOW.z0],
      [WINDOW.x1, GAUGE_FACE, top],
      [WINDOW.x0, GAUGE_FACE, top],
    ].map(([x, y, z]) => here([x, y, z])),
    true,
  );
}

/** A coin in the hopper's mouth is there while the level stays above its share. */
export const mouthShown = (index: number, count: number, leaked: number) => 1 - leaked > (index + 0.5) / (count + 1);

/** A heap coin is there once the leak has reached its share. */
export const heapShown = (threshold: number, leaked: number) => leaked >= threshold - 1e-6;

/** How many pooled coins each stream owns, flattened: [stream, slot] in element order. */
export const POOL = STREAMS.flatMap((stream, index) => Array.from({ length: stream.pool }, (_, slot) => ({ stream: index, slot })));
