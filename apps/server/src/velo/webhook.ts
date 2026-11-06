// Velo webhook signature check (docs/api-and-data.md §5.5). The SDK verifies `t=<unix>,v1=<hex>` with an HMAC-SHA256
// over `<t>.<raw body>` (Web Crypto `verify`, which is constant-time) and a 300 s freshness window, then parses and
// shapes the event. The bytes passed in must be the raw request body, never a re-serialized JSON value.
import { Velo } from '@tapat/agent';
import { ApiError } from '../errors';

/** The fields of a verified Velo event this server reads; the SDK's `WebhookEvent` union is assignable to it. */
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
}

/** The verified, typed event, or 400 `WEBHOOK_SIGNATURE_INVALID` for any verification or event-shape failure. */
export async function verifyVeloWebhook(input: VerifyVeloWebhookInput): Promise<VeloWebhookEvent> {
  try {
    return await Velo.webhooks.verify({
      payload: input.rawBody.toString('utf8'),
      signature: input.signature ?? null,
      secret: input.secret,
    });
  } catch {
    throw new ApiError(400, 'WEBHOOK_SIGNATURE_INVALID', 'webhook signature verification failed');
  }
}
