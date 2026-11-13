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
    /** The status in plain words, never a raw decision code. */
    chip: string;
    tone: FeedTone;
    /** One sentence on what happened. */
    summary: string;
    /** The agent that decided, for agent decisions. */
    agent?: string;
    rows: Array<[string, string]>;
    /** Full tx hash for the explorer link, when one was submitted. */
    hash: string | null;
    /** Said in place of the transaction when there is none; the panel has a default. */
    chainNote?: string;
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
        summary: `The contract checked the card's policy and approved ${amount} at ${station}. The station is paid when settlement claims it.`,
        rows: [...rows, ['MIDAS score', midas]],
        hash,
        chainNote: 'Waiting for the chain.',
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
      detail: {
        title: 'Simulated edge',
        chip: 'Refused',
        tone: 'outline',
        summary: "A simulated burst tap. It was refused, so no money moved; it only feeds the Freeze Agent's score.",
        rows: [...rows, ['MIDAS score', midas]],
        hash: null,
        label: 'simulated burst',
      },
    };
  }
  const refused = tap.status === 'refused';
  const failed = tap.status === 'failed';
  const word = failed ? 'Failed' : refused ? 'Refused' : 'Declined';
  const why = reason ?? 'the chain call did not finish';
  return {
    id: tap.id,
    createdAt: tap.createdAt,
    title,
    meta: `${word} · ${why}`,
    chip: word,
    tone: 'danger',
    detail: {
      title: `Tap ${word.toLowerCase()}`,
      chip: word,
      tone: 'danger',
      summary: `This tap was ${word.toLowerCase()}: ${why}. No money moved.`,
      rows: [...rows, ['Reason', why]],
      hash,
      chainNote: 'None submitted.',
    },
  };
}

