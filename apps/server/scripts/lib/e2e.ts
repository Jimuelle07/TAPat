// Pure assertions + the fail-fast step runner behind `pnpm demo:e2e` (docs/test-plan.md §3.2). No I/O here, so the
// handler stays thin and every expectation below is unit-tested against fabricated API responses.
import {
  phpToStroops,
  type Beneficiary,
  type CardSummary,
  type Dashboard,
  type EnrollResponse,
  type EndProgramResponse,
  type IntakeResponse,
  type Program,
  type SettlementResponse,
  type TapReasonCode,
  type TapResponse,
  type TapStatus,
  type TrancheState,
} from '@tapat/shared';

/** `pnpm demo:e2e` arguments (docs/test-plan.md §3.2). */
export interface E2eArgs {
  /** API origin; the server listens on `127.0.0.1:${PORT}`, never on a LAN interface. */
  baseUrl: string;
  /** D3's policy lifetime from seed time: must be > 0 and short enough to expire before beat 2. */
  d3ExpiryOffsetS: number;
  /** Seconds after seed before the price feed starts, so D3 is expired for the tranche and beat 3. */
  preTrancheWaitS: number;
  /** How long the operator has to pay the Velo checkout in Freighter. */
  budgetTimeoutS: number;
  /** S5 gate: run beats 1-4 and 6 only, without the S7 intake upload and D4 enrollment. */
  skipS7: boolean;
}

const DEFAULTS = { d3ExpiryOffsetS: 30, preTrancheWaitS: 35, budgetTimeoutS: 300, skipS7: false } as const;

/**
 * Parses `--base-url=<origin>`, `--d3-expiry-offset=<s>`, `--pre-tranche-wait=<s>`, `--budget-timeout-s=<s>` and the
 * bare `--skip-s7`. Anything else throws, so a typo never silently runs the defaults.
 */
export function parseE2eArgs(argv: readonly string[], defaultBaseUrl: string): E2eArgs {
  const args: E2eArgs = { baseUrl: defaultBaseUrl, ...DEFAULTS };
  for (const arg of argv) {
    const match = /^--([a-z0-9-]+)(?:=(.*))?$/i.exec(arg);
    if (match === null) throw new Error(`unrecognised argument "${arg}"; flags look like --name=value`);
    const name = (match[1] as string).toLowerCase();
    const value = match[2];
    if (name === 'skip-s7') {
      if (value !== undefined && value !== 'true' && value !== 'false') {
        throw new Error(`--skip-s7 takes no value, got "${value}"`);
      }
      args.skipS7 = value !== 'false';
      continue;
    }
    if (value === undefined) throw new Error(`--${name} needs a value, like --${name}=...`);
    if (name === 'base-url') {
      let url: URL | null = null;
      try {
        url = new URL(value);
      } catch {
        url = null;
      }
      if (url === null || (url.protocol !== 'http:' && url.protocol !== 'https:')) {
        throw new Error(`--base-url must be an absolute http(s) URL, got "${value}"`);
      }
      args.baseUrl = url.origin;
      continue;
    }
    if (name !== 'd3-expiry-offset' && name !== 'pre-tranche-wait' && name !== 'budget-timeout-s') {
      throw new Error(`unknown flag --${name}`);
    }
    const seconds = /^\d+$/.test(value) ? Number(value) : Number.NaN;
    if (!Number.isInteger(seconds) || seconds <= 0) {
      throw new Error(`--${name} must be a whole number of seconds > 0, got "${value}"`);
    }
    if (name === 'd3-expiry-offset') args.d3ExpiryOffsetS = seconds;
    else if (name === 'pre-tranche-wait') args.preTrancheWaitS = seconds;
    else args.budgetTimeoutS = seconds;
  }
  return args;
}

/** docs/demo-runbook.md §3 "Expected totals and the arithmetic", as exact stroops at PHP_PER_XLM = 10. */
export const RUNBOOK_TOTALS = {
  funded: String(phpToStroops(4500)),
  spent: String(phpToStroops(350)),
  held: String(phpToStroops(960)),
  pending: String(phpToStroops(0)),
  escrowRemaining: String(phpToStroops(0)),
  returned: String(phpToStroops(3190)),
} as const;

