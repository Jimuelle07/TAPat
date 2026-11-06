// Velo webhook verification (docs/api-and-data.md §5.5). `x-velo-signature` is `t=<unix>,v1=<64 hex>`, an HMAC-SHA256
// over `<t>.<raw body>` with VELO_WEBHOOK_SECRET; the stamp must be within 300 s of now. The bytes passed in must be
// the raw request body, never a re-serialized JSON value.
//
// Not `Velo.webhooks.verify`: SDK 1.0.0 also enforces its own event schema after the HMAC, and that schema requires
// `project.registryProjectId` to be a string while Velo sends a number (captured 2026-11-06), so every real delivery
// failed. This checks the same signature format, then only the event fields this server reads.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { ApiError } from '../errors';

/** Freshness window for the signature stamp, the same as the SDK's default. */
export const WEBHOOK_TOLERANCE_S = 300;
const MAX_SIGNATURE_HEADER_LENGTH = 512;

/** Only the envelope fields the budget handler reads; every other field is stored with the raw body, not checked. */
const eventSchema = z.object({
  version: z.literal('1').optional(),
  id: z.string(),
  type: z.string(),
  paymentIntent: z.unknown().optional(),
});
const paymentIntentSchema = z.object({ id: z.string(), txHash: z.string().nullish() });

/** The fields of a verified Velo event this server reads. */
export interface VeloWebhookEvent {
  id: string;
  type: string;
  paymentIntent?: { id: string; txHash?: string };
}

export interface VerifyVeloWebhookInput {
  rawBody: Buffer;
  /** The `x-velo-signature` header value, if the request carried one. */
  signature: string | undefined;
  /** `VELO_WEBHOOK_SECRET`. */
  secret: string;
  /** Unix seconds; default now. */
  nowS?: number;
}

function invalid(): ApiError {
  return new ApiError(400, 'WEBHOOK_SIGNATURE_INVALID', 'webhook signature verification failed');
}

/** `{t, v1}` from the header, or null for anything but exactly one numeric `t` and one 64-hex `v1`. */
function parseSignatureHeader(header: string): { t: number; v1: Buffer } | null {
  if (header.length === 0 || header.length > MAX_SIGNATURE_HEADER_LENGTH) return null;
  let t: string | undefined;
  let v1: string | undefined;
  for (const part of header.split(',')) {
    const eq = part.indexOf('=');
    if (eq <= 0) return null;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === 't') {
      if (t !== undefined) return null;
      t = value;
    } else if (key === 'v1') {
      if (v1 !== undefined) return null;
      v1 = value;
    }
  }
  // `t` is canonical decimal like the SDK requires (no leading zeros), so the MAC input matches what Velo signed.
  if (t === undefined || !/^(?:0|[1-9]\d{0,11})$/.test(t) || v1 === undefined || !/^[0-9a-f]{64}$/.test(v1)) return null;
  return { t: Number(t), v1: Buffer.from(v1, 'hex') };
}

/** The event fields the budget handler reads; a `payment.*` event must name its intent. */
function parseEvent(rawBody: Buffer): VeloWebhookEvent | null {
  let json: unknown;
  try {
    json = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return null;
  }
  const envelope = eventSchema.safeParse(json);
  if (!envelope.success) return null;
  const { id, type } = envelope.data;
  if (!type.startsWith('payment.')) return { id, type };
  const intent = paymentIntentSchema.safeParse(envelope.data.paymentIntent);
  if (!intent.success) return null;
  const { id: intentId, txHash } = intent.data;
  return { id, type, paymentIntent: txHash == null ? { id: intentId } : { id: intentId, txHash } };
}

/** The verified event, or 400 `WEBHOOK_SIGNATURE_INVALID` for any signature, freshness, or event-shape failure. */
export function verifyVeloWebhook(input: VerifyVeloWebhookInput): VeloWebhookEvent {
  const header = input.signature === undefined ? null : parseSignatureHeader(input.signature);
  if (header === null) throw invalid();
  const nowS = input.nowS ?? Math.floor(Date.now() / 1000);
  if (Math.abs(nowS - header.t) > WEBHOOK_TOLERANCE_S) throw invalid();
  const expected = createHmac('sha256', input.secret)
    .update(`${header.t}.`)
    .update(input.rawBody)
    .digest();
  // Both are 32 bytes (v1 is checked as 64 hex), so the constant-time compare never throws on length.
  if (!timingSafeEqual(expected, header.v1)) throw invalid();
  const event = parseEvent(input.rawBody);
  if (event === null) throw invalid();
  return event;
}
