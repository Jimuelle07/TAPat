// Freeze Agent + burst (docs/test-plan.md §2.2 `apps/server/src/services/freeze.test.ts`): the honest replay, MIDAS-F
// scoring, the two LGU rules, the burst gate and unfreeze. Injected clock, injected MIDAS config, fake chain — no
// network, no money.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Keypair } from '@stellar/stellar-sdk';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SKETCH, encryptSecret, replayMidas } from '@tapat/agent';
import type { Tap } from '@tapat/shared';
import type { Db } from '../db/index';
import { openDb } from '../db/index';
import { createFreezeService, type FreezeService } from './freeze';
import { createSseBus, type SseBus, type SseEventName } from './sse';
import { recordTap, type TapDeps } from './tap';
import {
  KEY_ENCRYPTION_SECRET,
  T0,
  XLM_SAC_ID,
  fakeLog,
  fakeNoir,
  makeChainDeps,
  seedBeneficiary,
  seedCard,
  seedProgram,
  seedStation,
  type FakeNoir,
} from './test-fakes';

/** The committed `apps/server/config/midas.json.threshold` (task MID); the service takes it as a config value. */
const THRESHOLD = 2.2;
/** High enough that only the LGU rules can fire — the honest baseline keeps MIDAS-F far below it. */
const NEVER_FREEZE = 1_000;
const HONEST_FIXTURE = fileURLToPath(new URL('../../../../fixtures/taps/honest-history.json', import.meta.url));

interface Published {
  event: SseEventName;
  data: unknown;
}

interface DecisionRow {
  decision: string;
  inputs_json: string;
  outputs_json: string;
  tx_ids_json: string;
}

let db: Db;
let fake: FakeNoir;
let bus: SseBus;
let published: Published[];
let clock: number;
let freeze: FreezeService;
let tapDeps: TapDeps;
let cardD2: Keypair;

function decisions(): DecisionRow[] {
  return db.prepare('SELECT * FROM agent_decisions ORDER BY rowid').all<DecisionRow>();
}

function decision(name: string): DecisionRow | undefined {
  return decisions().find((row) => row.decision === name);
}

function stationStatus(id: string): string {
  return db.prepare('SELECT status FROM stations WHERE id = ?').get<{ status: string }>(id)?.status ?? 'missing';
}

function tapCount(): number {
  return db.prepare('SELECT COUNT(*) AS n FROM taps').get<{ n: number }>()?.n ?? 0;
}

/** The two ₱480 taps at Station B, one per freeze tick, exactly as the runbook performs them. */
async function tapAtB(amountPhp: number): Promise<Tap> {
  const response = await recordTap(tapDeps, { stationId: 'B', amountPhp, cardId: 'card_D2', simulated: true });
  return response.tap;
}

beforeEach(async () => {
  db = openDb(':memory:');
  seedProgram(db);
  seedBeneficiary(db, { id: 'ben_D2', firstName: 'Pedro', lastName: 'Reyes' });
  seedStation(db, { id: 'A', name: 'Petron San Roque' });
  seedStation(db, { id: 'B', name: 'Rotonda Fuels' });
  cardD2 = Keypair.random();
  await seedCard(db, {
    id: 'card_D2',
    beneficiaryId: 'ben_D2',
    uid: '04A21F3A54',
    agent: cardD2,
    secretEnc: encryptSecret(cardD2.secret(), KEY_ENCRYPTION_SECRET),
  });
  fake = fakeNoir();
  bus = createSseBus();
  published = [];
  bus.subscribe((event, data) => published.push({ event, data }));
  clock = T0;
  freeze = createFreezeService({
    db,
    bus,
    config: { FREEZE_TICK_MS: 1000 },
    midas: { threshold: THRESHOLD, decay: 0.6, sketch: DEFAULT_SKETCH },
    now: () => clock,
    schedule: () => () => {},
  });
  tapDeps = {
    db,
    chain: makeChainDeps(db, fake.noir, fakeLog()),
    bus,
    config: { KEY_ENCRYPTION_SECRET, XLM_SAC_ID, PHP_PER_XLM: 10 },
    onTap: (tap) => freeze.enqueue(tap),
    now: () => clock,
  };
});

afterEach(() => {
  freeze.stop();
  db.close();
});

