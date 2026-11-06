import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { Keypair } from '@stellar/stellar-sdk';
import { decryptSecret, encryptSecret, fundWithFriendbot, generateAgentKeypair } from './keys';

const KEY_HEX = 'a'.repeat(64);

function httpResponse(status: number, body = ''): { ok: boolean; status: number; text: () => Promise<string> } {
  return { ok: status >= 200 && status < 300, status, text: () => Promise.resolve(body) };
}

function stubFetch() {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('generateAgentKeypair', () => {
  it('returns a G… address that belongs to the returned S… secret', () => {
    const { publicKey, secret } = generateAgentKeypair();

    expect(publicKey).toMatch(/^G[A-Z0-9]{55}$/);
    expect(secret).toMatch(/^S[A-Z0-9]{55}$/);
    expect(Keypair.fromSecret(secret).publicKey()).toBe(publicKey);
  });
});

describe('encryptSecret / decryptSecret', () => {
  it('round-trips a Stellar secret', () => {
    const secret = Keypair.random().secret();

    expect(decryptSecret(encryptSecret(secret, KEY_HEX), KEY_HEX)).toBe(secret);
  });

  it('emits v1:<iv>:<tag>:<ciphertext> with a 12-byte IV and a 16-byte tag', () => {
    const blob = encryptSecret('anything', KEY_HEX);
    const parts = blob.split(':');

    expect(blob).toMatch(/^v1:[\w-]+:[\w-]+:[\w-]+$/);
    expect(parts).toHaveLength(4);
    expect(Buffer.from(parts[1], 'base64url')).toHaveLength(12);
    expect(Buffer.from(parts[2], 'base64url')).toHaveLength(16);
  });

  it('throws when one ciphertext character is flipped', () => {
    const blob = encryptSecret('Ssecret', KEY_HEX);
    const [version, iv, tag, ciphertext] = blob.split(':');
    const first = ciphertext.startsWith('A') ? 'B' : 'A';
    const tampered = [version, iv, tag, first + ciphertext.slice(1)].join(':');

    expect(Buffer.from(tampered.split(':')[3], 'base64url')).not.toEqual(Buffer.from(ciphertext, 'base64url'));
    expect(() => decryptSecret(tampered, KEY_HEX)).toThrow();
  });

  it('throws on a different valid 64-hex key', () => {
    const blob = encryptSecret('Ssecret', KEY_HEX);

    expect(() => decryptSecret(blob, 'b'.repeat(64))).toThrow();
  });

  it('rejects a 63-hex-char key with the key-format message', () => {
    expect(() => encryptSecret('x', 'a'.repeat(63))).toThrow('KEY_ENCRYPTION_SECRET must be 64 lowercase hex chars');
    expect(() => decryptSecret(encryptSecret('x', KEY_HEX), 'a'.repeat(63))).toThrow(
      'KEY_ENCRYPTION_SECRET must be 64 lowercase hex chars',
    );
  });

  it('rejects a blob from another version or shape', () => {
    expect(() => decryptSecret('v2:aa:bb:cc', KEY_HEX)).toThrow('Unrecognised secret blob format');
    expect(() => decryptSecret('not-a-blob', KEY_HEX)).toThrow('Unrecognised secret blob format');
  });

  it('rejects a 4-byte tag and an 11-byte IV', () => {
    const [, iv, tag, ciphertext] = encryptSecret('Ssecret', KEY_HEX).split(':');
    const shortTag = ['v1', iv, randomBytes(4).toString('base64url'), ciphertext].join(':');
    const shortIv = ['v1', randomBytes(11).toString('base64url'), tag, ciphertext].join(':');

    expect(Buffer.from(shortTag.split(':')[2], 'base64url')).toHaveLength(4);
    expect(Buffer.from(shortIv.split(':')[1], 'base64url')).toHaveLength(11);
    expect(() => decryptSecret(shortTag, KEY_HEX)).toThrow('Unrecognised secret blob format');
    expect(() => decryptSecret(shortIv, KEY_HEX)).toThrow('Unrecognised secret blob format');
  });
});

describe('fundWithFriendbot', () => {
  it('resolves after one call on 200 and targets the account in the query string', async () => {
    const fetchMock = stubFetch().mockResolvedValue(httpResponse(200));
    const publicKey = Keypair.random().publicKey();

    await expect(fundWithFriendbot(publicKey, { delayMs: 0 })).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(`addr=${publicKey}`);
  });

  it('treats an already-funded 400 as success', async () => {
    const fetchMock = stubFetch().mockResolvedValue(
      httpResponse(400, JSON.stringify({ detail: 'account already funded to starting balance', status: 400 })),
    );

    await expect(fundWithFriendbot(Keypair.random().publicKey(), { delayMs: 0 })).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not treat another 400 "already" body as success', async () => {
    const fetchMock = stubFetch().mockResolvedValue(
      httpResponse(400, JSON.stringify({ detail: 'already registered elsewhere', status: 400 })),
    );
    const publicKey = Keypair.random().publicKey();

    await expect(fundWithFriendbot(publicKey, { delayMs: 0 })).rejects.toThrow(
      `friendbot failed for ${publicKey}: HTTP 400`,
    );

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('retries another 400 body and rejects after the last attempt', async () => {
    const fetchMock = stubFetch().mockResolvedValue(httpResponse(400, 'invalid address'));

    await expect(fundWithFriendbot(Keypair.random().publicKey(), { delayMs: 0 })).rejects.toThrow('HTTP 400');

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('retries an HTTP error and resolves on a later 200', async () => {
    const fetchMock = stubFetch()
      .mockResolvedValueOnce(httpResponse(500))
      .mockResolvedValueOnce(httpResponse(500))
      .mockResolvedValueOnce(httpResponse(200));

    await expect(fundWithFriendbot(Keypair.random().publicKey(), { delayMs: 0 })).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('rejects with the last status when every attempt fails', async () => {
    const fetchMock = stubFetch().mockResolvedValue(httpResponse(500));
    const publicKey = Keypair.random().publicKey();

    await expect(fundWithFriendbot(publicKey, { delayMs: 0 })).rejects.toThrow(
      `friendbot failed for ${publicKey}: HTTP 500`,
    );

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('rejects with the thrown message after three transport failures', async () => {
    const fetchMock = stubFetch().mockRejectedValue(new Error('ECONNRESET'));
    const publicKey = Keypair.random().publicKey();

    await expect(fundWithFriendbot(publicKey, { delayMs: 0 })).rejects.toThrow(
      `friendbot failed for ${publicKey}: ECONNRESET`,
    );

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
