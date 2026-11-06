/**
 * Headless run of the scripted demo through the HTTP API (docs/test-plan.md §3.2, docs/demo-runbook.md §3).
 *
 * On the VM, as the service user, with the API already up (`sudo systemctl status tapat-api`):
 *
 *   sudo -H -u tapat pnpm -C /opt/tapat demo:e2e
 *
 * It reseeds the demo with the same service code `reset-demo.ts` / `seed-demo.ts` run (`--d3-expiry-offset=30`, then
 * waits 35 s so D3's policy has expired), creates the Velo budget checkout and waits up to 5 min for the operator to
 * pay it in Freighter as Budget Office, then drives beats 2-4 and 6 plus the S7 intake and D4 enrollment through
 * `POST`/`GET` on `http://127.0.0.1:${PORT}`. The last steps assert the totals, the chain coverage and the simulated
 * labels straight from the SQLite tables. Every step prints PASS/FAIL and the first failure exits non-zero.
 *
 * Flags: `--base-url=<origin>`, `--d3-expiry-offset=<s>`, `--pre-tranche-wait=<s>`, `--budget-timeout-s=<s>`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Keypair } from '@stellar/stellar-sdk';
import {
  formatPhp,
  type Beneficiary,
  type BudgetCheckoutResponse,
  type BurstResponse,
  type Dashboard,
  type EndProgramResponse,
  type EnrollResponse,
  type HealthResponse,
  type IntakeResponse,
  type ProgramResponse,
  type SettlementResponse,
  type Station,
  type TapResponse,
  type TrancheStartResponse,
  type TrancheState,
} from '@tapat/shared';
import { loadConfig } from '../src/config';
import { openDb, type Db } from '../src/db/index';
import { createChainRuntime } from '../src/runtime';
import { parseSeedArgs, resetDemo, seedDemo } from '../src/services/demo';
import { createSseBus } from '../src/services/sse';
import {
  BEATS_ONLY_DASHBOARD,
  EXPECTED_BUDGET_STROOPS,
  FULL_RUN_DASHBOARD,
  assertNoFailures,
  checkAudit,
  checkDashboard,
  checkEndProgram,
  checkEnrolled,
  checkIntake,
  checkProgramSeeded,
  checkSeededCards,
  checkSettlement,
  checkTap,
  checkTotals,
  checkTranche,
  findD4,
  parseE2eArgs,
  pollUntil,
  runSteps,
  type ChainAudit,
  type E2eStep,
  type MoneyTx,
} from './lib/e2e';
import { REPO_ROOT } from './lib/fixture-file';

/** The runbook's virtual D4 UID (`docs/test-plan.md` §3.2). */
const D4_UID = 'TAPATE2E04';

const log = {
  warn: (obj: object, msg: string): void => console.warn(msg, obj),
  error: (obj: object, msg: string): void => console.error(msg, obj),
};

interface Api {
  get<T>(path: string): Promise<T>;
  postJson<T>(path: string, body?: unknown): Promise<T>;
  postForm<T>(path: string, form: FormData): Promise<T>;
}

