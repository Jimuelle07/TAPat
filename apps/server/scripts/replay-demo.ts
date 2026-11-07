/**
 * One-command demo restore (SDD §6.8): from any state (fresh, mid-run, ended) to a fresh seeded demo. It unfreezes any
 * frozen station, runs settlement, ends the program (sweeps escrow to the Program Wallet), resets the database, then runs
 * the unchanged `seed-demo.ts` with the already-paid Velo budget intent, so no Freighter checkout is needed.
 *
 * Run on the VM with the API stopped:
 *   sudo systemctl stop tapat-api
 *   sudo -H -u tapat pnpm -C /opt/tapat --filter server tsx scripts/replay-demo.ts [--dry-run] [seed-demo.ts flags]
 *   sudo systemctl start tapat-api
 * `--dry-run` prints the steps: no chain calls and no data changes. Without `--d3-expiry-offset=` the seed gets 300 s. Every other flag is
 * passed to seed-demo.ts (`--uid-d1=…`, `--officer-password=…`, `--budget-intent=…`).
 */
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Keypair } from '@stellar/stellar-sdk';
import { loadConfig } from '../src/config';
import { openDb } from '../src/db/index';
import { createChainRuntime } from '../src/runtime';
import { resetDemo } from '../src/services/demo';
import { runSettlement } from '../src/services/settlement';
import { createSseBus } from '../src/services/sse';
import { endProgram } from '../src/services/sweep';
import { REPO_ROOT } from './lib/fixture-file';
import { describePlan, parseReplayArgs, planReplay } from './lib/replay';

const log = {
  warn: (obj: object, msg: string): void => console.warn(msg, obj),
  error: (obj: object, msg: string): void => console.error(msg, obj),
};

/** Any HTTP response means the API process is up; a refused connection or timeout means it is not. */
async function apiIsUp(port: number): Promise<boolean> {
  try {
    await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1500) });
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const { dryRun, seedArgs } = parseReplayArgs(process.argv.slice(2));
  const config = loadConfig();
  const db = openDb(config.DATABASE_PATH);
  let dbOpen = true;
  try {
    const plan = planReplay(db, seedArgs);
    console.log(
      `Program: ${plan.programId === null ? 'none' : `${plan.programId} (${plan.programStatus ?? 'unknown'})`}; database ${config.DATABASE_PATH}`,
    );
    for (const [index, step] of describePlan(plan).entries()) console.log(`${index + 1}. ${step}`);

    // The running API holds in-memory MIDAS/tranche state and is a second writer, so a real run needs it stopped.
    if (await apiIsUp(config.PORT)) {
      if (dryRun) console.warn('WARN tapat-api is running — stop it before a real replay');
      else throw new Error(`tapat-api is running on :${config.PORT}; stop it first: sudo systemctl stop tapat-api`);
    }
    if (dryRun) {
      console.log('Dry run: nothing changed.');
      return;
    }

    const { chain } = createChainRuntime(config, db, log);
    const programWallet = Keypair.fromSecret(config.PROGRAM_WALLET_SECRET);
    const bus = createSseBus();

    for (const id of plan.frozenStations) {
      db.prepare(`UPDATE stations SET status = 'active', frozen_reason = NULL, frozen_at = NULL WHERE id = ?`).run(id);
      console.log(`Unfroze station ${id}.`);
    }

    if (plan.settle) {
      try {
        const settlement = await runSettlement({ db, chain, bus, config });
        for (const station of settlement.stations) {
          console.log(
            `Settlement ${station.stationId} (${station.stationName}): ${station.action}, pending ${station.pendingStroops} stroops${station.chainTxId === null ? '' : `, tx ${station.chainTxId}`}`,
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`WARN settlement failed (${message}); pending money stays in escrow on testnet`);
      }
    }

    if (plan.reopenEnded) {
      // `ending` is endProgram's resume state: it sweeps only the cards that are still `active`.
      db.prepare(`UPDATE program SET status = 'ending' WHERE id = ? AND status = 'ended'`).run(plan.programId);
      console.log(`Re-opened ended program ${plan.programId} to sweep: ${plan.unsweptCardIds.join(', ')}.`);
    }
    if (plan.end) {
      const ended = await endProgram({ db, chain, bus, programWallet, config });
      for (const card of ended.cards) {
        console.log(`Card ${card.cardId}: ${card.status}, returned ${card.returnedStroops} stroops${card.reason === null ? '' : ` (${card.reason})`}`);
      }
      const unswept = ended.cards.filter((card) => card.status !== 'swept').map((card) => card.cardId);
      if (unswept.length > 0) {
        throw new Error(`end program left cards ${unswept.join(', ')} unswept; fix and re-run replay-demo.ts`);
      }
      console.log(`Program ${ended.program.id} ended; returned ${ended.totalReturnedStroops} stroops.`);
    }

    // resetDemo deletes velo_intents, so the intent id is the only copy once it succeeds.
    console.log(`Budget intent kept for the seed: ${plan.budgetIntentId ?? 'none'}`);
    let result;
    try {
      result = await resetDemo({ db, chain, programWallet });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`reset failed (${message}); database untouched (devices already revoked are skipped on re-run) — re-run replay-demo.ts`);
    }
    console.log(`Revoked ${result.revoked.length} device(s): ${result.revoked.join(', ') || 'none'}.`);
    if (result.skipped.length > 0) console.log(`Nothing to revoke for: ${result.skipped.join(', ')}.`);
    console.log('Database emptied.');

    db.close();
    dbOpen = false;
    const seed = spawnSync('pnpm', ['exec', 'tsx', 'scripts/seed-demo.ts', ...plan.seedArgs], {
      cwd: resolve(REPO_ROOT, 'apps/server'),
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    if (seed.error !== undefined || seed.status !== 0) {
      const reason = seed.error !== undefined ? seed.error.message : `exit ${seed.status ?? 'signal'}`;
      const vmPrefix = 'sudo -H -u tapat pnpm -C /opt/tapat --filter server tsx scripts';
      const intentFlag = plan.budgetIntentId === null ? '' : ` --budget-intent=${plan.budgetIntentId}`;
      const rerunFlags = plan.seedArgs.filter((arg) => !arg.startsWith('--budget-intent=')).join(' ');
      console.error(`seed-demo.ts failed (${reason}); the database was reset and is empty.`);
      console.error(`Re-run the seed only: ${vmPrefix}/seed-demo.ts ${plan.seedArgs.join(' ')}`);
      console.error(
        `If the seed got partway (a program row exists), run instead: ${vmPrefix}/replay-demo.ts${intentFlag} ${rerunFlags}`.trimEnd() +
          ' (the database no longer holds the intent, so pass it explicitly).',
      );
      process.exit(seed.status ?? 1);
    }
    console.log('Replay done. Start the API: sudo systemctl start tapat-api, then run demo-preflight.ts.');
  } finally {
    if (dbOpen) db.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
