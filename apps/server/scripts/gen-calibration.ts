/**
 * docs/algorithms.md §5.5 + §9.2: the labeled CRC calibration set, 400 pairs drawn in this order:
 * 320 genuine, then 60 ghosts, then 20 hard negatives (so a later count change at the end keeps the stream).
 *   pnpm --filter server tsx scripts/gen-calibration.ts --seed 42 --out fixtures/calibration/labeled.json
 */
import { parseArgs } from 'node:util';
import { generateCalibration } from './lib/calibration';
import { intFlag, requiredFlag, writeFixture } from './lib/fixture-file';

function main(): void {
  const { values } = parseArgs({ options: { seed: { type: 'string' }, out: { type: 'string' } } });
  const seed = intFlag('seed', values.seed);
  const out = requiredFlag('out', values.out);
  const fixture = generateCalibration(seed);
  const target = writeFixture(out, fixture);
  console.log(`wrote ${fixture.records.length} simulated calibration pairs (seed ${seed}) to ${target}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(2);
}
