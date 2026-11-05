import { describe, expect, it } from 'vitest';
import { deviceHash, normalizeUid } from './src/device-hash';

const SALT_A = '00112233445566778899aabbccddeeff';
const SALT_B = 'ffeeddccbbaa99887766554433221100';

describe('device hash', () => {
  it('normalizes a Web NFC serialNumber: colons removed, uppercased, idempotent', () => {
    expect(normalizeUid('04:a2:1f:9c:a1:b2')).toBe('04A21F9CA1B2');
    expect(normalizeUid('04A21F9CA1B2')).toBe('04A21F9CA1B2');
  });

  it('is SHA-256(utf8("${salt}:${UID}")) over the normalized UID', async () => {
    // Independent reference: sha256 of the ASCII string "00112233445566778899aabbccddeeff:04A21F9CA1B2".
    const expected = 'a3e0cdb888edc9d5618982270ecfbe2b2a2fcdffd72d84b8235f0f2815db7de2';
    expect(await deviceHash(SALT_A, '04:a2:1f:9c:a1:b2')).toBe(expected);
    expect(await deviceHash(SALT_A, '04A21F9CA1B2')).toBe(expected);
  });

  it('gives different hashes for the same card under two salts', async () => {
    const uid = '04A21F9CA1B2';
    expect(await deviceHash(SALT_A, uid)).not.toBe(await deviceHash(SALT_B, uid));
  });
});
