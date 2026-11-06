// The session check's decision logic, kept pure: only an authoritative answer from the API may log anyone out.
import type { AuthUser } from '@tapat/shared';

export type SessionCheck =
  | { kind: 'user'; user: AuthUser }
  | { kind: 'anonymous' }
  | { kind: 'unreachable' };

export interface SessionCheckOptions {
  /** Total tries including the first. */
  attempts?: number;
  /** Pause before retry n (0-based); the last value repeats. */
  delaysMs?: readonly number[];
  sleep?: (ms: number) => Promise<void>;
  /** Checked after each await; when true the result is discarded and `unreachable` returned. */
  cancelled?: () => boolean;
}

const DEFAULT_DELAYS_MS = [500, 1000, 1500] as const;

const realSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Asks `fetchMe` who is logged in. A resolved `{user}` is authoritative (`user: null` means logged out). A thrown
 * error (network, abort, non-2xx, proxy hiccup) is NOT an answer: it is retried with backoff, and when every attempt
 * fails the result is `unreachable`, never `anonymous`.
 */
export async function checkSession(
  fetchMe: () => Promise<{ user: AuthUser | null }>,
  options: SessionCheckOptions = {},
): Promise<SessionCheck> {
  const attempts = Math.max(1, options.attempts ?? 3);
  const delays = options.delaysMs ?? DEFAULT_DELAYS_MS;
  const sleep = options.sleep ?? realSleep;
  const cancelled = options.cancelled ?? (() => false);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const me = await fetchMe();
      if (cancelled()) return { kind: 'unreachable' };
      return me.user === null ? { kind: 'anonymous' } : { kind: 'user', user: me.user };
    } catch {
      if (cancelled()) return { kind: 'unreachable' };
      if (attempt === attempts - 1) break;
      const delay = delays.length === 0 ? 0 : delays[Math.min(attempt, delays.length - 1)]!;
      await sleep(delay);
      if (cancelled()) return { kind: 'unreachable' };
    }
  }
  return { kind: 'unreachable' };
}