describe('Freeze Agent warm-up', () => {
  it('keeps every honest-replay score below the freeze line', () => {
    // The same 60-tick replay the warm-up performs, with nothing filtered: this is the baseline the burst must cross,
    // and the reason Station A can never freeze on the honest history.
    const fixture = JSON.parse(readFileSync(HONEST_FIXTURE, 'utf8')) as {
      ticks: Array<{ tick: number; card_ref: string; station_id: string; amount_php: number }>;
    };
    const scores = replayMidas(
      fixture.ticks.map((edge) => ({
        tick: edge.tick,
        cardId: edge.card_ref,
        stationId: edge.station_id,
        amountStroops: String(Math.round(edge.amount_php * 1e6)),
      })),
      { threshold: Number.POSITIVE_INFINITY, decay: 0.6, sketch: DEFAULT_SKETCH },
    );
    expect(Math.max(...scores.map((score) => score.score))).toBeLessThan(THRESHOLD);
  });

  it('records the honest baselines once and freezes nothing', () => {
    freeze.tick();

    const baselines = decisions();
    expect(baselines).toHaveLength(1);
    expect(baselines[0]?.decision).toBe('BASELINE_SET');
    // `fixtures/taps/honest-history.json`: seed 7, 60 ticks, 86 edges (A 59, B 27).
    expect(JSON.parse(baselines[0]?.inputs_json ?? '{}')).toEqual({ seeds: 7, ticks: 60 });
    const perStation = JSON.parse(baselines[0]?.outputs_json ?? '{}').perStation as Record<string, number>;
    expect(perStation.A).toBeCloseTo((59 / 60) * 10, 6);
    expect(perStation.B).toBeCloseTo((27 / 60) * 10, 6);
    // The honest history can never freeze a station: it is warm-up only.
    expect(stationStatus('A')).toBe('active');
    expect(stationStatus('B')).toBe('active');
    expect(tapCount()).toBe(0);

    // A second tick does not replay the warm-up again.
    freeze.tick();
    expect(decisions()).toHaveLength(1);
  });
});

describe('burst', () => {
  it('is 409 INVALID_STATE until an authorized Station-B tap exists, and writes nothing', () => {
    expect(() => freeze.burst()).toThrow(
      expect.objectContaining({ statusCode: 409, code: 'INVALID_STATE', message: 'Tap D2 at Station B first' }),
    );
    expect(tapCount()).toBe(0);
  });

  it('replays 30 simulated edges as refused SIMULATED_EDGE rows and returns the 202 body', async () => {
    await tapAtB(480);
    freeze.tick();

    expect(freeze.burst()).toEqual({ accepted: true, edges: 30, tickMs: 100 });

    const rows = db
      .prepare(`SELECT card_id, card_ref, station_id, status, reason_code, simulated, chain_tx_id FROM taps
                 WHERE reason_code = 'SIMULATED_EDGE'`)
      .all<{
        card_id: string | null;
        card_ref: string | null;
        station_id: string;
        status: string;
        reason_code: string;
        simulated: number;
        chain_tx_id: string | null;
      }>();
    expect(rows).toHaveLength(30);
    for (const row of rows) {
      expect(row).toMatchObject({
        card_id: null,
        station_id: 'B',
        status: 'refused',
        reason_code: 'SIMULATED_EDGE',
        simulated: 1,
        chain_tx_id: null,
      });
      expect(row.card_ref).toMatch(/^virtual\d{2}$/);
    }
    // No money: the burst never touches the chain.
    expect(fake.prepare.mock.calls.filter(([, op]) => op.kind === 'authorize')).toHaveLength(1);
    expect(db.prepare('SELECT COUNT(*) AS n FROM chain_txs').get<{ n: number }>()?.n).toBe(1);

    // A second burst at an already-frozen station is 409, not a second 30 edges.
    freeze.tick();
    expect(stationStatus('B')).toBe('frozen');
    expect(() => freeze.burst()).toThrow(expect.objectContaining({ statusCode: 409, code: 'INVALID_STATE' }));
  });
});

