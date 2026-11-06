// Unit tests for the pure side of `pnpm demo:e2e` (docs/test-plan.md §3.2). No network, no database, no config.
import { describe, expect, it } from 'vitest';
import type {
  Beneficiary,
  CardSummary,
  Dashboard,
  EndProgramResponse,
  IntakeResponse,
  PricePoint,
  Program,
  SettlementResponse,
  Station,
  TapResponse,
  TrancheState,
} from '@tapat/shared';
import {
  BEATS_ONLY_DASHBOARD,
  EXPECTED_BUDGET_STROOPS,
  EXPECTED_INTAKE_SUMMARY,
  FULL_RUN_DASHBOARD,
  RUNBOOK_TOTALS,
  TRANCHE_FIRE_IDX,
  checkAudit,
  checkDashboard,
  checkEndProgram,
  checkIntake,
  checkSettlement,
  checkTap,
  checkTotals,
  checkTranche,
  findD4,
  parseE2eArgs,
  runSteps,
  summaryMatches,
  type ChainAudit,
  type E2eStep,
} from './e2e';

const TOTALS = {
  fundedStroops: RUNBOOK_TOTALS.funded,
  spentStroops: RUNBOOK_TOTALS.spent,
  heldStroops: RUNBOOK_TOTALS.held,
  pendingStroops: RUNBOOK_TOTALS.pending,
  escrowRemainingStroops: RUNBOOK_TOTALS.escrowRemaining,
  returnedStroops: RUNBOOK_TOTALS.returned,
  invariantOk: true,
} as const;

