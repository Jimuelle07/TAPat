// The dashboard's one activity feed: taps, decisions, fund txs and the budget row, newest first, capped at 50 with milestone rows pinned (api-and-data §5.2 #18).
import { TAP_REASON_LABELS } from '@tapat/shared';
import type { AgentDecision, CardSummary, ChainTx, Dashboard, Stroops, Tap } from '@tapat/shared';
import { php, shortHash, txHash } from './format';

export type FeedTone = 'outline' | 'mint' | 'accent' | 'danger' | 'frozen' | 'ink';

export interface FeedItem {
  id: string;
  createdAt: number;
  title: string;
  meta: string;
  value?: string;
  chip?: string;
  tone?: FeedTone;
  detail: {
    title: string;
    chip: string;
    tone: FeedTone;
    rows: Array<[string, string]>;
    /** Full tx hash for the explorer link, when one was submitted. */
    hash: string | null;
    /** The honesty label the data needs (AGENTS.md §5). */
    label?: string;
  };
}

const FEED_LIMIT = 50;

export function cardLabel(card: Pick<CardSummary, 'displayName' | 'uidLast4'>): string {
  return `${card.displayName} …${card.uidLast4}`;
}

/** Resolves `ctx_…` ids to hashes. */
export function txLookup(
  dashboard: Partial<Pick<Dashboard, 'recentChainTxs'>>,
): (id: string | null | undefined) => string | null {
  // An API older than this web build omits `recentChainTxs`, so every id resolves to null instead of throwing.
  const byId = new Map<string, ChainTx>((dashboard.recentChainTxs ?? []).map((tx) => [tx.id, tx]));
  return (id) => (id === null || id === undefined ? null : txHash(byId.get(id)));
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}
function asNumber(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}
function asList(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
}

/** A litre price is already pesos (the feed is not stroops), so it does not go through `formatPhp`. */
export function perLitre(value: unknown): string {
  const price = asNumber(value);
  return price === null ? 'Not recorded' : `PHP ${price.toFixed(2)}`;
}

function tapItem(tap: Tap, dashboard: Dashboard, hashOf: ReturnType<typeof txLookup>): FeedItem {
  const rate = dashboard.phpPerXlm;
  const amount = php(tap.amountStroops, rate);
  const card = dashboard.cards.find((c) => c.id === tap.cardId);
  const station = dashboard.stations.find((s) => s.id === tap.stationId)?.name ?? `Station ${tap.stationId}`;
  // A tap refused before the card lookup has no card on purpose (§5.2 #13).
  const who = card === undefined ? (tap.reasonCode === 'SIMULATED_EDGE' ? 'Simulated edge' : 'Tap') : `…${card.uidLast4}`;
  const title = `${who} at ${station}`;
  const hash = hashOf(tap.chainTxId);
  const midas = tap.midasScore === null ? 'Not scored yet' : tap.midasScore.toFixed(2);
  const reason = tap.reasonCode === null ? null : TAP_REASON_LABELS[tap.reasonCode];
  const rows: Array<[string, string]> = [
    ['Card', card === undefined ? (tap.cardRef ?? 'Not read') : cardLabel(card)],
    ['Station', station],
    ['Amount', amount],
  ];

  if (tap.status === 'authorized') {
    return {
      id: tap.id,
      createdAt: tap.createdAt,
      title,
      meta: hash === null ? 'Paid' : `Paid · tx ${shortHash(hash)}`,
      value: amount,
      detail: {
        title: 'Tap paid',
        chip: 'Authorized',
        tone: 'mint',
        rows: [...rows, ['MIDAS score', midas], ['Tx', hash === null ? 'Waiting for the chain' : shortHash(hash)]],
        hash,
        ...(tap.simulated ? { label: 'simulated tap, real on-chain payment' } : {}),
      },
    };
  }
  if (tap.reasonCode === 'SIMULATED_EDGE') {
    return {
      id: tap.id,
      createdAt: tap.createdAt,
      title,
      meta: `Refused · ${reason} · MIDAS ${midas}`,
      chip: 'Simulated',
      tone: 'outline',
      detail: { title: 'Simulated edge', chip: 'Refused', tone: 'outline', rows: [...rows, ['MIDAS score', midas]], hash: null, label: 'simulated burst' },
    };
  }
  const refused = tap.status === 'refused';
  const failed = tap.status === 'failed';
  const word = failed ? 'Failed' : refused ? 'Refused' : 'Declined';
  return {
    id: tap.id,
    createdAt: tap.createdAt,
    title,
    meta: `${word} · ${reason ?? 'the chain call did not finish'}`,
    chip: word,
    tone: 'danger',
    detail: {
      title: `Tap ${word.toLowerCase()}`,
      chip: word,
      tone: 'danger',
      rows: [...rows, ['Reason', reason ?? 'the chain call did not finish'], ['Tx', hash === null ? 'None submitted' : shortHash(hash)]],
      hash,
    },
  };
}

