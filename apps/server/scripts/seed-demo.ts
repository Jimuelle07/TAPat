/**
 * Seeds the demo (build-schedule SED, SDD §2.5): both stations, one program, then D1/D2/D3/D5 approved and enrolled on
 * chain through the same code `POST /api/enroll` runs. D4 is left for the live enrollment.
 *
 * Run:  pnpm --filter server tsx scripts/seed-demo.ts [--d3-expiry-offset=<seconds>] [--uid-d1=<UID>] [--uid-d2=<UID>]
 *       [--uid-d3=<UID>] [--uid-d5=<UID>] [--officer-email=<email>] [--officer-password=<password>]
 *
 * `--d3-expiry-offset` is D3's policy lifetime from seed time (default 600, must be > 0). `--uid-dN` names the
 * normalized UID of a physical tag (what Read card shows, minus the ellipsis); a driver without a flag gets the virtual
 * UID `TAPATVIRTUAL0N`, so the seed always completes. `--officer-email` (default `officer@tapat.demo`) and
 * `--officer-password` (at least 8 characters; generated when omitted and the account is new) set the officer login.
 * Run `reset-demo.ts` first on a database that already has a program.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Keypair } from '@stellar/stellar-sdk';
import { loadConfig } from '../src/config';
import { openDb } from '../src/db/index';
import { createChainRuntime } from '../src/runtime';
import { parseSeedArgs, seedDemo } from '../src/services/demo';
import { ensureOfficer } from '../src/services/auth';
import { createSseBus } from '../src/services/sse';
import { REPO_ROOT } from './lib/fixture-file';

const log = {
  warn: (obj: object, msg: string): void => console.warn(msg, obj),
  error: (obj: object, msg: string): void => console.error(msg, obj),
};

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
    const { chain } = createChainRuntime(config, db, log);
    const result = await seedDemo(
      {
        db,
        chain,
        config,
        enroll: { bus: createSseBus(), programWallet: Keypair.fromSecret(config.PROGRAM_WALLET_SECRET), config },
      },
      args,
      readFileSync(resolve(REPO_ROOT, 'fixtures/masterlist/masterlist.csv'), 'utf8'),
    );
    console.log(`Program ${result.program.id} is ${result.program.status} (expires ${result.program.expiresAtS}).`);
    for (const card of result.enrolled) {
      const kind = card.virtual ? 'virtual' : 'physical';
      console.log(
        `${card.tag}  ${card.cardId}  …${card.uidLast4}  ${kind}  policy expires ${card.expiresAtS}  txs ${card.chainTxIds.join(', ')}`,
      );
    }
  } finally {
    db.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