/** A thin JSON client: a non-2xx response throws with the server's message, so the step fails with it. */
function createApi(baseUrl: string): Api {
  async function request<T>(method: string, path: string, init?: { headers?: Record<string, string>; body?: RequestInit['body'] }): Promise<T> {
    const response = await fetch(new URL(path, baseUrl), { method, ...init });
    const text = await response.text();
    if (!response.ok) throw new Error(`${method} ${path} -> ${response.status} ${text.slice(0, 400)}`);
    return (text === '' ? null : JSON.parse(text)) as T;
  }
  return {
    get: <T>(path: string) => request<T>('GET', path),
    postJson: <T>(path: string, body?: unknown) =>
      request<T>('POST', path, {
        headers: body === undefined ? {} : { 'content-type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    postForm: <T>(path: string, form: FormData) => request<T>('POST', path, { body: form }),
  };
}

/** Finds the first numeric value under one of `keys`, so an unspecified decision JSON shape still yields its score. */
function numericField(json: string, keys: readonly string[]): number | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  for (const key of keys) {
    const value = (parsed as Record<string, unknown>)[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

/** The table-level audit docs/test-plan.md §3.2 asks for; no endpoint exposes `chain_txs` or `price_points`. */
function readAudit(db: Db, dashboard: Dashboard): ChainAudit {
  return {
    moneyTxs: db
      .prepare(`SELECT kind, status FROM chain_txs WHERE kind IN ('fund','authorize','claim','sweep')`)
      .all<MoneyTx>(),
    authorizedTaps: db
      .prepare(
        `SELECT c.status AS chainTxStatus FROM taps t LEFT JOIN chain_txs c ON c.id = t.chain_tx_id
         WHERE t.status = 'authorized'`,
      )
      .all<{ chainTxStatus: string | null }>(),
    rejectedTaps: db
      .prepare(`SELECT chain_tx_id AS chainTxId FROM taps WHERE status = 'rejected'`)
      .all<{ chainTxId: string | null }>(),
    pricePoints: db.prepare(`SELECT simulated FROM price_points`).all<{ simulated: number }>(),
    burstEdges: db
      .prepare(`SELECT simulated FROM taps WHERE reason_code = 'SIMULATED_EDGE'`)
      .all<{ simulated: number }>(),
    trancheDecisions:
      db.prepare(`SELECT COUNT(*) AS n FROM agent_decisions WHERE agent = 'tranche'`).get<{ n: number }>()?.n ?? 0,
    freezeScores: db
      .prepare(
        `SELECT inputs_json AS inputs, outputs_json AS outputs FROM agent_decisions
         WHERE agent = 'freeze' AND decision = 'FROZEN'`,
      )
      .all<{ inputs: string; outputs: string }>()
      .flatMap((row) => {
        const keys = ['midasScore', 'midas_score', 'score'] as const;
        const score = numericField(row.outputs, keys) ?? numericField(row.inputs, keys);
        return score === null ? [] : [score];
      }),
    midasThreshold: dashboard.midasThreshold,
  };
}

const sleep = (ms: number): Promise<void> =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const config = loadConfig();
const args = parseE2eArgs(process.argv.slice(2), `http://127.0.0.1:${config.PORT}`);
const seedArgs = parseSeedArgs([`--d3-expiry-offset=${args.d3ExpiryOffsetS}`]);
const api = createApi(args.baseUrl);
const db = openDb(config.DATABASE_PATH);
const { chain } = createChainRuntime(config, db, log);

/** Filled in by the steps: the seed instant, the last dashboard, and the health report's gas mode. */
const run = { seededAt: 0, dashboard: null as Dashboard | null, gasMode: 'unknown' };

const s7Steps: E2eStep[] = [
  {
    name: 'beat 5a: POST /api/intake/upload with masterlist.csv',
    run: async () => {
      const csv = readFileSync(resolve(REPO_ROOT, 'fixtures/masterlist/masterlist.csv'));
      const form = new FormData();
      form.append('file', new Blob([new Uint8Array(csv)], { type: 'text/csv' }), 'masterlist.csv');
      const intake = await api.postForm<IntakeResponse>('/api/intake/upload', form);
      assertNoFailures(checkIntake(intake), 'intake');
      console.log(`   summary: ${JSON.stringify(intake.summary)}`);
    },
  },
  {
    name: `beat 5b: POST /api/enroll D4 (${D4_UID} + d4-photo.jpg)`,
    run: async () => {
      const beneficiaries = await api.get<Beneficiary[]>('/api/beneficiaries?status=approved');
      const d4 = findD4(beneficiaries);
      if (d4 === null) throw new Error('no approved "Villanueva, Ana" row — did the intake upload land?');
      if (!existsSync(resolve(REPO_ROOT, 'fixtures/enroll/d4-photo.json'))) {
        throw new Error('fixtures/enroll/d4-photo.json is missing (FIX3) — POST /api/enroll needs the committed sample');
      }
      const form = new FormData();
      form.append('beneficiaryId', d4.id);
      form.append('uid', D4_UID);
      form.append('samplePhoto', 'd4-photo.jpg');
      const enrolled = await api.postForm<EnrollResponse>('/api/enroll', form);
      assertNoFailures(checkEnrolled(enrolled, D4_UID.slice(-4)), 'enroll D4');
      const dashboard = await api.get<Dashboard>('/api/dashboard');
      const card = dashboard.cards.find((candidate) => candidate.beneficiaryId === d4.id);
      if (card === undefined) throw new Error('D4 card is missing from the dashboard');
      if (card.escrowStroops !== '0') {
        throw new Error(`D4 escrowStroops: expected 0 (enrolled after the tranche), got ${card.escrowStroops}`);
      }
      console.log(`   ${enrolled.card.id} active, txs ${enrolled.chainTxIds.join(', ')}; not funded`);
    },
  },
];

const steps: E2eStep[] = [
  {
    name: `seed: reset-demo + seed-demo --d3-expiry-offset=${args.d3ExpiryOffsetS}`,
    run: async () => {
      const wallet = Keypair.fromSecret(config.PROGRAM_WALLET_SECRET);
      const reset = await resetDemo({ db, chain, programWallet: wallet });
      const seed = await seedDemo(
        {
          db,
          chain,
          config,
          enroll: { bus: createSseBus(), programWallet: wallet, config },
        },
        seedArgs,
        readFileSync(resolve(REPO_ROOT, 'fixtures/masterlist/masterlist.csv'), 'utf8'),
      );
      run.seededAt = Date.now();
      for (const card of seed.enrolled) {
        console.log(`   ${card.tag}  ${card.cardId}  …${card.uidLast4}  policy expires ${card.expiresAtS}`);
      }
      console.log(`   program ${seed.program.id} active; revoked ${reset.revoked.length} previous card(s)`);
    },
  },
  {
    name: 'health: GET /api/health',
    run: async () => {
      const health = await api.get<HealthResponse>('/api/health');
      run.gasMode = health.gasMode;
      console.log(
        `   rpc ${health.rpc}, velo ${health.velo}, telegram ${health.telegram}, gas ${health.gasMode}`,
      );
      if (!health.ok) throw new Error(`health.ok is false (rpc ${health.rpc}) — check STELLAR_RPC_URL and the VM's network`);
    },
  },
  {
    name: 'program: GET /api/program',
    run: async () => {
      const { program } = await api.get<ProgramResponse>('/api/program');
      assertNoFailures(checkProgramSeeded(program), 'program');
    },
  },
  {
    name: 'beat 1: GET /api/dashboard shows the four seeded cards',
    run: async () => {
      const dashboard = await api.get<Dashboard>('/api/dashboard');
      assertNoFailures(checkSeededCards(dashboard.cards), 'seeded cards');
      console.log(`   cards: ${dashboard.cards.map((card) => card.deviceHashPrefix).join(', ')}`);
    },
  },
  {
    name: 'beat 2a: POST /api/program/budget-checkout + pay it in Freighter',
    run: async () => {
      const checkout = await api.postJson<BudgetCheckoutResponse>('/api/program/budget-checkout', { amountPhp: 10000 });
      console.log(`   checkout: ${checkout.checkoutUrl}`);
      console.log(
        `   >>> Pay this Velo checkout in Freighter as Budget Office (1,000 XLM). Waiting up to ${args.budgetTimeoutS} s…`,
      );
      const program = await pollUntil(
        async () => {
          const { program } = await api.get<ProgramResponse>('/api/program');
          return program !== null && program.budgetVerifiedStroops !== '0' ? program : null;
        },
        { timeoutMs: args.budgetTimeoutS * 1000, intervalMs: 3000 },
      );
      if (program.budgetVerifiedStroops !== EXPECTED_BUDGET_STROOPS) {
        throw new Error(
          `budgetVerifiedStroops: expected ${EXPECTED_BUDGET_STROOPS}, got ${program.budgetVerifiedStroops}`,
        );
      }
      console.log(`   budget verified: ${program.budgetVerifiedStroops} stroops`);
    },
  },
  {
    name: `d3 window: wait ${args.preTrancheWaitS} s after seed so D3's policy (${args.d3ExpiryOffsetS} s) has expired`,
    run: async () => {
      const remaining = run.seededAt + args.preTrancheWaitS * 1000 - Date.now();
      if (remaining > 0) {
        console.log(`   waiting ${Math.ceil(remaining / 1000)} s (SEED time + ${args.preTrancheWaitS} s)`);
        await sleep(remaining);
      }
    },
  },
  {
    name: 'beat 2b: POST /api/agents/tranche/start funds three escrows',
    run: async () => {
      const start = await api.postJson<TrancheStartResponse>('/api/agents/tranche/start');
      const state = await pollUntil(
        async () => {
          const state = await api.get<TrancheState>('/api/agents/tranche/state');
          return state.fired && !state.running ? state : null;
        },
        { timeoutMs: start.points * start.tickMs + 90_000, intervalMs: 1000 },
      );
      assertNoFailures(checkTranche(state), 'tranche');
      console.log(`   funded ${state.budgetFundedStroops} stroops over ${state.funds.length} cards (D3 skipped)`);
    },
  },
  {
    name: 'beat 3a: tap D1 ₱350 at Station A',
    run: async () => {
      const response = await api.postJson<TapResponse>('/api/taps', {
        stationId: 'A',
        amountPhp: 350,
        uid: seedArgs.uids.D1,
      });
      assertNoFailures(
        checkTap('D1 ₱350', response, {
          status: 'authorized',
          reasonCode: null,
          chainTx: 'set',
          amountPhp: 350,
          balancePhp: 1150,
        }),
        'tap D1',
      );
      console.log(`   tx ${String(response.tap.chainTxId)}: ${response.message}`);
    },
  },
  {
    name: 'beat 3b: tap ₱800 → OVER_CAP with no tx',
    run: async () => {
      const response = await api.postJson<TapResponse>('/api/taps', {
        stationId: 'A',
        amountPhp: 800,
        uid: seedArgs.uids.D1,
      });
      assertNoFailures(
        checkTap('₱800', response, { status: 'rejected', reasonCode: 'OVER_CAP', chainTx: 'null', amountPhp: 800 }),
        'tap ₱800',
      );
      console.log(`   ${response.message}`);
    },
  },
  {
    name: 'beat 3c: tap D3 ₱200 → EXPIRED with no tx',
    run: async () => {
      const response = await api.postJson<TapResponse>('/api/taps', {
        stationId: 'A',
        amountPhp: 200,
        uid: seedArgs.uids.D3,
      });
      assertNoFailures(
        checkTap('D3 ₱200', response, { status: 'rejected', reasonCode: 'EXPIRED', chainTx: 'null', amountPhp: 200 }),
        'tap D3',
      );
      console.log(`   ${response.message}`);
    },
  },
  {
    name: 'beat 4a: two D2 taps of ₱480 at Station B',
    run: async () => {
      for (const [index, amountPhp] of [480, 480].entries()) {
        const response = await api.postJson<TapResponse>('/api/taps', {
          stationId: 'B',
          amountPhp,
          uid: seedArgs.uids.D2,
        });
        assertNoFailures(
          checkTap(`D2 ₱480 #${index + 1}`, response, {
            status: 'authorized',
            reasonCode: null,
            chainTx: 'set',
            amountPhp,
          }),
          `tap D2 #${index + 1}`,
        );
      }
      console.log('   two authorized taps at B; ₱960 pending');
    },
  },
  {
    name: 'beat 4b: POST /api/agents/freeze/burst freezes Station B',
    run: async () => {
      const burst = await api.postJson<BurstResponse>('/api/agents/freeze/burst');
      if (!burst.accepted || burst.edges !== 30) {
        throw new Error(`burst: expected {accepted:true, edges:30}, got ${JSON.stringify(burst)}`);
      }
      const station = await pollUntil(
        async () => {
          const stations = await api.get<Station[]>('/api/stations');
          const b = stations.find((candidate) => candidate.id === 'B');
          return b !== undefined && b.status === 'frozen' ? b : null;
        },
        { timeoutMs: 60_000, intervalMs: 1000 },
      );
      if (station.frozenReason === null) throw new Error('B.frozenReason: expected the Freeze Agent reason, got null');
      console.log(`   B frozen: ${station.frozenReason}`);
    },
  },
  {
    name: 'beat 4c: POST /api/settlement/run claims A and holds B',
    run: async () => {
      const settlement = await api.postJson<SettlementResponse>('/api/settlement/run');
      assertNoFailures(checkSettlement(settlement), 'settlement');
      const a = settlement.stations.find((station) => station.stationId === 'A');
      console.log(`   A claimed ₱350 (tx ${String(a?.chainTxId)}); B held ₱960 with no tx`);
    },
  },
  ...(args.skipS7 ? [] : s7Steps),
  {
    name: 'beat 6: POST /api/program/end sweeps every card',
    run: async () => {
      const end = await api.postJson<EndProgramResponse>('/api/program/end');
      assertNoFailures(checkEndProgram(end, { expectD4: !args.skipS7 }), 'end program');
      console.log(`   returned ${formatPhp(end.totalReturnedStroops)} across ${end.cards.length} cards`);
    },
  },
  {
    name: 'totals: GET /api/dashboard five tiles + invariant',
    run: async () => {
      const dashboard = await api.get<Dashboard>('/api/dashboard');
      assertNoFailures(checkDashboard(dashboard, args.skipS7 ? BEATS_ONLY_DASHBOARD : FULL_RUN_DASHBOARD), 'dashboard');
      assertNoFailures(checkTotals(dashboard), 'totals');
      run.dashboard = dashboard;
      console.log(
        `   funded ${formatPhp(dashboard.fundedStroops)} / spent ${formatPhp(dashboard.spentStroops)} / ` +
          `held ${formatPhp(dashboard.heldStroops)} / pending ${formatPhp(dashboard.pendingStroops)} / ` +
          `returned ${formatPhp(dashboard.returnedStroops)} — invariant ${dashboard.invariantOk ? 'OK' : 'BROKEN'}`,
      );
    },
  },
  {
    name: 'audit: chain coverage, price labels, burst labels, freeze decision',
    run: () => {
      const dashboard = run.dashboard;
      if (dashboard === null) throw new Error('no dashboard snapshot for the audit');
      assertNoFailures(checkAudit(readAudit(db, dashboard)), 'audit');
      console.log(`   money txs succeeded: 3 fund + 3 authorize + 1 claim + 3 sweep; 45 simulated prices; 30 simulated edges`);
    },
  },
];

async function main(): Promise<void> {
  console.log(`demo:e2e → ${args.baseUrl} (db ${config.DATABASE_PATH})`);
  if (args.skipS7) console.warn('--skip-s7: beats 1-4 and 6 only; the S7 intake upload + D4 enrollment steps are skipped.');
  try {
    const outcome = await runSteps(steps, {
      pass: (name) => console.log(`PASS ${name}`),
      fail: (name, message) => console.error(`FAIL ${name}: ${message}`),
    });
    if (!outcome.ok) {
      console.error(`\n${outcome.passed.length}/${steps.length} steps passed; stopped at "${outcome.failedStep ?? '?'}".`);
      process.exitCode = 1;
      return;
    }
    console.log(`\ndemo:e2e green: ${outcome.passed.length} steps, gas mode ${run.gasMode}.`);
  } finally {
    db.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