/** docs/test-plan.md §3.2 "Budget verified": 1,000 XLM = ₱10,000 at the demo rate. */
export const EXPECTED_BUDGET_STROOPS = String(phpToStroops(10000));

/** docs/test-plan.md §3.2 "Intake": disjoint buckets that always sum to `total`. The committed calibration fixture
 * clamps λ_lo == λ_hi, so the two Santos variants are approved rather than uncertain (6 approved, 0 uncertain).
 */
export const EXPECTED_INTAKE_SUMMARY = { total: 12, approved: 6, rejected: 2, uncertain: 0, enrolled: 4 } as const;

const SUMMARY_KEYS = Object.keys(EXPECTED_INTAKE_SUMMARY).sort();

/** Deep equality for the intake summary: same keys, same numbers, no extras. */
export function summaryMatches(summary: Readonly<Record<string, unknown>>): boolean {
  return (
    Object.keys(summary).sort().join(',') === SUMMARY_KEYS.join(',') &&
    SUMMARY_KEYS.every(
      (key) => summary[key] === EXPECTED_INTAKE_SUMMARY[key as keyof typeof EXPECTED_INTAKE_SUMMARY],
    )
  );
}

/** Builds a failure list entry only when the values differ. */
function expectEqual(failures: string[], label: string, actual: unknown, expected: unknown): void {
  if (actual !== expected) failures.push(`${label}: expected ${String(expected)}, got ${String(actual)}`);
}

/** Throws one step's failure list as a single `Error`; a passing step (no failures) returns. */
export function assertNoFailures(failures: readonly string[], step: string): void {
  if (failures.length === 0) return;
  throw new Error(`${step} failed:\n  - ${failures.join('\n  - ')}`);
}

/** One rung of the run; `run` throws on the first failed expectation. */
export interface E2eStep {
  name: string;
  run: () => Promise<void> | void;
}

export interface StepReporter {
  pass(name: string): void;
  fail(name: string, message: string): void;
}

export interface StepOutcome {
  ok: boolean;
  passed: string[];
  failedStep: string | null;
}

/** Runs the steps in order and stops at the first throw: no later step runs after a failure. */
export async function runSteps(steps: readonly E2eStep[], report: StepReporter): Promise<StepOutcome> {
  const passed: string[] = [];
  for (const step of steps) {
    try {
      await step.run();
    } catch (error) {
      report.fail(step.name, error instanceof Error ? error.message : String(error));
      return { ok: false, passed, failedStep: step.name };
    }
    report.pass(step.name);
    passed.push(step.name);
  }
  return { ok: true, passed, failedStep: null };
}

export interface PollOptions {
  timeoutMs: number;
  intervalMs: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Polls `read` until it answers a non-null value, or throws when the deadline passes. Errors from `read` propagate:
 * an API 5xx should fail the step at once rather than be retried for minutes.
 */
export async function pollUntil<T>(
  read: () => Promise<T | null | undefined>,
  options: PollOptions,
): Promise<T> {
  const now = options.now ?? Date.now;
  const sleep =
    options.sleep ??
    ((ms: number) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
      }));
  const deadline = now() + options.timeoutMs;
  for (;;) {
    const value = await read();
    if (value !== null && value !== undefined) return value;
    if (now() >= deadline) throw new Error(`timed out after ${Math.round(options.timeoutMs / 1000)} s`);
    await sleep(options.intervalMs);
  }
}

/** The D4 masterlist record (`Villanueva, Ana, Reyes`) as the intake upload writes it. */
export const D4_RECORD = { lastName: 'Villanueva', firstName: 'Ana' } as const;

/** Finds D4 among the approved beneficiaries; the runbook's `/enroll` picks that record. */
export function findD4(beneficiaries: readonly Beneficiary[]): Beneficiary | null {
  const sameName = (value: string, expected: string) => value.trim().toLowerCase() === expected.toLowerCase();
  return (
    beneficiaries.find((row) => sameName(row.lastName, D4_RECORD.lastName) && sameName(row.firstName, D4_RECORD.firstName)) ??
    null
  );
}

/** Four seeded cards, active, in the seed's enrollment order (D3 already carries its 30 s policy). */
const SEEDED_BENEFICIARIES = ['ben_D1', 'ben_D2', 'ben_D3', 'ben_D5'] as const;