function decisionItem(decision: AgentDecision, dashboard: Dashboard, hashOf: ReturnType<typeof txLookup>): FeedItem {
  const rate = dashboard.phpPerXlm;
  const { inputs, outputs } = decision;
  const base = { id: decision.id, createdAt: decision.createdAt };
  const stationName = asString(outputs.stationName) ?? `Station ${asString(outputs.stationId) ?? ''}`.trim();
  const hash = hashOf(decision.txIds[0]);
  const money = (value: unknown): string => {
    const stroops = asString(value) as Stroops | null;
    return stroops === null ? 'Not recorded' : php(stroops, rate);
  };

  if (decision.agent === 'tranche') {
    const funded = asList(outputs.funded);
    const skipped = asList(outputs.skipped);
    const total = funded.reduce((sum, entry) => sum + BigInt(asString(entry.amountStroops) ?? '0'), 0n);
    const exhausted = decision.decision === 'BUDGET_EXHAUSTED';
    const label = (id: unknown): string => {
      const card = dashboard.cards.find((c) => c.id === id);
      return card === undefined ? String(id) : `…${card.uidLast4}`;
    };
    return {
      ...base,
      title: exhausted ? 'Budget ran out' : 'Tranche released',
      meta: `Tranche Agent · ${funded.length} cards funded, ${skipped.length} skipped`,
      value: php(total, rate),
      detail: {
        title: exhausted ? 'Budget ran out' : 'Tranche released',
        chip: `Tranche Agent · ${decision.decision}`,
        tone: 'mint',
        rows: [
          ['Price', perLitre(inputs.pricePhp)],
          ['Segment mean', perLitre(inputs.segmentMeanPhp)],
          ['Threshold', perLitre(inputs.thresholdPhp)],
          ['Changepoint probability', asNumber(inputs.cpRecent)?.toFixed(2) ?? 'Not recorded'],
          ['Run length', String(asNumber(inputs.mapR) ?? 'Not recorded')],
          ['Funded', `${funded.length} cards`],
          ['Skipped', skipped.length === 0 ? 'None' : skipped.map((s) => `${label(s.cardId)} ${String(s.reason)}`).join(', ')],
        ],
        hash: null,
        label: 'simulated DOE series',
      },
    };
  }
  if (decision.agent === 'freeze') {
    if (decision.decision === 'FROZEN') {
      const midasScore = asNumber(inputs.midasScore);
      const threshold = asNumber(inputs.threshold);
      return {
        ...base,
        title: `${stationName} frozen`,
        meta: `Freeze Agent · MIDAS ${midasScore?.toFixed(2)} >= ${threshold}`,
        chip: 'Frozen',
        tone: 'frozen',
        detail: {
          title: 'Station frozen',
          chip: 'Freeze Agent · FROZEN',
          tone: 'frozen',
          rows: [
            ['Station', stationName],
            ['Score', midasScore?.toFixed(2) ?? 'Not recorded'],
            ['Threshold', String(threshold ?? 'Not recorded')],
            ['Rule', asString(outputs.rule) ?? 'Not recorded'],
          ],
          hash: null,
          label: 'simulated burst',
        },
      };
    }
    const unfrozen = decision.decision === 'UNFROZEN';
    const title = unfrozen ? `${stationName} unfrozen` : 'Freeze Agent baseline set';
    return {
      ...base,
      title,
      meta: unfrozen ? 'LGU released the station' : 'Honest history replayed at start-up',
      detail: { title, chip: `Freeze Agent · ${decision.decision}`, tone: 'outline', rows: [], hash: null },
    };
  }
  if (decision.agent === 'settlement') {
    const amount = money(outputs.amountStroops ?? inputs.pendingStroops);
    if (decision.decision === 'HELD') {
      return {
        ...base,
        title: `${stationName} held`,
        meta: 'Settlement · station frozen, no tx',
        value: amount,
        chip: 'Held',
        tone: 'ink',
        detail: { title: 'Settlement held', chip: 'Held', tone: 'ink', rows: [['Station', stationName], ['Amount', amount], ['Tx', 'None submitted']], hash: null },
      };
    }
    if (decision.decision === 'NOTHING_PENDING') {
      const title = `${stationName}: nothing pending`;
      return { ...base, title, meta: 'Settlement · no claim needed', detail: { title, chip: 'Settlement', tone: 'outline', rows: [], hash: null } };
    }
    const claimed = outputs.claimed !== false;
    return {
      ...base,
      title: claimed ? `${stationName} claimed` : `${stationName} claim failed`,
      meta: hash === null ? 'Settlement' : `Settlement · tx ${shortHash(hash)}`,
      ...(claimed ? { value: amount } : { chip: 'Failed', tone: 'danger' as const }),
      detail: {
        title: claimed ? 'Settlement claimed' : 'Claim failed',
        chip: claimed ? 'Claimed' : 'Failed',
        tone: claimed ? 'mint' : 'danger',
        rows: [['Station', stationName], ['Amount', amount], ['Tx', hash === null ? 'None submitted' : shortHash(hash)]],
        hash,
      },
    };
  }
  if (decision.agent === 'sweep') {
    if (decision.decision === 'PROGRAM_ENDED') {
      return { ...base, title: 'Program ended', meta: 'Sweep Agent · unspent credit returned', detail: { title: 'Program ended', chip: 'Sweep Agent', tone: 'outline', rows: [], hash: null } };
    }
    const card = dashboard.cards.find((c) => c.id === outputs.cardId);
    const title = card === undefined ? 'Card swept' : `${card.displayName} …${card.uidLast4}`;
    const swept = decision.decision === 'SWEPT';
    return {
      ...base,
      title,
      meta: swept ? 'Returned to the LGU wallet' : `Skipped · ${asString(outputs.reason) ?? 'nothing to return'}`,
      ...(swept ? { value: money(outputs.returnedStroops) } : {}),
      detail: { title: swept ? 'Credit returned' : 'Sweep skipped', chip: decision.decision, tone: 'outline', rows: [['Card', title]], hash },
    };
  }
  const title = 'Masterlist decision';
  return {
    ...base,
    title,
    meta: `Intake Agent · ${decision.decision.toLowerCase().replaceAll('_', ' ')}`,
    detail: { title, chip: `Intake Agent · ${decision.decision}`, tone: 'outline', rows: [], hash: null },
  };
}

