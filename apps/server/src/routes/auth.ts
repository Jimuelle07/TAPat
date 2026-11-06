// The four account endpoints (docs/api-and-data.md §5.2 #22–#25): JSON bodies in, `{ user }` out, one cookie, plus
// the officer guard that every other write endpoint passes through.
import type { FastifyInstance } from 'fastify';
import { loginBodySchema, signupBodySchema } from '@tapat/shared';
import type { Db } from '../db/index';
import { ApiError } from '../errors';
import {
  createSession,
  deleteSession,
  login,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  signup,
  userForToken,
} from '../services/auth';

export interface AuthRouteDeps {
  db: Db;
}

/** `Max-Age` is seconds; 12 h = 43200. No `Secure`: TLS ends at Funnel/Vercel and the API sees plain http. */
const SESSION_MAX_AGE_S = SESSION_TTL_MS / 1000;

function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_S}`;
}

const CLEAR_SESSION_COOKIE = `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

/** The `cookie` header parsed by hand (no `@fastify/cookie`): name=value pairs, first match wins. */
export function readCookie(header: string | undefined, name: string): string | undefined {
  if (header === undefined) return undefined;
  for (const part of header.split(';')) {
    const equals = part.indexOf('=');
    if (equals < 0) continue;
    if (part.slice(0, equals).trim() === name) return part.slice(equals + 1).trim();
  }
  return undefined;
}

/** Reads need no session, except the officer-only read prefixes below (and OPTIONS, which is CORS preflight). */
const READ_METHODS: Readonly<Record<string, true>> = { GET: true, HEAD: true, OPTIONS: true };

/** The reads that still need the officer's session; `OPTIONS` stays public so CORS preflight never 401s. */
const GUARDED_READ_METHODS: Readonly<Record<string, true>> = { GET: true, HEAD: true };

/**
 * Route patterns whose `GET`/`HEAD` is officer-only. Beneficiaries carry full names, birthdates and plates, and
 * `linkCode`/`telegramDeepLink` would let any Telegram user bind to a driver, so this list stays short.
 */
export const OFFICER_READ_PREFIXES = ['/api/beneficiaries'];

/** The account endpoints (their own 401s) and Velo's signed webhook stay reachable without a session. */
const OPEN_PREFIXES = ['/api/auth/', '/api/webhooks/'];

/**
 * Every write route needs the officer's session (docs/api-and-data.md §5.2): no session/expired → 401
 * `UNAUTHORIZED`, a viewer's session → 403 `FORBIDDEN`. Reads stay public except `GET`/`HEAD` on
 * `OFFICER_READ_PREFIXES`, and the account and Velo webhook paths are exempt.
 *
 * The decision uses the matched route pattern (`request.routeOptions.url`), never the raw URL: Fastify percent-decodes
 * before routing, so `/%61pi/taps` reaches the `/api/taps` handler while a raw-URL prefix check would let it through.
 * Routing runs before `onRequest`, so the pattern is populated there; it is `undefined` when no route matched, and
 * Fastify's own 404 handles that request.
 */
export function registerOfficerGuard(app: FastifyInstance, deps: AuthRouteDeps): void {
  app.addHook('onRequest', async (request) => {
    const route = request.routeOptions.url;
    if (route === undefined) return;
    if (READ_METHODS[request.method] === true) {
      if (GUARDED_READ_METHODS[request.method] !== true) return;
      if (!OFFICER_READ_PREFIXES.some((prefix) => route.startsWith(prefix))) return;
    } else if (OPEN_PREFIXES.some((prefix) => route.startsWith(prefix))) {
      return;
    }
    const token = readCookie(request.headers.cookie, SESSION_COOKIE);
    const user = token === undefined ? null : userForToken(deps.db, token);
    if (user === null) throw new ApiError(401, 'UNAUTHORIZED', 'Log in as the officer to do this.');
    if (user.role !== 'officer') throw new ApiError(403, 'FORBIDDEN', 'Only the officer can do this.');
  });
}

export function registerAuthRoutes(app: FastifyInstance, deps: AuthRouteDeps): void {
  // #22: always an `officer`; the response is already logged in.
  app.post('/api/auth/signup', async (request, reply) => {
    const user = await signup(deps.db, signupBodySchema.parse(request.body));
    const session = createSession(deps.db, user.id);
    return reply.code(201).header('set-cookie', sessionCookie(session.token)).send({ user });
  });

  // #23
  app.post('/api/auth/login', async (request, reply) => {
    const user = await login(deps.db, loginBodySchema.parse(request.body));
    const session = createSession(deps.db, user.id);
    return reply.code(200).header('set-cookie', sessionCookie(session.token)).send({ user });
  });

  // #24: idempotent — no cookie, unknown token, or expired token all end the same way.
  app.post('/api/auth/logout', async (request, reply) => {
    const token = readCookie(request.headers.cookie, SESSION_COOKIE);
    if (token !== undefined) deleteSession(deps.db, token);
    return reply.code(204).header('set-cookie', CLEAR_SESSION_COOKIE).send();
  });

  // #25: no session is a 200 with `user: null`, never a 401.
  app.get('/api/auth/me', async (request) => {
    const token = readCookie(request.headers.cookie, SESSION_COOKIE);
    return { user: token === undefined ? null : userForToken(deps.db, token) };
  });
}