export function checkSeededCards(cards: readonly CardSummary[]): string[] {
  const failures: string[] = [];
  expectEqual(failures, 'cards', cards.length, SEEDED_BENEFICIARIES.length);
  const seen = cards.map((card) => card.beneficiaryId).sort();
  expectEqual(failures, 'card beneficiaries', seen.join(','), [...SEEDED_BENEFICIARIES].sort().join(','));
  for (const card of cards) {
    if (card.status !== 'active') failures.push(`${card.id}: expected status active, got ${card.status}`);
  }
  return failures;
}

/** A freshly seeded program: active, demo defaults, no budget credited and no tranche fired yet. */
export function checkProgramSeeded(program: Program | null): string[] {
  if (program === null) return ['program is null — seed-demo.ts did not leave a program'];
  const failures: string[] = [];
  expectEqual(failures, 'program.status', program.status, 'active');
  expectEqual(failures, 'program.perTapCapStroops', program.perTapCapStroops, String(phpToStroops(500)));
  expectEqual(failures, 'program.trancheStroops', program.trancheStroops, String(phpToStroops(1500)));
  expectEqual(failures, 'program.budgetVerifiedStroops', program.budgetVerifiedStroops, '0');
  expectEqual(failures, 'program.budgetFundedStroops', program.budgetFundedStroops, '0');
  expectEqual(failures, 'program.trancheFired', program.trancheFired, false);
  return failures;
}

/** The tranche stops the replay at the fire point, so the last point the state carries is the changepoint (1-based):
 * `tranche.test.ts` pins the 0-based BOCPD index into `[33, 36]`, i.e. `idx` into `[34, 37]`. */
export const TRANCHE_FIRE_IDX = { min: 34, max: 37 } as const;

/** Beat 2: three escrows funded, D3 skipped because its 30 s policy had expired. */
export function checkTranche(state: TrancheState): string[] {
  const failures: string[] = [];
  const tranche = String(phpToStroops(1500));
  expectEqual(failures, 'tranche.running', state.running, false);
  expectEqual(failures, 'tranche.fired', state.fired, true);
  expectEqual(failures, 'tranche.total', state.total, 45);
  // `tick()` cancels → fires → ends the run, so the series is short: the points up to the changepoint, never all 45.
  if (!(state.idx > 0 && state.idx <= state.total)) {
    failures.push(`tranche.idx: expected 1..${state.total}, got ${state.idx}`);
  } else if (state.idx < TRANCHE_FIRE_IDX.min || state.idx > TRANCHE_FIRE_IDX.max) {
    failures.push(
      `tranche.idx: expected the fire point ${TRANCHE_FIRE_IDX.min}..${TRANCHE_FIRE_IDX.max}, got ${state.idx}`,
    );
  }
  expectEqual(failures, 'tranche.points.length', state.points.length, state.idx);
  const lastPoint = state.points.at(-1);
  if (lastPoint !== undefined) expectEqual(failures, 'tranche.points[last].idx', lastPoint.idx, state.idx);
  expectEqual(failures, 'tranche.budgetFundedStroops', state.budgetFundedStroops, RUNBOOK_TOTALS.funded);
  expectEqual(failures, 'tranche.funds.length', state.funds.length, 4);
  const byCard = new Map(state.funds.map((fund) => [fund.cardId, fund]));
  for (const cardId of ['card_D1', 'card_D2', 'card_D5']) {
    const fund = byCard.get(cardId);
    if (fund === undefined) {
      failures.push(`${cardId}: no funding row`);
      continue;
    }
    expectEqual(failures, `${cardId}.status`, fund.status, 'succeeded');
    expectEqual(failures, `${cardId}.amountStroops`, fund.amountStroops, tranche);
    if (fund.txId === null) failures.push(`${cardId}: expected a chain tx id, got null`);
  }
  const d3 = byCard.get('card_D3');
  if (d3 === undefined) failures.push('card_D3: no funding row (expected a skipped row)');
  else {
    expectEqual(failures, 'card_D3.status', d3.status, 'skipped');
    expectEqual(failures, 'card_D3.reason', d3.reason, 'EXPIRED');
    expectEqual(failures, 'card_D3.amountStroops', d3.amountStroops, '0');
    expectEqual(failures, 'card_D3.txId', d3.txId, null);
  }
  return failures;
}

