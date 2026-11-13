import { afterEach, describe, expect, it, vi } from 'vitest';
import { subscribe } from './sse';

/** A stand-in EventSource that records listeners and lets the test fire frames. */
class FakeEventSource {
  static made: FakeEventSource[] = [];
  closed = false;
  private listeners = new Map<string, Array<(message: { data: string }) => void>>();
  constructor(readonly url: string) {
    FakeEventSource.made.push(this);
  }
  addEventListener(name: string, listener: (message: { data: string }) => void): void {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]);
  }
  fire(name: string, data = ''): void {
    for (const listener of this.listeners.get(name) ?? []) listener({ data });
  }
  close(): void {
    this.closed = true;
  }
}

describe('subscribe', () => {
  afterEach(() => {
    FakeEventSource.made = [];
    vi.unstubAllGlobals();
  });

  it('shares one connection between subscribers and closes it after the last one leaves', () => {
    vi.stubGlobal('EventSource', FakeEventSource);
    const first = { onEvent: vi.fn(), onOpen: vi.fn() };
    const second = { onEvent: vi.fn(), onOpen: vi.fn() };
    const leaveFirst = subscribe('/api/stream', first);
    const leaveSecond = subscribe('/api/stream', second);
    expect(FakeEventSource.made).toHaveLength(1);

    const [source] = FakeEventSource.made;
    source?.fire('open');
    source?.fire('tap', '{"id":"tap_1"}');
    expect(first.onOpen).toHaveBeenCalledOnce();
    expect(second.onEvent).toHaveBeenCalledWith({ event: 'tap', data: { id: 'tap_1' } });

    leaveFirst();
    expect(source?.closed).toBe(false);
    leaveSecond();
    expect(source?.closed).toBe(true);

    subscribe('/api/stream', first)();
    expect(FakeEventSource.made).toHaveLength(2);
  });
});
