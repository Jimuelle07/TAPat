// Budget funding (SDD §6.9, api-and-data.md §5.2 #4, §5.5): the Velo checkout, the webhook dispatch and the 3 s poller.
// Both the webhook and the poller credit through `creditBudgetIntent`, so one paid intent raises
// `program.budget_verified_stroops` exactly once however many deliveries or poll passes see it.
import type { Velo } from '@tapat/agent';
import {
  phpToStroops,
  stroopsToXlmString,
  type BudgetCheckoutBody,
  type BudgetCheckoutResponse,
} from '@tapat/shared';
import type { Config } from '../config';
import type { Db } from '../db/index';
import { ApiError } from '../errors';
import { createBudgetCheckoutSession, retrievePaymentIntent } from '../velo/checkout';
import type { VeloWebhookEvent } from '../velo/webhook';
import type { ChainLog } from './chain';
import { getCurrentProgram } from './program';
import type { SseBus } from './sse';

export interface BudgetDeps {
  db: Db;
  velo: Pick<Velo, 'checkout' | 'paymentIntents'>;
  bus: SseBus;
  config: Pick<Config, 'PHP_PER_XLM' | 'PUBLIC_BASE_URL' | 'VELO_WEBHOOK_SECRET'>;
  log: ChainLog;
  now?: () => number;
}

/** Poller reads only intents younger than this (SDD §6.9). */
export const BUDGET_POLL_WINDOW_MS = 30 * 60_000;
export const BUDGET_POLL_INTERVAL_MS = 3_000;

/** The stored asset: Velo echoes the checkout's `native` as either `native` or `XLM`; both mean XLM. */
const STORED_ASSET = 'XLM';

interface IntentRow {
  id: string;
  purpose: string;
  amount: string;
  asset: string;
  status: string;
}

export type CreditOutcome = 'credited' | 'already_paid' | 'not_paid' | 'unknown_intent' | 'mismatch' | 'no_program';

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** An XLM decimal string ("1000.00", up to 7 places) as exact stroops, or null when it is not one. */
function xlmToStroops(text: string): bigint | null {
  const match = /^(\d+)(?:\.(\d{1,7}))?$/.exec(text.trim());
  if (match === null) return null;
  return BigInt(match[1] as string) * 10_000_000n + BigInt((match[2] ?? '').padEnd(7, '0'));
}

function canonicalAsset(asset: string): string {
  return asset === 'native' ? 'XLM' : asset;
}

/** `POST /api/program/budget-checkout`: one Velo checkout session and its `velo_intents` row. */
export async function createBudgetCheckout(deps: BudgetDeps, body: BudgetCheckoutBody): Promise<BudgetCheckoutResponse> {
  const program = getCurrentProgram(deps.db);
  if (program === null) throw new ApiError(404, 'NOT_FOUND', 'no program; create one first');
  if (program.status === 'ending' || program.status === 'ended') {
    throw new ApiError(409, 'INVALID_STATE', `program is ${program.status}`);
  }
  const amount = stroopsToXlmString(phpToStroops(body.amountPhp, deps.config.PHP_PER_XLM));
  const seq =
    (deps.db.prepare(`SELECT COUNT(*) AS n FROM velo_intents WHERE purpose = 'budget'`).get<{ n: number }>()?.n ?? 0) + 1;

  const session = await createBudgetCheckoutSession(deps.velo, {
    amount,
    idempotencyKey: `budget:${program.id}:${seq}`,
    publicBaseUrl: deps.config.PUBLIC_BASE_URL,
  });
  // OR IGNORE: a repeated idempotency key makes Velo answer with the same intent, which already has its row.
  deps.db
    .prepare(
      `INSERT OR IGNORE INTO velo_intents
         (id, purpose, amount, asset, status, checkout_url, tx_hash, payer_address, created_at, paid_at)
       VALUES (?, 'budget', ?, ?, 'created', ?, NULL, NULL, ?, NULL)`,
    )
    .run(session.paymentIntentId, amount, STORED_ASSET, session.checkoutUrl, (deps.now ?? Date.now)());
  return { checkoutUrl: session.checkoutUrl, paymentIntentId: session.paymentIntentId };
}

/**
 * Verifies one budget intent against Velo and credits it once. Velo's own answer decides: the intent must be `paid`
 * with the stored asset and amount. The credit and the `status = 'paid'` flip share one transaction, and the flip
 * only lands while the row is not yet `paid`, so a replayed delivery and a poll pass can never credit it twice.
 */
