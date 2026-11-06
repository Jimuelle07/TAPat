import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SKETCH, sketchEstimate } from './cms';
import {
  initMidasState,
  replayMidas,
  stepMidas,
  type EdgeEvent,
  type MidasConfig,
  type MidasScore,
  type MidasState,
} from './midas';

interface HonestFixture {
  ticks: { tick: number; card_ref: string; station_id: string; amount_php: number }[];
}

interface BurstFixture {
  edges: { tick_offset: number; card_ref: string; station_id: string; amount_php: number }[];
}

/** Generated output of `apps/server/scripts/calibrate-midas.ts`; the tests never hand-edit it. */
const calibrated: { threshold: number; maxHonestScore: number } = JSON.parse(
  readFileSync(new URL('../../../../apps/server/config/midas.json', import.meta.url), 'utf8'),
);
const honestFixture: HonestFixture = JSON.parse(
  readFileSync(new URL('../../../../fixtures/taps/honest-history.json', import.meta.url), 'utf8'),
);
const burstFixture: BurstFixture = JSON.parse(
  readFileSync(new URL('../../../../fixtures/taps/burst.json', import.meta.url), 'utf8'),
);

const CONFIG: MidasConfig = { threshold: calibrated.threshold, decay: 0.6, sketch: DEFAULT_SKETCH };
const LOOSE: MidasConfig = { ...CONFIG, threshold: Infinity };
const LAST_WARMUP_TICK = 60;

const toStroops = (php: number): string => BigInt(Math.round(php * 1e6)).toString();

const honestEvents: EdgeEvent[] = honestFixture.ticks.map((edge) => ({
  tick: edge.tick,
  cardId: edge.card_ref,
  stationId: edge.station_id,
  amountStroops: toStroops(edge.amount_php),
}));

/** The burst arrives on the three ticks after the 60-tick warm-up (docs/system-design.md §6.5/§6.6). */
const burstEvents: EdgeEvent[] = burstFixture.edges.map((edge) => ({
  tick: LAST_WARMUP_TICK + edge.tick_offset,
  cardId: edge.card_ref,
  stationId: edge.station_id,
  amountStroops: toStroops(edge.amount_php),
}));

function replayFrom(state: MidasState, events: EdgeEvent[], cfg: MidasConfig) {
  let current = state;
  const scores: MidasScore[] = [];
  for (const event of events) {
    const step = stepMidas(current, event, cfg);
    current = step.state;
    scores.push(step.score);
  }
  return { state: current, scores };
}

const warmed = replayFrom(initMidasState(CONFIG), honestEvents, CONFIG).state;

describe('midas on the honest history', () => {
  it('never crosses the calibrated threshold over the 60-tick replay', () => {
    const scores = replayMidas(honestEvents, LOOSE);
    const worst = Math.max(...scores.map((score) => score.score));
    expect(worst).toBe(1.687864);
    expect(worst).toBeLessThan(calibrated.threshold);
  });

  it('filters nothing at the calibrated threshold', () => {
    expect(replayMidas(honestEvents, CONFIG).every((score) => !score.filtered)).toBe(true);
  });

  it('scores every tap in document order and carries the tick through', () => {
    const scores = replayMidas(honestEvents, LOOSE);
    expect(scores).toHaveLength(honestEvents.length);
    expect(scores.map((score) => score.tick)).toEqual(honestEvents.map((event) => event.tick));
  });
});

describe('midas on the burst', () => {
  const { scores } = replayFrom(warmed, burstEvents, CONFIG);

  it('crosses the calibrated threshold within the 30 burst edges', () => {
    const crossed = scores.findIndex((score) => score.score >= calibrated.threshold);
    expect(crossed).toBeGreaterThanOrEqual(0);
    expect(crossed).toBeLessThan(30);
  });

  it('is still above the threshold on the last burst edge', () => {
    expect(scores[29].score).toBeGreaterThanOrEqual(calibrated.threshold);
    expect(scores[29].filtered).toBe(true);
  });

  it('stays below the threshold on the first burst tick, where the flood has not built up yet', () => {
    for (const score of scores.slice(0, 10)) expect(score.score).toBeLessThan(calibrated.threshold);
  });

  it('is driven by the destination sketch, not the amount', () => {
    expect(scores[29].destination).toBeGreaterThan(scores[29].edge);
    expect(scores[29].destination).toBeGreaterThan(scores[29].source);
  });
});

