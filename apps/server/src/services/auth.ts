// Accounts and sessions (docs/api-and-data.md §5.2 #22–#25): scrypt password hashes, and sessions addressed by the
// sha256 of the cookie token so a database read never yields a usable token. Every write endpoint requires an
// officer session, enforced by `registerOfficerGuard` in `routes/auth.ts`.
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { AuthUser, LoginBody, SignupBody, UserRole } from '@tapat/shared';
import type { Db } from '../db/index';
import { ApiError } from '../errors';

/** §5.2 #22: the session cookie and its 12-hour lifetime (also the cookie's `Max-Age`). */
export const SESSION_COOKIE = 'tapat_session';
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/** scrypt parameters; the stored string names them, so a future change stays verifiable. */
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SALT_BYTES = 16;
const KEY_BYTES = 64;

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  password_hash: string;
  created_at: number;
}

/** Row -> response shape. `password_hash` never leaves this module. */
function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    createdAt: row.created_at,
  };
}

function newUserId(): string {
  return `usr_${randomBytes(6).toString('hex')}`;
}

/** Lowercased, trimmed email: the column's invariant, also for callers that skip the zod schema (seed, tests). */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function scryptKey(
  password: string,
  salt: Buffer,
  keylen: number,
  N: number,
  r: number,
  p: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, { N, r, p }, (error, key) => {
      if (error === null) resolve(key);
      else reject(error);
    });
  });
}

/** `scrypt$16384$8$1$<saltHex>$<hashHex>` with a fresh 16-byte salt. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await scryptKey(password, salt, KEY_BYTES, SCRYPT_N, SCRYPT_R, SCRYPT_P);
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('hex')}$${key.toString('hex')}`;
}

/** Constant-time compare against a stored hash; a malformed or foreign-format string is simply not a match. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[4], 'hex');
  const expected = Buffer.from(parts[5], 'hex');
  if (salt.length === 0 || expected.length === 0) return false;
  const key = await scryptKey(password, salt, expected.length, Number(parts[1]), Number(parts[2]), Number(parts[3]));
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/**
 * A well-formed hash of a password nobody knows. An unknown email still runs one scrypt against it, so login takes
 * the same time whether the account exists or not.
 */
const DUMMY_HASH = `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${'0'.repeat(SALT_BYTES * 2)}$${'0'.repeat(KEY_BYTES * 2)}`;

function uniqueEmailViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  if (!('code' in error) || error.code !== 'SQLITE_CONSTRAINT_UNIQUE') return false;
  return 'message' in error && typeof error.message === 'string' && error.message.includes('users.email');
}

/** #22: creates an `officer` and returns it. A taken email is 409 `ACCOUNT_EXISTS`; nothing here ever creates a viewer. */
export async function signup(db: Db, body: SignupBody): Promise<AuthUser> {
  const email = normalizeEmail(body.email);
  const passwordHash = await hashPassword(body.password);
  const user: AuthUser = {
    id: newUserId(),
    email,
    displayName: body.displayName,
    role: 'officer',
    createdAt: Date.now(),
  };
  try {
    db.prepare(
      `INSERT INTO users (id, email, display_name, role, password_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(user.id, user.email, user.displayName, user.role, passwordHash, user.createdAt);
  } catch (error) {
    if (uniqueEmailViolation(error)) {
      throw new ApiError(409, 'ACCOUNT_EXISTS', 'An account with this email already exists.');
    }
    throw error;
  }
  return user;
}

/** #23: the user for a correct email/password pair; anything else is 401 with one message (no account enumeration). */
export async function login(db: Db, body: LoginBody): Promise<AuthUser> {
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get<UserRow>(normalizeEmail(body.email));
  if (row === undefined) {
    await verifyPassword(body.password, DUMMY_HASH);
    throw new ApiError(401, 'UNAUTHORIZED', 'Wrong email or password.');
  }
  if (!(await verifyPassword(body.password, row.password_hash))) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Wrong email or password.');
  }
  return toAuthUser(row);
}

/** `sessions.id`: the cookie token is sent to the client, only its digest is stored. */
function sessionId(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface Session {
  token: string;
  expiresAt: number;
}

/** #22/#23: a fresh 32-byte token and its row. `now` is injectable so expiry is testable without waiting. */
export function createSession(db: Db, userId: string, now: () => number = Date.now): Session {
  const token = randomBytes(32).toString('base64url');
  const createdAt = now();
  const expiresAt = createdAt + SESSION_TTL_MS;
  db.prepare('INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
    sessionId(token),
    userId,
    createdAt,
    expiresAt,
  );
  return { token, expiresAt };
}

/** #25: the session's user, or null when the token is unknown or expired (an expired row is deleted on sight). */
export function userForToken(db: Db, token: string, now: () => number = Date.now): AuthUser | null {
  const id = sessionId(token);
  const row = db
    .prepare(
      `SELECT u.*, s.expires_at AS session_expires_at
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.id = ?`,
    )
    .get<UserRow & { session_expires_at: number }>(id);
  if (row === undefined) return null;
  if (row.session_expires_at <= now()) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
    return null;
  }
  return toAuthUser(row);
}

/** #24: drops the token's session; an unknown token is a no-op (logout is idempotent). */
export function deleteSession(db: Db, token: string): void {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId(token));
}

export interface EnsureOfficerInput {
  email: string;
  password?: string;
  displayName?: string;
}

export interface EnsureOfficerResult {
  user: AuthUser;
  /** The plaintext used or generated on this call; null when an existing account's hash was left alone. */
  password: string | null;
  created: boolean;
}

/**
 * `seed-demo.ts`'s one officer. A new email gets role `officer` and either `input.password` or a generated 16-char
 * password; an existing account is forced to `officer` and keeps its hash unless a password is given.
 */
export async function ensureOfficer(db: Db, input: EnsureOfficerInput): Promise<EnsureOfficerResult> {
  const email = normalizeEmail(input.email);
  const displayName = input.displayName ?? 'LGU Officer';
  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get<UserRow>(email);

  if (existing === undefined) {
    const password = input.password ?? randomBytes(12).toString('base64url');
    const user: AuthUser = {
      id: newUserId(),
      email,
      displayName,
      role: 'officer',
      createdAt: Date.now(),
    };
    db.prepare(
      `INSERT INTO users (id, email, display_name, role, password_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(user.id, user.email, user.displayName, user.role, await hashPassword(password), user.createdAt);
    return { user, password, created: true };
  }

  db.prepare("UPDATE users SET role = 'officer' WHERE id = ?").run(existing.id);
  const user: AuthUser = { ...toAuthUser(existing), role: 'officer' };
  if (input.password === undefined) return { user, password: null, created: false };
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashPassword(input.password), existing.id);
  return { user, password: input.password, created: false };
}