export interface TapExpectation {
  status: TapStatus;
  reasonCode: TapReasonCode | null;
  /** A money tap carries a `chainTxId`; a declined one must not have spent a nonce. */
  chainTx: 'set' | 'null';
  amountPhp: number;
  /** Only for an authorized tap: the escrow balance the tap response reports. */
  balancePhp?: number;
}

/** One `POST /api/taps` outcome: authorized with a tx, or declined with a reason and no tx. */
export function checkTap(label: string, response: TapResponse, expected: TapExpectation): string[] {
  const failures: string[] = [];
  const tap = response.tap;
  expectEqual(failures, `${label}.tap.status`, tap.status, expected.status);
  expectEqual(failures, `${label}.tap.reasonCode`, tap.reasonCode, expected.reasonCode);
  expectEqual(failures, `${label}.tap.amountStroops`, tap.amountStroops, String(phpToStroops(expected.amountPhp)));
  if (expected.chainTx === 'set' && tap.chainTxId === null) failures.push(`${label}.tap.chainTxId: expected a tx id, got null`);
  if (expected.chainTx === 'null' && tap.chainTxId !== null) {
    failures.push(`${label}.tap.chainTxId: expected null, got ${tap.chainTxId}`);
  }
  if (expected.balancePhp !== undefined) {
    expectEqual(failures, `${label}.balanceStroops`, response.balanceStroops, String(phpToStroops(expected.balancePhp)));
  }
  return failures;
}

/** Beat 5a: the CSV branch's summary, its disjoint buckets and the two hard-rule rejections. */
export function checkIntake(response: IntakeResponse): string[] {
  const failures: string[] = [];
  if (!summaryMatches({ ...response.summary })) {
    failures.push(
      `summary: expected ${JSON.stringify(EXPECTED_INTAKE_SUMMARY)}, got ${JSON.stringify(response.summary)}`,
    );
  }
  const rows = response.rows;
  const summary = response.summary;
  expectEqual(failures, 'rows.length', rows.length, summary.total);
  const count = (status: Beneficiary['status']) => rows.filter((row) => row.status === status).length;
  expectEqual(failures, 'approved rows', count('approved'), summary.approved);
  expectEqual(failures, 'rejected rows', count('rejected'), summary.rejected);
  expectEqual(failures, 'enrolled rows', count('enrolled'), summary.enrolled);
  const uncertain = rows.filter((row) => row.status === 'uncertain' || row.status === 'evidence_requested');
  expectEqual(failures, 'uncertain/evidence_requested rows', uncertain.length, summary.uncertain);
  expectEqual(
    failures,
    'UNDERAGE rows',
    rows.filter((row) => row.ruleCode === 'UNDERAGE').length,
    1,
  );
  const ghost = rows.filter((row) => row.status === 'rejected' && row.ruleCode !== 'UNDERAGE');
  expectEqual(failures, 'ghost rows (rejected, not UNDERAGE)', ghost.length, 1);
  for (const row of uncertain) {
    if (typeof row.telegramDeepLink !== 'string' || row.telegramDeepLink.length === 0) {
      failures.push(`${row.id}: uncertain row has no telegramDeepLink`);
    }
  }
  return failures;
}

/** Beat 5b: D4 active on chain, precomputed photo matched, never funded (it enrolls after the tranche). */
export function checkEnrolled(response: EnrollResponse, uidLast4: string): string[] {
  const failures: string[] = [];
  expectEqual(failures, 'card.status', response.card.status, 'active');
  expectEqual(failures, 'card.uidLast4', response.card.uidLast4, uidLast4);
  expectEqual(failures, 'beneficiary.status', response.beneficiary.status, 'enrolled');
  expectEqual(failures, 'photoCheck.source', response.photoCheck.source, 'precomputed');
  expectEqual(failures, 'photoCheck.matched', response.photoCheck.matched, true);
  expectEqual(failures, 'chainTxIds.length', response.chainTxIds.length, 2);
  if (!/^[0-9a-f]{8}$/.test(response.deviceHashPrefix)) {
    failures.push(`deviceHashPrefix: expected 8 hex chars, got ${response.deviceHashPrefix}`);
  }
  return failures;
}

