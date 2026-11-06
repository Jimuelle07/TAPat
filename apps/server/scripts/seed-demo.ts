/**
 * Seeds the demo (build-schedule SED, SDD §2.5): both stations, one program, then D1/D2/D3/D5 approved and enrolled on
 * chain through the same code `POST /api/enroll` runs. D4 is left for the live enrollment.
 *
 * Run:  pnpm --filter server tsx scripts/seed-demo.ts [--d3-expiry-offset=<seconds>] [--uid-d1=<UID>] [--uid-d2=<UID>]
 *       [--uid-d3=<UID>] [--uid-d5=<UID>] [--officer-email=<email>] [--officer-password=<password>]
 *       [--budget-intent=<paymentIntentId>]
 *
 * `--d3-expiry-offset` is D3's policy lifetime from seed time (default 600, must be > 0). `--uid-dN` names the
 * normalized UID of a physical tag (what Read card shows, minus the ellipsis); a driver without a flag gets the virtual
 * UID `TAPATVIRTUAL0N`, so the seed always completes. `--officer-email` (default `officer@tapat.demo`) and
 * `--officer-password` (at least 8 characters; generated when omitted and the account is new) set the officer login.
 * After the program is seeded, the masterlist CSV goes through the intake service (the same flags, rejections and
 * summary as `POST /api/intake/upload`). `--budget-intent` adopts a payment intent that Velo already reports `paid`
 * and credits it through `creditBudgetIntent`; without it, fund the budget from the dashboard's hosted checkout.
 * Run `reset-demo.ts` first on a database that already has a program.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Keypair } from '@stellar/stellar-sdk';
import { Velo } from '@tapat/agent';
import { loadConfig } from '../src/config';
import { openDb } from '../src/db/index';
import { createChainRuntime } from '../src/runtime';
import { creditBudgetIntent, type BudgetDeps } from '../src/services/budget';
import { parseSeedArgs, seedDemo } from '../src/services/demo';
import { ensureOfficer } from '../src/services/auth';
import { loadCalibration, uploadMasterlist } from '../src/services/intake';
import { getCurrentProgram, PROGRAM_DEFAULTS } from '../src/services/program';
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
    const masterlistCsv = readFileSync(resolve(REPO_ROOT, 'fixtures/masterlist/masterlist.csv'), 'utf8');
    const result = await seedDemo(
      {
        db,
        chain,
        config,
        enroll: { bus: createSseBus(), programWallet: Keypair.fromSecret(config.PROGRAM_WALLET_SECRET), config },
      },
      args,
      masterlistCsv,
    );
    console.log(`Program ${result.program.id} is ${result.program.status} (expires ${result.program.expiresAtS}).`);
    for (const card of result.enrolled) {
      const kind = card.virtual ? 'virtual' : 'physical';
      console.log(
        `${card.tag}  ${card.cardId}  …${card.uidLast4}  ${kind}  policy expires ${card.expiresAtS}  txs ${card.chainTxIds.join(', ')}`,
      );
    }

    // The same intake run the upload route does, so the demo opens with the flagged rows the runbook walks through.
    const program = getCurrentProgram(db);
    const calibration = loadCalibration({
      alpha: program?.alpha ?? PROGRAM_DEFAULTS.alpha,
      beta: program?.beta ?? PROGRAM_DEFAULTS.beta,
    });
    const { summary } = await uploadMasterlist(
      { db, bus: createSseBus(), config, calibration },
      { filename: 'masterlist.csv', mimetype: 'text/csv', bytes: Buffer.from(masterlistCsv, 'utf8') },
    );
    console.log(
      `Masterlist: total=${summary.total} approved=${summary.approved} rejected=${summary.rejected} uncertain=${summary.uncertain} enrolled=${summary.enrolled}`,
    );

    if (args.budgetIntent !== undefined) {
      const id = args.budgetIntent;
      const velo = new Velo({ apiKey: config.VELO_API_KEY, environment: 'testnet', timeoutMs: 30_000 });
      const intent = await velo.paymentIntents.retrieve(id);
      if (intent.status !== 'paid') {
        throw new Error(`budget intent ${id} is ${intent.status} at Velo; pay it or omit --budget-intent`);
      }
      // The asset literal is budget.ts's private STORED_ASSET: Velo may echo the checkout's `native` as `native` or `XLM`.
      db.prepare(
        `INSERT INTO velo_intents
           (id, purpose, amount, asset, status, checkout_url, tx_hash, payer_address, created_at, paid_at)
         VALUES (?, 'budget', ?, 'XLM', 'created', ?, NULL, NULL, ?, NULL)`,
      ).run(id, intent.amount, intent.checkoutUrl ?? null, Date.now());
      const budget: BudgetDeps = { db, velo, bus: createSseBus(), config, log };
      const outcome = await creditBudgetIntent(budget, id);
      if (outcome !== 'credited') {
        throw new Error(`budget intent ${id} was not credited: ${outcome}`);
      }
      console.log(`Budget: ${intent.amount} XLM verified by Velo (intent ${id})`);
    }
  } finally {
    db.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
