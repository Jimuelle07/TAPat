'use client';

// The ONLY SSE entry point (AGENTS.md §3, api-and-data.md §5.4, system-design.md §8).
// `useStream(onEvent)` opens `EventSource('/api/stream')` — relative, so it is same-origin through the Next.js
// rewrite on a laptop and through Caddy's `/api/*` route in prod — and hands each frame to the caller as
// `{ event, data }` with `data` already JSON-parsed.
import { useEffect, useRef } from 'react';
import type { AgentDecision, Card, ChainTx, FreezeEvent, PricePoint, Program, Tap } from '@tapat/shared';

/** The closed event set of api-and-data.md §5.4. */
export type StreamEventName =
  | 'price'
  | 'tranche'
  | 'enroll'
  | 'tap'
  | 'freeze'
  | 'settlement'
  | 'sweep'
  | 'budget'
  | 'chain_tx'
  | 'intake';

export const STREAM_EVENT_NAMES: readonly StreamEventName[] = [
  'price',
  'tranche',
  'enroll',
  'tap',
  'freeze',
  'settlement',
  'sweep',
  'budget',
  'chain_tx',
  'intake',
];

/** Each event's `data:` payload, in the camelCase REST shape (§5.4 table). */
export interface StreamPayloads {
  price: PricePoint;
  tranche: AgentDecision;
  enroll: Card;
  tap: Tap;
  freeze: FreezeEvent;
  settlement: AgentDecision;
  sweep: AgentDecision;
  budget: Program;
  chain_tx: ChainTx;
  intake: AgentDecision;
}

/** A discriminated union, so `event === 'tap'` narrows `data` to `Tap`. */
export type StreamEvent = {
  [K in StreamEventName]: { event: K; data: StreamPayloads[K] };
}[StreamEventName];

/** Same-origin path: the Next.js rewrite locally, Caddy's `/api/*` route in prod. */
export const STREAM_PATH = '/api/stream';

/** The laptop-only debugging target behind `/?sse=direct` (§5.4); the API's CORS allows that origin. */
export const DIRECT_STREAM_URL = 'http://localhost:4000/api/stream';

/** `/?sse=direct` points at the API port directly; every other page uses the relative path. */
export function streamUrl(search?: string): string {
  const query = search ?? (typeof window === 'undefined' ? '' : window.location.search);
  return new URLSearchParams(query).get('sse') === 'direct' ? DIRECT_STREAM_URL : STREAM_PATH;
}

/**
 * Upserts `next` into a list keyed by `id`: an existing row is replaced in place (the scored-tap re-emit
 * updates the same `tap` row), a new row is appended, or prepended for a newest-first feed.
 */
export function upsertById<T extends { id: string }>(
  list: readonly T[],
  next: T,
  options: { position?: 'start' | 'end' } = {},
): T[] {
  const index = list.findIndex((item) => item.id === next.id);
  if (index === -1) return options.position === 'start' ? [next, ...list] : [...list, next];
  const copy = [...list];
  copy[index] = next;
  return copy;
}

export interface UseStreamOptions {
  /**
   * Called on every (re)connect. There is no replay (§5.4): the caller re-reads `GET /api/dashboard` and
   * `GET /api/agents/tranche/state` here so a reconnect does not leave a hole.
   */
  onOpen?: () => void;
}

/**
 * Subscribes a client component to `GET /api/stream` and closes the connection on unmount.
 * Must be used from a client component (the module carries `'use client'`).
 */
export function useStream(onEvent: (event: StreamEvent) => void, options: UseStreamOptions = {}): void {
  const handler = useRef(onEvent);
  const onOpen = useRef(options.onOpen);

  useEffect(() => {
    handler.current = onEvent;
    onOpen.current = options.onOpen;
  }, [onEvent, options.onOpen]);

  useEffect(() => {
    const source = new EventSource(streamUrl());
    const listeners = STREAM_EVENT_NAMES.map((name) => {
      const listener = (message: MessageEvent<string>): void => {
        const payload = parseFrame(message.data);
        if (payload === undefined) return;
        // `name` is the event that delivered the frame, so it and the payload belong to the same union member.
        handler.current({ event: name, data: payload } as StreamEvent);
      };
      source.addEventListener(name, listener as EventListener);
      return { name, listener };
    });

    const open = (): void => onOpen.current?.();
    source.addEventListener('open', open);

    return () => {
      source.removeEventListener('open', open);
      for (const { name, listener } of listeners) source.removeEventListener(name, listener as EventListener);
      source.close();
    };
  }, []);
}

/** A frame we cannot parse is not one of the ten events: ignore it rather than throw inside a handler. */
function parseFrame(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}
