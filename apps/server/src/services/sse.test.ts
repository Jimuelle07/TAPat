// The SSE bus (docs/system-design.md §8): fan-out only, payloads untouched.
import { describe, expect, it, vi } from 'vitest';
import type { Tap } from '@tapat/shared';
import { createSseBus } from './sse';

const TAP: Tap = {
  id: 'tap_7c1e',
  cardId: 'card_D1',
  cardRef: null,
  stationId: 'A',
  amountStroops: '350000000',
  nonce: '1793808200000',
  status: 'authorized',
  reasonCode: null,
  chainTxId: 'ctx_7c1e',
  simulated: false,
  midasScore: null,
  tick: null,
  createdAt: 1793808201234,
};

describe('createSseBus', () => {
  it('delivers the event name and the REST payload object to every subscriber', () => {
    const bus = createSseBus();
    const first = vi.fn();
    const second = vi.fn();
    bus.subscribe(first);
    bus.subscribe(second);

    bus.publish('tap', TAP);

    expect(first).toHaveBeenCalledWith('tap', TAP);
    expect(second).toHaveBeenCalledWith('tap', TAP);
  });

  it('stops delivering after unsubscribe', () => {
    const bus = createSseBus();
    const listener = vi.fn();
    const unsubscribe = bus.subscribe(listener);

    bus.publish('enroll', {});
    unsubscribe();
    bus.publish('enroll', {});

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('isolates a throwing subscriber so the others still receive the event', () => {
    const bus = createSseBus();
    const healthy = vi.fn();
    bus.subscribe(() => {
      throw new Error('socket closed');
    });
    bus.subscribe(healthy);

    bus.publish('chain_tx', { id: 'ctx_1' });

    expect(healthy).toHaveBeenCalledWith('chain_tx', { id: 'ctx_1' });
  });
});