export async function creditBudgetIntent(
  deps: BudgetDeps,
  intentId: string,
  hint: { txHash?: string | null } = {},
): Promise<CreditOutcome> {
  const row = deps.db
    .prepare('SELECT id, purpose, amount, asset, status FROM velo_intents WHERE id = ?')
    .get<IntentRow>(intentId);
  if (row === undefined || row.purpose !== 'budget') return 'unknown_intent';
  if (row.status === 'paid') return 'already_paid';
  const program = getCurrentProgram(deps.db);
  if (program === null) return 'no_program';

  const intent = await retrievePaymentIntent(deps.velo, intentId);
  if (intent.status !== 'paid') return 'not_paid';
  const expected = xlmToStroops(row.amount);
  const paid = xlmToStroops(intent.amount);
  if (
    expected === null ||
    paid === null ||
    expected !== paid ||
    intent.paymentIntentId !== row.id ||
    canonicalAsset(intent.asset) !== canonicalAsset(row.asset)
  ) {
    deps.log.warn({ intentId, expected: row.amount, got: intent.amount, asset: intent.asset }, 'budget intent does not match its row');
    return 'mismatch';
  }

  const credited = deps.db.transaction(() => {
    const flipped = deps.db
      .prepare(
        `UPDATE velo_intents SET status = 'paid', paid_at = ?, tx_hash = ?, payer_address = ?
         WHERE id = ? AND status != 'paid'`,
      )
      .run((deps.now ?? Date.now)(), hint.txHash ?? null, intent.payerAddress ?? null, intentId);
    if (flipped.changes === 0) return false;
    deps.db
      .prepare('UPDATE program SET budget_verified_stroops = budget_verified_stroops + ? WHERE id = ?')
      .run(expected, program.id);
    return true;
  });
  if (!credited) return 'already_paid';

  const updated = getCurrentProgram(deps.db);
  if (updated !== null) deps.bus.publish('budget', updated);
  return 'credited';
}

/** One poll pass: every unpaid budget intent younger than 30 min goes through the same credit path. */
export async function pollBudgetOnce(deps: BudgetDeps): Promise<number> {
  const cutoff = (deps.now ?? Date.now)() - BUDGET_POLL_WINDOW_MS;
  const rows = deps.db
    .prepare(`SELECT id FROM velo_intents WHERE purpose = 'budget' AND status != 'paid' AND created_at > ? ORDER BY created_at`)
    .all<{ id: string }>(cutoff);
  let credited = 0;
  for (const { id } of rows) {
    try {
      if ((await creditBudgetIntent(deps, id)) === 'credited') credited += 1;
    } catch (error) {
      deps.log.warn({ intentId: id, cause: messageOf(error) }, 'budget poll failed');
    }
  }
  return credited;
}

/** Runs `pollBudgetOnce` every `intervalMs`, skipping a tick while the previous pass is still running. */
export function startBudgetPoller(deps: BudgetDeps, intervalMs: number = BUDGET_POLL_INTERVAL_MS): () => void {
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    pollBudgetOnce(deps)
      .catch((error: unknown) => {
        deps.log.error({ cause: messageOf(error) }, 'budget poller pass failed');
      })
      .finally(() => {
        running = false;
      });
  }, intervalMs);
  return () => {
    clearInterval(timer);
  };
}

export interface VeloDelivery {
  /** `x-velo-delivery`. */
  id: string;
  /** The raw body text that was signed; stored verbatim as `payload_json`. */
  rawBody: string;
  /** The verified event. */
  event: VeloWebhookEvent;
}

/**
 * Records one verified delivery and dispatches it (§5.5 steps 3-5). A repeated delivery id stops at the insert. A throw
 * from the handler is logged and swallowed: the delivery is recorded, and the poller covers a payment the webhook
 * could not credit, so Velo must not be told to retry.
 */
export async function handleVeloDelivery(deps: BudgetDeps, delivery: VeloDelivery): Promise<void> {
  const inserted = deps.db
    .prepare('INSERT OR IGNORE INTO webhook_deliveries (delivery_id, type, received_at, payload_json) VALUES (?, ?, ?, ?)')
    .run(delivery.id, delivery.event.type, (deps.now ?? Date.now)(), delivery.rawBody);
  if (inserted.changes === 0) return;

  try {
    const { event } = delivery;
    if (event.type === 'payment.succeeded' && event.paymentIntent !== undefined) {
      await creditBudgetIntent(deps, event.paymentIntent.id, { txHash: event.paymentIntent.txHash ?? null });
    } else if (event.type === 'payment.failed' && event.paymentIntent !== undefined) {
      deps.db
        .prepare(`UPDATE velo_intents SET status = 'failed' WHERE id = ? AND purpose = 'budget' AND status != 'paid'`)
        .run(event.paymentIntent.id);
    }
    // payment.created, contract.event and every other type are stored only.
  } catch (error) {
    deps.log.error({ deliveryId: delivery.id, type: delivery.event.type, cause: messageOf(error) }, 'velo webhook handler failed');
  }
}
