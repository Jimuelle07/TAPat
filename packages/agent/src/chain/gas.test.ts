import { describe, expect, it, vi } from 'vitest';
import {
  VeloProviderError,
  type GasApi,
  type GasExecutionIdentity,
  type GasSponsorReservation,
  type GasSubmitResult,
} from '@carts1024/velo-sdk';
import { GasHandoffError, GasSponsorError, submitSponsored } from './gas';

type Gas = Pick<GasApi, 'sponsor' | 'submit' | 'getStatus' | 'waitForResult'>;

const XDR = 'AAAAAgAAAAA-signed-envelope';
const KEY = 'tapat-spk:run1:authorize';

const RESERVATION: GasSponsorReservation = {
  object: 'gas_sponsor_reservation',
  requestId: 'req_1',
  replayed: false,
  decision: 'reserved',
  transactionHash: 'inner_hash_1',
  sourceWallet: 'GSPONSOR',
  targetContractIds: ['CESCROW'],
  innerMaxFeeStroops: '100',
  reservedStroops: '200',
  expiresAt: '2026-11-05T00:00:00Z',
};

const IDENTITY: GasExecutionIdentity = {
  requestId: RESERVATION.requestId,
  transactionHash: RESERVATION.transactionHash,
};

function result(status: GasSubmitResult['status']): GasSubmitResult {
  return {
    object: 'gas_submit_result',
    requestId: RESERVATION.requestId,
    transactionHash: RESERVATION.transactionHash,
    outerTransactionHash: status === 'succeeded' ? 'outer_hash_1' : null,
    status,
    reservedStroops: '200',
    actualFeeStroops: status === 'succeeded' ? '150' : null,
    expiresAt: '2026-11-05T00:00:00Z',
    reconciliationRequired: status === 'submission_unknown',
  };
}

function fakeGas() {
  const sponsor = vi.fn().mockResolvedValue(RESERVATION);
  const submit = vi.fn().mockResolvedValue(result('succeeded'));
  const getStatus = vi.fn().mockResolvedValue(result('succeeded'));
  const waitForResult = vi.fn().mockResolvedValue(result('succeeded'));
  const gas: Gas = { sponsor, submit, getStatus, waitForResult };
  return { gas, sponsor, submit, getStatus, waitForResult };
}