describe('freeze decision', () => {
  it('freezes Station B on two ₱480 taps plus the burst, and never Station A', async () => {
    const first = await tapAtB(480);
    freeze.tick();
    const second = await tapAtB(480);
    freeze.tick();
    expect(stationStatus('B')).toBe('active');

    freeze.burst();
    freeze.tick();

    expect(stationStatus('B')).toBe('frozen');
    expect(stationStatus('A')).toBe('active');

    const frozen = decision('FROZEN');
    expect(frozen).toBeDefined();
    const inputs = JSON.parse(frozen?.inputs_json ?? '{}') as { midasScore: number; threshold: number };
    const outputs = JSON.parse(frozen?.outputs_json ?? '{}') as {
      rule: string;
      stationId: string;
      frozenReason: string;
    };
    expect(inputs.threshold).toBe(THRESHOLD);
    expect(inputs.midasScore).toBeGreaterThanOrEqual(THRESHOLD);
    expect(outputs.rule).toBe('MIDAS_F');
    expect(outputs.stationId).toBe('B');
    expect(outputs.frozenReason).toContain(`>= ${THRESHOLD}`);
    expect(frozen?.tx_ids_json).toBe('[]');

    // The station row carries the reason and the time it was frozen.
    const station = db
      .prepare('SELECT frozen_reason, frozen_at FROM stations WHERE id = ?')
      .get<{ frozen_reason: string | null; frozen_at: number | null }>('B');
    expect(station?.frozen_reason).toBe(outputs.frozenReason);
    expect(station?.frozen_at).toBe(T0);

    // SSE: `freeze` is the decision plus the flat station keys; `tap` is re-emitted under the same ids.
    const freezeEvents = published.filter((entry) => entry.event === 'freeze');
    expect(freezeEvents).toHaveLength(1);
    expect(freezeEvents[0]?.data).toMatchObject({ agent: 'freeze', decision: 'FROZEN', stationId: 'B', stationStatus: 'frozen' });

    const scored = published.filter((entry) => entry.event === 'tap').map((entry) => entry.data as Tap);
    expect(scored.some((tap) => tap.id === first.id)).toBe(true);
    expect(scored.some((tap) => tap.id === second.id)).toBe(true);
    const reEmitted = scored.find((tap) => tap.id === second.id);
    expect(reEmitted?.midasScore).not.toBeNull();
    expect(reEmitted?.tick).toBe(60);
    // Two `tap` events per row: one at tap time, one after scoring (clients upsert by `id`).
    expect(scored.filter((tap) => tap.id === second.id)).toHaveLength(2);

    // Scored burst rows keep the fixture tick (`freezeStartTick + tick_offset`) and carry a score.
    const burstTicks = db
      .prepare(`SELECT DISTINCT tick FROM taps WHERE reason_code = 'SIMULATED_EDGE' ORDER BY tick`)
      .all<{ tick: number }>()
      .map((row) => row.tick);
    expect(burstTicks).toEqual([61, 62, 63]);
    const unscored = db
      .prepare(`SELECT COUNT(*) AS n FROM taps WHERE midas_score IS NULL`)
      .get<{ n: number }>()?.n;
    expect(unscored).toBe(0);
  });

  it('falls back to NEAR_CAP_STREAK when MIDAS-F cannot fire', async () => {
    freeze.stop();
    freeze = createFreezeService({
      db,
      bus,
      config: { FREEZE_TICK_MS: 1000 },
      midas: { threshold: NEVER_FREEZE, decay: 0.6, sketch: DEFAULT_SKETCH },
      now: () => clock,
      schedule: () => () => {},
    });
    tapDeps = { ...tapDeps, onTap: (tap) => freeze.enqueue(tap) };

    await tapAtB(480);
    await tapAtB(480);
    freeze.tick();
    // Two near-cap taps are not a streak (SDD §6.5: three consecutive `authorized` taps).
    expect(stationStatus('B')).toBe('active');

    await tapAtB(480);
    freeze.tick();

    expect(stationStatus('B')).toBe('frozen');
    const outputs = JSON.parse(decision('FROZEN')?.outputs_json ?? '{}') as { rule: string };
    expect(outputs.rule).toBe('NEAR_CAP_STREAK');
  });

  it('scores but decides nothing at a station that is already frozen', async () => {
    await tapAtB(480);
    await tapAtB(480);
    await tapAtB(480);
    freeze.tick();
    expect(stationStatus('B')).toBe('frozen');
    const before = decisions().filter((row) => row.decision === 'FROZEN').length;

    // A tap at a frozen station is refused 423 by the tap service, and still queued for the story.
    await expect(tapAtB(480)).rejects.toThrow(expect.objectContaining({ statusCode: 423, code: 'STATION_FROZEN' }));
    freeze.tick();

    expect(decisions().filter((row) => row.decision === 'FROZEN')).toHaveLength(before);
  });
});

describe('unfreeze', () => {
  it('releases a frozen station, logs UNFROZEN and 409s on a second call', async () => {
    await tapAtB(480);
    await tapAtB(480);
    await tapAtB(480);
    freeze.tick();
    expect(stationStatus('B')).toBe('frozen');

    const station = freeze.unfreeze('B');
    expect(station).toMatchObject({
      id: 'B',
      name: 'Rotonda Fuels',
      status: 'active',
      frozenReason: null,
      frozenAt: null,
    });
    // Three authorized ₱480 taps, none claimed yet.
    expect(station.pendingStroops).toBe('1440000000');
    expect(station.spentStroops).toBe('0');
    expect(stationStatus('B')).toBe('active');
    expect(decision('UNFROZEN')).toBeDefined();

    const last = published.filter((entry) => entry.event === 'freeze').at(-1);
    expect(last?.data).toMatchObject({ decision: 'UNFROZEN', stationId: 'B', stationStatus: 'active' });

    expect(() => freeze.unfreeze('B')).toThrow(
      expect.objectContaining({ statusCode: 409, code: 'INVALID_STATE' }),
    );
    expect(() => freeze.unfreeze('Z')).toThrow(expect.objectContaining({ statusCode: 404, code: 'NOT_FOUND' }));
  });
});
