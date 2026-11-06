'use client';

// The one way a page reads program state: `GET /api/program`, then `GET /api/dashboard`, then the stream.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dashboard } from '@tapat/shared';
import { ApiClientError, getDashboard, getProgram } from './api';
import { useStream, type StreamEvent } from './sse';

export type DashboardState =
  | { status: 'loading' }
  | { status: 'no-program' }
  | { status: 'error'; message: string }
  | { status: 'ready'; dashboard: Dashboard };

/** Totals are derived server-side, so an event means "re-read" rather than a local patch. Bursts arrive 100 ms apart. */
const REFETCH_THROTTLE_MS = 400;

/** `price` ticks only move the tranche chart, which polls its own state. */
function changesDashboard(event: StreamEvent): boolean {
  return event.event !== 'price';
}

export function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Something went wrong on our side. Try again in a moment.';
}

export function useDashboard(onEvent?: (event: StreamEvent) => void): DashboardState & { reload: () => Promise<void> } {
  const [state, setState] = useState<DashboardState>({ status: 'loading' });
  const latest = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(async () => {
    const request = ++latest.current;
    try {
      const { program } = await getProgram();
      const next: DashboardState =
        program === null ? { status: 'no-program' } : { status: 'ready', dashboard: await getDashboard() };
      if (request === latest.current) setState(next);
    } catch (cause) {
      if (request !== latest.current) return;
      if (cause instanceof ApiClientError && cause.code === 'NOT_FOUND') {
        setState({ status: 'no-program' });
        return;
      }
      // A failed background refresh must not wipe numbers already on screen.
      setState((current) => (current.status === 'ready' ? current : { status: 'error', message: errorMessage(cause) }));
    }
  }, []);

  useEffect(() => {
    void reload();
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [reload]);

  useStream(
    (event) => {
      onEvent?.(event);
      if (!changesDashboard(event) || timer.current !== null) return;
      timer.current = setTimeout(() => {
        timer.current = null;
        void reload();
      }, REFETCH_THROTTLE_MS);
    },
    { onOpen: () => void reload() },
  );

  return { ...state, reload };
}
