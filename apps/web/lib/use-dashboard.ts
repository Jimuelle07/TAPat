'use client';

// The one way a page reads program state: a single `GET /api/dashboard` (its 404 means "no program"), the
// stream, and a module-level snapshot, so a navigation paints the last dashboard at once and revalidates
// behind it instead of starting from a spinner.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dashboard } from '@tapat/shared';
import { ApiClientError, getDashboard } from './api';
import { useStream, type StreamEvent } from './sse';

export type DashboardState =
  | { status: 'loading' }
  | { status: 'no-program' }
  | { status: 'error'; message: string }
  | { status: 'ready'; dashboard: Dashboard };

/** Totals are derived server-side, so an event means "re-read" rather than a local patch. Bursts arrive 100 ms apart. */
const REFETCH_THROTTLE_MS = 400;

/** An `open` this soon after a settled read is the stream confirming a read we just made, not news. */
const OPEN_RELOAD_GRACE_MS = 1000;

/** `price` ticks only move the tranche chart, which polls its own state. */
function changesDashboard(event: StreamEvent): boolean {
  return event.event !== 'price';
}

export function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Something went wrong on our side. Try again in a moment.';
}

/** A settled read: the state to paint, or the failure to report without discarding numbers already on screen. */
type LoadOutcome = { kind: 'loaded'; state: DashboardState } | { kind: 'failed'; cause: unknown };

/** The last resolved dashboard, shared by every mount, so a revisit paints it before the network answers. */
let snapshot: DashboardState | null = null;

/** The read in flight, shared by the mount effect, `onOpen` and every other mounted instance. */
let inFlight: Promise<LoadOutcome> | null = null;

/** When the last read settled, for `OPEN_RELOAD_GRACE_MS`. */
let settledAt = 0;

async function fetchDashboard(): Promise<LoadOutcome> {
  try {
    return { kind: 'loaded', state: { status: 'ready', dashboard: await getDashboard() } };
  } catch (cause) {
    if (cause instanceof ApiClientError && cause.code === 'NOT_FOUND') {
      return { kind: 'loaded', state: { status: 'no-program' } };
    }
    return { kind: 'failed', cause };
  }
}

/** Joins the read in flight instead of starting a second one. */
function loadDashboard(): Promise<LoadOutcome> {
  if (inFlight !== null) return inFlight;
  const load = fetchDashboard().then((outcome) => {
    if (outcome.kind === 'loaded') snapshot = outcome.state;
    settledAt = Date.now();
    inFlight = null;
    return outcome;
  });
  inFlight = load;
  return load;
}

export function useDashboard(onEvent?: (event: StreamEvent) => void): DashboardState & { reload: () => Promise<void> } {
  const [state, setState] = useState<DashboardState>(() => snapshot ?? { status: 'loading' });
  const latest = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const followUp = useRef(false);
  const alive = useRef(true);

  const reload = useCallback(async () => {
    const request = ++latest.current;
    const outcome = await loadDashboard();
    if (request !== latest.current) return;
    if (outcome.kind === 'loaded') {
      setState(outcome.state);
      return;
    }
    // A failed background refresh must not wipe numbers already on screen.
    setState((current) => (current.status === 'ready' ? current : { status: 'error', message: errorMessage(outcome.cause) }));
  }, []);

  /** An event means the numbers changed: a read that started before it cannot answer it. */
  const reloadAfterInFlight = useCallback(async () => {
    if (followUp.current || !alive.current) return;
    followUp.current = true;
    const pending = inFlight;
    if (pending !== null) await pending;
    followUp.current = false;
    if (!alive.current) return;
    await reload();
  }, [reload]);

  useEffect(() => {
    alive.current = true;
    const request = ++latest.current;
    loadDashboard().then((outcome) => {
      if (!alive.current || request !== latest.current) return;
      if (outcome.kind === 'loaded') {
        setState(outcome.state);
        return;
      }
      // A failed background refresh must not wipe numbers already on screen.
      setState((current) => (current.status === 'ready' ? current : { status: 'error', message: errorMessage(outcome.cause) }));
    });
    return () => {
      alive.current = false;
      clearTimeout(timer.current);
      timer.current = undefined;
    };
  }, []);

  const handleOpen = useCallback(() => {
    if (Date.now() - settledAt < OPEN_RELOAD_GRACE_MS) return;
    void reload();
  }, [reload]);

  useStream(
    (event) => {
      onEvent?.(event);
      if (!changesDashboard(event) || timer.current !== undefined) return;
      timer.current = setTimeout(() => {
        timer.current = undefined;
        void reloadAfterInFlight();
      }, REFETCH_THROTTLE_MS);
    },
    { onOpen: handleOpen },
  );

  return { ...state, reload };
}
