// Test-only Velo fakes (no network): a client whose checkout and payment-intent calls are spies, plus a signer that
// produces the exact `x-velo-signature` format the SDK verifies (`t=<unix>,v1=hex(HMAC-SHA256(secret, "<t>.<body>"))`).
import { createHmac } from 'node:crypto';
import { vi, type Mock } from 'vitest';
import type { Velo } from '@tapat/agent';
import type { VeloPaymentIntent } from '../velo/checkout';

export const WEBHOOK_SECRET = 'whsec_0123456789abcdef0123456789abcdef';
export const PUBLIC_BASE_URL = 'https://tapat.example.ts.net';
export const INTENT_ID = 'pi_budget_1';

/** A payment intent as the SDK returns it; `status` and `amount` are what the tests vary. */
export function intent(overrides: Partial<VeloPaymentIntent> = {}): VeloPaymentIntent {
  return {
    id: INTENT_ID,
    paymentIntentId: INTENT_ID,
    status: 'created',
    amount: '1000.00',
    asset: 'native',
    checkoutUrl: 'https://pay.velo-build.dev/checkout/pi_budget_1',
    payerAddress: null,
    ...overrides,
  };
}

export interface FakeVelo {
  velo: Pick<Velo, 'checkout' | 'paymentIntents'>;
  create: Mock<(params: object, options?: object) => Promise<VeloPaymentIntent>>;
  retrieve: Mock<(id: string, options?: object) => Promise<VeloPaymentIntent>>;
}

/** `create` answers a `created` intent, `retrieve` answers it as still `created`; tests override either. */
export function fakeVelo(): FakeVelo {
  const create = vi.fn(async (_params: object, _options?: object) => intent());
  const retrieve = vi.fn(async (_id: string, _options?: object) => intent());
  const list = vi.fn(async () => ({ data: [] }));
  const velo = {
    checkout: { sessions: { create } },
    paymentIntents: { retrieve, list },
  } as unknown as Pick<Velo, 'checkout' | 'paymentIntents'>;
  return { velo, create, retrieve };
}

/** The `x-velo-signature` header for `body`; `t` defaults to now (the SDK rejects a stamp more than 300 s off). */
export function signBody(body: string, secret: string = WEBHOOK_SECRET, t: number = Math.floor(Date.now() / 1000)): string {
  const mac = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  return `t=${t},v1=${mac}`;
}

/** A schema-valid `payment.*` webhook body for one intent. */
export function paymentEventBody(type: 'payment.succeeded' | 'payment.failed' | 'payment.created', intentId = INTENT_ID): string {
  const stamp = new Date().toISOString();
  return JSON.stringify({
    version: '1',
    id: `evt_${type}_${intentId}`,
    type,
    test: false,
    sentAt: stamp,
    project: { id: 'proj_1', registryProjectId: 'reg_1', name: 'TAPat', slug: 'tapat' },
    paymentIntent: {
      id: intentId,
      amount: '1000.00',
      asset: 'native',
      merchantName: 'TAPat',
      description: 'TAPat fuel program budget',
      status: type === 'payment.succeeded' ? 'paid' : 'pending',
      payerAddress: 'GPAYER',
      txHash: 'abc123',
      createdAt: stamp,
      updatedAt: stamp,
    },
  });
}
