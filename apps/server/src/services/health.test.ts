import { describe, expect, it } from 'vitest';
import type { Velo } from '@tapat/agent';
import { HEALTH_CACHE_MS, checkHealth, createHealthProbes, type HealthProbes } from './health';

const RPC_URL = 'https://rpc.example.test';
const BOT_TOKEN = '123456:test-token';
const TELEGRAM_URL = `https://api.telegram.org/bot${BOT_TOKEN}/getMe`;

function jsonResponse(body: unknown): Response {
  return { ok: true, json: async () => body } as Response;
}

/** The probe only calls `paymentIntents.list`, but the injected type is the SDK's whole object. */
function fakeVelo(list: () => Promise<unknown>): Pick<Velo, 'paymentIntents'> {
  return { paymentIntents: { list } } as unknown as Pick<Velo, 'paymentIntents'>;
}

interface Harness {
  probes: HealthProbes;
  now: { value: number };
  counts: { rpc: number; telegram: number; list: number };
}

function harness(options: {
  rpc?: () => Promise<Response>;
  telegram?: () => Promise<Response>;
  list?: () => Promise<unknown>;
} = {}): Harness {
  const counts = { rpc: 0, telegram: 0, list: 0 };
  const now = { value: 0 };
  const rpc = options.rpc ?? (async () => jsonResponse({ jsonrpc: '2.0', id: 1, result: { status: 'healthy' } }));
  const telegram = options.telegram ?? (async () => jsonResponse({ ok: true, result: {} }));
  const list = options.list ?? (async () => ({ data: [], has_more: false }));

  const probes = createHealthProbes({
    config: { STELLAR_RPC_URL: RPC_URL, TELEGRAM_BOT_TOKEN: BOT_TOKEN },
    velo: fakeVelo(async () => {
      counts.list += 1;
      return list();
    }),
    now: () => now.value,
    fetch: (async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url === RPC_URL) {
        counts.rpc += 1;
        return rpc();
      }
      if (url === TELEGRAM_URL) {
        counts.telegram += 1;
        return telegram();
      }
      throw new Error(`unexpected fetch ${url}`);
    }) as typeof fetch,
  });

  return { probes, now, counts };
}

describe('checkHealth', () => {
  it('reports every probe ok and passes gasMode through', async () => {
    const { probes } = harness();
    await expect(checkHealth(probes, 'direct')).resolves.toEqual({
      ok: true,
      rpc: 'ok',
      velo: 'ok',
      telegram: 'ok',
      gasMode: 'direct',
    });
  });

  it('reports rpc down when the RPC body says unhealthy', async () => {
    const { probes } = harness({
      rpc: async () => jsonResponse({ jsonrpc: '2.0', id: 1, result: { status: 'unhealthy' } }),
    });
    await expect(checkHealth(probes, 'velo')).resolves.toMatchObject({ ok: false, rpc: 'down' });
  });

  it('reports rpc down when the RPC fetch throws', async () => {
    const { probes } = harness({
      rpc: async () => {
        throw new Error('ECONNREFUSED');
      },
    });
    await expect(checkHealth(probes, 'velo')).resolves.toMatchObject({ ok: false, rpc: 'down' });
  });

  it('stays ok when velo rejects but the RPC is healthy', async () => {
    const { probes } = harness({
      list: async () => {
        throw new Error('401');
      },
    });
    await expect(checkHealth(probes, 'velo')).resolves.toMatchObject({ ok: true, rpc: 'ok', velo: 'down' });
  });

  it('caches rpc, velo and telegram for HEALTH_CACHE_MS', async () => {
    const { probes, now, counts } = harness();

    await checkHealth(probes, 'velo');
    now.value = HEALTH_CACHE_MS - 1;
    await checkHealth(probes, 'velo');
    expect(counts).toEqual({ rpc: 1, telegram: 1, list: 1 });

    now.value = HEALTH_CACHE_MS;
    await checkHealth(probes, 'velo');
    expect(counts).toEqual({ rpc: 2, telegram: 2, list: 2 });
  });

  it('probes the RPC once for two quick calls', async () => {
    const { probes, counts } = harness();

    await Promise.all([checkHealth(probes, 'velo'), checkHealth(probes, 'velo')]);
    expect(counts).toEqual({ rpc: 1, telegram: 1, list: 1 });
  });
});
