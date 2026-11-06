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
  /**
   * Called once right after `sponsor` succeeds and before `submit`, so the caller can persist the identity before the
   * hand-off. A throw from it propagates unchanged and `submit` is never called.
   */
  onReserved?: (identity: GasExecutionIdentity) => void;
}

const PROVIDER_TIMEOUT_MS = 30_000;

/**
 * `sponsor` never succeeded, so nothing was handed off and the same XDR may still be sent directly.
 * Wrapping keeps the SDK error reachable through `.cause` for callers that triage by Velo error class.
 */
export class GasSponsorError extends Error {
  override readonly cause: unknown;

  constructor(cause: unknown) {
    super(`Gas sponsorship failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = 'GasSponsorError';
    this.cause = cause;
  }
}

/**
 * `submit` was attempted and its status could not be read back: Velo may already have the transaction, so the caller
 * must never resubmit and must reconcile by identity instead.
 */
export class GasHandoffError extends Error {
  override readonly cause: unknown;
  readonly identity: GasExecutionIdentity;

  constructor(identity: GasExecutionIdentity, cause: unknown) {
    super(`Gas hand-off status unknown: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = 'GasHandoffError';
    this.identity = identity;
    this.cause = cause;
  }
}

/**
 * Sponsors and submits one signed envelope. Sponsor failures are retried only when Velo reports a provider error,
 * and always with the same XDR and key. Any `submit` failure is recovered through `getStatus`, never a second submit.
 * The returned result may still be non-terminal; the caller decides what that means. Throws `GasSponsorError` when
 * nothing was handed off and `GasHandoffError` when it was but the status is unreadable.
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
      if (!(error instanceof VeloProviderError) || attempt >= sponsorAttempts) throw new GasSponsorError(error);
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
  // Outside the post-reservation try: a caller persistence fault must reach the caller unchanged, before the hand-off.
  opts.onReserved?.(identity);
  let result: GasSubmitResult;
  try {
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
  } catch (error) {
    // The hand-off may have reached Velo: anything that stops us reading the status back leaves it unknown.
    throw new GasHandoffError(identity, error);
  }
  return result;
}
