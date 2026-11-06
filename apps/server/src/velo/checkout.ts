// The Velo checkout and payment-intent calls behind the budget flow (docs/api-and-data.md §5.2 #4, §6.1). The server
// reaches Velo's classic-payment API only through these two functions; the Gas Station (`velo.gas`) is separate.
import type { Velo } from '@tapat/agent';
import { ApiError } from '../errors';

/** The handbook's checkout asset; Velo may echo it back as `native` or `XLM` (§5.2 #4). */
export const VELO_CHECKOUT_ASSET = 'native';

export const BUDGET_CHECKOUT_DESCRIPTION = 'TAPat fuel program budget';

/** The fields of a Velo payment intent this server reads; the SDK's `PaymentIntent` is assignable to it. */
export interface VeloPaymentIntent {
  id: string;
  paymentIntentId: string;
  status: string;
  amount: string;
  asset: string;
  checkoutUrl: string | null;
  payerAddress?: string | null;
}

/** One intent read is bounded so a slow Velo never stalls the 3 s poller or a webhook handler for long. */
const RETRIEVE_TIMEOUT_MS = 5_000;

export interface BudgetCheckoutRequest {
  /** XLM decimal string, always 2 decimals (`"1000.00"`). */
  amount: string;
  idempotencyKey: string;
  /** `PUBLIC_BASE_URL`; the success and cancel redirects hang off it. */
  publicBaseUrl: string;
}

export interface BudgetCheckoutSession {
  checkoutUrl: string;
  paymentIntentId: string;
}

/** `velo.checkout.sessions.create` for one budget deposit; any SDK failure is 502 `CHAIN_ERROR` / `VELO_CALL_FAILED`. */
export async function createBudgetCheckoutSession(
  velo: Pick<Velo, 'checkout'>,
  request: BudgetCheckoutRequest,
): Promise<BudgetCheckoutSession> {
  const base = request.publicBaseUrl.replace(/\/+$/, '');
  let intent: VeloPaymentIntent;
  try {
    intent = await velo.checkout.sessions.create(
      {
        amount: request.amount,
        asset: VELO_CHECKOUT_ASSET,
        description: BUDGET_CHECKOUT_DESCRIPTION,
        successUrl: `${base}/?budget=success`,
        cancelUrl: `${base}/?budget=cancel`,
      },
      { idempotencyKey: request.idempotencyKey },
    );
  } catch (error) {
    throw new ApiError(502, 'CHAIN_ERROR', `VELO_CALL_FAILED: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (intent.checkoutUrl === null) {
    throw new ApiError(502, 'CHAIN_ERROR', 'VELO_CALL_FAILED: checkout session has no checkoutUrl');
  }
  return { checkoutUrl: intent.checkoutUrl, paymentIntentId: intent.paymentIntentId };
}

/** `velo.paymentIntents.retrieve`: the authority on whether an intent was paid (webhook and poller both use it). */
export function retrievePaymentIntent(velo: Pick<Velo, 'paymentIntents'>, id: string): Promise<VeloPaymentIntent> {
  return velo.paymentIntents.retrieve(id, { timeoutMs: RETRIEVE_TIMEOUT_MS });
}