describe('midas on the two demo taps at Station B', () => {
  const tap = (tick: number): EdgeEvent => ({
    tick,
    cardId: 'card_D2',
    stationId: 'B',
    amountStroops: '480000000',
  });

  it('stays far below the threshold, so the burst is what freezes the station', () => {
    const first = stepMidas(warmed, tap(LAST_WARMUP_TICK + 1), CONFIG);
    const second = stepMidas(first.state, tap(LAST_WARMUP_TICK + 2), CONFIG);
    const sameTick = stepMidas(first.state, tap(LAST_WARMUP_TICK + 1), CONFIG);
    for (const score of [first.score, second.score, sameTick.score]) {
      expect(score.score).toBeLessThan(calibrated.threshold / 2);
      expect(score.filtered).toBe(false);
    }
  });
});

describe('midas mechanics', () => {
  it('decays the window once per tick change', () => {
    const two = replayFrom(
      initMidasState(CONFIG),
      [
        { tick: 1, cardId: 'c1', stationId: 'S', amountStroops: '0' },
        { tick: 1, cardId: 'c2', stationId: 'S', amountStroops: '0' },
      ],
      CONFIG,
    ).state;
    const before = sketchEstimate(two.edge, 'c1|S');
    expect(before).toBe(1);
    const after = stepMidas(two, { tick: 2, cardId: 'c3', stationId: 'S', amountStroops: '0' }, CONFIG).state;
    expect(sketchEstimate(after.edge, 'c1|S')).toBe(0.6 * before);
  });

  it('keeps a filtered edge out of the totals while it keeps inflating the window', () => {
    const filtering: MidasConfig = { ...CONFIG, threshold: 0 };
    const event: EdgeEvent = { tick: 1, cardId: 'c1', stationId: 'S', amountStroops: '0' };
    const first = stepMidas(initMidasState(filtering), event, filtering);
    const second = stepMidas(first.state, event, filtering);
    expect(first.score.filtered).toBe(true);
    expect(second.score.filtered).toBe(true);
    expect(second.state.edge.totalCount).toBe(0);
    expect(second.state.edge.distinctKeys).toEqual([]);
    expect(second.state.edge.totals.reduce((sum, v) => sum + v, 0)).toBe(0);
    expect(sketchEstimate(second.state.edge, 'c1|S')).toBe(2);
  });

  it('scores 0 while a sketch knows fewer than two keys', () => {
    const score = stepMidas(initMidasState(CONFIG), { tick: 1, cardId: 'c1', stationId: 'S', amountStroops: '0' }, CONFIG)
      .score;
    expect(score).toEqual({ tick: 1, edge: 0, source: 0, destination: 0, score: 0, filtered: false });
  });

  it('ignores the amount', () => {
    const a = stepMidas(warmed, { tick: 61, cardId: 'card_D2', stationId: 'B', amountStroops: '480000000' }, CONFIG);
    const b = stepMidas(warmed, { tick: 61, cardId: 'card_D2', stationId: 'B', amountStroops: '1000' }, CONFIG);
    expect(b.score).toEqual(a.score);
  });

  it('does not mutate the state it is given', () => {
    const before = JSON.stringify(warmed);
    stepMidas(warmed, { tick: 61, cardId: 'card_D2', stationId: 'B', amountStroops: '0' }, CONFIG);
    expect(JSON.stringify(warmed)).toBe(before);
  });

  it('is deterministic, and an incremental step loop matches replayMidas', () => {
    const batch = replayMidas(burstEvents, CONFIG);
    expect(replayMidas(burstEvents, CONFIG)).toEqual(batch);
    expect(replayFrom(initMidasState(CONFIG), burstEvents, CONFIG).scores).toEqual(batch);
  });
});
