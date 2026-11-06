// Tranche Agent (SDD §6.4, api-and-data.md §5.2 #11-12, algorithms.md §6): replays the simulated price series one point
// per PRICE_TICK_MS through BOCPD and, on the first sustained changepoint above the LGU threshold, funds every eligible
// card's escrow from the Program Wallet. It fires at most once per program and writes one `agent_decisions` row.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Keypair } from '@stellar/stellar-sdk';
import { Bocpd, trancheShouldFire, type BocpdPoint } from '@tapat/agent';
import type { AgentDecision, ChainTxStatus, PricePoint, TrancheStartResponse, TrancheState } from '@tapat/shared';
import { z } from 'zod';
import type { Config } from '../config';
import type { Db } from '../db/index';
import { ApiError } from '../errors';
import { latestFailedChainTxId, readChainTx, runChainTx, type ChainDeps } from './chain';
import { getCurrentProgram } from './program';
import type { SseBus } from './sse';

const DEFAULT_PRICE_FIXTURE = fileURLToPath(new URL('../../../../fixtures/prices/doe-diesel-sim.json', import.meta.url));

const priceFixtureSchema = z.object({
  source: z.string(),
  points: z
    .array(z.object({ idx: z.number().int().positive(), price_php: z.number().positive() }))
    .min(1),
});

interface PriceSeries {
  /** Prices in fixture order (idx 1..n). */
  prices: number[];
  /** `price_points.simulated`: the fixture labels itself `"source": "simulated"` (AGENTS.md §5). */
  simulated: boolean;
}

function loadPriceSeries(path: string): PriceSeries {
  const fixture = priceFixtureSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
  const points = [...fixture.points].sort((a, b) => a.idx - b.idx);
  points.forEach((point, i) => {
    if (point.idx !== i + 1) throw new Error(`price fixture idx must run 1..${points.length} without gaps`);
  });
  return { prices: points.map((point) => point.price_php), simulated: fixture.source === 'simulated' };
}

export interface TrancheDeps {
  db: Db;
  chain: ChainDeps;
  bus: SseBus;
  /** The funder: every `fund_escrow` is signed by the Program Wallet (SDD §2.4). */
  programWallet: Keypair;
  config: Pick<Config, 'XLM_SAC_ID' | 'PRICE_TICK_MS'>;
  priceFixturePath?: string;
  now?: () => number;
  id?: () => string;
  /** Runs `fn` every `ms` and returns its cancel. Tests inject a no-op and drive `tick()` themselves. */
  schedule?: (fn: () => void, ms: number) => () => void;
}

export interface TrancheService {
  /** Validates, resets the series, starts the ticker and returns the 202 body. */
  start(): TrancheStartResponse;
  state(): TrancheState;
  /** One price step (and the funding when it fires). Exposed for tests with an injected clock. */
  tick(): Promise<void>;
  /** Cancels a running ticker; wired to the server's `onClose`. */
  stop(): void;
}

interface DecisionRow {
  id: string;
  agent: AgentDecision['agent'];
  decision: string;
  inputs_json: string;
  outputs_json: string;
  tx_ids_json: string;
  created_at: number;
}

/** `agent_decisions` row -> the REST shape (§3); the SSE `tranche` payload. */
export function toAgentDecision(row: DecisionRow): AgentDecision {
  return {
    id: row.id,
    agent: row.agent,
    decision: row.decision,
    inputs: JSON.parse(row.inputs_json) as Record<string, unknown>,
    outputs: JSON.parse(row.outputs_json) as Record<string, unknown>,
    txIds: JSON.parse(row.tx_ids_json) as string[],
    createdAt: row.created_at,
  };
}

interface PricePointRow {
  program_id: string;
  idx: number;
  price_php: number;
  simulated: number;
  cp_recent: number | null;
  map_r: number | null;
}

