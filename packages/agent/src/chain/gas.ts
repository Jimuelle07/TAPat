// Velo Gas Station hand-off: sponsor once (retried only on provider errors), submit exactly once, then read the
// result back by identity. A failed hand-off is never resubmitted, because Velo may already have the transaction.
import { setTimeout as sleep } from 'node:timers/promises';
import {
  VeloProviderError,
  type GasApi,
  type GasExecutionIdentity,
  type GasSubmitResult,
} from '@carts1024/velo-sdk';

export interface SubmitSponsoredOptions {
  /** Stable per (run, step): a retried sponsorship reuses the reservation instead of taking a second one. */
  idempotencyKey: string;
  /** Total `sponsor` attempts, retries included. Default 4. */
  sponsorAttempts?: number;
  /** Linear backoff between sponsor retries, in ms. Default 10_000. */
  retryDelayMs?: number;
  /** Passed to `waitForResult` for non-terminal statuses. Default 90_000 ms / 20 attempts. */
  wait?: { timeoutMs?: number; maxAttempts?: number };
  /** Called before each sponsor retry, with the 1-based attempt that just failed. */
  onRetry?: (attempt: number, error: unknown) => void;
  /** Called when `submit` fails, before the status is read back by identity. */
  onUncertainHandoff?: (error: unknown) => void;
}

const PROVIDER_TIMEOUT_MS = 30_000;

/**
 * Sponsors and submits one signed envelope. Sponsor failures are retried only when Velo reports a provider error,
 * and always with the same XDR and key. Any `submit` failure is recovered through `getStatus`, never a second submit.
 * The returned result may still be non-terminal; the caller decides what that means.
 */
export async function submitSponsored(
  gas: Pick<GasApi, 'sponsor' | 'submit' | 'getStatus' | 'waitForResult'>,
  signedXdr: string,
  opts: SubmitSponsoredOptions,
): Promise<GasSubmitResult> {
  const sponsorAttempts = opts.sponsorAttempts ?? 4;
  const retryDelayMs = opts.retryDelayMs ?? 10_000;
  const wait = { timeoutMs: opts.wait?.timeoutMs ?? 90_000, maxAttempts: opts.wait?.maxAttempts ?? 20 };

  // sponsor() only reserves fee exposure and never submits, so a provider failure is safe to retry.
  let reservation;
  for (let attempt = 1; ; attempt++) {
    try {
      reservation = await gas.sponsor(signedXdr, {
        idempotencyKey: opts.idempotencyKey,
        correlationId: opts.idempotencyKey,
        timeoutMs: PROVIDER_TIMEOUT_MS,
      });
      break;
    } catch (error) {
      if (!(error instanceof VeloProviderError) || attempt >= sponsorAttempts) throw error;
      opts.onRetry?.(attempt, error);
      if (retryDelayMs > 0) await sleep(retryDelayMs * attempt);
    }
  }

  // submit() is the single hand-off. Any failure may come after Velo received it (a 5xx arrives as
  // VeloProviderError, a lost response as VeloGasSubmissionUnknownError), so recover by identity, never resubmit.
  const identity: GasExecutionIdentity = {
    requestId: reservation.requestId,
    transactionHash: reservation.transactionHash,
  };
  let result: GasSubmitResult;
  try {
    result = await gas.submit({ ...identity, transactionXdr: signedXdr });
  } catch (error) {
    opts.onUncertainHandoff?.(error);
    result = await gas.getStatus(identity);
  }
  // waitForResult returns the last non-terminal result when its attempts run out.
  if (result.status === 'claimed' || result.status === 'submitted' || result.status === 'submission_unknown') {
    result = await gas.waitForResult(identity, wait);
  }
  return result;
}
