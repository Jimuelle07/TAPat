// docs/algorithms.md §6.5 + §9.1: the simulated DOE diesel price series (pure; the CLI is scripts/gen-prices.ts).
import { gaussian, mulberry32, round2 } from './rng';

export interface PriceFixture {
  source: 'simulated';
  currency: 'PHP';
  unit: 'L';
  seed: number;
  points: Array<{ idx: number; price_php: number }>;
}

export const PRICE_POINTS = 45;
export const SPIKE_IDX = 15;
export const SPIKE_PRICE_PHP = 66.0;

export function generatePrices(seed: number): PriceFixture {
  const rand = mulberry32(seed);
  const points: PriceFixture['points'] = [];
  for (let d = 1; d <= PRICE_POINTS; d++) {
    let price = d <= 30 ? gaussian(rand, 58.5, 0.4) : gaussian(rand, 71.0, 0.5);
    if (d === SPIKE_IDX) price = SPIKE_PRICE_PHP; // overwritten after the draw: the draw is still consumed
    points.push({ idx: d, price_php: round2(price) });
  }
  return { source: 'simulated', currency: 'PHP', unit: 'L', seed, points };
}
