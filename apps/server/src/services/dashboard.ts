// `GET /api/dashboard` (api-and-data.md §5.2 #18, SDD §6.10): the money tiles with the invariant, the budget badge,
// disjoint counts, the privacy-safe card list, the stations and the two feeds. Every number is SQL over our tables
// plus exactly one chain read — the active cards' escrow — cached 5 s and shared by `cards[]` and the total.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { NoirAgentClient } from '@tapat/agent';
import type { CardSummary, Dashboard, Station, Tap, AgentDecision } from '@tapat/shared';
import type { Config } from '../config';
import type { Db } from '../db/index';
import { ApiError } from '../errors';
import { toAgentDecision, type DecisionRow } from './decisions';
import { getCurrentProgram } from './program';
import { listStations } from './stations';
import { toTap, type TapRow } from './tap';

const MIDAS_CONFIG_PATH = fileURLToPath(new URL('../../config/midas.json', import.meta.url));

/**
 * Until `calibrate-midas.ts` writes `config/midas.json` (task MID), the dashboard must still draw a line. This is the
 * calibrated threshold the Freeze Agent falls back to as well (`MidAlgos`: honest max 1.688 → 2.2), so the chart line
 * and the agent never disagree on a checkout without the generated file.
 */
export const MIDAS_THRESHOLD_FALLBACK = 2.2;

/**
 * `apps/server/config/midas.json.threshold` — the freeze line the edge chart draws. The file is generated output and
 * may not exist yet on a fresh checkout, so a missing or malformed file falls back to `MIDAS_THRESHOLD_FALLBACK`
 * instead of failing the dashboard.
 */
export function loadMidasThreshold(path: string = MIDAS_CONFIG_PATH): number {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as { threshold?: unknown };
    return typeof parsed.threshold === 'number' && Number.isFinite(parsed.threshold)
      ? parsed.threshold
      : MIDAS_THRESHOLD_FALLBACK;
  } catch {
    return MIDAS_THRESHOLD_FALLBACK;
  }
}

/** `api-and-data.md` §5.2 #18: the escrow read is deliberately slow-moving; the invariant must not flicker. */
export const ESCROW_CACHE_MS = 5_000;

const RECENT_TAPS_LIMIT = 50;
const RECENT_DECISIONS_LIMIT = 20;

interface CardWithNameRow {
  id: string;
  beneficiary_id: string;
  device_hash: string;
  uid_last4: string;
  virtual: number;
  status: CardSummary['status'];
  expires_at_s: number;
  returned_stroops: number | bigint;
  created_at: number;
  first_name: string;
  last_name: string;
}

interface BudgetIntentRow {
  id: string;
  status: string;
  checkout_url: string | null;
}

export interface DashboardDeps {
  db: Db;
  noir: Pick<NoirAgentClient, 'getEscrowBalance'>;
  config: Pick<Config, 'PHP_PER_XLM'>;
  /** `apps/server/config/midas.json.threshold`, or `loadMidasThreshold()`'s fallback. */
  midasThreshold: number;
  now?: () => number;
  /** Test seam; production keeps the 5 s window. */
  escrowCacheMs?: number;
}

export interface DashboardService {
  get(): Promise<Dashboard>;
}

function count(db: Db, sql: string, ...params: string[]): number {
  const row = db.prepare(sql).get<{ n: number }>(...params);
  return row?.n ?? 0;
}

/** "Juan D." — the only name the pages ever render. */
function displayName(firstName: string, lastName: string): string {
  const initial = lastName.trim().charAt(0);
  return initial === '' ? firstName : `${firstName} ${initial}.`;
}

/**
 * The dashboard service instance holds the escrow cache, so the one chain read per 5 s window is shared by the card
 * list and the escrow-remaining total: register it once and reuse it for every request.
 */
