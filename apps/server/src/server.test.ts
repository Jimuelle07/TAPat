import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { formatPhp } from '@tapat/shared';
import { ApiError } from './errors';
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

describe('error envelopes', () => {
  async function serverWithErrorRoutes(): Promise<FastifyInstance> {
    const server = await buildServer();
    server.get('/api/api-error', async () => {
      throw new ApiError(409, 'INVALID_STATE', 'no verified budget');
    });
    server.get('/api/chain-error', async () => {
      throw new ApiError(502, 'CHAIN_ERROR', 'CONTRACT_DuplicateAuth');
    });
    server.post('/api/zod', async (request) => z.strictObject({ amountPhp: z.number().positive() }).parse(request.body));
    server.post('/api/json', async () => ({ ok: true }));
    return server;
  }

  it('renders an ApiError with its own status and code', async () => {
    app = await serverWithErrorRoutes();
    const response = await app.inject({ method: 'GET', url: '/api/api-error' });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: { code: 'INVALID_STATE', message: 'no verified budget' } });
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('renders a 5xx ApiError with its code (CHAIN_ERROR keeps the contract name)', async () => {
    app = await serverWithErrorRoutes();
    const response = await app.inject({ method: 'GET', url: '/api/chain-error' });
    expect(response.statusCode).toBe(502);
    expect(response.json()).toEqual({ error: { code: 'CHAIN_ERROR', message: 'CONTRACT_DuplicateAuth' } });
  });

  it('maps a ZodError to 400 VALIDATION_ERROR naming the first failing path', async () => {
    app = await serverWithErrorRoutes();
    const response = await app.inject({ method: 'POST', url: '/api/zod', payload: { amountPhp: -5 } });
    expect(response.statusCode).toBe(400);
    const body = z.object({ error: z.object({ code: z.string(), message: z.string() }) }).parse(response.json());
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message.startsWith('amountPhp')).toBe(true);
  });

  it('maps a Fastify body-parse failure (4xx) to VALIDATION_ERROR with that status', async () => {
    app = await serverWithErrorRoutes();
    const response = await app.inject({
      method: 'POST',
      url: '/api/json',
      headers: { 'content-type': 'application/json' },
      payload: '{"broken":',
    });
    expect(response.statusCode).toBe(400);
    const body = z.object({ error: z.object({ code: z.string() }) }).parse(response.json());
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('maps an unsupported media type (415) to VALIDATION_ERROR with status 415', async () => {
    app = await serverWithErrorRoutes();
    const response = await app.inject({
      method: 'POST',
      url: '/api/json',
      headers: { 'content-type': 'application/x-weird' },
      payload: 'x',
    });
    expect(response.statusCode).toBe(415);
    const body = z.object({ error: z.object({ code: z.string() }) }).parse(response.json());
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('never returns the message of an unexpected error', async () => {
    app = await buildServer();
    app.get('/api/leak', async () => {
      throw new Error('secret connection string');
    });
    const response = await app.inject({ method: 'GET', url: '/api/leak' });
    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain('secret');
    expect(response.json()).toEqual({ error: { code: 'INTERNAL', message: 'Internal error' } });
  });
});

describe('@tapat/shared from apps/server', () => {
  it('formats 350 PHP from @tapat/shared in apps/server', () => {
    expect(formatPhp(350_000_000n)).toBe('₱350.00');
  });
});
