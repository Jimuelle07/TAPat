// The officer guard (docs/api-and-data.md §5.2): every write route, plus `GET`/`HEAD` on `/api/beneficiaries*`, needs
// the officer's session; other reads, `/api/auth/*` and `/api/webhooks/*` stay open.
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { Db } from '../db/index';
import { openDb } from '../db/index';
import { buildServer } from '../server';
import { createSession, ensureOfficer, SESSION_COOKIE, SESSION_TTL_MS, signup } from '../services/auth';
import { registerOfficerGuard } from './auth';

/** The `/api/taps` stand-in, spied so a bypass test can prove its handler never ran. */
type TapHandler = () => Promise<{ ok: boolean }>;

let app: FastifyInstance;
let db: Db;
let tapHandler: Mock<TapHandler>;

const OFFICER = { email: 'officer@example.com', password: 'secret123' };
const VIEWER = { email: 'viewer@example.com', password: 'secret123', displayName: 'Viewer' };

beforeEach(async () => {
  db = openDb(':memory:');
  app = await buildServer();
  registerOfficerGuard(app, { db });
  // Stand-ins for the real handlers: reaching one is the guard's pass.
  tapHandler = vi.fn<TapHandler>(async () => ({ ok: true }));
  app.post('/api/taps', tapHandler);
  app.get('/api/taps', async () => ({ ok: true }));
  app.get('/api/beneficiaries', async () => ({ ok: true }));
  app.get('/api/beneficiaries/:id', async () => ({ ok: true }));
  app.get('/api/dashboard', async () => ({ ok: true }));
  app.post('/api/auth/login', async () => ({ ok: true }));
  app.post('/api/webhooks/velo', async () => ({ ok: true }));
  app.post('/x', async () => ({ ok: true }));
});

afterEach(async () => {
  await app.close();
  db.close();
});

/** The `cookie` header for a session token. */
function cookieFor(token: string): string {
  return `${SESSION_COOKIE}=${token}`;
}

async function officerCookie(): Promise<string> {
  const { user } = await ensureOfficer(db, OFFICER);
  return cookieFor(createSession(db, user.id).token);
}

async function viewerCookie(): Promise<string> {
  const user = await signup(db, VIEWER);
  return cookieFor(createSession(db, user.id).token);
}

function post(url: string, cookie?: string) {
  return app.inject({ method: 'POST', url, ...(cookie === undefined ? {} : { headers: { cookie } }) });
}

function get(url: string, cookie?: string) {
  return app.inject({ method: 'GET', url, ...(cookie === undefined ? {} : { headers: { cookie } }) });
}

describe('registerOfficerGuard', () => {
  it('rejects an anonymous write with 401 UNAUTHORIZED', async () => {
    const response = await post('/api/taps');
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Log in as the officer to do this.' },
    });
  });

  it('rejects an unknown session token with 401 UNAUTHORIZED', async () => {
    const response = await post('/api/taps', cookieFor('not-a-real-token'));
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');
  });

  it('rejects an expired session with 401 UNAUTHORIZED', async () => {
    const { user } = await ensureOfficer(db, OFFICER);
    const expired = createSession(db, user.id, () => Date.now() - SESSION_TTL_MS - 1000);
    const response = await post('/api/taps', cookieFor(expired.token));
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a viewer write with 403 FORBIDDEN', async () => {
    const response = await post('/api/taps', await viewerCookie());
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: { code: 'FORBIDDEN', message: 'Only the officer can do this.' },
    });
  });

  it('lets the officer reach the handler', async () => {
    const response = await post('/api/taps', await officerCookie());
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it('leaves reads public', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/taps' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it('rejects an anonymous beneficiaries read with 401 UNAUTHORIZED', async () => {
    const response = await get('/api/beneficiaries');
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Log in as the officer to do this.' },
    });
  });

  it('rejects an anonymous beneficiaries HEAD with 401 UNAUTHORIZED', async () => {
    const response = await app.inject({ method: 'HEAD', url: '/api/beneficiaries' });
    expect(response.statusCode).toBe(401);
  });

  it('rejects a viewer beneficiaries read with 403 FORBIDDEN', async () => {
    const response = await get('/api/beneficiaries', await viewerCookie());
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: { code: 'FORBIDDEN', message: 'Only the officer can do this.' },
    });
  });

  it('lets the officer read beneficiaries', async () => {
    const response = await get('/api/beneficiaries', await officerCookie());
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it('guards an encoded beneficiaries spelling', async () => {
    const response = await get('/%61pi/beneficiaries');
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');
  });

  it('leaves other reads public', async () => {
    const response = await get('/api/dashboard');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it('exempts the account endpoints', async () => {
    const response = await post('/api/auth/login');
    expect(response.statusCode).toBe(200);
  });

  it('exempts the Velo webhook', async () => {
    const response = await post('/api/webhooks/velo');
    expect(response.statusCode).toBe(200);
  });

  it('does not let a query string bypass the guard', async () => {
    const response = await post('/api/taps?x=1');
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');
  });

  // Fastify decodes the path before routing, so several of these spellings reach the `/api/taps` handler; the guard
  // must decide on the matched route pattern, never on the raw URL.
  const BYPASS_URLS = ['/%61pi/taps', '/%2561pi/taps', '/api/%74aps', '/API/taps', '//api/taps', '/api/taps/'];

  it.each(BYPASS_URLS)('never lets %s reach the handler', async (url) => {
    const response = await post(url);
    expect([401, 404]).toContain(response.statusCode);
    expect(tapHandler).not.toHaveBeenCalled();
  });

  it('guards a write route registered outside /api', async () => {
    const response = await post('/x');
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');
  });

  it('lets the officer reach a write route registered outside /api', async () => {
    const response = await post('/x', await officerCookie());
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it('leaves an unmatched write to the 404 handler', async () => {
    const response = await post('/no-such-route');
    expect(response.statusCode).toBe(404);
    expect(tapHandler).not.toHaveBeenCalled();
  });
});