const SOURCE_LABEL: Record<string, string> = { csv: 'CSV', ocr_precomputed: 'Scanned list (precomputed OCR)' };
const PHOTO_LABEL: Record<string, string> = { precomputed: 'Precomputed', officer_confirmed: 'Confirmed by the officer' };

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
  const count = (value: unknown): string => String(asNumber(value) ?? 'Not recorded');

  if (decision.agent === 'tranche') {
    const funded = asList(outputs.funded);
    const skipped = asList(outputs.skipped);
    const total = funded.reduce((sum, entry) => sum + BigInt(asString(entry.amountStroops) ?? '0'), 0n);
    const exhausted = decision.decision === 'BUDGET_EXHAUSTED';
    const label = (id: unknown): string => {
      const card = dashboard.cards.find((c) => c.id === id);
      return card === undefined ? String(id) : `…${card.uidLast4}`;
    };
    const skippedNote = skipped.length === 0 ? '' : `; ${skipped.length} skipped`;
    return {
      ...base,
      title: exhausted ? 'Budget ran out' : 'Tranche released',
      meta: `Tranche Agent · ${funded.length} cards funded, ${skipped.length} skipped`,
      value: php(total, rate),
      detail: {
        title: exhausted ? 'Budget ran out' : 'Tranche released',
        chip: exhausted ? 'Budget ran out' : 'Funded',
        tone: 'mint',
        agent: 'Tranche Agent',
        summary: exhausted
          ? `The budget ran out: ${funded.length} cards were funded with ${php(total, rate)}${skippedNote}.`
          : `The Tranche Agent released ${php(total, rate)} to ${funded.length} cards${skippedNote}.`,
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
        chainNote: "Each card's fund transaction has its own row in the activity list.",
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
          chip: 'Frozen',
          tone: 'frozen',
          agent: 'Freeze Agent',
          summary: `${stationName} is frozen: new taps are refused before signing, and it is not settled until an officer unfreezes it.`,
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
    if (decision.decision === 'UNFROZEN') {
      const title = `${stationName} unfrozen`;
      return {
        ...base,
        title,
        meta: 'LGU released the station',
        detail: {
          title,
          chip: 'Unfrozen',
          tone: 'outline',
          agent: 'Freeze Agent',
          summary: `An officer unfroze ${stationName}. It takes taps again and is settled with the other stations.`,
          rows: [['Station', stationName]],
          hash: null,
        },
      };
    }
    const ticks = asNumber(inputs.ticks);
    const perStation = typeof outputs.perStation === 'object' && outputs.perStation !== null ? (outputs.perStation as Record<string, unknown>) : {};
    const nameOf = (id: string): string => dashboard.stations.find((s) => s.id === id)?.name ?? `Station ${id}`;
    const title = 'Freeze Agent baseline set';
    return {
      ...base,
      title,
      meta: 'Honest history replayed at start-up',
      detail: {
        title,
        chip: 'Baseline set',
        tone: 'outline',
        agent: 'Freeze Agent',
        summary: `At start-up the Freeze Agent replayed ${ticks === null ? 'the honest tap history' : `${ticks} ticks of honest taps`} to learn each station's normal volume. It never freezes a station during this warm-up.`,
        rows: [
          ['Ticks replayed', count(inputs.ticks)],
          ...Object.entries(perStation).map(([id, value]): [string, string] => {
            const normal = asNumber(value);
            return [`${nameOf(id)} normal`, normal === null ? 'Not recorded' : `${normal.toFixed(1)} taps per 10 ticks`];
          }),
        ],
        hash: null,
      },
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
        detail: {
          title: 'Settlement held',
          chip: 'Held',
          tone: 'ink',
          agent: 'Settlement Agent',
          summary: `${stationName} is frozen, so ${amount} stays in escrow and no claim was sent.`,
          rows: [['Station', stationName], ['Amount', amount]],
          hash: null,
          chainNote: 'None submitted: the station is frozen.',
        },
      };
    }
    if (decision.decision === 'NOTHING_PENDING') {
      const title = `${stationName}: nothing pending`;
      return {
        ...base,
        title,
        meta: 'Settlement · no claim needed',
        detail: {
          title,
          chip: 'Nothing pending',
          tone: 'outline',
          agent: 'Settlement Agent',
          summary: `${stationName} had nothing new to claim, so no transaction was sent.`,
          rows: [['Station', stationName], ['Pending', amount]],
          hash: null,
        },
      };
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
        agent: 'Settlement Agent',
        summary: claimed ? `Settlement claimed ${amount} for ${stationName}.` : `The claim of ${amount} for ${stationName} did not go through.`,
        rows: [['Station', stationName], ['Amount', amount]],
        hash,
        chainNote: 'None submitted.',
      },
    };
  }
  if (decision.agent === 'sweep') {
    if (decision.decision === 'PROGRAM_ENDED') {
      const returned = money(outputs.totalReturnedStroops);
      const txs = decision.txIds.length;
      return {
        ...base,
        title: 'Program ended',
        meta: 'Sweep Agent · unspent credit returned',
        detail: {
          title: 'Program ended',
          chip: 'Program ended',
          tone: 'outline',
          agent: 'Sweep Agent',
          summary: `The program ended and the Sweep Agent returned ${returned} of unspent credit to the LGU wallet.`,
          rows: [
            ['Cards processed', count(inputs.cardsProcessed)],
            ['Cards swept', count(inputs.cardsSwept)],
            ['Returned', returned],
          ],
          hash: null,
          ...(txs > 0 ? { chainNote: `${txs} sweep ${txs === 1 ? 'transaction' : 'transactions'}; each card's row links its own.` } : {}),
        },
      };
    }
    const card = dashboard.cards.find((c) => c.id === outputs.cardId);
    const title = card === undefined ? 'Card swept' : `${card.displayName} …${card.uidLast4}`;
    const swept = decision.decision === 'SWEPT';
    const reason = asString(outputs.reason) ?? 'nothing to return';
    const returned = money(outputs.returnedStroops);
    return {
      ...base,
      title,
      meta: swept ? 'Returned to the LGU wallet' : `Skipped · ${reason}`,
      ...(swept ? { value: returned } : {}),
      detail: {
        title: swept ? 'Credit returned' : 'Sweep skipped',
        chip: swept ? 'Swept' : 'Skipped',
        tone: 'outline',
        agent: 'Sweep Agent',
        summary: swept ? `${returned} of unspent credit on this card went back to the LGU wallet.` : `Nothing was returned from this card: ${reason}.`,
        rows: swept ? [['Card', title], ['Returned', returned]] : [['Card', title], ['Reason', reason]],
        hash,
      },
    };
  }
  return intakeItem(decision, dashboard, base, hash);
}

