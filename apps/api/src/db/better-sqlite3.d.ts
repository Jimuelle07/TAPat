// Minimal typings for the subset of better-sqlite3 that db/index.ts uses (the package ships no types,
// and @types/better-sqlite3 is not an approved dependency). Everything else goes through the Db interface.
declare module 'better-sqlite3' {
  interface RunResult {
    changes: number;
    lastInsertRowid: number | bigint;
  }

  interface Statement {
    run(...params: unknown[]): RunResult;
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  }

  class Database {
    constructor(filename: string);
    exec(sql: string): this;
    prepare(sql: string): Statement;
    pragma(source: string, options?: { simple?: boolean }): unknown;
    transaction<F extends (...args: never[]) => unknown>(fn: F): F;
    close(): this;
  }

  export default Database;
}
