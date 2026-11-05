// docs/algorithms.md §9.3: simulated card -> station tap edges (pure; the CLI is scripts/gen-taps.ts).
import { mulberry32, round2 } from './rng';

export interface HonestEdge {
  tick: number;
  card_ref: string;
  station_id: 'A' | 'B';
  amount_php: number;
}

export interface HonestFixture {
  source: 'simulated';
  seed: number;
  tick_ms: number;
  ticks: HonestEdge[];
}

export interface BurstEdge {
  tick_offset: number;
  card_ref: string;
  station_id: 'B';
  amount_php: number;
}

export interface BurstFixture {
  source: 'simulated';
  seed: number;
  edges: BurstEdge[];
}

const CARDS = Array.from({ length: 20 }, (_, i) => `virtual${String(i + 1).padStart(2, '0')}`);
/** At most this many edges per (card, station) inside the trailing window, so honest streams never trip NEAR_CAP_STREAK. */
const MAX_EDGES_PER_WINDOW = 3;
/** The window is the current tick plus the 9 before it ("the last 10 ticks"). */
const WINDOW_TICKS = 10;
export const HONEST_TICK_MS = 1000;

export function generateHonest(seed: number, ticks: number): HonestFixture {
  const rand = mulberry32(seed);
  const edges: HonestEdge[] = [];
  for (let tick = 0; tick < ticks; tick++) {
    const k = rand() < 0.5 ? 1 : 2;
    for (let n = 0; n < k; n++) {
      const card = CARDS[Math.floor(rand() * CARDS.length)];
      const station = rand() < 0.75 ? 'A' : 'B';
      const recent = edges.filter(
        (edge) => edge.card_ref === card && edge.station_id === station && edge.tick > tick + 1 - WINDOW_TICKS,
      ).length;
      if (recent >= MAX_EDGES_PER_WINDOW) continue; // skipped: no draw consumed for the amount
      const amountPhp = round2(60 + rand() * 290);
      edges.push({ tick: tick + 1, card_ref: card, station_id: station, amount_php: amountPhp });
    }
  }
  return { source: 'simulated', seed, tick_ms: HONEST_TICK_MS, ticks: edges };
}

export function generateBurst(seed: number): BurstFixture {
  const rand = mulberry32(seed);
  const edges: BurstEdge[] = [];
  for (let tick = 0; tick <= 2; tick++) {
    for (let i = 0; i <= 9; i++) {
      const card = CARDS[(tick * 10 + i) % CARDS.length];
      const amountPhp = round2(400 + rand() * 100);
      edges.push({ tick_offset: tick + 1, card_ref: card, station_id: 'B', amount_php: amountPhp });
    }
  }
  return { source: 'simulated', seed, edges };
}
