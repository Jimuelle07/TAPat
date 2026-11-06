/**
 * Frees the previous run's cards and empties the database (build-schedule SED, SDD §6.8 step 4): every registered card's
 * device hash is released with `device_registry.revoke`, so the same physical tags enroll again, then every row goes.
 * Refuses while any card still holds escrow: run End program first.
 *
 * Run: pnpm --filter server tsx scripts/reset-demo.ts
 */
import { Keypair } from '@stellar/stellar-sdk';
import { loadConfig } from '../src/config';
import { openDb } from '../src/db/index';
import { createChainRuntime } from '../src/runtime';
import { resetDemo } from '../src/services/demo';

const log = {
  warn: (obj: object, msg: string): void => console.warn(msg, obj),
  error: (obj: object, msg: string): void => console.error(msg, obj),
};

async function main(): Promise<void> {
  const config = loadConfig();
  const db = openDb(config.DATABASE_PATH);
  try {
    const { chain } = createChainRuntime(config, db, log);
    const result = await resetDemo({ db, chain, programWallet: Keypair.fromSecret(config.PROGRAM_WALLET_SECRET) });
    console.log(`Revoked ${result.revoked.length} device(s): ${result.revoked.join(', ') || 'none'}.`);
    if (result.skipped.length > 0) console.log(`Nothing to revoke for: ${result.skipped.join(', ')}.`);
    console.log('Database emptied. Run seed-demo.ts next.');
  } finally {
    db.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
