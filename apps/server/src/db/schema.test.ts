import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { applySchema, BASE_SCHEMA_SQL, openDb, SCHEMA_VERSION, type Db } from './index';

const TABLES = [
  'agent_decisions',
  'beneficiaries',
  'cards',
  'chain_txs',
  'price_points',
  'program',
  'sessions',
  'stations',
  'taps',
  'users',
  'velo_intents',
  'webhook_deliveries',
];

const opened: Db[] = [];
const dirs: string[] = [];

function tempDbPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'tapat-db-'));
  dirs.push(dir);
  return join(dir, 'nested', 'data', 'tapat.db');
}

function open(path: string): Db {
  const db = openDb(path);
  opened.push(db);
  return db;
}

function tableNames(db: Db): string[] {
  return db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all<{ name: string }>()
    .map((row) => row.name);
}

afterEach(() => {
  for (const db of opened.splice(0)) db.close();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('schema.sql', () => {
  it('creates the parent directory and the file, in WAL mode with foreign keys on', () => {
    const path = tempDbPath();
    const db = open(path);
    expect(existsSync(path)).toBe(true);
    expect(db.pragma('journal_mode')).toBe('wal');
    expect(db.pragma('foreign_keys')).toBe(1);
    expect(tableNames(db)).toEqual(TABLES);
  });

  it('is idempotent: re-applying it and reopening the file keep the tables and the rows', () => {
    const path = tempDbPath();
    const first = open(path);
    first.prepare("INSERT INTO stations (id, name, public_key, secret_enc, status) VALUES ('A', 'Petron San Roque', 'G', 'x', 'active')").run();
    applySchema(first);
    first.close();
    opened.splice(opened.indexOf(first), 1);

    const second = open(path);
    expect(tableNames(second)).toEqual(TABLES);
    expect(second.prepare('SELECT COUNT(*) AS n FROM stations').get<{ n: number }>()).toEqual({ n: 1 });
  });

  it('migrates a version-1 file in place: the auth tables appear, existing rows stay, user_version becomes 2', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tapat-db-v1-'));
    dirs.push(dir);
    const path = join(dir, 'tapat.db');
    const legacy = new Database(path);
    legacy.exec(BASE_SCHEMA_SQL);
    legacy.exec('PRAGMA user_version = 1');
    legacy
      .prepare("INSERT INTO stations (id, name, public_key, secret_enc, status) VALUES ('A', 'Petron San Roque', 'G', 'x', 'active')")
      .run();
    legacy.close();

    const db = open(path);
    expect(db.pragma('user_version')).toBe(SCHEMA_VERSION);
    expect(tableNames(db)).toEqual(TABLES);
    expect(db.prepare('SELECT COUNT(*) AS n FROM stations').get<{ n: number }>()).toEqual({ n: 1 });
  });

  it('rejects a row that violates a CHECK constraint', () => {
    const db = open(':memory:');
    db.prepare("INSERT INTO stations (id, name, public_key, secret_enc, status) VALUES ('A', 'Petron San Roque', 'G', 'x', 'active')").run();
    const insertTap = db.prepare(
      "INSERT INTO taps (id, station_id, amount_stroops, status, created_at) VALUES (?, 'A', 350000000, ?, 0)",
    );
    expect(() => insertTap.run('tap_bad', 'bogus')).toThrow(/CHECK constraint failed/);
    expect(insertTap.run('tap_ok', 'refused').changes).toBe(1);
  });

  it('enforces foreign keys', () => {
    const db = open(':memory:');
    expect(() =>
      db.prepare("INSERT INTO taps (id, station_id, amount_stroops, status, created_at) VALUES ('t', 'Z', 1, 'refused', 0)").run(),
    ).toThrow(/FOREIGN KEY constraint failed/);
  });
});
