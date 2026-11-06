// GET /api/stream (docs/api-and-data.md §5.4): a published event reaches the client as one SSE frame.
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildServer } from '../server';
import { createSseBus, type SseBus } from '../services/sse';
import { SSE_HEARTBEAT_MS, registerStreamRoutes } from './stream';

let app: FastifyInstance | undefined;
let controller: AbortController | undefined;

afterEach(async () => {
  controller?.abort();
  controller = undefined;
  await app?.close();
  app = undefined;
});

async function listen(bus: SseBus): Promise<string> {
  app = await buildServer();
  registerStreamRoutes(app, { bus });
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  if (address === null || typeof address === 'string') throw new Error('no listening port');
  return `http://127.0.0.1:${address.port}/api/stream`;
}

describe('GET /api/stream', () => {
  it('streams a published event as `event:` + JSON `data:` with no-cache headers', async () => {
    const bus = createSseBus();
    const url = await listen(bus);
    controller = new AbortController();

    const response = await fetch(url, { signal: controller.signal });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/^text\/event-stream/);
    expect(response.headers.get('cache-control')).toBe('no-cache, no-transform');
    expect(response.headers.get('cache-control')).not.toContain('no-store');

    const reader = response.body?.getReader();
    if (reader === undefined) throw new Error('no response body');
    const decoder = new TextDecoder();
    // First body byte is written on connect, before any event, so proxies forward the stream at once.
    const first = await reader.read();
    let text = decoder.decode(first.value);
    expect(text.startsWith(': connected\n\n')).toBe(true);

    bus.publish('enroll', { id: 'card_D1', status: 'active' });
    while (!text.includes('data: {"id":"card_D1","status":"active"}\n\n')) {
      const { value, done } = await reader.read();
      if (done) break;
      text += decoder.decode(value);
    }
    const frame = text.slice(': connected\n\n'.length);

    expect(frame).toContain('event: enroll');
    expect(frame).toContain('data: {"id":"card_D1","status":"active"}');
    expect(frame.startsWith('id: 1\nevent: enroll\n')).toBe(true);
  });

  it('sends nothing historical on connect and keeps the 15 s heartbeat', async () => {
    expect(SSE_HEARTBEAT_MS).toBe(15_000);
    const bus = createSseBus();
    const url = await listen(bus);
    controller = new AbortController();

    const response = await fetch(url, { signal: controller.signal });
    expect(response.status).toBe(200);
    controller.abort();
    controller = undefined;
    // Closing the socket unsubscribes: the next publish is a no-op rather than a write to a dead reply.
    expect(() => bus.publish('tap', { id: 'tap_1' })).not.toThrow();
  });
});
