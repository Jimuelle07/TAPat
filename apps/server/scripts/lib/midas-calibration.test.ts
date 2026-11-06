// MID (docs/algorithms.md §8.3, §12.6): the committed midas.json must match what this calibration recomputes.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SKETCH, initMidasState, stepMidas, type EdgeEvent, type MidasConfig } from '@tapat/agent';
import { REPO_ROOT } from './fixture-file';
import { round2 } from './rng';
import { generateHonest } from './taps';

interface MidasConfigFile {
  threshold: number;
  maxHonestScore: number;
  seedCount: number;
  ticks: number;
  decay: number;
  depth: number;
  width: number;
  hashSeeds: string[];
  generatedBy: string;
  generatedAt: string;
}

const committed: MidasConfigFile = JSON.parse(readFileSync(resolve(REPO_ROOT, 'apps/server/config/midas.json'), 'utf8'));

/** Seeds 1..50 at 60 ticks with `threshold = Infinity`, so nothing is filtered and the background stays clean. */
function replayHonestSeeds(cfg: MidasConfig, filtered: boolean): { worst: number; anyFiltered: boolean } {
  let worst = 0;
  let anyFiltered = false;
  for (let seed = 1; seed <= committed.seedCount; seed++) {
    let state = initMidasState(cfg);
    for (const edge of generateHonest(seed, committed.ticks).ticks) {
      const event: EdgeEvent = {
        tick: edge.tick,
        cardId: edge.card_ref,
        stationId: edge.station_id,
        amountStroops: BigInt(Math.round(edge.amount_php * 1e6)).toString(),
      };
      const step = stepMidas(state, event, cfg);
      state = step.state;
      if (step.score.score > worst) worst = step.score.score;
      if (filtered && step.score.filtered) anyFiltered = true;
    }
  }
  return { worst, anyFiltered };
}

const sketch = DEFAULT_SKETCH;

describe('apps/server/config/midas.json', () => {
  it('records the documented generator shape', () => {
    expect(committed.seedCount).toBe(50);
    expect(committed.ticks).toBe(60);
    expect(committed.decay).toBe(0.6);
    expect(committed.depth).toBe(sketch.depth);
    expect(committed.width).toBe(sketch.width);
    expect(committed.hashSeeds).toEqual(sketch.seeds.map((seed) => `0x${seed.toString(16)}`));
    expect(committed.generatedBy).toBe('calibrate-midas.ts');
    expect(Number.isNaN(Date.parse(committed.generatedAt))).toBe(false);
  });

  it('is the 25% margin over the worst honest stream recomputed from seeds 1..50', () => {
    const { worst } = replayHonestSeeds({ threshold: Infinity, decay: committed.decay, sketch }, false);
    expect(worst).toBe(committed.maxHonestScore);
    expect(committed.threshold).toBe(round2(1.25 * worst));
  });

  it('sits above every honest seed 1..50, so an honest stream never freezes a station', () => {
    const cfg: MidasConfig = { threshold: committed.threshold, decay: committed.decay, sketch };
    expect(replayHonestSeeds(cfg, true).anyFiltered).toBe(false);
  });
});
