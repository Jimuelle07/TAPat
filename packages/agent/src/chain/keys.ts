// Agent key material (SDD §4.7): generate a Stellar identity, encrypt its secret at rest and fund it on testnet.
// This package reads no env, so the AES key always comes from the caller (apps/server passes KEY_ENCRYPTION_SECRET).
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { Keypair } from '@stellar/stellar-sdk';

/** Same rule apps/server/src/config.ts enforces: 32 bytes as 64 lowercase hex chars. */
const KEY_PATTERN = /^[0-9a-f]{64}$/;
const FRIENDBOT_URL = 'https://friendbot.stellar.org';

/** A fresh agent identity: the G… address the registries see, and the S… secret to encrypt before it is stored. */
export function generateAgentKeypair(): { publicKey: string; secret: string } {
  const pair = Keypair.random();
  return { publicKey: pair.publicKey(), secret: pair.secret() };
}

function keyFromHex(keyHex: string): Buffer {
  if (!KEY_PATTERN.test(keyHex)) throw new Error('KEY_ENCRYPTION_SECRET must be 64 lowercase hex chars');
  return Buffer.from(keyHex, 'hex');
}

/** GCM fixed sizes: a 96-bit IV and a 128-bit tag (SP 800-38D). */
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * Returns `v1:<iv>:<tag>:<ciphertext>`, each part base64url. The `v1` prefix is a format version only — it carries no
 * key id, so rotating the AES key makes every existing blob undecryptable (no key-version fallback exists).
 */
export function encryptSecret(plain: string, keyHex: string): string {
  const key = keyFromHex(keyHex);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join(':');
}

/** GCM's auth tag is the only integrity gate: a wrong key or a tampered blob throws, with no fallback path. */
export function decryptSecret(blob: string, keyHex: string): string {
  const parts = blob.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('Unrecognised secret blob format');
  const key = keyFromHex(keyHex);
  const iv = Buffer.from(parts[1] as string, 'base64url');
  const tag = Buffer.from(parts[2] as string, 'base64url');
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) throw new Error('Unrecognised secret blob format');
  const decipher = createDecipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_BYTES });
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(Buffer.from(parts[3] as string, 'base64url')), decipher.final()]);
  return plain.toString('utf8');
}

/**
 * Funds a fresh testnet account through Friendbot. A 400 saying the account is already funded counts as success:
 * the caller's goal (the account exists with a starting balance) is already met.
 */
export async function fundWithFriendbot(
  publicKey: string,
  opts: { attempts?: number; delayMs?: number } = {},
): Promise<void> {
  const attempts = opts.attempts ?? 3;
  const delayMs = opts.delayMs ?? 2000;
  let lastDetail = 'no attempt made';
  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (attempt > 1 && delayMs > 0) await sleep(delayMs);
    try {
      const res = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(publicKey)}`);
      if (res.ok) return;
      // Live Friendbot body: {"detail":"account already funded to starting balance","status":400,...}
      if (res.status === 400 && /already funded/i.test(await res.text())) return;
      lastDetail = `HTTP ${res.status}`;
    } catch (error) {
      lastDetail = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(`friendbot failed for ${publicKey}: ${lastDetail}`);
}
