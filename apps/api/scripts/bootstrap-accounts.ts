/**
 * setup.md stage 2: create and friendbot-fund the four testnet accounts, write the three
 * server secrets (plus KEY_ENCRYPTION_SECRET when absent) into apps/api/.env in place,
 * and print the public keys and the Budget Office secret.
 *
 * Run: pnpm --filter api tsx scripts/bootstrap-accounts.ts
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Keypair } from '@stellar/stellar-sdk';
import { readEnvValue, upsertEnv } from './lib/env-file';

const ENV_PATH = fileURLToPath(new URL('../.env', import.meta.url));
const FRIENDBOT_URL = 'https://friendbot.stellar.org';
const KEY_ENCRYPTION_SECRET_RULE = /^[0-9a-f]{64}$/;

async function friendbot(label: string, publicKey: string): Promise<void> {
  const res = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(publicKey)}`);
  const body = (await res.json().catch(() => null)) as { successful?: boolean; detail?: string } | null;
  if (!res.ok || body?.successful !== true) {
    throw new Error(`friendbot failed for ${label} (${publicKey}): HTTP ${res.status} ${body?.detail ?? ''}`.trim());
  }
}

async function main(): Promise<void> {
  if (!existsSync(ENV_PATH)) {
    throw new Error(`${ENV_PATH} not found. Run first: Copy-Item apps/api/.env.example apps/api/.env`);
  }

  const accounts = {
    programWallet: Keypair.random(),
    budgetOffice: Keypair.random(),
    stationA: Keypair.random(),
    stationB: Keypair.random(),
  };

  for (const [label, keypair] of Object.entries(accounts)) {
    await friendbot(label, keypair.publicKey());
  }

  const original = readFileSync(ENV_PATH, 'utf8');
  const updates: Record<string, string> = {
    PROGRAM_WALLET_SECRET: accounts.programWallet.secret(),
    STATION_A_SECRET: accounts.stationA.secret(),
    STATION_B_SECRET: accounts.stationB.secret(),
  };

  let newKeyEncryptionSecret: string | null = null;
  if (!KEY_ENCRYPTION_SECRET_RULE.test(readEnvValue(original, 'KEY_ENCRYPTION_SECRET') ?? '')) {
    newKeyEncryptionSecret = randomBytes(32).toString('hex');
    updates.KEY_ENCRYPTION_SECRET = newKeyEncryptionSecret;
  }

  writeFileSync(ENV_PATH, upsertEnv(original, updates));

  console.log(`Funded 4 testnet accounts; wrote PROGRAM_WALLET_SECRET, STATION_A_SECRET, STATION_B_SECRET to ${ENV_PATH}`);
  if (newKeyEncryptionSecret) {
    console.log('KEY_ENCRYPTION_SECRET was empty: generated and written. Back it up now (shown once):');
    console.log(`key encryption  secret  ${newKeyEncryptionSecret}`);
  } else {
    console.log('KEY_ENCRYPTION_SECRET already set: left unchanged.');
  }
  console.log('');
  console.log(`program wallet  public  ${accounts.programWallet.publicKey()}`);
  console.log(`budget office   public  ${accounts.budgetOffice.publicKey()}`);
  console.log(`budget office   secret  ${accounts.budgetOffice.secret()}   -> import into Freighter, never into .env`);
  console.log(`station A       public  ${accounts.stationA.publicKey()}`);
  console.log(`station B       public  ${accounts.stationB.publicKey()}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
