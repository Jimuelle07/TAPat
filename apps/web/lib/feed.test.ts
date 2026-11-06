import { describe, expect, it } from 'vitest';
import type { AgentDecision, ChainTx, Dashboard, Tap } from '@tapat/shared';
import { buildFeed } from './feed';

const tap = (over: Partial<Tap>): Tap => ({
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
  midasScore: 0.12,
  tick: 1,
  createdAt: 100,
  ...over,
});

const decision = (over: Partial<AgentDecision>): AgentDecision => ({
  id: 'dec_1',
  agent: 'freeze',
  decision: 'FROZEN',
  inputs: {},
  outputs: {},
  txIds: [],
  createdAt: 200,
  ...over,
});

function dashboard(over: Partial<Dashboard>): Dashboard {
  return {
    phpPerXlm: 10,
    cards: [{ id: 'card_D1', beneficiaryId: 'ben', displayName: 'Juan D.', uidLast4: '9C7E', deviceHashPrefix: '3f9c1a0b', virtual: false, status: 'active', expiresAtS: 0, expired: false, escrowStroops: '0', returnedStroops: '0' }],
    stations: [{ id: 'A', name: 'Petron San Roque', publicKey: 'G', status: 'active', frozenReason: null, frozenAt: null, pendingStroops: '0', spentStroops: '0' }],
    recentTaps: [],
    recentDecisions: [],
    recentChainTxs: [],
    ...over,
  } as Dashboard;
}

describe('buildFeed', () => {
  it('merges taps and decisions newest first', () => {
    const feed = buildFeed(dashboard({ recentTaps: [tap({})], recentDecisions: [decision({ outputs: { stationName: 'Rotonda Fuels' }, inputs: { midasScore: 2.31, threshold: 1.78 } })] }));
    expect(feed.map((item) => item.id)).toEqual(['dec_1', 'tap_1']);
    expect(feed[0]).toMatchObject({ title: 'Rotonda Fuels frozen', meta: 'Freeze Agent · MIDAS 2.31 >= 1.78', chip: 'Frozen' });
  });

  it('caps the feed at 50 rows', () => {
    const taps = Array.from({ length: 50 }, (_, i) => tap({ id: `tap_${i}`, createdAt: i }));
    const decisions = Array.from({ length: 20 }, (_, i) => decision({ id: `dec_${i}`, createdAt: 1000 + i }));
    expect(buildFeed(dashboard({ recentTaps: taps, recentDecisions: decisions }))).toHaveLength(50);
  });

  it('resolves a paid tap to its hash, never showing the internal id', () => {
    const tx = { id: 'ctx_1', outerHash: '7f3a000000000000c21e', innerHash: 'x' } as ChainTx;
    const [item] = buildFeed(dashboard({ recentTaps: [tap({})], recentChainTxs: [tx] }));
    expect(item).toMatchObject({ title: '…9C7E at Petron San Roque', meta: 'Paid · tx 7f3a…c21e', value: 'PHP 350.00' });
    expect(item?.detail.hash).toBe('7f3a000000000000c21e');
  });

  it('says the tx is pending instead of inventing one', () => {
    const [item] = buildFeed(dashboard({ recentTaps: [tap({})] }));
    expect(item?.meta).toBe('Paid');
    expect(item?.detail.hash).toBeNull();
  });

  it('labels declines through TAP_REASON_LABELS and marks no tx', () => {
    const [item] = buildFeed(dashboard({ recentTaps: [tap({ status: 'rejected', reasonCode: 'OVER_CAP', chainTxId: null })] }));
    expect(item).toMatchObject({ meta: 'Declined · over the ₱500.00 per-tap cap', chip: 'Declined', tone: 'danger' });
    expect(item?.detail.rows).toContainEqual(['Tx', 'None submitted']);
  });

  it('labels burst edges as simulated, with no card', () => {
    const [item] = buildFeed(dashboard({ recentTaps: [tap({ cardId: null, cardRef: 'v12', status: 'refused', reasonCode: 'SIMULATED_EDGE', chainTxId: null })] }));
    expect(item).toMatchObject({ chip: 'Simulated' });
    expect(item?.title).toBe('Simulated edge at Petron San Roque');
    expect(item?.detail.label).toBe('simulated burst');
  });

  it('marks a failed claim as failed, not claimed', () => {
    const [item] = buildFeed(dashboard({ recentDecisions: [decision({ agent: 'settlement', decision: 'CLAIMED', outputs: { stationId: 'A', stationName: 'Petron San Roque', amountStroops: '350000000', claimed: false } })] }));
    expect(item).toMatchObject({ title: 'Petron San Roque claim failed', chip: 'Failed' });
  });

  it('sums a tranche and counts skipped cards', () => {
    const [item] = buildFeed(
      dashboard({
        recentDecisions: [
          decision({
            agent: 'tranche',
            decision: 'FUNDED',
            inputs: { pricePhp: 71.2 },
            outputs: { funded: [{ cardId: 'card_D1', amountStroops: '1500000000' }, { cardId: 'x', amountStroops: '1500000000' }], skipped: [{ cardId: 'card_D1', reason: 'EXPIRED' }] },
          }),
        ],
      }),
    );
    expect(item).toMatchObject({ title: 'Tranche released', meta: 'Tranche Agent · 2 cards funded, 1 skipped', value: 'PHP 3,000.00' });
    expect(item?.detail.rows).toContainEqual(['Skipped', '…9C7E EXPIRED']);
  });
});
