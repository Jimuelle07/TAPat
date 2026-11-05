import { describe, expect, it } from 'vitest';
import { parseConfig } from './config';

// Syntactically valid dummies; none of these is a real key.
const VALID: Record<string, string> = {
  PORT: '4000',
  DATABASE_PATH: './data/tapat.db',
  PUBLIC_BASE_URL: 'https://localhost:3000',
  STELLAR_RPC_URL: 'https://soroban-testnet.stellar.org',
  STELLAR_NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
  NOIR_DEVICE_REGISTRY_ID: 'CAC4KOLHDLDYDWBOKXNKRN5KVHO56PLOIFXDLTBUWGVN6GVDEB7FQHU5',
  NOIR_AGENT_REGISTRY_ID: 'CCMZDSPTLX7IIJWCYEUM5DJUHOSOYSTHGK777S2TXZWEMC5ZZGPJ3EBV',
  NOIR_PAYMENT_ESCROW_ID: 'CC7EAW5FNJEDBS7THM5IT6XIOHO4AOYMLXT3KSZ3HWUIKEACTW7E5BFS',
  XLM_SAC_ID: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
  PROGRAM_WALLET_SECRET: `S${'A'.repeat(55)}`,
  STATION_A_SECRET: `S${'B'.repeat(55)}`,
  STATION_B_SECRET: `S${'C'.repeat(55)}`,
  KEY_ENCRYPTION_SECRET: 'ab'.repeat(32),
  GAS_MODE: 'direct',
  GAS_FALLBACK_DIRECT: 'false',
  VELO_GAS_BASE_URL: 'https://www.velo-build.dev',
  VELO_GAS_API_KEY: 'tg_test_dummy',
  VELO_API_KEY: 'tk_test_dummy',
  VELO_WEBHOOK_SECRET: 'whsec_dummy_dummy_dummy',
  TELEGRAM_BOT_TOKEN: '123456789:dummy',
  TELEGRAM_BOT_USERNAME: 'tapat_dev_bot',
  PHP_PER_XLM: '10',
  PRICE_TICK_MS: '700',
  FREEZE_TICK_MS: '1000',
};

function without(name: string): Record<string, string> {
  const env = { ...VALID };
  delete env[name];
  return env;
}

describe('parseConfig', () => {
  it('accepts a complete env and coerces the typed values', () => {
    const result = parseConfig(VALID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.PORT).toBe(4000);
    expect(result.config.GAS_FALLBACK_DIRECT).toBe(false);
    expect(result.config.PHP_PER_XLM).toBe(10);
  });

  it('applies the documented defaults when PORT, PHP_PER_XLM and the tick variables are absent', () => {
    const env = without('PORT');
    delete env.PHP_PER_XLM;
    delete env.PRICE_TICK_MS;
    env.FREEZE_TICK_MS = '';
    const result = parseConfig(env);
    expect(result.ok && [result.config.PORT, result.config.PHP_PER_XLM, result.config.PRICE_TICK_MS, result.config.FREEZE_TICK_MS])
      .toEqual([4000, 10, 700, 1000]);
  });

  it('names a missing required variable, and only that one', () => {
    const result = parseConfig(without('VELO_API_KEY'));
    expect(result).toEqual({ ok: false, errors: ["VELO_API_KEY: missing (rule: starts with 'tk_test_' or 'tk_live_')"] });
  });

  it("accepts a tk_live_ general key (the dashboard's current prefix) and rejects any other prefix", () => {
    expect(parseConfig({ ...VALID, VELO_API_KEY: 'tk_live_dummy' }).ok).toBe(true);
    for (const key of ['tg_test_dummy', 'tk_prod_dummy', 'xtk_live_dummy']) {
      const result = parseConfig({ ...VALID, VELO_API_KEY: key });
      expect(!result.ok && result.errors).toEqual(["VELO_API_KEY: invalid (rule: starts with 'tk_test_' or 'tk_live_')"]);
    }
  });

  it('treats the empty KEY_ENCRYPTION_SECRET from .env.example as missing', () => {
    const result = parseConfig({ ...VALID, KEY_ENCRYPTION_SECRET: '' });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors).toEqual([expect.stringMatching(/^KEY_ENCRYPTION_SECRET: missing/)]);
  });

  it('lists every malformed variable by name without printing its value', () => {
    const secret = `S${'Z'.repeat(54)}`; // one char short
    const result = parseConfig({ ...VALID, PUBLIC_BASE_URL: 'http://localhost:3000', STATION_A_SECRET: secret, PORT: '70000' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((error) => error.split(':')[0])).toEqual(['PORT', 'PUBLIC_BASE_URL', 'STATION_A_SECRET']);
    expect(result.errors.join('\n')).not.toContain(secret);
    expect(result.errors.join('\n')).not.toContain('http://localhost:3000');
  });
});
