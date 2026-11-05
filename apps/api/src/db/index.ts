// SQLite access for the API. Driver: better-sqlite3 (docs/api-and-data.md §2). Callers use only `Db`.
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';

export type SqlValue = string | number | bigint | null | Uint8Array;

export interface RunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

export interface Statement {
  run(...params: SqlValue[]): RunResult;
  get<Row>(...params: SqlValue[]): Row | undefined;
  all<Row>(...params: SqlValue[]): Row[];
}

export interface Db {
  /** Runs one or more statements with no parameters and no result. */
  exec(sql: string): void;
  prepare(sql: string): Statement;
  /** Runs `fn` inside one transaction: committed on return, rolled back on throw. */
  transaction<T>(fn: () => T): T;
  /** A single-value pragma read, e.g. `pragma('journal_mode')` -> 'wal'. */
  pragma(name: string): unknown;
  close(): void;
}

const SCHEMA_SQL = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
/** `PRAGMA user_version` once schema.sql has been applied. schema.sql has no IF NOT EXISTS, so it runs once per file. */
const SCHEMA_VERSION = 1;

/** Applies schema.sql on a fresh database; a database already at SCHEMA_VERSION is left untouched. */
export function applySchema(db: Db): void {
  db.transaction(() => {
    if (Number(db.pragma('user_version')) >= SCHEMA_VERSION) return;
    db.exec(SCHEMA_SQL);
    db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  });
}

/** Opens (creating the parent directory and the file if needed) the database at `path`, in WAL mode with foreign keys on. */
export function openDb(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  const db: Db = {
    exec: (sql) => {
      sqlite.exec(sql);
    },
    prepare: (sql) => {
      const statement = sqlite.prepare(sql);
      return {
        run: (...params) => statement.run(...params),
        get: <Row>(...params: SqlValue[]) => statement.get(...params) as Row | undefined,
        all: <Row>(...params: SqlValue[]) => statement.all(...params) as Row[],
      };
    },
    transaction: (fn) => sqlite.transaction(fn)(),
    pragma: (name) => sqlite.pragma(name, { simple: true }),
    close: () => {
      sqlite.close();
    },
  };
  applySchema(db);
  return db;
}
