import type { PricePoint } from '@tapat/shared';

/**
 * No decision row is written for an ignored spike, so the notice is derived from the real series: the newest point at
 * or above the threshold that the price has since fallen back from, while nothing has fired.
 */
export function ignoredSpike(points: readonly PricePoint[], thresholdPhp: number, fired: boolean): PricePoint | null {
  if (fired) return null;
  for (let i = points.length - 2; i >= 0; i--) {
    const point = points[i];
    const next = points[i + 1];
    if (point !== undefined && next !== undefined && point.pricePhp >= thresholdPhp && next.pricePhp < thresholdPhp) return point;
  }
  return null;
}