/** One row per tranche `fund` tx: the card and amount come from the tranche decision entry that carries the tx id. */
function fundItem(tx: ChainTx, dashboard: Dashboard): FeedItem {
  const entry = (dashboard.recentDecisions ?? [])
    .filter((d) => d.agent === 'tranche')
    .flatMap((d) => asList(d.outputs.funded))
    .find((e) => e.chainTxId === tx.id);
  const card = entry === undefined ? undefined : dashboard.cards.find((c) => c.id === entry.cardId);
  const who = card === undefined ? 'Card' : cardLabel(card);
  const amountStroops = entry === undefined ? null : asString(entry.amountStroops);
  const amount = amountStroops === null ? null : php(amountStroops, dashboard.phpPerXlm);
  const hash = txHash(tx);
  const failed = tx.status === 'failed';
  const done = tx.status === 'succeeded';
  const word = failed ? 'Failed' : done ? 'Funded' : 'Pending';
  return {
    id: `fund_${tx.id}`,
    createdAt: tx.createdAt,
    title: `${who} funded`,
    meta: `${word}${hash === null ? '' : ` · tx ${shortHash(hash)}`}`,
    ...(amount === null ? {} : { value: amount }),
    ...(failed ? { chip: 'Failed', tone: 'danger' as const } : {}),
    detail: {
      title: 'Card funded',
      chip: word,
      tone: failed ? 'danger' : done ? 'mint' : 'outline',
      rows: [
        ['Card', card === undefined ? 'Not recorded' : cardLabel(card)],
        ['Amount', amount ?? 'Not recorded'],
        ['Tx', hash === null ? 'Waiting for the chain' : shortHash(hash)],
      ],
      hash,
    },
  };
}

/** Shown once Velo has verified the budget; the dashboard carries no credit timestamp, so it sorts at the program's creation. */
function budgetItems(dashboard: Dashboard): FeedItem[] {
  if (dashboard.budget?.state !== 'verified') return [];
  const amount = php(dashboard.budget.verifiedStroops, dashboard.phpPerXlm);
  const intent = dashboard.budget.paymentIntentId;
  return [
    {
      id: 'budget_verified',
      createdAt: dashboard.program?.createdAt ?? 0,
      title: 'Budget verified',
      meta: 'Velo hosted checkout',
      value: amount,
      detail: {
        title: 'Budget verified',
        chip: 'Velo verified',
        tone: 'accent',
        rows: [
          ['Verified', amount],
          ['Payment intent', intent ?? 'Not recorded'],
        ],
        hash: null,
      },
    },
  ];
}

/** Milestone rows that must never be cut by FEED_LIMIT: budget, per-card fund, tranche, claim/held and sweep/program end. */
const PINNED_AGENTS: Record<string, true> = { tranche: true, settlement: true, sweep: true };
const isPinned = (d: AgentDecision): boolean => PINNED_AGENTS[d.agent] === true;

export function buildFeed(dashboard: Dashboard): FeedItem[] {
  const hashOf = txLookup(dashboard);
  const decisions = dashboard.recentDecisions ?? [];
  const pinned: FeedItem[] = [
    ...budgetItems(dashboard),
    ...(dashboard.recentChainTxs ?? []).filter((tx) => tx.kind === 'fund').map((tx) => fundItem(tx, dashboard)),
    ...decisions.filter(isPinned).map((d) => decisionItem(d, dashboard, hashOf)),
  ];
  const volume: FeedItem[] = [
    ...(dashboard.recentTaps ?? []).map((tap) => tapItem(tap, dashboard, hashOf)),
    ...decisions.filter((d) => !isPinned(d)).map((d) => decisionItem(d, dashboard, hashOf)),
  ]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, Math.max(0, FEED_LIMIT - pinned.length));
  return [...pinned, ...volume].sort((a, b) => b.createdAt - a.createdAt);
}