/** Beat 4c: A claimed its ₱350; B's ₱960 is held because the station is frozen (no tx). */
export function checkSettlement(response: SettlementResponse): string[] {
  const failures: string[] = [];
  const byStation = new Map(response.stations.map((station) => [station.stationId, station]));
  const a = byStation.get('A');
  if (a === undefined) failures.push('station A: missing from the settlement response');
  else {
    expectEqual(failures, 'A.action', a.action, 'claimed');
    // A claimed row reports the amount it claimed, not the residual: `settlement.ts` pushes `pendingStroops` as it
    // was before the claim, which is D1's ₱350 tap — the runbook's "spent" tile after settlement.
    expectEqual(failures, 'A.pendingStroops', a.pendingStroops, RUNBOOK_TOTALS.spent);
    if (a.chainTxId === null) failures.push('A.chainTxId: expected a claim tx id, got null');
  }
  const b = byStation.get('B');
  if (b === undefined) failures.push('station B: missing from the settlement response');
  else {
    expectEqual(failures, 'B.action', b.action, 'held');
    expectEqual(failures, 'B.pendingStroops', b.pendingStroops, RUNBOOK_TOTALS.held);
    expectEqual(failures, 'B.chainTxId', b.chainTxId, null);
  }
  return failures;
}

/** Beat 6: every card swept, ₱3,190 returned, D3/D4 empty (D3's policy expired, D4 enrolled after the tranche). */
export function checkEndProgram(response: EndProgramResponse, options: { expectD4: boolean }): string[] {
  const failures: string[] = [];
  expectEqual(failures, 'program.status', response.program.status, 'ended');
  expectEqual(failures, 'cards.length', response.cards.length, options.expectD4 ? 5 : 4);
  expectEqual(failures, 'totalReturnedStroops', response.totalReturnedStroops, RUNBOOK_TOTALS.returned);
  const byCard = new Map(response.cards.map((card) => [card.cardId, card]));
  const expectedReturned: Record<string, string> = {
    card_D1: String(phpToStroops(1150)),
    card_D2: String(phpToStroops(540)),
    card_D5: String(phpToStroops(1500)),
  };
  for (const [cardId, amount] of Object.entries(expectedReturned)) {
    const card = byCard.get(cardId);
    if (card === undefined) {
      failures.push(`${cardId}: missing from the end response`);
      continue;
    }
    expectEqual(failures, `${cardId}.status`, card.status, 'swept');
    expectEqual(failures, `${cardId}.returnedStroops`, card.returnedStroops, amount);
    if (card.sweepTxId === null) failures.push(`${cardId}.sweepTxId: expected a sweep tx id, got null`);
  }
  const d3 = byCard.get('card_D3');
  if (d3 === undefined) failures.push('card_D3: missing from the end response');
  else {
    expectEqual(failures, 'card_D3.returnedStroops', d3.returnedStroops, '0');
    expectEqual(failures, 'card_D3.sweepTxId', d3.sweepTxId, null);
    expectEqual(failures, 'card_D3.revokeTxId', d3.revokeTxId, null);
  }
  if (options.expectD4) {
    const d4 = byCard.get('card_D4');
    if (d4 === undefined) failures.push('card_D4: missing from the end response');
    else {
      expectEqual(failures, 'card_D4.returnedStroops', d4.returnedStroops, '0');
      expectEqual(failures, 'card_D4.sweepTxId', d4.sweepTxId, null);
      // D4's policy is still live at end time, so the card agent is revoked even with an empty escrow.
      if (d4.revokeTxId === null) failures.push('card_D4.revokeTxId: expected a revoke_agent tx id, got null');
    }
  }
  return failures;
}

/** The two demo widths: the full run ends with D4 enrolled; the S5 gate (`--skip-s7`) stops before the intake. */
export interface DashboardExpectation {
  cards: number;
  beneficiaries: number;
  approved: number;
  uncertain: number;
  enrolled: number;
}

/** `pnpm demo:e2e` (docs/test-plan.md §3.2 "Dashboard"). */
export const FULL_RUN_DASHBOARD: DashboardExpectation = {
  cards: 5,
  beneficiaries: 12,
  approved: 5,
  uncertain: 0,
  enrolled: 5,
};

