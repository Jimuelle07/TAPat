/**
 * docs/algorithms.md §8.3: calibrates the MIDAS-F freeze threshold and writes apps/server/config/midas.json.
 *   pnpm --filter server tsx scripts/calibrate-midas.ts
 *
 * Honest streams are seeds 1..50 at 60 ticks, replayed with `threshold = Infinity` so nothing is filtered and the
 * background stays clean. The threshold is a 25% margin over the worst honest score. The output is generated: never
 * hand-edit it.
 */
import { DEFAULT_SKETCH, initMidasState, stepMidas, type EdgeEvent, type MidasConfig } from '@tapat/agent';
import { writeFixture } from './lib/fixture-file';
import { round2 } from './lib/rng';
import { generateHonest } from './lib/taps';

const SEED_COUNT = 50;
const TICKS = 60;
const DECAY = 0.6;
const MARGIN = 1.25;
const OUT = 'apps/server/config/midas.json';

/** One honest stream as MIDAS edges; `amount_php` becomes stroops at read time, never stored twice. */
function honestEdges(seed: number): EdgeEvent[] {
  return generateHonest(seed, TICKS).ticks.map((edge) => ({
    tick: edge.tick,
    cardId: edge.card_ref,
    stationId: edge.station_id,
    amountStroops: BigInt(Math.round(edge.amount_php * 1e6)).toString(),
  }));
}

function worstHonestScore(): number {
  const cfg: MidasConfig = { threshold: Infinity, decay: DECAY, sketch: DEFAULT_SKETCH };
  let worst = 0;
  for (let seed = 1; seed <= SEED_COUNT; seed++) {
    let state = initMidasState(cfg);
    for (const edge of honestEdges(seed)) {
      const step = stepMidas(state, edge, cfg);
      state = step.state;
      if (step.score.score > worst) worst = step.score.score;
    }
  }
  return worst;
}

function main(): void {
  const maxHonestScore = worstHonestScore();
  const threshold = round2(MARGIN * maxHonestScore);
  const target = writeFixture(OUT, {
    threshold,
    maxHonestScore,
    seedCount: SEED_COUNT,
    ticks: TICKS,
    decay: DECAY,
    depth: DEFAULT_SKETCH.depth,
    width: DEFAULT_SKETCH.width,
    hashSeeds: DEFAULT_SKETCH.seeds.map((seed) => `0x${seed.toString(16)}`),
    generatedBy: 'calibrate-midas.ts',
    generatedAt: new Date().toISOString(),
  });
  console.log(
    `worst honest score ${maxHonestScore} over seeds 1..${SEED_COUNT} (${TICKS} ticks) -> threshold ${threshold}; wrote ${target}`,
  );
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(2);
}
