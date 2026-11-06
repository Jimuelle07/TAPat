// The in-process SSE fan-out (docs/system-design.md §8). Services publish after writing their row; the route
// subscribes. Payloads are the camelCase REST shapes from api-and-data.md §3, never DB rows.

/** api-and-data.md §5.4, closed set. */
export type SseEventName =
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

export type SseListener = (event: SseEventName, data: unknown) => void;

export interface SseBus {
  publish(event: SseEventName, data: unknown): void;
  /** Registers `fn` and returns its unsubscribe. */
  subscribe(fn: SseListener): () => void;
}

export function createSseBus(): SseBus {
  const listeners = new Set<SseListener>();
  return {
    publish(event, data) {
      // A closed connection removes itself on the next `close`; a throwing listener must not stop the others.
      for (const fn of [...listeners]) {
        try {
          fn(event, data);
        } catch {
          // The route drops a listener whose socket is gone.
        }
      }
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}
