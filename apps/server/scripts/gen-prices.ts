/**
 * docs/algorithms.md §6.5 + §9.1: the simulated DOE diesel price series for the Tranche Agent.
 *   pnpm --filter server tsx scripts/gen-prices.ts --seed 3 --out fixtures/prices/doe-diesel-sim.json
 */
import { parseArgs } from 'node:util';
import { intFlag, requiredFlag, writeFixture } from './lib/fixture-file';
import { PRICE_POINTS, generatePrices } from './lib/prices';

function main(): void {
  const { values } = parseArgs({ options: { seed: { type: 'string' }, out: { type: 'string' } } });
  const seed = intFlag('seed', values.seed);
  const out = requiredFlag('out', values.out);
  const target = writeFixture(out, generatePrices(seed));
  console.log(`wrote ${PRICE_POINTS} simulated price points (seed ${seed}) to ${target}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(2);
}
