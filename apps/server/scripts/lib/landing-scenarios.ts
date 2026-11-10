// docs/algorithms.md §9.4: five simulated diesel price series for the landing page, each run through the real
// Tranche Agent algorithm (bocpdRun + trancheShouldFire from @tapat/agent). Pure; the CLI is scripts/gen-landing-scenarios.ts.
import { bocpdRun, trancheShouldFire } from '@tapat/agent';
import { gaussian, mulberry32, round2 } from './rng';
import { PRICE_POINTS, generatePrices } from './prices';

export const LANDING_THRESHOLD_PHP = 65;
export const LANDING_TRANCHE_PHP = 1500;
export const LANDING_CARDS = 3;

export type ScenarioEventKind = 'spike-ignored' | 'hike' | 'drop' | 'release';

export interface LandingScenario {
  id: string;
  title: string;
  story: string;
  seed: number;
  points: Array<{ idx: number; pricePhp: number; cpRecent: number; mapR: number }>;
  shiftIdx: number;
  fireIdx: number;
  reason: string;
  events: Array<{ idx: number; label: string; kind: ScenarioEventKind }>;
}

export interface LandingScenarios {
  source: 'simulated';
  agent: 'precomputed';
  thresholdPhp: number;
  tranchePhp: number;
  cards: number;
  scenarios: LandingScenario[];
}

interface Spec {
  id: string;
  title: string;
  story: string;
  seed: number;
  sigma: number;
  /** The underlying (noise-free) daily level, 1-based. */
  level: (day: number) => number;
  /** One-day spikes: day -> price (overwrites the drawn value; the draw is still consumed). */
  spikes: Record<number, number>;
  shiftIdx: number;
  /** Authored narration for level changes (spike and release events are derived). */
  moves: Array<{ idx: number; kind: 'hike' | 'drop'; label: string }>;
}

const SPECS: Spec[] = [
  {
    id: 'staircase',
    title: 'Weekly hikes in steps',
    story: 'Diesel climbed in four Tuesday-style steps; only the last one pushed it above the ₱65 line.',
    seed: 21,
    sigma: 0.3,
    level: (d) => (d <= 10 ? 58.5 : d <= 17 ? 61.5 : d <= 24 ? 63.5 : 67.5),
    spikes: {},
    shiftIdx: 25,
    moves: [
      { idx: 11, kind: 'hike', label: 'Tuesday hike +₱3.00 — still under ₱65' },
      { idx: 18, kind: 'hike', label: 'Tuesday hike +₱2.00 — still under ₱65' },
      { idx: 25, kind: 'hike', label: 'Tuesday hike +₱4.00 — now above ₱65' },
    ],
  },
  {
    id: 'volatile',
    title: 'Volatile market, two false alarms',
    story: 'A jumpy market spiked above ₱65 twice for a single day each; only the later sustained climb counted.',
    seed: 34,
    sigma: 0.7,
    level: (d) => (d <= 32 ? 60 : 70),
    spikes: { 12: 66.4, 22: 67.1 },
    shiftIdx: 33,
    moves: [{ idx: 33, kind: 'hike', label: 'Sustained climb to about ₱70' }],
  },
  {
    id: 'peso-slide',
    title: 'Weak peso, slow climb',
    story: 'A sliding peso pushed diesel up gradually over two weeks to a plateau near ₱68.',
    seed: 47,
    sigma: 0.35,
    level: (d) => (d <= 18 ? 59 : d <= 32 ? 59 + ((d - 18) * 9.5) / 14 : 68.5),
    spikes: {},
    shiftIdx: 28,
    moves: [
      { idx: 19, kind: 'hike', label: 'Price starts creeping up' },
      { idx: 28, kind: 'hike', label: 'Crosses ₱65 and keeps rising' },
    ],
  },
  {
    id: 'supply-shock',
    title: 'Refinery outage',
    story: 'A refinery outage sent diesel to about ₱77 overnight, then it eased to about ₱72 — still above the line.',
    seed: 58,
    sigma: 0.5,
    level: (d) => (d <= 24 ? 58 : d <= 34 ? 77 : 72),
    spikes: {},
    shiftIdx: 25,
    moves: [
      { idx: 25, kind: 'hike', label: 'Refinery outage: jump of about ₱19' },
      { idx: 35, kind: 'drop', label: 'Eases to about ₱72 — still above ₱65' },
    ],
  },
];

function build(spec: Spec): LandingScenario {
  const rand = mulberry32(spec.seed);
  const prices: number[] = [];
  for (let d = 1; d <= PRICE_POINTS; d++) {
    const drawn = gaussian(rand, spec.level(d), spec.sigma);
    prices.push(round2(spec.spikes[d] ?? drawn));
  }
  return assemble(spec, prices);
}

function assemble(spec: Pick<Spec, 'id' | 'title' | 'story' | 'seed' | 'shiftIdx'> & Partial<Spec>, prices: number[]): LandingScenario {
  const run = bocpdRun(prices);
  const verdict = trancheShouldFire(run, LANDING_THRESHOLD_PHP);
  if (!verdict.fire || verdict.at === null) throw new Error(`scenario ${spec.id}: the agent never fires`);
  const fireIdx = verdict.at + 1;

  const events: LandingScenario['events'] = [...(spec.moves ?? [])];
  for (const day of Object.keys(spec.spikes ?? {}).map(Number)) {
    events.push({ idx: day, kind: 'spike-ignored', label: `One-day spike to ₱${prices[day - 1].toFixed(2)} — ignored` });
  }
  events.push({ idx: fireIdx, kind: 'release', label: `Funds released to ${LANDING_CARDS} cards` });
  events.sort((a, b) => a.idx - b.idx);

  return {
    id: spec.id,
    title: spec.title,
    story: spec.story,
    seed: spec.seed,
    points: run.map((p, i) => ({
      idx: i + 1,
      pricePhp: prices[i],
      cpRecent: Math.round(p.cpRecent * 10000) / 10000,
      mapR: p.mapRunLength,
    })),
    shiftIdx: spec.shiftIdx,
    fireIdx,
    reason: verdict.reason,
    events,
  };
}

export function generateLandingScenarios(): LandingScenarios {
  const crude = generatePrices(3);
  const crudeScenario = assemble(
    {
      id: 'crude-rally',
      title: 'Global crude rally',
      story: 'Crude oil rallied: diesel jumped for a day, fell back, then settled about ₱12 higher.',
      seed: 3,
      shiftIdx: 31,
      spikes: { 15: crude.points[14].price_php },
      moves: [{ idx: 31, kind: 'hike', label: 'Pump prices settle about ₱12.50 higher' }],
    },
    crude.points.map((p) => p.price_php),
  );
  return {
    source: 'simulated',
    agent: 'precomputed',
    thresholdPhp: LANDING_THRESHOLD_PHP,
    tranchePhp: LANDING_TRANCHE_PHP,
    cards: LANDING_CARDS,
    scenarios: [crudeScenario, ...SPECS.map(build)],
  };
}