function toPricePoint(row: PricePointRow): PricePoint {
  return {
    programId: row.program_id,
    idx: row.idx,
    pricePhp: row.price_php,
    simulated: row.simulated === 1,
    cpRecent: row.cp_recent,
    mapR: row.map_r,
  };
}

interface CardRow {
  id: string;
  beneficiary_id: string;
  device_hash: string;
  expires_at_s: number;
}

interface FundedEntry {
  cardId: string;
  deviceHashPrefix: string;
  amountStroops: string;
  chainTxId: string | null;
}

interface SkippedEntry {
  cardId: string;
  reason: 'EXPIRED' | 'BUDGET_EXHAUSTED';
}

/** The in-flight price replay; `null` when none is running. */
interface Run {
  programId: string;
  thresholdPhp: number;
  series: PriceSeries;
  bocpd: Bocpd;
  /** Points consumed so far. */
  idx: number;
  /** A tick is still awaiting the chain; the next interval skips instead of overlapping. */
  busy: boolean;
  cancel: () => void;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createTrancheService(deps: TrancheDeps): TrancheService {
  const now = deps.now ?? Date.now;
  const newId = deps.id ?? ((): string => `dec_${randomUUID().replaceAll('-', '').slice(0, 8)}`);
  const schedule =
    deps.schedule ??
    ((fn: () => void, ms: number): (() => void) => {
      const timer = setInterval(fn, ms);
      return () => {
        clearInterval(timer);
      };
    });
  let run: Run | null = null;
  let series: PriceSeries | undefined;

  const priceSeries = (): PriceSeries => (series ??= loadPriceSeries(deps.priceFixturePath ?? DEFAULT_PRICE_FIXTURE));

  function endRun(finished: Run): void {
    finished.cancel();
    if (run === finished) run = null;
  }

  /** The funding pass (SDD §6.4 step 5). Never throws for a chain failure: it lands in `outputs.funded`. */
  async function fire(current: Run, point: BocpdPoint): Promise<void> {
    const program = getCurrentProgram(deps.db);
    if (program === null || program.id !== current.programId) throw new Error('program disappeared while firing');
    // Marked before the first transaction: a crash mid-funding must never allow a second tranche (AGENTS.md money).
    deps.db.prepare('UPDATE program SET tranche_fired = 1 WHERE id = ?').run(program.id);

    const tranche = BigInt(program.trancheStroops);
    let remaining = BigInt(program.budgetVerifiedStroops) - BigInt(program.budgetFundedStroops);
    const budgetBefore = remaining;
    const nowS = Math.floor(now() / 1000);
    const cards = deps.db
      .prepare(
        `SELECT id, beneficiary_id, device_hash, expires_at_s FROM cards WHERE status = 'active' ORDER BY created_at, rowid`,
      )
      .all<CardRow>();

    const funded: FundedEntry[] = [];
    const skipped: SkippedEntry[] = [];
    const txIds: string[] = [];
    let exhausted = false;

    for (const card of cards) {
      if (card.expires_at_s <= nowS) {
        skipped.push({ cardId: card.id, reason: 'EXPIRED' });
        continue;
      }
      if (remaining <= 0n) {
        exhausted = true;
        skipped.push({ cardId: card.id, reason: 'BUDGET_EXHAUSTED' });
        continue;
      }
      // min(tranche, remaining): the card that finds less than a full tranche left takes the rest, then funding stops.
      const amount = remaining < tranche ? remaining : tranche;
      if (amount < tranche) exhausted = true;

      let chainTxId: string | null = null;
      let succeeded = false;
      try {
        const result = await runChainTx(deps.chain, deps.programWallet, {
          kind: 'fundEscrow',
          deviceHash: card.device_hash,
          token: deps.config.XLM_SAC_ID,
          amount,
        });
        chainTxId = result.chainTxId;
        succeeded = result.status === 'succeeded';
      } catch (error) {
        // `runChainTx` wrote its row before simulating and threw before returning the id.
        chainTxId = latestFailedChainTxId(deps.db, 'fund', deps.programWallet.publicKey());
        deps.chain.log.warn({ cardId: card.id, cause: messageOf(error) }, 'tranche fund_escrow failed');
      }
      if (chainTxId !== null) {
        txIds.push(chainTxId);
        const tx = readChainTx(deps.db, chainTxId);
        if (tx !== null) deps.bus.publish('chain_tx', tx);
      }
      if (succeeded) {
        deps.db
          .prepare('UPDATE program SET budget_funded_stroops = budget_funded_stroops + ? WHERE id = ?')
          .run(amount, program.id);
        remaining -= amount;
      }
      funded.push({
        cardId: card.id,
        deviceHashPrefix: card.device_hash.slice(0, 8),
        amountStroops: String(amount),
        chainTxId,
      });
    }

    const row: DecisionRow = {
      id: newId(),
      agent: 'tranche',
      decision: exhausted ? 'BUDGET_EXHAUSTED' : 'FUNDED',
      inputs_json: JSON.stringify({
        pricePhp: point.price,
        segmentMeanPhp: point.segmentMean,
        thresholdPhp: current.thresholdPhp,
        cpRecent: point.cpRecent,
        mapR: point.mapRunLength,
        budgetBeforeStroops: String(budgetBefore),
      }),
      outputs_json: JSON.stringify({ budgetAfterStroops: String(remaining), funded, skipped }),
      tx_ids_json: JSON.stringify(txIds),
      created_at: now(),
    };
    deps.db
      .prepare(
        `INSERT INTO agent_decisions (id, agent, decision, inputs_json, outputs_json, tx_ids_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(row.id, row.agent, row.decision, row.inputs_json, row.outputs_json, row.tx_ids_json, row.created_at);
    deps.bus.publish('tranche', toAgentDecision(row));
    const updated = getCurrentProgram(deps.db);
    if (updated !== null) deps.bus.publish('budget', updated);
  }

  async function tick(): Promise<void> {
    const current = run;
    if (current === null || current.busy) return;
    current.busy = true;
    try {
      const price = current.series.prices[current.idx];
      if (price === undefined) {
        endRun(current);
        return;
      }
      const point = current.bocpd.push(price);
      current.idx += 1;
      const row: PricePointRow = {
        program_id: current.programId,
        idx: current.idx,
        price_php: price,
        simulated: current.series.simulated ? 1 : 0,
        cp_recent: point.cpRecent,
        map_r: point.mapRunLength,
      };
      deps.db
        .prepare(
          `INSERT INTO price_points (program_id, idx, price_php, simulated, cp_recent, map_r) VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(row.program_id, row.idx, row.price_php, row.simulated, row.cp_recent, row.map_r);
      deps.bus.publish('price', toPricePoint(row));

      const verdict = trancheShouldFire(current.bocpd.points, current.thresholdPhp);
      const firedAt = verdict.at === null ? undefined : current.bocpd.points[verdict.at];
      if (verdict.fire && firedAt !== undefined) {
        // Stop the ticker first: nothing else may run while the funding transactions are in flight.
        current.cancel();
        await fire(current, firedAt);
        endRun(current);
      } else if (current.idx >= current.series.prices.length) {
        endRun(current);
      }
    } catch (error) {
      deps.chain.log.error({ cause: messageOf(error) }, 'tranche tick failed');
      endRun(current);
    } finally {
      current.busy = false;
    }
  }

  return {
    start() {
      const program = getCurrentProgram(deps.db);
      if (program === null) throw new ApiError(404, 'NOT_FOUND', 'no program; run seed-demo.ts');
      if (program.status === 'ending' || program.status === 'ended') {
        throw new ApiError(409, 'INVALID_STATE', `program is ${program.status}`);
      }
      if (run !== null) throw new ApiError(409, 'INVALID_STATE', 'tranche already running');
      if (program.trancheFired) {
        throw new ApiError(409, 'INVALID_STATE', 'tranche already fired; run reset-demo.ts to replay');
      }
      if (BigInt(program.budgetVerifiedStroops) <= 0n) {
        throw new ApiError(409, 'INVALID_STATE', 'no verified budget; run the budget checkout first');
      }
      const prices = priceSeries();
      deps.db.prepare('DELETE FROM price_points WHERE program_id = ?').run(program.id);
      const started: Run = {
        programId: program.id,
        thresholdPhp: program.priceThresholdPhp,
        series: prices,
        // The first 10 points set mu0 and sigma2 only; every point is still scored from point 1 (algorithms.md §6.1).
        bocpd: new Bocpd(undefined, prices.prices.slice(0, 10)),
        idx: 0,
        busy: false,
        cancel: () => undefined,
      };
      run = started;
      started.cancel = schedule(() => {
        void tick();
      }, deps.config.PRICE_TICK_MS);
      return { started: true, points: prices.prices.length, tickMs: deps.config.PRICE_TICK_MS };
    },

    state() {
      const program = getCurrentProgram(deps.db);
      if (program === null) throw new ApiError(404, 'NOT_FOUND', 'no program; run seed-demo.ts');
      const points = deps.db
        .prepare('SELECT * FROM price_points WHERE program_id = ? ORDER BY idx')
        .all<PricePointRow>(program.id)
        .map(toPricePoint);
      const last = points.at(-1);
      return {
        running: run !== null,
        fired: program.trancheFired,
        idx: points.length,
        total: priceSeries().prices.length,
        lastPricePhp: last?.pricePhp ?? null,
        cpRecent: last?.cpRecent ?? null,
        mapR: last?.mapR ?? null,
        thresholdPhp: program.priceThresholdPhp,
        budgetVerifiedStroops: program.budgetVerifiedStroops,
        budgetFundedStroops: program.budgetFundedStroops,
        points,
        funds: readFunds(deps.db),
      };
    },

    tick,

    stop() {
      if (run !== null) endRun(run);
    },
  };
}

/** `TrancheState.funds`, rebuilt from the latest tranche decision so a reload or API restart still shows it. */
function readFunds(db: Db): TrancheState['funds'] {
  const decision = db
    .prepare(`SELECT * FROM agent_decisions WHERE agent = 'tranche' ORDER BY created_at DESC, rowid DESC LIMIT 1`)
    .get<DecisionRow>();
  if (decision === undefined) return [];
  const outputs = toAgentDecision(decision).outputs as { funded?: FundedEntry[]; skipped?: SkippedEntry[] };
  const funded = new Map((outputs.funded ?? []).map((entry) => [entry.cardId, entry]));
  const skipped = new Map((outputs.skipped ?? []).map((entry) => [entry.cardId, entry]));

  const funds: TrancheState['funds'] = [];
  for (const card of db.prepare('SELECT id, beneficiary_id FROM cards ORDER BY created_at, rowid').all<{ id: string; beneficiary_id: string }>()) {
    const fund = funded.get(card.id);
    if (fund !== undefined) {
      const status =
        fund.chainTxId === null
          ? 'failed'
          : (db.prepare('SELECT status FROM chain_txs WHERE id = ?').get<{ status: ChainTxStatus }>(fund.chainTxId)?.status ?? 'failed');
      funds.push({
        cardId: card.id,
        beneficiaryId: card.beneficiary_id,
        amountStroops: fund.amountStroops,
        txId: fund.chainTxId,
        status,
        reason: null,
      });
      continue;
    }
    const skip = skipped.get(card.id);
    if (skip !== undefined) {
      funds.push({
        cardId: card.id,
        beneficiaryId: card.beneficiary_id,
        amountStroops: '0',
        txId: null,
        status: 'skipped',
        reason: skip.reason,
      });
    }
  }
  return funds;
}