describe('runbook totals', () => {
  it('passes on the runbook numbers and their sum', () => {
    expect(RUNBOOK_TOTALS).toEqual({
      funded: '4500000000',
      spent: '350000000',
      held: '960000000',
      pending: '0',
      escrowRemaining: '0',
      returned: '3190000000',
    });
    expect(checkTotals(TOTALS)).toEqual([]);
  });

  it('names every wrong tile', () => {
    const failures = checkTotals({ ...TOTALS, spentStroops: '0', returnedStroops: '3000000000' });
    expect(failures.some((failure) => failure.startsWith('spentStroops'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('returnedStroops'))).toBe(true);
  });

  it('fails when the five tiles do not add up to funded, even if invariantOk is true', () => {
    const failures = checkTotals({ ...TOTALS, invariantOk: true, escrowRemainingStroops: '500000000' });
    expect(failures.some((failure) => failure.startsWith('invariant arithmetic'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('escrowRemainingStroops'))).toBe(true);
  });

  it('fails when the dashboard says the invariant does not hold', () => {
    expect(checkTotals({ ...TOTALS, invariantOk: false })).toContain('invariantOk: expected true, got false');
  });
});

describe('intake summary', () => {
  it('deep-equals the coordinator-decided buckets', () => {
    expect(EXPECTED_INTAKE_SUMMARY).toEqual({ total: 12, approved: 6, rejected: 2, uncertain: 0, enrolled: 4 });
    expect(summaryMatches({ total: 12, approved: 6, rejected: 2, uncertain: 0, enrolled: 4 })).toBe(true);
    // key order is irrelevant
    expect(summaryMatches({ enrolled: 4, uncertain: 0, rejected: 2, approved: 6, total: 12 })).toBe(true);
  });

  it('rejects a different bucket, an extra key and a missing key', () => {
    expect(summaryMatches({ total: 12, approved: 4, rejected: 2, uncertain: 2, enrolled: 4 })).toBe(false);
    expect(summaryMatches({ total: 12, approved: 6, rejected: 2, uncertain: 0, enrolled: 4, extra: 1 })).toBe(false);
    expect(summaryMatches({ total: 12, approved: 6, rejected: 2, uncertain: 0 })).toBe(false);
  });
});

function beneficiary(overrides: Partial<Beneficiary>): Beneficiary {
  return {
    id: 'ben_x',
    programId: 'prog_x',
    lastName: 'Santos',
    firstName: 'Maria',
    middleName: null,
    suffix: null,
    birthdate: '1980-01-01',
    plate: 'XYZ 7788',
    toda: 'Rotonda TODA',
    barangay: 'Rotonda',
    source: 'csv',
    score: 1,
    status: 'approved',
    ruleCode: null,
    decisionReason: 'genuine',
    linkCode: null,
    telegramLinked: false,
    telegramDeepLink: 'https://t.me/tapat_demo_bot?start=k7m2x9qp',
    createdAt: 0,
    ...overrides,
  };
}

function intakeResponse(rows: Beneficiary[], summary: IntakeResponse['summary'] = { ...EXPECTED_INTAKE_SUMMARY }): IntakeResponse {
  return {
    rows,
    summary,
    calibration: {
      alpha: 0.05,
      beta: 0.02,
      lambdaLo: 0.62,
      lambdaHi: 0.62,
      n: 400,
      wrongfulDenialRate: 0,
      ghostAdmissionRate: 0,
      feasible: false,
    },
  };
}

const INTAKE_ROWS: Beneficiary[] = [
  beneficiary({ id: 'ben_D1', status: 'enrolled' }),
  beneficiary({ id: 'ben_D2', status: 'enrolled' }),
  beneficiary({ id: 'ben_D3', status: 'enrolled' }),
  beneficiary({ id: 'ben_D5', status: 'enrolled' }),
  beneficiary({ id: 'ben_1', lastName: 'Villanueva', firstName: 'Ana' }),
  beneficiary({ id: 'ben_2', lastName: 'Santos', plate: 'XYZ 7788', telegramDeepLink: 'https://t.me/bot?start=x1' }),
  beneficiary({ id: 'ben_3', lastName: 'Mendoza', plate: 'STU 7890' }),
  beneficiary({ id: 'ben_4', lastName: 'Navarro', plate: 'VWX 8901' }),
  beneficiary({ id: 'ben_5', lastName: 'Santos', plate: 'BCD 1357' }),
  beneficiary({ id: 'ben_6', lastName: 'Santos', plate: 'CDE 2468' }),
  beneficiary({ id: 'ben_7', lastName: 'De la Cruz', status: 'rejected', plate: 'ABC 1234' }),
  beneficiary({ id: 'ben_8', lastName: 'Tolentino', status: 'rejected', ruleCode: 'UNDERAGE' }),
];

describe('intake assertions', () => {
  it('passes on the demo upload: 4 enrolled, 6 approved, 1 ghost, 1 underage, no uncertain', () => {
    expect(checkIntake(intakeResponse(INTAKE_ROWS))).toEqual([]);
  });

  it('reports the summary mismatch instead of guessing', () => {
    const failures = checkIntake(
      intakeResponse(INTAKE_ROWS, { ...EXPECTED_INTAKE_SUMMARY, approved: 4, uncertain: 2 }),
    );
    expect(failures.some((failure) => failure.startsWith('summary:'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('approved rows'))).toBe(true);
  });

  it('requires exactly one ghost and one UNDERAGE reject', () => {
    const rows = INTAKE_ROWS.map((row) => (row.id === 'ben_7' ? { ...row, status: 'approved' as const } : row));
    const failures = checkIntake(intakeResponse(rows));
    expect(failures).toContain('ghost rows (rejected, not UNDERAGE): expected 1, got 0');
  });
});

describe('D4 record lookup', () => {
  it('finds Ana Villanueva among the approved rows', () => {
    expect(findD4(INTAKE_ROWS)?.id).toBe('ben_1');
  });

  it('returns null when the intake row is missing', () => {
    expect(findD4(INTAKE_ROWS.filter((row) => row.lastName !== 'Villanueva'))).toBeNull();
  });
});

describe('tap expectation', () => {
  const authorized: TapResponse = {
    tap: {
      id: 'tap_1',
      cardId: 'card_D1',
      cardRef: null,
      stationId: 'A',
      amountStroops: '350000000',
      nonce: '1',
      status: 'authorized',
      reasonCode: null,
      chainTxId: 'ctx_1',
      simulated: false,
      midasScore: 0.1,
      tick: 1,
      createdAt: 0,
    },
    balanceStroops: '1150000000',
    message: 'Paid ₱350.00',
  };
  const declined: TapResponse = {
    tap: { ...authorized.tap, amountStroops: '800000000', status: 'rejected', reasonCode: 'OVER_CAP', chainTxId: null },
    balanceStroops: null,
    message: 'Declined',
  };

  it('accepts an authorized tap with its balance', () => {
    expect(
      checkTap('D1 350', authorized, { status: 'authorized', reasonCode: null, chainTx: 'set', amountPhp: 350, balancePhp: 1150 }),
    ).toEqual([]);
  });

  it('accepts a declined tap with no tx and rejects a tx on it', () => {
    expect(checkTap('800', declined, { status: 'rejected', reasonCode: 'OVER_CAP', chainTx: 'null', amountPhp: 800 })).toEqual(
      [],
    );
    const failures = checkTap('800', authorized, {
      status: 'rejected',
      reasonCode: 'OVER_CAP',
      chainTx: 'null',
      amountPhp: 800,
    });
    expect(failures.some((failure) => failure.includes('status'))).toBe(true);
    expect(failures.some((failure) => failure.includes('chainTxId: expected null'))).toBe(true);
  });
});

function pricePoint(idx: number): PricePoint {
  return { programId: 'prog_test', idx, pricePhp: 60 + idx / 10, simulated: true, cpRecent: 0.9, mapR: 1 };
}

/** Beat 2's state: the replay stopped at the fire point, so `idx` is the changepoint and not the fixture's 45. */
function trancheFixture(idx: number): TrancheState {
  return {
    running: false,
    fired: true,
    idx,
    total: 45,
    lastPricePhp: 60 + idx / 10,
    cpRecent: 0.004,
    mapR: 6,
    thresholdPhp: 65,
    budgetVerifiedStroops: EXPECTED_BUDGET_STROOPS,
    budgetFundedStroops: RUNBOOK_TOTALS.funded,
    points: Array.from({ length: idx }, (_, index) => pricePoint(index + 1)),
    funds: [
      { cardId: 'card_D1', beneficiaryId: 'ben_D1', amountStroops: '1500000000', txId: 'ctx_1', status: 'succeeded', reason: null },
      { cardId: 'card_D2', beneficiaryId: 'ben_D2', amountStroops: '1500000000', txId: 'ctx_2', status: 'succeeded', reason: null },
      { cardId: 'card_D3', beneficiaryId: 'ben_D3', amountStroops: '0', txId: null, status: 'skipped', reason: 'EXPIRED' },
      { cardId: 'card_D5', beneficiaryId: 'ben_D5', amountStroops: '1500000000', txId: 'ctx_3', status: 'succeeded', reason: null },
    ],
  };
}

describe('tranche expectation', () => {
  it('accepts a run that stopped at the fire point instead of replaying all 45 points', () => {
    const fireIdx = TRANCHE_FIRE_IDX.min + 1;
    const state = trancheFixture(fireIdx);
    expect(state.idx).toBeLessThan(state.total);
    expect(checkTranche(state)).toEqual([]);
  });

  it('rejects an idx that replayed the whole series and a points list that disagrees with it', () => {
    const failures = checkTranche({ ...trancheFixture(TRANCHE_FIRE_IDX.min), idx: 45, points: trancheFixture(45).points });
    expect(failures.some((failure) => failure.startsWith('tranche.idx'))).toBe(true);

    const short = checkTranche({ ...trancheFixture(TRANCHE_FIRE_IDX.min), points: trancheFixture(TRANCHE_FIRE_IDX.min - 1).points });
    expect(short).toContain(`tranche.points.length: expected ${TRANCHE_FIRE_IDX.min}, got ${TRANCHE_FIRE_IDX.min - 1}`);
  });

  it('rejects an idx of zero and a fire point outside the changepoint window', () => {
    expect(checkTranche(trancheFixture(0)).some((failure) => failure.startsWith('tranche.idx'))).toBe(true);
    const early = checkTranche(trancheFixture(TRANCHE_FIRE_IDX.min - 1));
    expect(early.some((failure) => failure.includes('expected the fire point'))).toBe(true);
  });
});

describe('settlement expectation', () => {
  const settled: SettlementResponse = {
    stations: [
      {
        stationId: 'A',
        stationName: 'Petron San Roque',
        pendingStroops: RUNBOOK_TOTALS.spent,
        action: 'claimed',
        chainTxId: 'ctx_claim',
        decisionId: 'dec_1',
      },
      {
        stationId: 'B',
        stationName: 'Rotonda Fuels',
        pendingStroops: RUNBOOK_TOTALS.held,
        action: 'held',
        chainTxId: null,
        decisionId: 'dec_2',
      },
    ],
  };

  it('accepts a claimed A that reports the amount it claimed and a held B with no tx', () => {
    expect(settled.stations[0]?.pendingStroops).toBe('350000000');
    expect(checkSettlement(settled)).toEqual([]);
  });

  it('rejects a claimed A whose pendingStroops reads zero and a held B with a tx', () => {
    const failures = checkSettlement({
      stations: [
        { ...(settled.stations[0] as SettlementResponse['stations'][number]), pendingStroops: '0', chainTxId: null },
        { ...(settled.stations[1] as SettlementResponse['stations'][number]), chainTxId: 'ctx_held' },
      ],
    });
    expect(failures).toContain('A.pendingStroops: expected 350000000, got 0');
    expect(failures.some((failure) => failure.startsWith('A.chainTxId'))).toBe(true);
    expect(failures).toContain('B.chainTxId: expected null, got ctx_held');
  });
});

describe('step runner', () => {
  function reporter() {
    const lines: string[] = [];
    return {
      lines,
      pass: (name: string) => lines.push(`PASS ${name}`),
      fail: (name: string, message: string) => lines.push(`FAIL ${name}: ${message}`),
    };
  }

  it('stops at the first failure and does not run the later steps', async () => {
    const ran: string[] = [];
    const steps: E2eStep[] = [
      { name: 'seed', run: () => void ran.push('seed') },
      {
        name: 'budget',
        run: () => {
          ran.push('budget');
          throw new Error('budget not verified');
        },
      },
      { name: 'tranche', run: () => void ran.push('tranche') },
    ];
    const report = reporter();

    const outcome = await runSteps(steps, report);

    expect(outcome).toEqual({ ok: false, passed: ['seed'], failedStep: 'budget' });
    expect(ran).toEqual(['seed', 'budget']);
    expect(report.lines).toEqual(['PASS seed', 'FAIL budget: budget not verified']);
  });

  it('runs every step and reports each one when all pass', async () => {
    const ran: string[] = [];
    const report = reporter();
    const outcome = await runSteps(
      [
        { name: 'one', run: () => void ran.push('one') },
        { name: 'two', run: async () => void ran.push('two') },
      ],
      report,
    );

    expect(outcome).toEqual({ ok: true, passed: ['one', 'two'], failedStep: null });
    expect(ran).toEqual(['one', 'two']);
    expect(report.lines).toEqual(['PASS one', 'PASS two']);
  });
});

describe('arguments', () => {
  const DEFAULT = 'http://127.0.0.1:4000';

  it('defaults to the documented seed window and the local origin', () => {
    expect(parseE2eArgs([], DEFAULT)).toEqual({
      baseUrl: DEFAULT,
      d3ExpiryOffsetS: 30,
      preTrancheWaitS: 35,
      budgetTimeoutS: 300,
      skipS7: false,
    });
  });

  it('accepts overrides', () => {
    expect(
      parseE2eArgs(['--base-url=https://tapat.example.ts.net/api', '--budget-timeout-s=60', '--pre-tranche-wait=40'], DEFAULT),
    ).toEqual({
      baseUrl: 'https://tapat.example.ts.net',
      d3ExpiryOffsetS: 30,
      preTrancheWaitS: 40,
      budgetTimeoutS: 60,
      skipS7: false,
    });
  });

  it('takes the bare --skip-s7 flag for the S5 gate', () => {
    expect(parseE2eArgs(['--skip-s7'], DEFAULT).skipS7).toBe(true);
    expect(parseE2eArgs(['--skip-s7=false'], DEFAULT).skipS7).toBe(false);
    expect(() => parseE2eArgs(['--skip-s7=maybe'], DEFAULT)).toThrow('--skip-s7 takes no value');
  });

  it('rejects an unknown flag, a bad URL and a non-positive second count', () => {
    expect(() => parseE2eArgs(['--uid-d1=X'], DEFAULT)).toThrow('unknown flag --uid-d1');
    expect(() => parseE2eArgs(['--base-url=localhost:4000'], DEFAULT)).toThrow('--base-url must be an absolute http(s) URL');
    expect(() => parseE2eArgs(['--d3-expiry-offset=0'], DEFAULT)).toThrow('--d3-expiry-offset must be a whole number');
  });
});

describe('chain audit', () => {
  const trancheIdx = TRANCHE_FIRE_IDX.min;
  const audit: ChainAudit = {
    moneyTxs: [
      { kind: 'fund', status: 'succeeded' },
      { kind: 'fund', status: 'succeeded' },
      { kind: 'fund', status: 'succeeded' },
      { kind: 'authorize', status: 'succeeded' },
      { kind: 'authorize', status: 'succeeded' },
      { kind: 'authorize', status: 'succeeded' },
      { kind: 'claim', status: 'succeeded' },
      { kind: 'sweep', status: 'succeeded' },
      { kind: 'sweep', status: 'succeeded' },
      { kind: 'sweep', status: 'succeeded' },
    ],
    authorizedTaps: [{ chainTxStatus: 'succeeded' }, { chainTxStatus: 'succeeded' }, { chainTxStatus: 'succeeded' }],
    rejectedTaps: [{ chainTxId: null }, { chainTxId: null }],
    pricePoints: Array.from({ length: trancheIdx }, () => ({ simulated: 1 })),
    trancheIdx,
    burstEdges: Array.from({ length: 30 }, () => ({ simulated: 1 })),
    trancheDecisions: 1,
    freezeScores: [2.31],
    midasThreshold: 1.78,
  };

  it('passes when every money row succeeded and the labels are simulated', () => {
    expect(checkAudit(audit)).toEqual([]);
  });

  it('measures price_points against the tranche fire point, not the fixture length', () => {
    expect(audit.pricePoints).toHaveLength(TRANCHE_FIRE_IDX.min);
    const short = checkAudit({ ...audit, pricePoints: audit.pricePoints.slice(1) });
    expect(short).toContain(`price_points: expected ${TRANCHE_FIRE_IDX.min}, got ${TRANCHE_FIRE_IDX.min - 1}`);
    const padded = checkAudit({
      ...audit,
      pricePoints: Array.from({ length: 45 }, () => ({ simulated: 1 })),
    });
    expect(padded).toContain(`price_points: expected ${TRANCHE_FIRE_IDX.min}, got 45`);
  });

  it('flags a failed money tx, an unsimulated price point and a sub-threshold freeze', () => {
    const failures = checkAudit({
      ...audit,
      moneyTxs: [...audit.moneyTxs.slice(1), { kind: 'claim', status: 'failed' }],
      pricePoints: audit.pricePoints.map((row, index) => (index === 0 ? { simulated: 0 } : row)),
      freezeScores: [0.5],
    });
    expect(failures.some((failure) => failure.startsWith('chain_txs claim: expected succeeded'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('rows with simulated != 1'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('freeze midas score'))).toBe(true);
  });
});

function programFixture(status: Program['status']): Program {
  return {
    id: 'prog_test',
    name: 'TODA Fuel Aid — San Roque',
    status,
    perTapCapStroops: '500000000',
    trancheStroops: '1500000000',
    expiresAtS: 1796054399,
    priceThresholdPhp: 65,
    alpha: 0.05,
    beta: 0.02,
    budgetVerifiedStroops: EXPECTED_BUDGET_STROOPS,
    budgetFundedStroops: RUNBOOK_TOTALS.funded,
    trancheFired: true,
    createdAt: 0,
  };
}

function cardSummary(index: number): CardSummary {
  return {
    id: `card_${index}`,
    beneficiaryId: `ben_${index}`,
    displayName: 'Juan D.',
    uidLast4: '9C7E',
    deviceHashPrefix: '3f9c1a0b',
    virtual: false,
    status: 'swept',
    expiresAtS: 1796054399,
    expired: false,
    escrowStroops: '0',
    returnedStroops: '0',
  };
}

function stationFixture(id: string, status: Station['status'], pendingStroops: string, frozenReason: string | null): Station {
  return {
    id,
    name: id === 'A' ? 'Petron San Roque' : 'Rotonda Fuels',
    publicKey: 'G...',
    status,
    frozenReason,
    frozenAt: frozenReason === null ? null : 1,
    pendingStroops,
    spentStroops: '0',
  };
}

/** The post-close dashboard for the full run and for the S5 gate (`--skip-s7`: no intake, so four cards). */
function dashboardFixture(mode: 'full' | 'beats'): Dashboard {
  const full = mode === 'full';
  return {
    program: programFixture('ended'),
    phpPerXlm: 10,
    midasThreshold: 1.78,
    fundedStroops: RUNBOOK_TOTALS.funded,
    spentStroops: RUNBOOK_TOTALS.spent,
    heldStroops: RUNBOOK_TOTALS.held,
    pendingStroops: RUNBOOK_TOTALS.pending,
    escrowRemainingStroops: RUNBOOK_TOTALS.escrowRemaining,
    returnedStroops: RUNBOOK_TOTALS.returned,
    invariantOk: true,
    budget: {
      state: 'verified',
      verifiedStroops: EXPECTED_BUDGET_STROOPS,
      fundedStroops: RUNBOOK_TOTALS.funded,
      remainingStroops: '5500000000',
      checkoutUrl: null,
      paymentIntentId: null,
    },
    counts: {
      beneficiaries: full ? 12 : 4,
      approved: full ? 5 : 0,
      uncertain: 0,
      enrolled: full ? 5 : 4,
      cardsActive: 0,
      tapsAuthorized: 3,
      tapsRejected: 2,
      tapsRefused: 30,
    },
    cards: Array.from({ length: full ? 5 : 4 }, (_, index) => cardSummary(index)),
    stations: [
      stationFixture('A', 'active', '0', null),
      stationFixture('B', 'frozen', RUNBOOK_TOTALS.held, 'MIDAS 2.31 >= 1.78 (NEAR_CAP_STREAK)'),
    ],
    recentTaps: [],
    recentDecisions: [],
    recentChainTxs: [],
  };
}

function endFixture(expectD4: boolean): EndProgramResponse {
  const cards: EndProgramResponse['cards'] = [
    { cardId: 'card_D1', beneficiaryId: 'ben_D1', returnedStroops: '1150000000', revokeTxId: 'ctx_r1', sweepTxId: 'ctx_w1', status: 'swept', reason: null },
    { cardId: 'card_D2', beneficiaryId: 'ben_D2', returnedStroops: '540000000', revokeTxId: 'ctx_r2', sweepTxId: 'ctx_w2', status: 'swept', reason: null },
    { cardId: 'card_D3', beneficiaryId: 'ben_D3', returnedStroops: '0', revokeTxId: null, sweepTxId: null, status: 'swept', reason: 'EMPTY_ESCROW' },
    ...(expectD4
      ? [
          {
            cardId: 'card_D4',
            beneficiaryId: 'ben_D4',
            returnedStroops: '0',
            revokeTxId: 'ctx_r4',
            sweepTxId: null,
            status: 'swept' as const,
            reason: 'EMPTY_ESCROW',
          },
        ]
      : []),
    { cardId: 'card_D5', beneficiaryId: 'ben_D5', returnedStroops: '1500000000', revokeTxId: 'ctx_r5', sweepTxId: 'ctx_w5', status: 'swept', reason: null },
  ];
  return { program: programFixture('ended'), cards, totalReturnedStroops: RUNBOOK_TOTALS.returned };
}

describe('demo widths', () => {
  it('the full run ends with five swept cards and D4 revoked but empty', () => {
    expect(checkEndProgram(endFixture(true), { expectD4: true })).toEqual([]);
    expect(checkDashboard(dashboardFixture('full'), FULL_RUN_DASHBOARD)).toEqual([]);
  });

  it('the S5 gate (--skip-s7) expects four cards and no approved beneficiary', () => {
    expect(checkEndProgram(endFixture(false), { expectD4: false })).toEqual([]);
    expect(checkDashboard(dashboardFixture('beats'), BEATS_ONLY_DASHBOARD)).toEqual([]);
  });

  it('fails when the width and the response disagree', () => {
    expect(checkEndProgram(endFixture(true), { expectD4: false })).toContain('cards.length: expected 4, got 5');
    expect(checkDashboard(dashboardFixture('full'), BEATS_ONLY_DASHBOARD)).toContain('counts.approved: expected 0, got 5');
  });
});