describe('submitSponsored', () => {
  it('retries the sponsor on a provider error with the same XDR and key, then submits exactly once', async () => {
    const { gas, sponsor, submit } = fakeGas();
    const providerError = new VeloProviderError('upstream 502', { status: 502 });
    sponsor.mockRejectedValueOnce(providerError);
    const onRetry = vi.fn();

    const out = await submitSponsored(gas, XDR, { idempotencyKey: KEY, retryDelayMs: 0, onRetry });

    expect(sponsor).toHaveBeenCalledTimes(2);
    for (const [xdr, options] of sponsor.mock.calls) {
      expect(xdr).toBe(XDR);
      expect(options.idempotencyKey).toBe(KEY);
    }
    expect(onRetry).toHaveBeenCalledWith(1, providerError);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith({ ...IDENTITY, transactionXdr: XDR });
    expect(out.status).toBe('succeeded');
  });

  it('stops after sponsorAttempts and wraps the last provider error', async () => {
    const { gas, sponsor, submit } = fakeGas();
    const providerError = new VeloProviderError('still 502', { status: 502 });
    sponsor.mockRejectedValue(providerError);

    const error: unknown = await submitSponsored(gas, XDR, {
      idempotencyKey: KEY,
      retryDelayMs: 0,
      sponsorAttempts: 3,
    }).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(GasSponsorError);
    expect((error as GasSponsorError).cause).toBe(providerError);
    expect((error as GasSponsorError).message).toBe('Gas sponsorship failed: still 502');
    expect(sponsor).toHaveBeenCalledTimes(3);
    expect(submit).not.toHaveBeenCalled();
  });

  it('wraps a non-provider sponsor error without submitting', async () => {
    const { gas, sponsor, submit } = fakeGas();
    const authError = new Error('bad api key');
    sponsor.mockRejectedValue(authError);

    const error: unknown = await submitSponsored(gas, XDR, { idempotencyKey: KEY, retryDelayMs: 0 }).catch(
      (thrown: unknown) => thrown,
    );

    expect(error).toBeInstanceOf(GasSponsorError);
    expect((error as GasSponsorError).cause).toBe(authError);
    expect(sponsor).toHaveBeenCalledTimes(1);
    expect(submit).not.toHaveBeenCalled();
  });

  it('recovers a VeloProviderError from submit by identity and never resubmits', async () => {
    const { gas, submit, getStatus, waitForResult } = fakeGas();
    const submitError = new VeloProviderError('lost response', { status: 504 });
    submit.mockRejectedValueOnce(submitError);
    const onUncertainHandoff = vi.fn();

    const out = await submitSponsored(gas, XDR, { idempotencyKey: KEY, retryDelayMs: 0, onUncertainHandoff });

    expect(onUncertainHandoff).toHaveBeenCalledWith(submitError);
    expect(getStatus).toHaveBeenCalledWith(IDENTITY);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(waitForResult).not.toHaveBeenCalled();
    expect(out).toEqual(result('succeeded'));
  });

  it('recovers a plain submit error by identity too', async () => {
    const { gas, submit, getStatus } = fakeGas();
    const submitError = new Error('socket hang up');
    submit.mockRejectedValueOnce(submitError);

    const out = await submitSponsored(gas, XDR, { idempotencyKey: KEY, retryDelayMs: 0 });

    expect(getStatus).toHaveBeenCalledWith(IDENTITY);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(out.status).toBe('succeeded');
  });

  it('waits by identity when the status is non-terminal', async () => {
    const { gas, submit, waitForResult } = fakeGas();
    submit.mockResolvedValueOnce(result('submitted'));
    waitForResult.mockResolvedValueOnce(result('succeeded'));

    const out = await submitSponsored(gas, XDR, { idempotencyKey: KEY, retryDelayMs: 0 });

    expect(waitForResult).toHaveBeenCalledTimes(1);
    expect(waitForResult).toHaveBeenCalledWith(IDENTITY, { timeoutMs: 90_000, maxAttempts: 20 });
    expect(out.status).toBe('succeeded');
  });

  it('returns a terminal status as is without waiting', async () => {
    const { gas, submit, waitForResult } = fakeGas();
    const failed = result('failed');
    submit.mockResolvedValueOnce(failed);

    await expect(submitSponsored(gas, XDR, { idempotencyKey: KEY, retryDelayMs: 0 })).resolves.toBe(failed);
    expect(waitForResult).not.toHaveBeenCalled();
  });

  it('wraps a getStatus failure after submit as a hand-off error', async () => {
    const { gas, submit, getStatus } = fakeGas();
    submit.mockRejectedValueOnce(new VeloProviderError('lost response', { status: 504 }));
    const statusError = new Error('status endpoint 502');
    getStatus.mockRejectedValueOnce(statusError);

    const error: unknown = await submitSponsored(gas, XDR, { idempotencyKey: KEY, retryDelayMs: 0 }).catch(
      (thrown: unknown) => thrown,
    );

    expect(error).toBeInstanceOf(GasHandoffError);
    expect((error as GasHandoffError).identity).toEqual(IDENTITY);
    expect((error as GasHandoffError).cause).toBe(statusError);
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('wraps a waitForResult failure as a hand-off error', async () => {
    const { gas, submit, waitForResult } = fakeGas();
    submit.mockResolvedValueOnce(result('submitted'));
    const waitError = new Error('polling aborted');
    waitForResult.mockRejectedValueOnce(waitError);

    const error: unknown = await submitSponsored(gas, XDR, { idempotencyKey: KEY, retryDelayMs: 0 }).catch(
      (thrown: unknown) => thrown,
    );

    expect(error).toBeInstanceOf(GasHandoffError);
    expect((error as GasHandoffError).identity).toEqual(IDENTITY);
    expect((error as GasHandoffError).cause).toBe(waitError);
  });
});
