import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { formatPhp } from '@tapat/shared';
import { buildServer } from './server';

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function serverWithTestRoutes(): Promise<FastifyInstance> {
  const server = await buildServer();
  server.get('/api/dashboard', async () => ({ ok: true }));
  server.get('/api/stream', (_request, reply) => {
    const stream = new PassThrough();
    reply.header('Content-Type', 'text/event-stream');
    void reply.send(stream);
    stream.end('data: {}\n\n');
  });
  return server;
}

describe('server cache headers', () => {
  it('sets Cache-Control: no-store on /api/* routes', async () => {
    app = await serverWithTestRoutes();
    const response = await app.inject({ method: 'GET', url: '/api/dashboard?x=1' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('keeps no-cache, never no-store, on the SSE stream', async () => {
    app = await serverWithTestRoutes();
    const response = await app.inject({ method: 'GET', url: '/api/stream' });
    expect(response.headers['content-type']).toMatch(/^text\/event-stream/);
    expect(response.headers['cache-control']).toContain('no-cache');
    expect(response.headers['cache-control']).not.toContain('no-store');
  });

  it('answers an unknown /api route with the NOT_FOUND envelope, also no-store', async () => {
    app = await serverWithTestRoutes();
    const response = await app.inject({ method: 'GET', url: '/api/nope' });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'No route for GET /api/nope' } });
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('answers a throwing route with the INTERNAL envelope, also no-store', async () => {
    app = await buildServer();
    app.get('/api/boom', async () => {
      throw new Error('boom');
    });
    const response = await app.inject({ method: 'GET', url: '/api/boom' });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: { code: 'INTERNAL', message: 'Internal error' } });
    expect(response.headers['cache-control']).toBe('no-store');
  });
});

describe('@tapat/shared from apps/server', () => {
  it('formats 350 PHP from @tapat/shared in apps/server', () => {
    expect(formatPhp(350_000_000n)).toBe('₱350.00');
  });
});
