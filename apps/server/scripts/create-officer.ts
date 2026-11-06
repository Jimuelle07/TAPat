/**
 * Creates or promotes the officer account without touching the demo chain data. `seed-demo.ts` refuses to run once a
 * program exists, but the live VM already has one, so this is the no-chain way to get an officer login there.
 *
 * Run:  pnpm --filter server tsx scripts/create-officer.ts [--officer-email=<email>] [--officer-password=<password>]
 *
 * Safe to run on the live VM while the API is running: SQLite is in WAL mode, so the API keeps serving and `openDb`
 * applies the v1→v2 schema migration if the database is still on it. `--officer-email` defaults to
 * `officer@tapat.demo`. An existing account is promoted to `officer`; `--officer-password` (at least 8 characters)
 * resets its password, otherwise the password is left alone. A new account gets the generated password when the flag
 * is omitted. The password is printed once here and never again — store it before this output scrolls away.
 */
import { loadConfig } from '../src/config';
import { openDb } from '../src/db/index';
import { ensureOfficer } from '../src/services/auth';
import { parseSeedArgs } from '../src/services/demo';

async function main(): Promise<void> {
  const args = parseSeedArgs(process.argv.slice(2));
  const config = loadConfig();
  const db = openDb(config.DATABASE_PATH);
  try {
    const officer = await ensureOfficer(db, { email: args.officerEmail, password: args.officerPassword });
    console.log(
      officer.password === null
        ? `Officer login: ${officer.user.email} (password unchanged)`
        : `Officer login: ${officer.user.email} / ${officer.password}`,
    );
  } finally {
    db.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
