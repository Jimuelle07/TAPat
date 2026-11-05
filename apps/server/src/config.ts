// Boot rule, docs/api-and-data.md §7.3: apps/server/.env is loaded unconditionally, then every variable is
// zod-parsed. The returned object is the only way the API reads configuration; nothing else reads process.env.
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

const ENV_PATH = fileURLToPath(new URL('../.env', import.meta.url));

const contractId = z.string().regex(/^C[A-Z2-7]{55}$/);
const secretKey = z.string().regex(/^S[A-Z2-7]{55}$/);
const tickMs = (fallback: number) => z.coerce.number().int().min(100).default(fallback);

const configSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_PATH: z.string().min(1),
  PUBLIC_BASE_URL: z.url().refine((value) => new URL(value).protocol === 'https:'),
  STELLAR_RPC_URL: z.url(),
  STELLAR_NETWORK_PASSPHRASE: z.literal('Test SDF Network ; September 2015'),
  NOIR_DEVICE_REGISTRY_ID: contractId,
  NOIR_AGENT_REGISTRY_ID: contractId,
  NOIR_PAYMENT_ESCROW_ID: contractId,
  XLM_SAC_ID: contractId,
  PROGRAM_WALLET_SECRET: secretKey,
  STATION_A_SECRET: secretKey,
  STATION_B_SECRET: secretKey,
  KEY_ENCRYPTION_SECRET: z.string().regex(/^[0-9a-f]{64}$/),
  GAS_MODE: z.enum(['velo', 'direct']),
  GAS_FALLBACK_DIRECT: z.enum(['true', 'false']).transform((value) => value === 'true'),
  VELO_GAS_BASE_URL: z.url(),
  VELO_GAS_API_KEY: z.string().startsWith('tg_test_'),
  VELO_API_KEY: z.string().regex(/^tk_(test|live)_/),
  VELO_WEBHOOK_SECRET: z.string().min(16),
  TELEGRAM_BOT_TOKEN: z.string().includes(':'),
  TELEGRAM_BOT_USERNAME: z.string().regex(/^[A-Za-z0-9_]{5,32}$/),
  PHP_PER_XLM: z.coerce.number().positive().default(10),
  PRICE_TICK_MS: tickMs(700),
  FREEZE_TICK_MS: tickMs(1000),
});

export type Config = z.infer<typeof configSchema>;
type VariableName = keyof typeof configSchema.shape;

/** The §7.3 rule column, printed next to a failing name. Never the value. */
const RULES: Record<VariableName, string> = {
  PORT: 'integer 1-65535 (default 4000)',
  DATABASE_PATH: 'non-empty path',
  PUBLIC_BASE_URL: 'URL with https:',
  STELLAR_RPC_URL: 'URL',
  STELLAR_NETWORK_PASSPHRASE: 'exactly "Test SDF Network ; September 2015"',
  NOIR_DEVICE_REGISTRY_ID: 'contract id /^C[A-Z2-7]{55}$/',
  NOIR_AGENT_REGISTRY_ID: 'contract id /^C[A-Z2-7]{55}$/',
  NOIR_PAYMENT_ESCROW_ID: 'contract id /^C[A-Z2-7]{55}$/',
  XLM_SAC_ID: 'contract id /^C[A-Z2-7]{55}$/',
  PROGRAM_WALLET_SECRET: 'secret key /^S[A-Z2-7]{55}$/',
  STATION_A_SECRET: 'secret key /^S[A-Z2-7]{55}$/',
  STATION_B_SECRET: 'secret key /^S[A-Z2-7]{55}$/',
  KEY_ENCRYPTION_SECRET: '64 lowercase hex chars /^[0-9a-f]{64}$/',
  GAS_MODE: "'velo' or 'direct'",
  GAS_FALLBACK_DIRECT: "'true' or 'false'",
  VELO_GAS_BASE_URL: 'URL',
  VELO_GAS_API_KEY: "starts with 'tg_test_'",
  VELO_API_KEY: "starts with 'tk_test_' or 'tk_live_'",
  VELO_WEBHOOK_SECRET: 'at least 16 characters',
  TELEGRAM_BOT_TOKEN: "contains ':'",
  TELEGRAM_BOT_USERNAME: '/^[A-Za-z0-9_]{5,32}$/ (no leading @)',
  PHP_PER_XLM: 'number > 0 (default 10)',
  PRICE_TICK_MS: 'integer >= 100 (default 700)',
  FREEZE_TICK_MS: 'integer >= 100 (default 1000)',
};

export type ConfigResult = { ok: true; config: Config } | { ok: false; errors: string[] };

/** Every variable this module parses, in schema order. The root .env.example must document all of them. */
export const CONFIG_VARIABLES = Object.keys(RULES) as VariableName[];

/** Parses an environment map. Empty values count as missing. Errors name the variable and its rule only. */
export function parseConfig(env: Readonly<Record<string, string | undefined>>): ConfigResult {
  const input: Record<string, string | undefined> = {};
  for (const name of Object.keys(RULES) as VariableName[]) {
    const value = env[name];
    input[name] = value === '' ? undefined : value;
  }

  const result = configSchema.safeParse(input);
  if (result.success) return { ok: true, config: result.data };

  const failing = new Set(result.error.issues.map((issue) => String(issue.path[0]) as VariableName));
  const errors = (Object.keys(RULES) as VariableName[])
    .filter((name) => failing.has(name))
    .map((name) => `${name}: ${input[name] === undefined ? 'missing' : 'invalid'} (rule: ${RULES[name]})`);
  return { ok: false, errors };
}

/** Loads apps/server/.env (existing process variables win), parses it, and exits 1 listing every failing name. */
export function loadConfig(): Config {
  loadDotenv({ path: ENV_PATH, quiet: true });
  const result = parseConfig(process.env);
  if (result.ok) return result.config;
  console.error(`Refusing to boot: ${result.errors.length} invalid environment variable(s) in ${ENV_PATH}`);
  for (const error of result.errors) console.error(`  ${error}`);
  process.exit(1);
}
