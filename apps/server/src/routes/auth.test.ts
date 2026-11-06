// The account endpoints (docs/api-and-data.md §5.2 #22–#25): status codes, the session cookie, and /me.
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../db/index';
import { openDb } from '../db/index';
import { buildServer } from '../server';
import { registerAuthRoutes } from './auth';

const ANA = { email: 'ana@example.com', password: 'secret123', displayName: 'Ana' };

let app: FastifyInstance;
let db: Db;

beforeEach(async () => {
  db = openDb(':memory:');
  app = await buildServer();
  registerAuthRoutes(app, { db });
});

afterEach(async () => {
  await app.close();
  db.close();
});

/** The response's Set-Cookie header as one string (Fastify may hand back an array). */
function setCookieHeader(headers: Record<string, unknown>): string {
  const header = headers['set-cookie'];
  const raw = Array.isArray(header) ? header[0] : header;
  if (typeof raw !== 'string') throw new Error('response has no set-cookie');
  return raw;
}

/** The `name=value` half of the response's Set-Cookie, ready to send back as `cookie`. */
function sessionCookie(headers: Record<string, unknown>): string {
  return setCookieHeader(headers).split(';')[0];
}

async function signup(payload: Record<string, string> = ANA) {
  return app.inject({ method: 'POST', url: '/api/auth/signup', payload });
}

describe('POST /api/auth/signup', () => {
  it('creates a viewer, sets the 12-hour cookie, and never returns the hash', async () => {
    const response = await signup({ ...ANA, email: 'ANA@Example.COM' });
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.user).toMatchObject({ email: 'ana@example.com', displayName: 'Ana', role: 'viewer' });
    expect(body.user).not.toHaveProperty('password');
    expect(body.user).not.toHaveProperty('passwordHash');
    expect(setCookieHeader(response.headers)).toMatch(
      /^tapat_session=[A-Za-z0-9_-]{43}; Path=\/; HttpOnly; SameSite=Lax; Max-Age=43200$/,
    );

    const me = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: sessionCookie(response.headers) },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().user).toMatchObject({ email: 'ana@example.com', role: 'viewer' });
  });

  it('returns 409 ACCOUNT_EXISTS for a taken email', async () => {
    await signup();
    const response = await signup({ ...ANA, displayName: 'Someone Else' });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: { code: 'ACCOUNT_EXISTS', message: 'An account with this email already exists.' },
    });
  });

  it('returns 400 VALIDATION_ERROR for an invalid body', async () => {
    const response = await signup({ email: 'not-an-email', password: 'short', displayName: '' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/auth/login', () => {
  it('returns 401 UNAUTHORIZED for a wrong password or an unknown email', async () => {
    await signup();
    const wrong = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: ANA.email, password: 'wrong-password' },
    });
    expect(wrong.statusCode).toBe(401);
    expect(wrong.json()).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Wrong email or password.' } });
    expect(wrong.headers['set-cookie']).toBeUndefined();

    const unknown = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'ghost@example.com', password: 'wrong-password' },
    });
    expect(unknown.statusCode).toBe(401);
    expect(unknown.json().error.code).toBe('UNAUTHORIZED');
  });

  it('returns 200 with a cookie that /api/auth/me accepts', async () => {
    await signup();
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: ANA.email, password: ANA.password },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().user).toMatchObject({ email: ANA.email, role: 'viewer' });
    const me = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: sessionCookie(response.headers) },
    });
    expect(me.json().user).toMatchObject({ email: ANA.email });
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the cookie, deletes the session, and /me returns null', async () => {
    const created = await signup();
    const cookie = sessionCookie(created.headers);
    const response = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie } });
    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(setCookieHeader(response.headers)).toBe('tapat_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');

    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toEqual({ user: null });
    expect(db.prepare('SELECT COUNT(*) AS n FROM sessions').get<{ n: number }>()).toEqual({ n: 0 });
  });

  it('is idempotent without a cookie', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/auth/logout' });
    expect(response.statusCode).toBe(204);
  });
});

describe('GET /api/auth/me', () => {
  it('returns 200 with user null when there is no session', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ user: null });
  });

  it('ignores and deletes an expired session', async () => {
    const created = await signup();
    const cookie = sessionCookie(created.headers);
    db.prepare('UPDATE sessions SET expires_at = ?').run(Date.now() - 1);
    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(me.json()).toEqual({ user: null });
    expect(db.prepare('SELECT COUNT(*) AS n FROM sessions').get<{ n: number }>()).toEqual({ n: 0 });
  });
});
