/**
 * docs/algorithms.md §9.3: simulated card -> station tap edges for the Freeze Agent.
 *   pnpm --filter api tsx scripts/gen-taps.ts --mode honest --seed 7 --ticks 60 --out fixtures/taps/honest-history.json
 *   pnpm --filter api tsx scripts/gen-taps.ts --mode burst  --seed 11 --out fixtures/taps/burst.json
 */
import { parseArgs } from 'node:util';
import { intFlag, requiredFlag, writeFixture } from './lib/fixture-file';
import { generateBurst, generateHonest } from './lib/taps';

function main(): void {
  const { values } = parseArgs({
    options: {
      mode: { type: 'string' },
      seed: { type: 'string' },
      ticks: { type: 'string' },
      out: { type: 'string' },
    },
  });
  const mode = values.mode;
  if (mode !== 'honest' && mode !== 'burst') throw new Error('--mode must be honest or burst');
  const seed = intFlag('seed', values.seed);
  const out = requiredFlag('out', values.out);

  if (mode === 'honest') {
    const ticks = intFlag('ticks', values.ticks);
    if (ticks < 1) throw new Error('--ticks must be >= 1');
    const fixture = generateHonest(seed, ticks);
    const target = writeFixture(out, fixture);
    console.log(`wrote ${fixture.ticks.length} simulated honest edges over ${ticks} ticks (seed ${seed}) to ${target}`);
  } else {
    // Burst is fixed at 3 ticks (docs/algorithms.md §9.3).
    if (values.ticks !== undefined) throw new Error('--ticks applies to --mode honest only');
    const fixture = generateBurst(seed);
    const target = writeFixture(out, fixture);
    console.log(`wrote ${fixture.edges.length} simulated burst edges (seed ${seed}) to ${target}`);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(2);
}
