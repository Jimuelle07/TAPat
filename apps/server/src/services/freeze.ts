// Freeze Agent (SDD §6.5-6.6, api-and-data.md §5.2 #14-15, algorithms.md §8): the honest 60-tick replay warms up
// MIDAS-F and the per-station baselines, then every live edge is scored on the freeze tick and either the model
// (MIDAS_F) or one of the two LGU rules freezes the station — once, for good. A simulated burst edge is a scoring
// input only: it is written `refused`/`SIMULATED_EDGE`, so it never moves money and never enters settlement.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_MIDAS,
  initMidasState,
  stepMidas,
  type EdgeEvent,
  type MidasConfig,
  type MidasState,
} from '@tapat/agent';
import type { BurstResponse, Station, Tap } from '@tapat/shared';
import { z } from 'zod';
import type { Config } from '../config';
import type { Db } from '../db/index';
import { ApiError } from '../errors';
import { getCurrentProgram } from './program';
import type { SseBus } from './sse';
import { stationMoney, toStation, type StationRow } from './stations';
import { toTap, type TapRow } from './tap';
import { toAgentDecision } from './tranche';

const HONEST_FIXTURE = fileURLToPath(new URL('../../../../fixtures/taps/honest-history.json', import.meta.url));
const BURST_FIXTURE = fileURLToPath(new URL('../../../../fixtures/taps/burst.json', import.meta.url));
const MIDAS_CONFIG = fileURLToPath(new URL('../../config/midas.json', import.meta.url));

/** The burst always hits Station B (`fixtures/taps/burst.json`, SDD §6.6). */
const BURST_STATION = 'B';
/** `fixtures/taps/burst.json` edges are emitted 100 ms apart (api-and-data.md §5.2 #14). */
const BURST_TICK_MS = 100;
/** `MIDAS_F` rules on the threshold; `VOLUME_SPIKE` on the taps in the last 10 ticks (SDD §6.5). */
const VOLUME_WINDOW_TICKS = 10;
/**
 * `apps/server/config/midas.json` is generated output (task MID, algorithms.md §8.3) and committed, but a checkout
 * without it must still boot: the last calibrated value is the documented stand-in, exactly like the dashboard's.
 */
export const MIDAS_THRESHOLD_FALLBACK = 2.2;

const honestFixtureSchema = z.object({
  source: z.string(),
  seed: z.number().int(),
  ticks: z
    .array(
      z.object({
        tick: z.number().int().positive(),
        card_ref: z.string().min(1),
        station_id: z.string().min(1),
        amount_php: z.number().positive(),
      }),
    )
    .min(1),
});

const burstFixtureSchema = z.object({
  source: z.string(),
  edges: z
    .array(
      z.object({
        tick_offset: z.number().int().positive(),
        card_ref: z.string().min(1),
        station_id: z.string().min(1),
        amount_php: z.number().positive(),
      }),
    )
    .min(1),
});

interface FreezeLog {
  warn(obj: object, msg: string): void;
}

/**
 * `apps/server/config/midas.json.threshold` plus the fixed decay/sketch from `DEFAULT_MIDAS`. A missing or malformed
 * file (MID not yet generated on this checkout) warns once and falls back to the last calibrated threshold; the
 * generator's extra keys (`maxHonestScore`, `seedCount`, …) are provenance and are not read here.
 */
export function loadMidasConfig(log?: FreezeLog, path: string = MIDAS_CONFIG): MidasConfig {
  try {
    const parsed = z
      .object({ threshold: z.number().finite().positive() })
      .parse(JSON.parse(readFileSync(path, 'utf8')));
    return { threshold: parsed.threshold, decay: DEFAULT_MIDAS.decay, sketch: DEFAULT_MIDAS.sketch };
  } catch (error) {
    log?.warn({ err: error, path }, 'midas.json unreadable; using the fallback threshold');
    return { threshold: MIDAS_THRESHOLD_FALLBACK, decay: DEFAULT_MIDAS.decay, sketch: DEFAULT_MIDAS.sketch };
  }
}

/** Which rule froze the station: the model, or one of the two plain-English LGU rules (algorithms.md §8.4). */
export type FreezeRule = 'MIDAS_F' | 'NEAR_CAP_STREAK' | 'VOLUME_SPIKE';

export interface FreezeDeps {
  db: Db;
  bus: SseBus;
  config: Pick<Config, 'FREEZE_TICK_MS'>;
  /** The calibrated threshold and its fixed decay/sketch; `loadMidasConfig()` in `main()`, injected in tests. */
  midas: MidasConfig;
  honestFixturePath?: string;
  burstFixturePath?: string;
  now?: () => number;
  id?: () => string;
  log?: FreezeLog;
  /** Runs `fn` every `ms` and returns its cancel. Tests inject a no-op and drive `tick()` themselves. */
  schedule?: (fn: () => void, ms: number) => () => void;
}