/** `pnpm demo:e2e --skip-s7`: the seeded cast only — no intake rows, so no approved beneficiary and four cards. */
export const BEATS_ONLY_DASHBOARD: DashboardExpectation = {
  cards: 4,
  beneficiaries: 4,
  approved: 0,
  uncertain: 0,
  enrolled: 4,
};

/** docs/test-plan.md §3.2 "Dashboard": the cards, the disjoint counts, a verified budget and a MIDAS line. */
export function checkDashboard(dashboard: Dashboard, expected: DashboardExpectation): string[] {
  const failures: string[] = [];
  expectEqual(failures, 'program.status', dashboard.program.status, 'ended');
  expectEqual(failures, 'counts.beneficiaries', dashboard.counts.beneficiaries, expected.beneficiaries);
  expectEqual(failures, 'counts.approved', dashboard.counts.approved, expected.approved);
  expectEqual(failures, 'counts.uncertain', dashboard.counts.uncertain, expected.uncertain);
  expectEqual(failures, 'counts.enrolled', dashboard.counts.enrolled, expected.enrolled);
  expectEqual(failures, 'counts.cardsActive', dashboard.counts.cardsActive, 0);
  expectEqual(failures, 'cards.length', dashboard.cards.length, expected.cards);
  for (const card of dashboard.cards) {
    if (!/^[0-9a-f]{8}$/.test(card.deviceHashPrefix)) {
      failures.push(`${card.id}.deviceHashPrefix: expected 8 hex chars, got ${card.deviceHashPrefix}`);
    }
    if ('deviceHash' in card) failures.push(`${card.id}: the dashboard must never carry deviceHash`);
  }
  expectEqual(failures, 'budget.state', dashboard.budget.state, 'verified');
  expectEqual(failures, 'budget.verifiedStroops', dashboard.budget.verifiedStroops, EXPECTED_BUDGET_STROOPS);
  if (typeof dashboard.midasThreshold !== 'number' || !Number.isFinite(dashboard.midasThreshold)) {
    failures.push(`midasThreshold: expected a number, got ${String(dashboard.midasThreshold)}`);
  }
  const stationA = dashboard.stations.find((station) => station.id === 'A');
  const stationB = dashboard.stations.find((station) => station.id === 'B');
  if (stationA === undefined) failures.push('station A: missing from the dashboard');
  else expectEqual(failures, 'A.status', stationA.status, 'active');
  if (stationB === undefined) failures.push('station B: missing from the dashboard');
  else {
    expectEqual(failures, 'B.status', stationB.status, 'frozen');
    expectEqual(failures, 'B.pendingStroops', stationB.pendingStroops, RUNBOOK_TOTALS.held);
    if (stationB.frozenReason === null) failures.push('B.frozenReason: expected the Freeze Agent reason, got null');
  }
  return failures;
}

/** docs/demo-runbook.md §3 totals + the invariant line, all in exact stroops. */
export function checkTotals(
  dashboard: Pick<
    Dashboard,
    'fundedStroops' | 'spentStroops' | 'heldStroops' | 'pendingStroops' | 'escrowRemainingStroops' | 'returnedStroops' | 'invariantOk'
  >,
): string[] {
  const failures: string[] = [];
  expectEqual(failures, 'fundedStroops', dashboard.fundedStroops, RUNBOOK_TOTALS.funded);
  expectEqual(failures, 'spentStroops', dashboard.spentStroops, RUNBOOK_TOTALS.spent);
  expectEqual(failures, 'heldStroops', dashboard.heldStroops, RUNBOOK_TOTALS.held);
  expectEqual(failures, 'pendingStroops', dashboard.pendingStroops, RUNBOOK_TOTALS.pending);
  expectEqual(failures, 'escrowRemainingStroops', dashboard.escrowRemainingStroops, RUNBOOK_TOTALS.escrowRemaining);
  expectEqual(failures, 'returnedStroops', dashboard.returnedStroops, RUNBOOK_TOTALS.returned);
  expectEqual(failures, 'invariantOk', dashboard.invariantOk, true);
  const sum =
    BigInt(dashboard.spentStroops) +
    BigInt(dashboard.heldStroops) +
    BigInt(dashboard.pendingStroops) +
    BigInt(dashboard.escrowRemainingStroops) +
    BigInt(dashboard.returnedStroops);
  if (sum !== BigInt(dashboard.fundedStroops)) {
    failures.push(`invariant arithmetic: funded ${dashboard.fundedStroops} !== ${String(sum)}`);
  }
  return failures;
}

