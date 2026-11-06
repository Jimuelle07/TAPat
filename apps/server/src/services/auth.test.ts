// Account and session services (docs/api-and-data.md §5.2 #22–#25): hashing, login timing, session addressing.
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import type { Db } from '../db/index';
import { openDb } from '../db/index';
import {
  createSession,
  deleteSession,
  ensureOfficer,
  hashPassword,
  login,
  SESSION_TTL_MS,
  signup,
  userForToken,
  verifyPassword,
} from './auth';

const opened: Db[] = [];

function testDb(): Db {
  const db = openDb(':memory:');
  opened.push(db);
  return db;
}

const ANA = { email: 'ana@example.com', password: 'secret123', displayName: 'Ana' };

afterEach(() => {
  for (const db of opened.splice(0)) db.close();
});

describe('hashPassword / verifyPassword', () => {
  it('stores the scrypt parameters and a fresh salt, and verifies only the right password', async () => {
    const first = await hashPassword('correct horse battery');
    const second = await hashPassword('correct horse battery');
    expect(first).toMatch(/^scrypt\$16384\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(first).not.toBe(second);
    expect(await verifyPassword('correct horse battery', first)).toBe(true);
    expect(await verifyPassword('wrong password', first)).toBe(false);
    expect(await verifyPassword('correct horse battery', 'not-a-hash')).toBe(false);
  });
});

describe('signup', () => {
  it('creates an officer with a lowercased email and never returns the hash', async () => {
    const db = testDb();
    const user = await signup(db, { ...ANA, email: 'ANA@Example.COM' });
    expect(user.email).toBe('ana@example.com');
    expect(user.role).toBe('officer');
    expect(user.id).toMatch(/^usr_[0-9a-f]{12}$/);
    expect(user).not.toHaveProperty('password');
    expect(user).not.toHaveProperty('passwordHash');
    const row = db.prepare('SELECT email, role, password_hash FROM users WHERE id = ?').get<{
      email: string;
      role: string;
      password_hash: string;
    }>(user.id);
    expect(row?.email).toBe('ana@example.com');
    expect(row?.role).toBe('officer');
    expect(await verifyPassword('secret123', row?.password_hash ?? '')).toBe(true);
  });

  it('rejects a taken email with 409 ACCOUNT_EXISTS', async () => {
    const db = testDb();
    await signup(db, ANA);
    await expect(signup(db, { ...ANA, displayName: 'Someone Else' })).rejects.toMatchObject({
      name: 'ApiError',
      code: 'ACCOUNT_EXISTS',
      statusCode: 409,
      message: 'An account with this email already exists.',
    });
    expect(db.prepare('SELECT COUNT(*) AS n FROM users').get<{ n: number }>()).toEqual({ n: 1 });
  });
});

describe('login', () => {
  it('returns the user for the right password', async () => {
    const db = testDb();
    const user = await signup(db, ANA);
    expect(await login(db, { email: 'ANA@example.com', password: 'secret123' })).toMatchObject({
      id: user.id,
      email: 'ana@example.com',
    });
  });

  it('rejects a wrong password and an unknown email with 401 UNAUTHORIZED', async () => {
    const db = testDb();
    await signup(db, ANA);
    await expect(login(db, { email: ANA.email, password: 'wrong-password' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      statusCode: 401,
      message: 'Wrong email or password.',
    });
    await expect(login(db, { email: 'ghost@example.com', password: 'wrong-password' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      statusCode: 401,
      message: 'Wrong email or password.',
    });
  });
});

describe('sessions', () => {
  it('stores only sha256(token) and resolves the token back to the user', async () => {
    const db = testDb();
    const user = await signup(db, ANA);
    const session = createSession(db, user.id);
    const rows = db.prepare('SELECT id FROM sessions').all<{ id: string }>();
    expect(rows).toEqual([{ id: createHash('sha256').update(session.token).digest('hex') }]);
    expect(rows[0]?.id).not.toBe(session.token);
    expect(userForToken(db, session.token)).toMatchObject({ id: user.id, email: 'ana@example.com' });
    expect(userForToken(db, 'not-a-session-token')).toBeNull();
  });

  it('ignores and deletes an expired session', async () => {
    const db = testDb();
    const user = await signup(db, ANA);
    const session = createSession(db, user.id, () => 1_000);
    expect(session.expiresAt).toBe(1_000 + SESSION_TTL_MS);
    expect(userForToken(db, session.token, () => 1_000 + SESSION_TTL_MS)).toBeNull();
    expect(db.prepare('SELECT COUNT(*) AS n FROM sessions').get<{ n: number }>()).toEqual({ n: 0 });
  });

  it('deleteSession removes the row and is idempotent', async () => {
    const db = testDb();
    const user = await signup(db, ANA);
    const session = createSession(db, user.id);
    deleteSession(db, session.token);
    expect(userForToken(db, session.token)).toBeNull();
    expect(() => deleteSession(db, session.token)).not.toThrow();
  });
});

describe('ensureOfficer', () => {
  it('creates the officer with the given password and a default display name', async () => {
    const db = testDb();
    const result = await ensureOfficer(db, { email: 'OFFICER@tapat.demo', password: 'officer-pass-1' });
    expect(result.created).toBe(true);
    expect(result.password).toBe('officer-pass-1');
    expect(result.user).toMatchObject({
      email: 'officer@tapat.demo',
      displayName: 'LGU Officer',
      role: 'officer',
    });
    expect((await login(db, { email: 'officer@tapat.demo', password: 'officer-pass-1' })).role).toBe('officer');
  });

  it('generates a 16-char password when none is given', async () => {
    const db = testDb();
    const result = await ensureOfficer(db, { email: 'officer@tapat.demo', displayName: 'Officer One' });
    expect(result.created).toBe(true);
    expect(result.password).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(
      await login(db, { email: 'officer@tapat.demo', password: result.password ?? '' }),
    ).toMatchObject({ displayName: 'Officer One', role: 'officer' });
  });

  it('promotes an existing viewer and replaces the hash when a password is given', async () => {
    const db = testDb();
    const viewer = await signup(db, { ...ANA, email: 'officer@tapat.demo' });
    const result = await ensureOfficer(db, { email: 'officer@tapat.demo', password: 'officer-pass-2' });
    expect(result).toMatchObject({ created: false, password: 'officer-pass-2' });
    expect(result.user).toMatchObject({ id: viewer.id, role: 'officer' });
    await expect(login(db, { email: 'officer@tapat.demo', password: 'secret123' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect((await login(db, { email: 'officer@tapat.demo', password: 'officer-pass-2' })).role).toBe('officer');
  });

  it('leaves an existing hash alone when no password is given', async () => {
    const db = testDb();
    const first = await ensureOfficer(db, { email: 'officer@tapat.demo', password: 'officer-pass-1' });
    const hashBefore = db.prepare('SELECT password_hash FROM users WHERE id = ?').get<{ password_hash: string }>(
      first.user.id,
    );
    const second = await ensureOfficer(db, { email: 'officer@tapat.demo' });
    expect(second).toMatchObject({ created: false, password: null });
    expect(second.user).toMatchObject({ id: first.user.id, role: 'officer' });
    expect(db.prepare('SELECT password_hash FROM users WHERE id = ?').get<{ password_hash: string }>(first.user.id)).toEqual(
      hashBefore,
    );
    expect((await login(db, { email: 'officer@tapat.demo', password: 'officer-pass-1' })).id).toBe(first.user.id);
  });
});