export interface FreezeService {
  /** The freeze line, for the dashboard's edge chart. */
  readonly threshold: number;
  /** Queues a freshly written tap row for the next tick's scoring (`recordTap`'s hand-off, and the burst). */
  enqueue(tap: Tap): void;
  /** One freeze tick: drains the queue, scores every edge, re-emits `tap` and freezes a station when a rule fires. */
  tick(): void;
  /** `POST /api/agents/freeze/burst`: writes the 30 simulated edges and returns the 202 body. */
  burst(): BurstResponse;
  /** `POST /api/stations/:id/unfreeze`: manual release, logged as a decision. */
  unfreeze(stationId: string): Station;
  /** Starts the `FREEZE_TICK_MS` ticker and returns its cancel. */
  start(): () => void;
  stop(): void;
}

interface DecisionRow {
  id: string;
  agent: 'freeze';
  decision: string;
  inputs_json: string;
  outputs_json: string;
  tx_ids_json: string;
  created_at: number;
}

/** What the two LGU rules measured on the tick that is being judged (SDD §6.5 step 4). */
interface RuleCounts {
  nearCapStreak: number;
  tapsLast10Ticks: number;
  baselineMeanPer10: number;
}

/** One scored station in a tick: the model decides on the batch maximum, the LGU rules on the latest edge. */
interface TickScores {
  maxScore: number;
  lastScore: number;
}

