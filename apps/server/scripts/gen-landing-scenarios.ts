/**
 * docs/algorithms.md §9.4: the five simulated diesel scenarios for the landing page, with precomputed Tranche Agent output.
 *   pnpm --filter server tsx scripts/gen-landing-scenarios.ts
 */
import { writeFixture } from './lib/fixture-file';
import { generateLandingScenarios } from './lib/landing-scenarios';

const OUT = 'apps/web/app/_landing/scenarios.json';

function main(): void {
  const data = generateLandingScenarios();
  const target = writeFixture(OUT, data);
  for (const s of data.scenarios) {
    const spikes = s.events.filter((e) => e.kind === 'spike-ignored').map((e) => e.idx);
    console.log(`${s.id}: shiftIdx ${s.shiftIdx}, fireIdx ${s.fireIdx}, spikes [${spikes.join(', ')}] — ${s.reason}`);
  }
  console.log(`wrote ${data.scenarios.length} simulated scenarios (precomputed agent output) to ${target}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(2);
}