export function createDashboardService(deps: DashboardDeps): DashboardService {
  const now = deps.now ?? Date.now;
  const escrowCacheMs = deps.escrowCacheMs ?? ESCROW_CACHE_MS;
  let escrowCache: { at: number; balances: Map<string, bigint> } | null = null;

  /** One chain read per active card, refreshed at most every `escrowCacheMs`; anything not read is treated as 0. */
  async function activeEscrow(cards: CardWithNameRow[]): Promise<Map<string, bigint>> {
    const at = now();
    if (escrowCache !== null && at - escrowCache.at < escrowCacheMs) return escrowCache.balances;
    const active = cards.filter((card) => card.status === 'active');
    const balances = new Map<string, bigint>(
      await Promise.all(
        active.map(async (card): Promise<[string, bigint]> => [
          card.device_hash,
          await deps.noir.getEscrowBalance(card.device_hash),
        ]),
      ),
    );
    escrowCache = { at, balances };
    return balances;
  }

  return {
    async get(): Promise<Dashboard> {
      const program = getCurrentProgram(deps.db);
      if (program === null) throw new ApiError(404, 'NOT_FOUND', 'no program; run seed-demo.ts');

      const cardRows = deps.db
        .prepare(
          `SELECT c.id, c.beneficiary_id, c.device_hash, c.uid_last4, c.virtual, c.status, c.expires_at_s,
                  c.returned_stroops, c.created_at, b.first_name, b.last_name
             FROM cards c JOIN beneficiaries b ON b.id = c.beneficiary_id
            WHERE b.program_id = ?
            ORDER BY c.created_at, c.rowid`,
        )
        .all<CardWithNameRow>(program.id);
      const escrow = await activeEscrow(cardRows);

      const nowS = Math.floor(now() / 1000);
      let escrowRemaining = 0n;
      let returned = 0n;
      const cards: CardSummary[] = cardRows.map((row) => {
        const balance = row.status === 'active' ? (escrow.get(row.device_hash) ?? 0n) : 0n;
        escrowRemaining += balance;
        returned +=
          typeof row.returned_stroops === 'bigint' ? row.returned_stroops : BigInt(Math.trunc(row.returned_stroops));
        return {
          id: row.id,
          beneficiaryId: row.beneficiary_id,
          displayName: displayName(row.first_name, row.last_name),
          uidLast4: row.uid_last4,
          deviceHashPrefix: row.device_hash.slice(0, 8),
          virtual: row.virtual === 1,
          status: row.status,
          expiresAtS: row.expires_at_s,
          expired: row.expires_at_s < nowS,
          escrowStroops: String(balance),
          returnedStroops: String(row.returned_stroops),
        };
      });

      // #16's pending/spent split per station; `held` is the frozen half, `pending` the active half.
      const stations: Station[] = listStations(deps.db);
      let held = 0n;
      let pending = 0n;
      let spent = 0n;
      for (const station of stations) {
        spent += BigInt(station.spentStroops);
        if (station.status === 'frozen') held += BigInt(station.pendingStroops);
        else pending += BigInt(station.pendingStroops);
      }

      const funded = BigInt(program.budgetFundedStroops);
      const invariantOk = funded === spent + held + pending + escrowRemaining + returned;

      const latestIntent = deps.db
        .prepare(
          `SELECT id, status, checkout_url FROM velo_intents
            WHERE purpose = 'budget' ORDER BY created_at DESC, rowid DESC LIMIT 1`,
        )
        .get<BudgetIntentRow>();
      const verified = BigInt(program.budgetVerifiedStroops);
      const remaining = verified > funded ? verified - funded : 0n;
      const budget: Dashboard['budget'] = {
        // §5.2 #18: none = no intent; waiting = the latest budget intent is not paid (or its credit has not landed);
        // verified = that intent is paid and the program holds verified budget.
        state:
          latestIntent === undefined
            ? 'none'
            : latestIntent.status === 'paid' && verified > 0n
              ? 'verified'
              : 'waiting',
        verifiedStroops: String(verified),
        fundedStroops: String(funded),
        remainingStroops: String(remaining),
        checkoutUrl: latestIntent?.checkout_url ?? null,
        paymentIntentId: latestIntent?.id ?? null,
      };

      const counts: Dashboard['counts'] = {
        beneficiaries: count(deps.db, 'SELECT COUNT(*) AS n FROM beneficiaries WHERE program_id = ?', program.id),
        approved: count(
          deps.db,
          `SELECT COUNT(*) AS n FROM beneficiaries WHERE program_id = ? AND status = 'approved'`,
          program.id,
        ),
        uncertain: count(
          deps.db,
          `SELECT COUNT(*) AS n FROM beneficiaries WHERE program_id = ? AND status = 'uncertain'`,
          program.id,
        ),
        enrolled: count(
          deps.db,
          `SELECT COUNT(*) AS n FROM beneficiaries WHERE program_id = ? AND status = 'enrolled'`,
          program.id,
        ),
        cardsActive: count(
          deps.db,
          `SELECT COUNT(*) AS n FROM cards c JOIN beneficiaries b ON b.id = c.beneficiary_id
            WHERE b.program_id = ? AND c.status = 'active'`,
          program.id,
        ),
        tapsAuthorized: count(deps.db, `SELECT COUNT(*) AS n FROM taps WHERE status = 'authorized'`),
        tapsRejected: count(deps.db, `SELECT COUNT(*) AS n FROM taps WHERE status = 'rejected'`),
        tapsRefused: count(deps.db, `SELECT COUNT(*) AS n FROM taps WHERE status = 'refused'`),
      };

      const recentTaps: Tap[] = deps.db
        .prepare('SELECT * FROM taps ORDER BY created_at DESC, rowid DESC LIMIT ?')
        .all<TapRow>(RECENT_TAPS_LIMIT)
        .map(toTap);
      const recentDecisions: AgentDecision[] = deps.db
        .prepare('SELECT * FROM agent_decisions ORDER BY created_at DESC, rowid DESC LIMIT ?')
        .all<DecisionRow>(RECENT_DECISIONS_LIMIT)
        .map(toAgentDecision);

      return {
        program,
        phpPerXlm: deps.config.PHP_PER_XLM,
        midasThreshold: deps.midasThreshold,
        fundedStroops: String(funded),
        spentStroops: String(spent),
        heldStroops: String(held),
        pendingStroops: String(pending),
        escrowRemainingStroops: String(escrowRemaining),
        returnedStroops: String(returned),
        invariantOk,
        budget,
        counts,
        cards,
        stations,
        recentTaps,
        recentDecisions,
      };
    },
  };
}
