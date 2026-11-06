// The four account endpoints (docs/api-and-data.md §5.2 #22–#25): JSON bodies in, `{ user }` out, one cookie.
// Gating is the web's job; these routes are as open as the rest of the API behind Caddy basic auth.
import type { FastifyInstance } from 'fastify';
import { loginBodySchema, signupBodySchema } from '@tapat/shared';
import type { Db } from '../db/index';
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
function readCookie(header: string | undefined, name: string): string | undefined {
  if (header === undefined) return undefined;
  for (const part of header.split(';')) {
    const equals = part.indexOf('=');
    if (equals < 0) continue;
    if (part.slice(0, equals).trim() === name) return part.slice(equals + 1).trim();
  }
  return undefined;
}

export function registerAuthRoutes(app: FastifyInstance, deps: AuthRouteDeps): void {
  // #22: always a `viewer`; the response is already logged in.
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