/** One `chain_txs` row the demo's money must point at. */
export interface MoneyTx {
  kind: string;
  status: string;
}

/** The table-level assertions from docs/test-plan.md §3.2 that no endpoint exposes. */
export interface ChainAudit {
  /** `chain_txs` rows with kind `fund`, `authorize`, `claim` or `sweep`. */
  moneyTxs: readonly MoneyTx[];
  /** Every `taps` row with `status='authorized'`, joined to its chain tx status. */
  authorizedTaps: ReadonlyArray<{ chainTxStatus: string | null }>;
  /** Every `taps` row with `status='rejected'`, with its `chain_tx_id`. */
  rejectedTaps: ReadonlyArray<{ chainTxId: string | null }>;
  /** Every `price_points` row for the program. */
  pricePoints: ReadonlyArray<{ simulated: number }>;
  /** The tranche's fired `idx` from `GET /api/agents/tranche/state`: the replay stops at the changepoint, so the
   * table holds exactly that many rows — never the fixture's full 45. */
  trancheIdx: number;
  /** Every burst tap (`reason_code='SIMULATED_EDGE'`). */
  burstEdges: ReadonlyArray<{ simulated: number }>;
  /** `agent_decisions` rows with `agent='tranche'`. */
  trancheDecisions: number;
  /** Numeric MIDAS score of each `freeze`/`FROZEN` decision. */
  freezeScores: readonly number[];
  /** `GET /api/dashboard.midasThreshold`, the line the score had to cross. */
  midasThreshold: number | null;
}

const MONEY_KIND_COUNTS: Readonly<Record<string, number>> = { fund: 3, authorize: 3, claim: 1, sweep: 3 };

/** Chain coverage, price labels and the freeze decision — the last three test-plan assertions. */
export function checkAudit(audit: ChainAudit): string[] {
  const failures: string[] = [];
  for (const tx of audit.moneyTxs) {
    if (tx.status !== 'succeeded') failures.push(`chain_txs ${tx.kind}: expected succeeded, got ${tx.status}`);
  }
  for (const [kind, count] of Object.entries(MONEY_KIND_COUNTS)) {
    const actual = audit.moneyTxs.filter((tx) => tx.kind === kind).length;
    expectEqual(failures, `chain_txs ${kind} count`, actual, count);
  }
  for (const [index, tap] of audit.authorizedTaps.entries()) {
    if (tap.chainTxStatus !== 'succeeded') {
      failures.push(`authorized tap #${index + 1}: chain tx status ${String(tap.chainTxStatus)}, expected succeeded`);
    }
  }
  for (const [index, tap] of audit.rejectedTaps.entries()) {
    if (tap.chainTxId !== null) failures.push(`rejected tap #${index + 1}: chain_tx_id must be NULL, got ${tap.chainTxId}`);
  }
  expectEqual(failures, 'price_points', audit.pricePoints.length, audit.trancheIdx);
  const notSimulated = [...audit.pricePoints, ...audit.burstEdges].filter((row) => row.simulated !== 1).length;
  expectEqual(failures, 'rows with simulated != 1 (price points + burst edges)', notSimulated, 0);
  expectEqual(failures, 'burst edges', audit.burstEdges.length, 30);
  expectEqual(failures, 'agent_decisions with agent = tranche', audit.trancheDecisions, 1);
  if (audit.midasThreshold === null) failures.push('midasThreshold: expected a number, got null');
  if (audit.freezeScores.length === 0) failures.push('freeze/FROZEN decision: expected at least one row, got none');
  else if (audit.midasThreshold !== null && Math.max(...audit.freezeScores) < audit.midasThreshold) {
    failures.push(
      `freeze midas score: expected >= ${audit.midasThreshold}, got ${Math.max(...audit.freezeScores)}`,
    );
  }
  return failures;
}
