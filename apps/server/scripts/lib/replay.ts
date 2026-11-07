/** Pure planning for `replay-demo.ts`: argument handling and the read-only DB inspection. No chain, no network. */
import type { Db } from '../../src/db/index';
import { parseSeedArgs } from '../../src/services/demo';
import { getCurrentProgram } from '../../src/services/program';

const D3_EXPIRY_FLAG = '--d3-expiry-offset=';
const BUDGET_INTENT_FLAG = '--budget-intent=';

/**
 * Strips the bare `--dry-run` flag; everything else goes to `seed-demo.ts`. The passthrough is validated with the seed's
 * own parser so a typo throws before any chain action. D3's expiry counts from seed start and the seed registers D1 and
 * D2 first (over 60 s on testnet), so `--d3-expiry-offset=300` is appended unless the operator chose one.
 */
export function parseReplayArgs(argv: readonly string[]): { dryRun: boolean; seedArgs: string[] } {
  const dryRun = argv.includes('--dry-run');
  const seedArgs = argv.filter((arg) => arg !== '--dry-run');
  parseSeedArgs(seedArgs);
  if (!seedArgs.some((arg) => arg.startsWith(D3_EXPIRY_FLAG))) seedArgs.push(`${D3_EXPIRY_FLAG}300`);
  return { dryRun, seedArgs };
}

export interface ReplayPlan {
  programId: string | null;
  programStatus: string | null;
  frozenStations: string[];
  settle: boolean;
  end: boolean;
  /** The program is `ended` but cards still hold escrow (a sweep failed): set it back to `ending` so `endProgram` resumes. */
  reopenEnded: boolean;
  /** Cards of the program still `active`, relevant only when `reopenEnded`. */
  unsweptCardIds: string[];
  budgetIntentId: string | null;
  seedArgs: string[];
}

export function planReplay(db: Db, seedArgs: string[]): ReplayPlan {
  const program = getCurrentProgram(db);
  const frozenStations = db
    .prepare(`SELECT id FROM stations WHERE status = 'frozen' ORDER BY id`)
    .all<{ id: string }>()
    .map((row) => row.id);

  const operatorIntent = seedArgs.find((arg) => arg.startsWith(BUDGET_INTENT_FLAG));
  let budgetIntentId: string | null = null;
  let outArgs = seedArgs;
  if (operatorIntent !== undefined) {
    budgetIntentId = operatorIntent.slice(BUDGET_INTENT_FLAG.length);
  } else {
    const row = db
      .prepare(`SELECT id FROM velo_intents WHERE purpose = 'budget' AND status = 'paid' ORDER BY paid_at DESC LIMIT 1`)
      .get<{ id: string }>();
    if (row !== undefined) {
      budgetIntentId = row.id;
      outArgs = [...seedArgs, `${BUDGET_INTENT_FLAG}${row.id}`];
    }
  }

  const unsweptCardIds =
    program !== null && program.status === 'ended'
      ? db
          .prepare(
            `SELECT c.id FROM cards c JOIN beneficiaries b ON b.id = c.beneficiary_id
              WHERE b.program_id = ? AND c.status = 'active' ORDER BY c.created_at, c.rowid`,
          )
          .all<{ id: string }>(program.id)
          .map((row) => row.id)
      : [];
  const reopenEnded = unsweptCardIds.length > 0;

  return {
    programId: program?.id ?? null,
    programStatus: program?.status ?? null,
    frozenStations,
    settle: program !== null,
    end: program !== null && (program.status === 'active' || program.status === 'ending' || reopenEnded),
    reopenEnded,
    unsweptCardIds,
    budgetIntentId,
    seedArgs: outArgs,
  };
}

/** The ordered steps a real run performs; `--dry-run` prints exactly these. */
export function describePlan(plan: ReplayPlan): string[] {
  const steps: string[] = [];
  for (const id of plan.frozenStations) steps.push(`unfreeze ${id}`);
  if (plan.settle) steps.push('run settlement (claims pending; frozen-station money released after unfreeze)');
  if (plan.reopenEnded) {
    steps.push(`re-open ended program to sweep cards still active: ${plan.unsweptCardIds.join(', ')}`);
  }
  if (plan.end) steps.push('end program (sweep escrow to Program Wallet)');
  steps.push('reset (revoke devices, empty DB)');
  steps.push(`seed: pnpm exec tsx scripts/seed-demo.ts ${plan.seedArgs.join(' ')}`.trimEnd());
  if (plan.budgetIntentId === null) {
    steps.push('NOTE: no paid budget intent found — press Fund budget on /desktop after replay');
  }
  return steps;
}