export function createFreezeService(deps: FreezeDeps): FreezeService {
  const now = deps.now ?? Date.now;
  const newId = deps.id ?? ((): string => `dec_${randomUUID().replaceAll('-', '').slice(0, 8)}`);
  const newTapId = (): string => `tap_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
  const schedule =
    deps.schedule ??
    ((fn: () => void, ms: number): (() => void) => {
      const timer = setInterval(() => {
        try {
          fn();
        } catch (error) {
          // A ticker must not take the process down; the next tick starts from the persisted state.
          deps.log?.warn({ err: error }, 'freeze tick failed');
        }
      }, ms);
      return () => {
        clearInterval(timer);
      };
    });

  /** The live clock starts at boot; the warm-up owns ticks 1..honestTicks. */
  const startedAt = now();
  const queue: Tap[] = [];
  let midas: MidasState | null = null;
  let honestTicks = 0;
  let baselines: Record<string, number> = {};
  let cancelTicker: (() => void) | null = null;

  function writeDecision(
    decision: string,
    inputs: Record<string, unknown>,
    outputs: Record<string, unknown>,
    txIds: string[] = [],
  ): DecisionRow {
    const row: DecisionRow = {
      id: newId(),
      agent: 'freeze',
      decision,
      inputs_json: JSON.stringify(inputs),
      outputs_json: JSON.stringify(outputs),
      tx_ids_json: JSON.stringify(txIds),
      created_at: now(),
    };
    deps.db
      .prepare(
        `INSERT INTO agent_decisions (id, agent, decision, inputs_json, outputs_json, tx_ids_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(row.id, row.agent, row.decision, row.inputs_json, row.outputs_json, row.tx_ids_json, row.created_at);
    return row;
  }

  function readStation(stationId: string): StationRow | undefined {
    return deps.db
      .prepare('SELECT id, name, public_key, status, frozen_reason, frozen_at FROM stations WHERE id = ?')
      .get<StationRow>(stationId);
  }

  /**
   * SDD §6.5 "Warm-up": replay the 60-tick honest history through MIDAS-F and count each station's edges, then record
   * the baselines once. The replayed edges are not written to `taps` (no money, no tap rows) and no rule is judged
   * here, so the honest history can never freeze a station.
   */
  function warmUp(): MidasState {
    if (midas !== null) return midas;
    const fixture = honestFixtureSchema.parse(
      JSON.parse(readFileSync(deps.honestFixturePath ?? HONEST_FIXTURE, 'utf8')),
    );
    let current = initMidasState(deps.midas);
    honestTicks = Math.max(...fixture.ticks.map((edge) => edge.tick));
    const counts = new Map<string, number>();
    for (const edge of fixture.ticks) {
      const event: EdgeEvent = {
        tick: edge.tick,
        cardId: edge.card_ref,
        stationId: edge.station_id,
        amountStroops: BigInt(Math.round(edge.amount_php * 1e6)).toString(),
      };
      current = stepMidas(current, event, deps.midas).state;
      counts.set(event.stationId, (counts.get(event.stationId) ?? 0) + 1);
    }
    const perStation: Record<string, number> = {};
    for (const [stationId, edges] of counts) perStation[stationId] = (edges / honestTicks) * 10;
    baselines = perStation;
    writeDecision('BASELINE_SET', { seeds: fixture.seed, ticks: honestTicks }, { perStation });
    midas = current;
    return current;
  }

  /** Tick 61 onwards: the freeze clock rides on top of the warm-up's 60 ticks. */
  function currentTick(): number {
    return honestTicks + Math.floor((now() - startedAt) / deps.config.FREEZE_TICK_MS);
  }

  function ruleCounts(stationId: string, tick: number): RuleCounts {
    const program = getCurrentProgram(deps.db);
    const cap = program === null ? 0n : BigInt(program.perTapCapStroops);
    // "3 consecutive `authorized` taps at that station, each >= 90% of the per-tap cap" (SDD §6.5).
    const recent = deps.db
      .prepare(
        `SELECT amount_stroops FROM taps WHERE station_id = ? AND status = 'authorized'
          ORDER BY created_at DESC, rowid DESC LIMIT 3`,
      )
      .all<{ amount_stroops: number | bigint }>(stationId);
    const nearCapStreak = recent.filter((tap) => BigInt(tap.amount_stroops) * 10n >= cap * 9n).length;
    const volume = deps.db
      .prepare('SELECT COUNT(*) AS n FROM taps WHERE station_id = ? AND tick IS NOT NULL AND tick > ?')
      .get<{ n: number }>(stationId, tick - VOLUME_WINDOW_TICKS);
    return {
      nearCapStreak: BigInt(recent.length) === 3n ? nearCapStreak : 0,
      tapsLast10Ticks: volume?.n ?? 0,
      baselineMeanPer10: baselines[stationId] ?? 0,
    };
  }

  /** SDD §6.5 step 5: the station goes `frozen` with the reason, one decision row, one `freeze` SSE event. */
  function freeze(station: StationRow, rule: FreezeRule, score: number, counts: RuleCounts): void {
    const at = now();
    // The api-and-data.md §5.2 #16 example string: the score, the line it crossed, and the rule that froze it.
    const reason = `MIDAS ${score.toFixed(2)} >= ${deps.midas.threshold} (${rule})`;
    deps.db
      .prepare(`UPDATE stations SET status = 'frozen', frozen_reason = ?, frozen_at = ? WHERE id = ?`)
      .run(reason, at, station.id);
    const row = writeDecision(
      'FROZEN',
      {
        midasScore: score,
        threshold: deps.midas.threshold,
        nearCapStreak: counts.nearCapStreak,
        tapsLast10Ticks: counts.tapsLast10Ticks,
        baselineMeanPer10: counts.baselineMeanPer10,
      },
      { rule, stationId: station.id, stationName: station.name, frozenReason: reason, frozenAt: at },
    );
    deps.bus.publish('freeze', { ...toAgentDecision(row), stationId: station.id, stationStatus: 'frozen' });
  }

  function tick(): void {
    // The warm-up runs once per process, on the first tick (start() also forces it at boot), so its baselines exist
    // before any live edge is judged.
    let current = warmUp();
    if (queue.length === 0) return;
    const drained = queue.splice(0, queue.length);
    const tickNow = currentTick();
    const scores = new Map<string, TickScores>();
    let anchorTick = tickNow;

    for (const tap of drained) {
      // A resolved tap carries a card; a burst edge carries the fixture's card ref. Anything else (a refusal before
      // the card was resolved) has no edge to score.
      const cardId = tap.cardId ?? tap.cardRef;
      if (cardId === null) continue;
      // Burst rows store `freezeStartTick + tick_offset` (algorithms.md §9.3); a live tap is scored on the draining tick.
      const edgeTick = tap.tick ?? tickNow;
      anchorTick = Math.max(anchorTick, edgeTick);
      const step = stepMidas(
        current,
        { tick: edgeTick, cardId, stationId: tap.stationId, amountStroops: tap.amountStroops },
        deps.midas,
      );
      current = step.state;
      deps.db
        .prepare('UPDATE taps SET midas_score = ?, tick = ? WHERE id = ?')
        .run(step.score.score, edgeTick, tap.id);
      const row = deps.db.prepare('SELECT * FROM taps WHERE id = ?').get<TapRow>(tap.id);
      // The scored row goes out with the same `id` as the tap-time event, so clients upsert instead of duplicating.
      if (row !== undefined) deps.bus.publish('tap', toTap(row));
      const seen = scores.get(tap.stationId);
      scores.set(tap.stationId, {
        maxScore: Math.max(seen?.maxScore ?? Number.NEGATIVE_INFINITY, step.score.score),
        lastScore: step.score.score,
      });
    }

    midas = current;
    if (scores.size === 0) return;

    for (const [stationId, scored] of scores) {
      const station = readStation(stationId);
      // Once frozen a station is not frozen again; its taps keep being scored for the story but decide nothing.
      if (station === undefined || station.status === 'frozen') continue;
      const counts = ruleCounts(stationId, anchorTick);
      // The model first: a station whose MIDAS-F score crossed the line in this tick is frozen by the model, even when
      // an LGU rule also fired (the demo's burst trips both).
      if (scored.maxScore >= deps.midas.threshold) {
        freeze(station, 'MIDAS_F', scored.maxScore, counts);
        continue;
      }
      if (counts.nearCapStreak > 0) {
        freeze(station, 'NEAR_CAP_STREAK', scored.lastScore, counts);
        continue;
      }
      if (counts.tapsLast10Ticks > 3 * counts.baselineMeanPer10) {
        freeze(station, 'VOLUME_SPIKE', scored.lastScore, counts);
      }
    }
  }

  function burst(): BurstResponse {
    const station = readStation(BURST_STATION);
    if (station === undefined) throw new ApiError(404, 'NOT_FOUND', `station ${BURST_STATION} not found`);
    if (station.status === 'frozen') throw new ApiError(409, 'INVALID_STATE', 'station already frozen');
    // The gate is any `authorized` Station-B tap — Read card or Simulate tap alike; `simulated` records only how the
    // UID was read, not whether money moved (api-and-data.md §5.2 #14).
    const authorized = deps.db
      .prepare(`SELECT COUNT(*) AS n FROM taps WHERE station_id = ? AND status = 'authorized'`)
      .get<{ n: number }>(station.id);
    if ((authorized?.n ?? 0) === 0) throw new ApiError(409, 'INVALID_STATE', 'Tap D2 at Station B first');

    const fixture = burstFixtureSchema.parse(
      JSON.parse(readFileSync(deps.burstFixturePath ?? BURST_FIXTURE, 'utf8')),
    );
    warmUp();
    const createdAt = now();
    for (const edge of fixture.edges) {
      const row: TapRow = {
        id: newTapId(),
        card_id: null,
        card_ref: edge.card_ref,
        station_id: edge.station_id,
        amount_stroops: Math.round(edge.amount_php * 1e6),
        nonce: null,
        status: 'refused',
        reason_code: 'SIMULATED_EDGE',
        chain_tx_id: null,
        simulated: 1,
        midas_score: null,
        // `freezeStartTick + tick_offset` (algorithms.md §9.3): the fixture's own tick, relative to the 60-tick warm-up.
        tick: honestTicks + edge.tick_offset,
        created_at: createdAt,
      };
      deps.db
        .prepare(
          `INSERT INTO taps
             (id, card_id, card_ref, station_id, amount_stroops, nonce, status, reason_code, chain_tx_id,
              simulated, midas_score, tick, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          row.id,
          row.card_id,
          row.card_ref,
          row.station_id,
          row.amount_stroops,
          row.nonce,
          row.status,
          row.reason_code,
          row.chain_tx_id,
          row.simulated,
          row.midas_score,
          row.tick,
          row.created_at,
        );
      queue.push(toTap(row));
    }
    return { accepted: true, edges: fixture.edges.length, tickMs: BURST_TICK_MS };
  }

  function unfreeze(stationId: string): Station {
    const station = readStation(stationId);
    if (station === undefined) throw new ApiError(404, 'NOT_FOUND', `station ${stationId} not found`);
    if (station.status === 'active') throw new ApiError(409, 'INVALID_STATE', `station ${station.id} is already active`);
    deps.db
      .prepare(`UPDATE stations SET status = 'active', frozen_reason = NULL, frozen_at = NULL WHERE id = ?`)
      .run(station.id);
    const row = writeDecision('UNFROZEN', {}, { stationId: station.id, stationName: station.name });
    deps.bus.publish('freeze', { ...toAgentDecision(row), stationId: station.id, stationStatus: 'active' });
    const updated = readStation(station.id);
    if (updated === undefined) throw new Error(`station ${station.id} disappeared`);
    return toStation(updated, stationMoney(deps.db, updated));
  }

  function stop(): void {
    cancelTicker?.();
    cancelTicker = null;
  }

  function start(): () => void {
    try {
      warmUp();
    } catch (error) {
      // The ticker keeps running: a bad fixture must not stop the station rules from judging live taps.
      deps.log?.warn({ err: error }, 'freeze warm-up failed');
    }
    cancelTicker ??= schedule(tick, deps.config.FREEZE_TICK_MS);
    return stop;
  }

  return {
    threshold: deps.midas.threshold,
    enqueue(tap: Tap): void {
      queue.push(tap);
    },
    tick,
    burst,
    unfreeze,
    start,
    stop,
  };
}
