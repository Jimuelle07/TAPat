// The /api/health probes (docs/api-and-data.md §5.2 #1). All three are cached for HEALTH_CACHE_MS and single-flight
// so a down service is not hammered; `ok` depends on `rpc` only: Velo or Telegram down is degraded.
import type { GasMode, HealthResponse } from '@tapat/shared';
import type { Velo } from '@tapat/agent';
import type { Config } from '../config';

export const HEALTH_CACHE_MS = 30_000;

export interface HealthProbes {
  rpc(): Promise<boolean>;
  velo(): Promise<boolean>;
  telegram(): Promise<boolean>;
}

export interface HealthProbeDeps {
  config: Pick<Config, 'STELLAR_RPC_URL' | 'TELEGRAM_BOT_TOKEN'>;
  velo: Pick<Velo, 'paymentIntents'>;
  fetch?: typeof fetch;   // default globalThis.fetch
  now?: () => number;     // default Date.now
}

export function createHealthProbes(deps: HealthProbeDeps): HealthProbes {
  const doFetch = deps.fetch ?? globalThis.fetch;
  const now = deps.now ?? Date.now;

  /** Remembers the last result (successes and failures) for HEALTH_CACHE_MS; concurrent misses share one probe. */
  const cached = (fn: () => Promise<boolean>): (() => Promise<boolean>) => {
    let entry: { at: number; value: boolean } | null = null;
    let inFlight: Promise<boolean> | null = null;
    return async () => {
      const at = now();
      if (entry !== null && at - entry.at < HEALTH_CACHE_MS) return entry.value;
      if (inFlight !== null) return inFlight;
      const pending = fn()
        .then((value) => {
          entry = { at, value };
          return value;
        })
        .finally(() => {
          inFlight = null;
        });
      inFlight = pending;
      return pending;
    };
  };

  const rpc = cached(async (): Promise<boolean> => {
    try {
      const response = await doFetch(deps.config.STELLAR_RPC_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth' }),
        signal: AbortSignal.timeout(5000), // public testnet RPC answers getHealth in 0.7–5.5 s
      });
      const body = (await response.json()) as { result?: { status?: unknown } };
      return body.result?.status === 'healthy';
    } catch {
      return false;
    }
  });

  const velo = cached(async () => {
    try {
      // Same 5 s budget as the RPC probe: a slow Velo answer is not an outage.
      await deps.velo.paymentIntents.list({ limit: 1 }, { timeoutMs: 5000, maxRetries: 0 });
      return true;
    } catch {
      return false;
    }
  });

  // Never log here: this URL contains the bot token.
  const telegram = cached(async () => {
    try {
      const response = await doFetch(`https://api.telegram.org/bot${deps.config.TELEGRAM_BOT_TOKEN}/getMe`, {
        signal: AbortSignal.timeout(2000),
      });
      const body = (await response.json()) as { ok?: unknown };
      return response.ok && body.ok === true;
    } catch {
      return false;
    }
  });

  return { rpc, velo, telegram };
}

export async function checkHealth(probes: HealthProbes, gasMode: GasMode): Promise<HealthResponse> {
  const [rpc, velo, telegram] = await Promise.all([probes.rpc(), probes.velo(), probes.telegram()]);
  return {
    ok: rpc,
    rpc: rpc ? 'ok' : 'down',
    velo: velo ? 'ok' : 'down',
    telegram: telegram ? 'ok' : 'down',
    gasMode,
  };
}