/** Intake writes four shapes: a masterlist upload, an enrollment, an evidence request and the evidence check. */
function intakeItem(decision: AgentDecision, dashboard: Dashboard, base: { id: string; createdAt: number }, hash: string | null): FeedItem {
  const { inputs, outputs } = decision;
  const total = asNumber(outputs.total);
  const agent = 'Intake Agent';

  if (total !== null) {
    const n = (key: string): number => asNumber(outputs[key]) ?? 0;
    const view =
      decision.decision === 'REJECTED'
        ? { chip: 'Rows rejected', tone: 'danger' as const }
        : decision.decision === 'UNCERTAIN'
          ? { chip: 'Needs review', tone: 'outline' as const }
          : { chip: 'All approved', tone: 'mint' as const };
    const source = asString(outputs.source);
    return {
      ...base,
      title: 'Masterlist checked',
      meta: `${agent} · ${total} rows, ${n('rejected')} rejected`,
      detail: {
        title: 'Masterlist checked',
        ...view,
        agent,
        summary: `An upload of ${total} rows went through the hard rules and the matcher: ${n('rejected')} rejected, ${n('uncertain')} need review.`,
        rows: [
          ['Source', source === null ? 'Not recorded' : (SOURCE_LABEL[source] ?? source)],
          ['Approved', String(n('approved'))],
          ['Already enrolled', String(n('enrolled'))],
          ['Uncertain', String(n('uncertain'))],
          ['Rejected', String(n('rejected'))],
          ['Approve at or above λ', asNumber(inputs.lambdaHi)?.toFixed(2) ?? 'Not recorded'],
          ['Reject below λ', asNumber(inputs.lambdaLo)?.toFixed(2) ?? 'Not recorded'],
        ],
        hash: null,
      },
    };
  }
  if (decision.decision === 'APPROVED') {
    const card = dashboard.cards.find((c) => c.id === outputs.cardId);
    const who = card === undefined ? 'A driver' : cardLabel(card);
    const photo = asString(outputs.photoSource);
    return {
      ...base,
      title: 'Driver enrolled',
      meta: `${agent} · ${card === undefined ? 'card registered' : cardLabel(card)}`,
      detail: {
        title: 'Driver enrolled',
        chip: 'Enrolled',
        tone: 'mint',
        agent,
        summary: `${who} was enrolled and the card was registered on-chain.`,
        rows: [
          ['Card', card === undefined ? 'Not recorded' : cardLabel(card)],
          ['Device hash', asString(outputs.deviceHashPrefix) ?? 'Not recorded'],
          ['Photo check', photo === null ? 'Not recorded' : (PHOTO_LABEL[photo] ?? photo)],
        ],
        hash,
        chainNote: 'Waiting for the chain.',
      },
    };
  }
  if (decision.decision === 'EVIDENCE_REQUESTED') {
    const sent = outputs.telegramSent === true;
    return {
      ...base,
      title: 'Evidence requested',
      meta: `${agent} · ${sent ? 'sent on Telegram' : 'link handed over'}`,
      detail: {
        title: 'Evidence requested',
        chip: 'Evidence requested',
        tone: 'outline',
        agent,
        summary: `A beneficiary needs review, so the Intake Agent asked for their OR/CR ${sent ? 'on Telegram' : 'through a link the officer shares'}.`,
        rows: [
          ['Score', asNumber(inputs.score)?.toFixed(2) ?? 'Not recorded'],
          ['Telegram', sent ? 'Sent' : 'Not sent; the officer shares the link'],
        ],
        hash: null,
      },
    };
  }
  if (decision.decision === 'EVIDENCE_VERIFIED' || decision.decision === 'EVIDENCE_UNMATCHED') {
    const verified = decision.decision === 'EVIDENCE_VERIFIED';
    const plate = asString(outputs.plate);
    const title = verified ? 'Evidence verified' : 'Evidence did not match';
    return {
      ...base,
      title,
      meta: `${agent} · ${verified ? 'OR/CR matched' : 'no match'}`,
      detail: {
        title,
        chip: verified ? 'Verified' : 'Did not match',
        tone: verified ? 'mint' : 'danger',
        agent,
        summary: verified
          ? `The OR/CR sent on Telegram matched the masterlist plate${plate === null ? '' : ` ${plate}`}.`
          : "The file sent on Telegram did not match this beneficiary's plate.",
        rows: [['Plate read', plate ?? 'Not read']],
        hash: null,
      },
    };
  }
  const title = 'Masterlist decision';
  return {
    ...base,
    title,
    meta: `${agent} · ${decision.decision.toLowerCase().replaceAll('_', ' ')}`,
    detail: {
      title,
      chip: decision.decision.toLowerCase().replaceAll('_', ' '),
      tone: 'outline',
      agent,
      summary: 'The Intake Agent recorded a masterlist decision.',
      rows: [],
      hash,
    },
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
      agent: 'Tranche Agent',
      summary: failed
        ? 'Funding this card did not go through.'
        : done
          ? `This card received ${amount ?? 'its tranche'} from the Tranche Agent's release.`
          : 'Funding this card is waiting for the chain.',
      rows: [
        ['Card', card === undefined ? 'Not recorded' : cardLabel(card)],
        ['Amount', amount ?? 'Not recorded'],
      ],
      hash,
      chainNote: 'Waiting for the chain.',
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
        summary: `Velo verified the ${amount} budget payment, so tranches can be funded from it.`,
        rows: [
          ['Verified', amount],
          ['Payment intent', intent ?? 'Not recorded'],
        ],
        hash: null,
        chainNote: 'Verified by Velo; the payment intent is the record.',
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
