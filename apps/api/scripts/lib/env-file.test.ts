import { describe, expect, it } from 'vitest';
import { readEnvValue, upsertEnv } from './env-file';

describe('upsertEnv', () => {
  it('replaces an existing NAME= line in place', () => {
    const text = 'PORT=4000\nPROGRAM_WALLET_SECRET=SOLD\nGAS_MODE=direct\n';
    expect(upsertEnv(text, { PROGRAM_WALLET_SECRET: 'SDUMMY' })).toBe(
      'PORT=4000\nPROGRAM_WALLET_SECRET=SDUMMY\nGAS_MODE=direct\n',
    );
  });

  it('fills an empty NAME= line', () => {
    const text = 'KEY_ENCRYPTION_SECRET=\nPORT=4000\n';
    expect(upsertEnv(text, { KEY_ENCRYPTION_SECRET: 'abc123' })).toBe('KEY_ENCRYPTION_SECRET=abc123\nPORT=4000\n');
  });

  it('appends missing names at the end, in updates order', () => {
    const text = 'PORT=4000\n';
    expect(upsertEnv(text, { STATION_A_SECRET: 'SDUMMYA', STATION_B_SECRET: 'SDUMMYB' })).toBe(
      'PORT=4000\nSTATION_A_SECRET=SDUMMYA\nSTATION_B_SECRET=SDUMMYB\n',
    );
  });

  it('keeps comments, blank lines and unrelated lines in their positions', () => {
    const text = '# Stellar\n\nPORT=4000\n# secrets below\nSTATION_A_SECRET=\n\nGAS_MODE=direct\n';
    expect(upsertEnv(text, { STATION_A_SECRET: 'SDUMMY' })).toBe(
      '# Stellar\n\nPORT=4000\n# secrets below\nSTATION_A_SECRET=SDUMMY\n\nGAS_MODE=direct\n',
    );
  });

  it('does not touch a commented-out NAME= or a NAME_OTHER= line', () => {
    const text = '# STATION_A_SECRET=x\nSTATION_A_SECRET_OLD=x\n';
    expect(upsertEnv(text, { STATION_A_SECRET: 'SDUMMY' })).toBe(
      '# STATION_A_SECRET=x\nSTATION_A_SECRET_OLD=x\nSTATION_A_SECRET=SDUMMY\n',
    );
  });

  it('keeps CRLF input as CRLF', () => {
    const text = 'PORT=4000\r\nSTATION_B_SECRET=\r\n';
    expect(upsertEnv(text, { STATION_B_SECRET: 'SDUMMY', KEY_ENCRYPTION_SECRET: 'abc' })).toBe(
      'PORT=4000\r\nSTATION_B_SECRET=SDUMMY\r\nKEY_ENCRYPTION_SECRET=abc\r\n',
    );
  });
});

describe('readEnvValue', () => {
  it("returns '' for an empty NAME= line and undefined when NAME is absent", () => {
    const text = '# KEY_ENCRYPTION_SECRET=commented\nKEY_ENCRYPTION_SECRET=\nPORT=4000\n';
    expect(readEnvValue(text, 'KEY_ENCRYPTION_SECRET')).toBe('');
    expect(readEnvValue(text, 'STATION_A_SECRET')).toBeUndefined();
  });
});
