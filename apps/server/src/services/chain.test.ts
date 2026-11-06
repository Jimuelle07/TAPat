import { Account, Keypair, Operation, TransactionBuilder } from '@stellar/stellar-sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  NoirContractError,
  VeloAuthError,
  VeloProviderError,
  VeloValidationError,
  type GasApi,
  type GasSubmitResult,
  type NoirAgentClient,
  type NoirOperation,
} from '@tapat/agent';
import type { Db, SqlValue } from '../db/index';
import { openDb } from '../db/index';
import {
  reconcileOnce,
  recoverInterruptedTxs,
  runChainTx,
  startReconciler,
  type ChainDeps,
  type ChainLog,
} from './chain';

const PASSPHRASE = 'Test SDF Network ; September 2015';
const DEVICE_REGISTRY = 'CAC4KOLHDLDYDWBOKXNKRN5KVHO56PLOIFXDLTBUWGVN6GVDEB7FQHU5';
const AGENT_REGISTRY = 'CCMZDSPTLX7IIJWCYEUM5DJUHOSOYSTHGK777S2TXZWEMC5ZZGPJ3EBV';
const PAYMENT_ESCROW = 'CC7EAW5FNJEDBS7THM5IT6XIOHO4AOYMLXT3KSZ3HWUIKEACTW7E5BFS';
const DEVICE_HASH = '00'.repeat(32);

type Gas = Pick<GasApi, 'sponsor' | 'submit' | 'getStatus' | 'waitForResult'>;

const RESERVATION = {
  object: 'gas_sponsor_reservation' as const,
  requestId: 'req_1',
  replayed: false,
  decision: 'reserved' as const,
  transactionHash: 'inner_hash_1',
  sourceWallet: 'GSPONSOR',
  targetContractIds: [PAYMENT_ESCROW],
  innerMaxFeeStroops: '100',
  reservedStroops: '200',
  expiresAt: '2026-11-05T00:00:00Z',
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

function fakeNoir(signer: Keypair) {
  const unsigned = new TransactionBuilder(new Account(signer.publicKey(), '1'), {
    fee: '100',
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(Operation.bumpSequence({ bumpTo: '2' }))
    .setTimeout(30)
    .build();
  const prepare = vi.fn().mockResolvedValue(unsigned.toXDR());
  const submit = vi.fn().mockResolvedValue('direct_inner_hash');
  // Default: the hash is not indexed yet, so a chain confirmation leaves the row as it was.
  const getTransaction = vi.fn().mockResolvedValue({ status: 'NOT_FOUND' });
  const noir = { prepare, submit, server: { getTransaction } } as unknown as NoirAgentClient;
  return { noir, prepare, submit, getTransaction };
}

function fakeLog() {
  return { warn: vi.fn(), error: vi.fn() } satisfies ChainLog;
}

const AUTH: NoirOperation = {
  kind: 'authorize',
  deviceHash: DEVICE_HASH,
  merchant: 'GMERCHANT',
  asset: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
  amount: 5_000_000n,
  nonce: 1n,
};

function makeDeps(overrides: Partial<ChainDeps> = {}): ChainDeps {
  return {
    db: openDb(':memory:'),
    noir: fakeNoir(Keypair.random()).noir,
    gas: fakeGas().gas,
    config: {
      GAS_MODE: 'velo',
      GAS_FALLBACK_DIRECT: false,
      STELLAR_NETWORK_PASSPHRASE: PASSPHRASE,
      NOIR_DEVICE_REGISTRY_ID: DEVICE_REGISTRY,
      NOIR_AGENT_REGISTRY_ID: AGENT_REGISTRY,
      NOIR_PAYMENT_ESCROW_ID: PAYMENT_ESCROW,
    },
    log: fakeLog(),
    gasOptions: { retryDelayMs: 0, wait: { timeoutMs: 1, maxAttempts: 1 } },
    // One chain read and no waiting: tests that exercise the poll override this.
    confirm: { timeoutMs: 0, pollMs: 0 },
    ...overrides,
  };
}

interface Row {
  id: string;
  kind: string;
  contract_id: string;
  method: string;
  source_public: string;
  status: string;
  gas_mode: string;
  velo_request_id: string | null;
  inner_hash: string | null;
  outer_hash: string | null;
  error_code: string | null;
  error: string | null;
  created_at: number;
  updated_at: number;
}

function onlyRow(db: Db): Row {
  const rows = db.prepare('SELECT * FROM chain_txs').all<Row>();
  expect(rows).toHaveLength(1);
  return rows[0] as Row;
}

function insertUncertain(db: Db, id: string, updatedAt: number): void {
  db.prepare(
    `INSERT INTO chain_txs
       (id, kind, contract_id, method, source_public, status, gas_mode,
        velo_request_id, inner_hash, created_at, updated_at)
     VALUES (?, 'authorize', ?, 'authorize', 'GSOURCE', 'submission_unknown', 'velo', ?, ?, ?, ?)`,
  ).run(id, PAYMENT_ESCROW, `req_${id}`, `inner_${id}`, updatedAt, updatedAt);
}

/** Same, for a direct row: no Velo identity, so only the chain can settle it. */
function insertUncertainDirect(db: Db, id: string, updatedAt: number): void {
  db.prepare(
    `INSERT INTO chain_txs
       (id, kind, contract_id, method, source_public, status, gas_mode,
        velo_request_id, inner_hash, created_at, updated_at)
     VALUES (?, 'authorize', ?, 'authorize', 'GSOURCE', 'submission_unknown', 'direct', NULL, ?, ?, ?)`,
  ).run(id, PAYMENT_ESCROW, `inner_${id}`, updatedAt, updatedAt);
}

/** Wraps a Db so the `nth` `UPDATE chain_txs` throws, standing in for a SQLite write fault. */
function failNthChainTxUpdate(db: Db, nth: number): Db {
  let updates = 0;
  return {
    ...db,
    prepare(sql: string) {
      const statement = db.prepare(sql);
      if (!sql.trimStart().startsWith('UPDATE chain_txs')) return statement;
      return {
        ...statement,
        run: (...params: SqlValue[]) => {
          updates += 1;
          if (updates === nth) throw new Error('disk I/O error');
          return statement.run(...params);
        },
      };
    },
  };
}

describe('runChainTx', () => {
  it('records a sponsored success as gas_mode=velo with both hashes', async () => {
    const { gas } = fakeGas();
    const { noir, submit: noirSubmit } = fakeNoir(Keypair.random());
    const deps = makeDeps({ gas, noir });

    const out = await runChainTx(deps, Keypair.random(), AUTH);

    const row = onlyRow(deps.db);
    expect(row.status).toBe('succeeded');
    expect(row.gas_mode).toBe('velo');
    expect(row.inner_hash).toBe(RESERVATION.transactionHash);
    expect(row.outer_hash).toBe('outer_hash_1');
    expect(row.velo_request_id).toBe('req_1');
    expect(noirSubmit).not.toHaveBeenCalled();
    expect(out).toEqual({
      chainTxId: row.id,
      status: 'succeeded',
      gasMode: 'velo',
      innerHash: 'inner_hash_1',
      outerHash: 'outer_hash_1',
      errorCode: null,
      error: null,
    });
  });

  it('falls back to the direct path with the same XDR when sponsorship is a validation failure', async () => {
    const { gas, sponsor, submit } = fakeGas();
    const validationError = new VeloValidationError('envelope has two signatures');
    sponsor.mockRejectedValue(validationError);
    const { noir, submit: noirSubmit } = fakeNoir(Keypair.random());
    const log = fakeLog();
    const deps = makeDeps({ gas, noir, log, config: { ...makeDeps().config, GAS_FALLBACK_DIRECT: true } });

    await runChainTx(deps, Keypair.random(), AUTH);

    const row = onlyRow(deps.db);
    expect(row.status).toBe('succeeded');
    expect(row.gas_mode).toBe('direct');
    expect(row.outer_hash).toBeNull();
    expect(sponsor).toHaveBeenCalledTimes(1);
    expect(submit).not.toHaveBeenCalled();
    expect(noirSubmit).toHaveBeenCalledTimes(1);
    expect(noirSubmit.mock.calls[0]?.[0]).toBe(sponsor.mock.calls[0]?.[0]);
    expect(log.error).toHaveBeenCalledTimes(1);
  });

  it('records VELO_AUTH and does not dispatch when auth fails without fallback', async () => {
    const { gas, sponsor, submit } = fakeGas();
    sponsor.mockRejectedValue(new VeloAuthError('bad api key'));
    const { noir, submit: noirSubmit } = fakeNoir(Keypair.random());
    const deps = makeDeps({ gas, noir });

    const out = await runChainTx(deps, Keypair.random(), AUTH);

    const row = onlyRow(deps.db);
    expect(row.status).toBe('failed');
    expect(row.gas_mode).toBe('velo');
    expect(row.error_code).toBe('VELO_AUTH');
    expect(out.errorCode).toBe('VELO_AUTH');
    expect(sponsor).toHaveBeenCalledTimes(1);
    expect(submit).not.toHaveBeenCalled();
    expect(noirSubmit).not.toHaveBeenCalled();
    // The locally computed hash is persisted before any hand-off, so a pre-hand-off failure keeps it.
    const handed = TransactionBuilder.fromXDR(sponsor.mock.calls[0]?.[0] as string, PASSPHRASE)
      .hash()
      .toString('hex');
    expect(row.inner_hash).toBe(handed);
    expect(row.inner_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('records GAS_UNAVAILABLE when every sponsor attempt is a provider error', async () => {
    const { gas, sponsor } = fakeGas();
    sponsor.mockRejectedValue(new VeloProviderError('upstream 502', { status: 502 }));
    const deps = makeDeps({
      gas,
      gasOptions: { sponsorAttempts: 2, retryDelayMs: 0, wait: { timeoutMs: 1, maxAttempts: 1 } },
    });

    await runChainTx(deps, Keypair.random(), AUTH);

    const row = onlyRow(deps.db);
    expect(row.status).toBe('failed');
    expect(row.error_code).toBe('GAS_UNAVAILABLE');
    expect(sponsor).toHaveBeenCalledTimes(2);
  });

  it('records submission_unknown when Velo is non-terminal and the chain has not seen it yet', async () => {
    const { gas, submit, getStatus, waitForResult } = fakeGas();
    submit.mockRejectedValueOnce(new VeloProviderError('lost response', { status: 504 }));
    getStatus.mockResolvedValue(result('submitted'));
    waitForResult.mockResolvedValue(result('submitted'));
    const { noir, submit: noirSubmit, getTransaction } = fakeNoir(Keypair.random());
    getTransaction.mockResolvedValue({ status: 'NOT_FOUND' });
    const deps = makeDeps({ gas, noir, config: { ...makeDeps().config, GAS_FALLBACK_DIRECT: true } });

    const out = await runChainTx(deps, Keypair.random(), AUTH);

    const row = onlyRow(deps.db);
    expect(row.status).toBe('submission_unknown');
    expect(row.velo_request_id).toBe('req_1');
    expect(out.status).toBe('submission_unknown');
    expect(getTransaction).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(noirSubmit).not.toHaveBeenCalled();
  });

  it('records GAS_HANDOFF_UNKNOWN when the status cannot be read back, and never falls back', async () => {
    const { gas, submit, getStatus } = fakeGas();
    submit.mockRejectedValueOnce(new VeloProviderError('lost response', { status: 504 }));
    getStatus.mockRejectedValue(new Error('status endpoint 502'));
    const { noir, submit: noirSubmit } = fakeNoir(Keypair.random());
    const deps = makeDeps({ gas, noir, config: { ...makeDeps().config, GAS_FALLBACK_DIRECT: true } });

    await runChainTx(deps, Keypair.random(), AUTH);

    const row = onlyRow(deps.db);
    expect(row.status).toBe('submission_unknown');
    expect(row.error_code).toBe('GAS_HANDOFF_UNKNOWN');
    expect(row.velo_request_id).toBe('req_1');
    // The reservation's transactionHash is authoritative once submit() was attempted.
    expect(row.inner_hash).toBe(RESERVATION.transactionHash);
    expect(noirSubmit).not.toHaveBeenCalled();
  });

  it('persists the Velo identity while the row is still pending, before submit', async () => {
    const db = openDb(':memory:');
    const { gas, submit } = fakeGas();
    let seen: Row | undefined;
    submit.mockImplementation(async () => {
      seen = db.prepare('SELECT * FROM chain_txs').get<Row>();
      return result('succeeded');
    });
    const deps = makeDeps({ db, gas });

    await runChainTx(deps, Keypair.random(), AUTH);

    expect(seen?.status).toBe('pending');
    expect(seen?.velo_request_id).toBe('req_1');
    expect(seen?.inner_hash).toBe('inner_hash_1');
  });

  it('confirms a lagging Velo status against the chain and keeps the Velo identity', async () => {
    const lagging: GasSubmitResult = { ...result('submitted'), outerTransactionHash: 'outer_hash_1' };
    const { gas, submit, waitForResult } = fakeGas();
    submit.mockResolvedValue(lagging);
    waitForResult.mockResolvedValue(lagging);
    const { noir, submit: noirSubmit, getTransaction } = fakeNoir(Keypair.random());
    getTransaction.mockResolvedValue({ status: 'SUCCESS' });
    const deps = makeDeps({ gas, noir });

    const out = await runChainTx(deps, Keypair.random(), AUTH);

    const row = onlyRow(deps.db);
    expect(row.status).toBe('succeeded');
    expect(row.gas_mode).toBe('velo');
    expect(row.velo_request_id).toBe('req_1');
    expect(row.outer_hash).toBe('outer_hash_1');
    expect(row.error_code).toBeNull();
    expect(row.error).toBeNull();
    expect(getTransaction).toHaveBeenCalledWith('inner_hash_1');
    expect(out.status).toBe('succeeded');
    expect(noirSubmit).not.toHaveBeenCalled();
  });

  it('records CHAIN_FAILED when the chain says the lagging transaction failed', async () => {
    const { gas, submit, waitForResult } = fakeGas();
    submit.mockResolvedValue(result('submitted'));
    waitForResult.mockResolvedValue(result('submitted'));
    const { noir, getTransaction } = fakeNoir(Keypair.random());
    getTransaction.mockResolvedValue({ status: 'FAILED' });
    const deps = makeDeps({ gas, noir });

    const out = await runChainTx(deps, Keypair.random(), AUTH);

    const row = onlyRow(deps.db);
    expect(row.status).toBe('failed');
    expect(row.error_code).toBe('CHAIN_FAILED');
    expect(row.error).toBe('Transaction inner_hash_1 failed on chain');
    expect(out.status).toBe('failed');
  });

  it('settles a GasHandoffError row from the chain', async () => {
    const { gas, submit, getStatus } = fakeGas();
    submit.mockRejectedValueOnce(new VeloProviderError('lost response', { status: 504 }));
    getStatus.mockRejectedValueOnce(new Error('status endpoint 502'));
    const { noir, submit: noirSubmit, getTransaction } = fakeNoir(Keypair.random());
    getTransaction.mockResolvedValue({ status: 'SUCCESS' });
    const deps = makeDeps({ gas, noir });

    const out = await runChainTx(deps, Keypair.random(), AUTH);

    const row = onlyRow(deps.db);
    expect(row.status).toBe('succeeded');
    expect(row.gas_mode).toBe('velo');
    expect(row.velo_request_id).toBe('req_1');
    expect(row.error_code).toBeNull();
    expect(out.status).toBe('succeeded');
    expect(noirSubmit).not.toHaveBeenCalled();
  });

  it('logs a failing chain read and leaves the row submission_unknown', async () => {
    const { gas, submit, waitForResult } = fakeGas();
    submit.mockResolvedValue(result('submitted'));
    waitForResult.mockResolvedValue(result('submitted'));
    const { noir, getTransaction } = fakeNoir(Keypair.random());
    getTransaction.mockRejectedValue(new Error('rpc down'));
    const log = fakeLog();
    const deps = makeDeps({ gas, noir, log });

    const out = await runChainTx(deps, Keypair.random(), AUTH);

    expect(log.warn).toHaveBeenCalled();
    const row = onlyRow(deps.db);
    expect(row.status).toBe('submission_unknown');
    expect(out.status).toBe('submission_unknown');
  });

  it('keeps polling the chain until the hash is indexed', async () => {
    const { gas, submit, waitForResult } = fakeGas();
    submit.mockResolvedValue(result('submitted'));
    waitForResult.mockResolvedValue(result('submitted'));
    const { noir, getTransaction } = fakeNoir(Keypair.random());
    getTransaction
      .mockResolvedValueOnce({ status: 'NOT_FOUND' })
      .mockResolvedValueOnce({ status: 'SUCCESS' });
    const deps = makeDeps({ gas, noir, confirm: { timeoutMs: 1000, pollMs: 0 } });

    const out = await runChainTx(deps, Keypair.random(), AUTH);

    expect(getTransaction).toHaveBeenCalledTimes(2);
    expect(out.status).toBe('succeeded');
  });

  it('does not overwrite a row another writer settled during the chain confirmation', async () => {
    const db = openDb(':memory:');
    const { gas, submit, waitForResult } = fakeGas();
    submit.mockResolvedValue(result('submitted'));
    waitForResult.mockResolvedValue(result('submitted'));
    const { noir, getTransaction } = fakeNoir(Keypair.random());
    getTransaction.mockImplementation(async () => {
      // Simulate the reconciler settling the row between our poll and our guarded UPDATE.
      db.prepare(
        `UPDATE chain_txs
            SET status = 'failed', error_code = 'GAS_FAILED', error = 'settled elsewhere'
          WHERE status = 'submission_unknown'`,
      ).run();
      return { status: 'SUCCESS' };
    });
    const deps = makeDeps({ db, gas, noir, confirm: { timeoutMs: 0, pollMs: 0 } });

    const out = await runChainTx(deps, Keypair.random(), AUTH);

    const row = onlyRow(db);
    expect(getTransaction).toHaveBeenCalledTimes(1);
    expect(row.status).toBe('failed');
    expect(row.error_code).toBe('GAS_FAILED');
    expect(out.status).toBe('failed');
    expect(out.errorCode).toBe('GAS_FAILED');
  });

  it('passes the short Velo wait when none is configured', async () => {
    const { gas, submit, waitForResult } = fakeGas();
    submit.mockResolvedValue(result('submitted'));
    waitForResult.mockResolvedValue(result('submitted'));
    const deps = makeDeps({ gas, gasOptions: { retryDelayMs: 0 } });

    await runChainTx(deps, Keypair.random(), AUTH);

    expect(waitForResult).toHaveBeenCalledWith(
      { requestId: 'req_1', transactionHash: 'inner_hash_1' },
      { timeoutMs: 10_000, maxAttempts: 5 },
    );
  });

  it('propagates a persistence fault on the direct success path instead of relabelling the send', async () => {
    const { noir } = fakeNoir(Keypair.random());
    const inner = openDb(':memory:');
    // 1 = inner hash, 2 = the pre-hand-off direct marker, 3 = the direct send result.
    const deps = makeDeps({
      noir,
      db: failNthChainTxUpdate(inner, 3),
      gas: null,
      config: { ...makeDeps().config, GAS_MODE: 'direct' },
    });

    await expect(runChainTx(deps, Keypair.random(), AUTH)).rejects.toThrow('disk I/O error');

    const row = onlyRow(inner);
    expect(row.status).toBe('pending');
    // The marker written before the send names the path a boot repair has to classify.
    expect(row.gas_mode).toBe('direct');
    expect(row.error_code).toBeNull();
    expect(row.inner_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it.each([
    ['GAS_MODE=direct', { GAS_MODE: 'direct' }],
    ['the sponsorship fallback', { GAS_FALLBACK_DIRECT: true }],
  ] as const)('writes gas_mode=direct while still pending before the direct send (%s)', async (label, config) => {
    const db = openDb(':memory:');
    const { gas, sponsor } = fakeGas();
    if (label !== 'GAS_MODE=direct') sponsor.mockRejectedValue(new VeloValidationError('envelope has two signatures'));
    const { noir, submit: noirSubmit } = fakeNoir(Keypair.random());
    let seen: Row | undefined;
    noirSubmit.mockImplementation(async () => {
      seen = db.prepare('SELECT * FROM chain_txs').get<Row>();
      return 'direct_inner_hash';
    });
    const deps = makeDeps({
      db,
      gas: label === 'GAS_MODE=direct' ? null : gas,
      noir,
      config: { ...makeDeps().config, ...config },
    });

    await runChainTx(deps, Keypair.random(), AUTH);

    expect(seen?.status).toBe('pending');
    expect(seen?.gas_mode).toBe('direct');
    expect(seen?.inner_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(seen?.velo_request_id).toBeNull();
    expect(onlyRow(db).status).toBe('succeeded');
  });

  it('marks a contract rejection at prepare() as failed and rethrows it', async () => {
    const { gas, sponsor, submit } = fakeGas();
    const { noir, prepare } = fakeNoir(Keypair.random());
    const contractError = new NoirContractError('paymentEscrow', 3, 'AgentNotAuthorized', 'authorize');
    prepare.mockRejectedValue(contractError);
    const deps = makeDeps({ gas, noir });

    await expect(runChainTx(deps, Keypair.random(), AUTH)).rejects.toBe(contractError);

    const row = onlyRow(deps.db);
    expect(row.status).toBe('failed');
    expect(row.error_code).toBe('CONTRACT_AgentNotAuthorized');
    expect(sponsor).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });

  it('takes the direct path with no Velo client under GAS_MODE=direct', async () => {
    const { noir, submit: noirSubmit } = fakeNoir(Keypair.random());
    const deps = makeDeps({
      noir,
      gas: null,
      config: { ...makeDeps().config, GAS_MODE: 'direct' },
    });

    const out = await runChainTx(deps, Keypair.random(), AUTH);

    const row = onlyRow(deps.db);
    expect(row.status).toBe('succeeded');
    expect(row.gas_mode).toBe('direct');
    expect(row.inner_hash).toBe('direct_inner_hash');
    expect(out.innerHash).toBe('direct_inner_hash');
    expect(noirSubmit).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['paymentEscrow.authorize not confirmed after 60s (abc)'],
    ['socket hang up'],
  ])('records DIRECT_UNKNOWN for an unconfirmed direct submit (%s)', async (message) => {
    const { noir, submit: noirSubmit } = fakeNoir(Keypair.random());
    noirSubmit.mockRejectedValue(new Error(message));
    const deps = makeDeps({
      noir,
      gas: null,
      config: { ...makeDeps().config, GAS_MODE: 'direct' },
    });

    const out = await runChainTx(deps, Keypair.random(), AUTH);

    const row = onlyRow(deps.db);
    const sent = noirSubmit.mock.calls[0]?.[0] as string;
    const localHash = TransactionBuilder.fromXDR(sent, PASSPHRASE).hash().toString('hex');
    expect(row.status).toBe('submission_unknown');
    expect(row.gas_mode).toBe('direct');
    expect(row.error_code).toBe('DIRECT_UNKNOWN');
    expect(row.error).toBe(message);
    expect(row.inner_hash).toBe(localHash);
    expect(row.inner_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.outer_hash).toBeNull();
    expect(row.velo_request_id).toBeNull();
    expect(out.status).toBe('submission_unknown');
    expect(out.errorCode).toBe('DIRECT_UNKNOWN');
  });

  it.each([
    ['paymentEscrow.authorize rejected by the network: txBadSeq'],
    ['paymentEscrow.authorize failed on-chain (abc)'],
  ])('records DIRECT_FAILED when the network definitively refused (%s)', async (message) => {
    const { noir, submit: noirSubmit } = fakeNoir(Keypair.random());
    noirSubmit.mockRejectedValue(new Error(message));
    const deps = makeDeps({
      noir,
      gas: null,
      config: { ...makeDeps().config, GAS_MODE: 'direct' },
    });

    const out = await runChainTx(deps, Keypair.random(), AUTH);

    const row = onlyRow(deps.db);
    expect(row.status).toBe('failed');
    expect(row.gas_mode).toBe('direct');
    expect(row.error_code).toBe('DIRECT_FAILED');
    expect(row.error).toBe(message);
    expect(out.error).toBe(message);
  });

  it('records DIRECT_UNKNOWN when the direct fallback after a sponsor failure is unconfirmed', async () => {
    const { gas, sponsor, submit } = fakeGas();
    sponsor.mockRejectedValue(new VeloValidationError('envelope has two signatures'));
    const { noir, submit: noirSubmit } = fakeNoir(Keypair.random());
    noirSubmit.mockRejectedValue(new Error('socket hang up'));
    const deps = makeDeps({ gas, noir, config: { ...makeDeps().config, GAS_FALLBACK_DIRECT: true } });

    const out = await runChainTx(deps, Keypair.random(), AUTH);

    const row = onlyRow(deps.db);
    expect(row.status).toBe('submission_unknown');
    expect(row.gas_mode).toBe('direct');
    expect(row.error_code).toBe('DIRECT_UNKNOWN');
    expect(submit).not.toHaveBeenCalled();
    expect(noirSubmit).toHaveBeenCalledTimes(1);
    expect(out.errorCode).toBe('DIRECT_UNKNOWN');
  });

  it('propagates a persistence fault on the success path instead of rewriting the row as failed', async () => {
    const { gas } = fakeGas();
    const { noir } = fakeNoir(Keypair.random());
    const inner = openDb(':memory:');
    // 1 = inner hash, 2 = the Velo identity before submit, 3 = the succeeded result.
    const deps = makeDeps({ gas, noir, db: failNthChainTxUpdate(inner, 3) });

    await expect(runChainTx(deps, Keypair.random(), AUTH)).rejects.toThrow('disk I/O error');

    const row = onlyRow(inner);
    expect(row.status).toBe('pending');
    expect(row.error_code).toBeNull();
    // The Velo identity persisted before submit keeps its `transactionHash`.
    expect(row.inner_hash).toBe(RESERVATION.transactionHash);
  });

  it.each([
    ['failed', 'GAS_FAILED'],
    ['cancelled', 'GAS_CANCELLED'],
  ] as const)(
    'keeps a Velo %s row submission_unknown with %s when the chain has not indexed it',
    async (status, code) => {
      const { gas, submit } = fakeGas();
      submit.mockResolvedValue(result(status));
      const { noir, getTransaction } = fakeNoir(Keypair.random());
      getTransaction.mockResolvedValue({ status: 'NOT_FOUND' });
      const deps = makeDeps({ gas, noir });

      const out = await runChainTx(deps, Keypair.random(), AUTH);

      const row = onlyRow(deps.db);
      expect(row.status).toBe('submission_unknown');
      expect(row.error_code).toBe(code);
      expect(row.error).toBe(`Gas Station status ${status} (request req_1)`);
      expect(row.velo_request_id).toBe('req_1');
      expect(row.inner_hash).toBe('inner_hash_1');
      expect(getTransaction).toHaveBeenCalledTimes(1);
      expect(getTransaction).toHaveBeenCalledWith('inner_hash_1');
      expect(out.status).toBe('submission_unknown');
      expect(out.errorCode).toBe(code);
    },
  );

  it('accepts a Velo failure as succeeded when the chain applied the transaction', async () => {
    const { gas, submit } = fakeGas();
    submit.mockResolvedValue(result('failed'));
    const { noir, getTransaction } = fakeNoir(Keypair.random());
    getTransaction.mockResolvedValue({ status: 'SUCCESS' });
    const deps = makeDeps({ gas, noir });

    const out = await runChainTx(deps, Keypair.random(), AUTH);

    const row = onlyRow(deps.db);
    expect(getTransaction).toHaveBeenCalledWith('inner_hash_1');
    expect(row.status).toBe('succeeded');
    expect(row.gas_mode).toBe('velo');
    expect(row.error_code).toBeNull();
    expect(row.error).toBeNull();
    // The Velo identity is kept.
    expect(row.velo_request_id).toBe('req_1');
    expect(row.inner_hash).toBe('inner_hash_1');
    expect(out.status).toBe('succeeded');
  });

  it('records CHAIN_FAILED when a cancelled Velo row is on chain as failed', async () => {
    const { gas, submit } = fakeGas();
    submit.mockResolvedValue(result('cancelled'));
    const { noir, getTransaction } = fakeNoir(Keypair.random());
    getTransaction.mockResolvedValue({ status: 'FAILED' });
    const deps = makeDeps({ gas, noir });

    const out = await runChainTx(deps, Keypair.random(), AUTH);

    const row = onlyRow(deps.db);
    expect(row.status).toBe('failed');
    expect(row.error_code).toBe('CHAIN_FAILED');
    expect(row.error).toBe('Transaction inner_hash_1 failed on chain');
    expect(out.errorCode).toBe('CHAIN_FAILED');
  });

  it('keeps GAS_FAILED and submission_unknown when the chain read after a Velo failure throws', async () => {
    const { gas, submit } = fakeGas();
    submit.mockResolvedValue(result('failed'));
    const { noir, getTransaction } = fakeNoir(Keypair.random());
    getTransaction.mockRejectedValue(new Error('rpc down'));
    const log = fakeLog();
    const deps = makeDeps({ gas, noir, log });

    const out = await runChainTx(deps, Keypair.random(), AUTH);

    const row = onlyRow(deps.db);
    expect(row.status).toBe('submission_unknown');
    expect(row.error_code).toBe('GAS_FAILED');
    expect(row.velo_request_id).toBe('req_1');
    expect(out.status).toBe('submission_unknown');
    expect(out.errorCode).toBe('GAS_FAILED');
    expect(log.warn).toHaveBeenCalledWith(
      { chainTxId: row.id, cause: new Error('rpc down') },
      'chain confirmation read failed',
    );
  });

  it('rejects defundEscrow before writing any row', async () => {
    const deps = makeDeps();
    const op: NoirOperation = { kind: 'defundEscrow', deviceHash: DEVICE_HASH, token: PAYMENT_ESCROW, amount: 1n };

    await expect(runChainTx(deps, Keypair.random(), op)).rejects.toThrow('defundEscrow is not used by TAPat');
    expect(deps.db.prepare('SELECT COUNT(*) AS n FROM chain_txs').get<{ n: number }>()?.n).toBe(0);
  });

  it('maps escrow operations onto the shared kind and contract', async () => {
    const deps = makeDeps();
    await runChainTx(deps, Keypair.random(), {
      kind: 'fundEscrow',
      deviceHash: DEVICE_HASH,
      token: PAYMENT_ESCROW,
      amount: 10_000_000n,
    });
    await runChainTx(deps, Keypair.random(), {
      kind: 'sweepOnRevoke',
      deviceHash: DEVICE_HASH,
      token: PAYMENT_ESCROW,
      agent: 'GAGENT',
    });

    const rows = deps.db.prepare('SELECT * FROM chain_txs ORDER BY rowid').all<Row>();
    expect(rows.map((row) => [row.kind, row.method, row.contract_id])).toEqual([
      ['fund', 'fund_escrow', PAYMENT_ESCROW],
      ['sweep', 'sweep_on_revoke', PAYMENT_ESCROW],
    ]);
  });
});

describe('reconcileOnce', () => {
  const NOW = 1_000_000_000;

  it('settles a Velo row from getStatus and reads only rows inside the 6-minute window', async () => {
    const db = openDb(':memory:');
    insertUncertain(db, 'recent', NOW - 359_000);
    insertUncertain(db, 'stale', NOW - 361_000);
    const { gas, getStatus } = fakeGas();
    getStatus.mockResolvedValue(result('succeeded'));
    const { noir, getTransaction } = fakeNoir(Keypair.random());
    const log = fakeLog();

    const settled = await reconcileOnce({ db, noir, gas, log, now: () => NOW });

    expect(settled).toBe(1);
    expect(getStatus).toHaveBeenCalledTimes(1);
    expect(getStatus.mock.calls[0]?.[0]).toEqual({ requestId: 'req_recent', transactionHash: 'inner_recent' });
    const recent = db.prepare('SELECT * FROM chain_txs WHERE id = ?').get<Row>('recent');
    expect(recent?.status).toBe('succeeded');
    expect(recent?.outer_hash).toBe('outer_hash_1');
    expect(getTransaction).not.toHaveBeenCalled();
    expect(db.prepare('SELECT * FROM chain_txs WHERE id = ?').get<Row>('stale')?.status).toBe('submission_unknown');
  });

  it('settles a Velo failure as succeeded when the chain applied the transaction', async () => {
    const db = openDb(':memory:');
    insertUncertain(db, 'velo_failed', NOW - 1_000);
    const { gas, getStatus } = fakeGas();
    getStatus.mockResolvedValue(result('failed'));
    const { noir, getTransaction } = fakeNoir(Keypair.random());
    getTransaction.mockResolvedValue({ status: 'SUCCESS' });

    const settled = await reconcileOnce({ db, noir, gas, log: fakeLog(), now: () => NOW });

    expect(settled).toBe(1);
    expect(getTransaction).toHaveBeenCalledWith('inner_velo_failed');
    const row = db.prepare('SELECT * FROM chain_txs WHERE id = ?').get<Row>('velo_failed');
    expect(row?.status).toBe('succeeded');
    expect(row?.error_code).toBeNull();
    expect(row?.velo_request_id).toBe('req_velo_failed');
  });

  it('writes nothing when the chain has not seen a cancelled Velo row', async () => {
    const db = openDb(':memory:');
    insertUncertain(db, 'velo_cancelled', NOW - 1_000);
    const { gas, getStatus } = fakeGas();
    getStatus.mockResolvedValue(result('cancelled'));
    const { noir, getTransaction } = fakeNoir(Keypair.random());
    getTransaction.mockResolvedValue({ status: 'NOT_FOUND' });

    const settled = await reconcileOnce({ db, noir, gas, log: fakeLog(), now: () => NOW });

    expect(settled).toBe(0);
    expect(getTransaction).toHaveBeenCalledTimes(1);
    expect(getTransaction).toHaveBeenCalledWith('inner_velo_cancelled');
    const row = db.prepare('SELECT * FROM chain_txs WHERE id = ?').get<Row>('velo_cancelled');
    expect(row?.status).toBe('submission_unknown');
    expect(row?.updated_at).toBe(NOW - 1_000);
  });

  it('writes nothing and warns when the chain read after a Velo failure throws', async () => {
    const db = openDb(':memory:');
    insertUncertain(db, 'velo_unreadable', NOW - 1_000);
    const { gas, getStatus } = fakeGas();
    getStatus.mockResolvedValue(result('failed'));
    const { noir, getTransaction } = fakeNoir(Keypair.random());
    getTransaction.mockRejectedValue(new Error('rpc down'));
    const log = fakeLog();

    const settled = await reconcileOnce({ db, noir, gas, log, now: () => NOW });

    expect(settled).toBe(0);
    expect(getTransaction).toHaveBeenCalledTimes(1);
    expect(log.warn).toHaveBeenCalledTimes(1);
    const row = db.prepare('SELECT * FROM chain_txs WHERE id = ?').get<Row>('velo_unreadable');
    expect(row?.status).toBe('submission_unknown');
    expect(row?.updated_at).toBe(NOW - 1_000);
  });

  it('settles a Velo row whose status lagged the chain', async () => {
    const db = openDb(':memory:');
    insertUncertain(db, 'lagging', NOW - 1_000);
    const { gas, getStatus } = fakeGas();
    getStatus.mockResolvedValue(result('submitted'));
    const { noir, getTransaction } = fakeNoir(Keypair.random());
    getTransaction.mockResolvedValue({ status: 'SUCCESS' });

    const settled = await reconcileOnce({ db, noir, gas, log: fakeLog(), now: () => NOW });

    expect(settled).toBe(1);
    expect(getTransaction).toHaveBeenCalledWith('inner_lagging');
    const row = db.prepare('SELECT * FROM chain_txs WHERE id = ?').get<Row>('lagging');
    expect(row?.status).toBe('succeeded');
    expect(row?.error_code).toBeNull();
    expect(row?.velo_request_id).toBe('req_lagging');
  });

  it('settles a Velo row from the chain when getStatus throws', async () => {
    const db = openDb(':memory:');
    insertUncertain(db, 'broken', NOW - 1_000);
    const { gas, getStatus, sponsor, submit } = fakeGas();
    getStatus.mockRejectedValue(new Error('status endpoint 502'));
    const { noir, getTransaction } = fakeNoir(Keypair.random());
    getTransaction.mockResolvedValue({ status: 'SUCCESS' });
    const log = fakeLog();

    const settled = await reconcileOnce({ db, noir, gas, log, now: () => NOW });

    expect(settled).toBe(1);
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(db.prepare('SELECT * FROM chain_txs WHERE id = ?').get<Row>('broken')?.status).toBe('succeeded');
    expect(sponsor).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });

  it('keeps a row unknown when the chain has not indexed it', async () => {
    const db = openDb(':memory:');
    insertUncertain(db, 'pending_row', NOW - 1_000);
    const { gas, getStatus } = fakeGas();
    getStatus.mockResolvedValue(result('submitted'));
    const { noir, getTransaction } = fakeNoir(Keypair.random());
    getTransaction.mockResolvedValue({ status: 'NOT_FOUND' });

    const settled = await reconcileOnce({ db, noir, gas, log: fakeLog(), now: () => NOW });

    expect(settled).toBe(0);
    const row = db.prepare('SELECT * FROM chain_txs WHERE id = ?').get<Row>('pending_row');
    expect(row?.status).toBe('submission_unknown');
    expect(row?.updated_at).toBe(NOW - 1_000);
  });

  it('settles a direct row from the chain even without a Velo client', async () => {
    const db = openDb(':memory:');
    insertUncertainDirect(db, 'direct_row', NOW - 1_000);
    const { noir, getTransaction } = fakeNoir(Keypair.random());
    getTransaction.mockResolvedValue({ status: 'SUCCESS' });

    const settled = await reconcileOnce({ db, noir, gas: null, log: fakeLog(), now: () => NOW });

    expect(settled).toBe(1);
    const row = db.prepare('SELECT * FROM chain_txs WHERE id = ?').get<Row>('direct_row');
    expect(row?.status).toBe('succeeded');
    expect(row?.gas_mode).toBe('direct');
  });

  it('records CHAIN_FAILED when the chain says the transaction failed', async () => {
    const db = openDb(':memory:');
    insertUncertainDirect(db, 'failed_row', NOW - 1_000);
    const { noir, getTransaction } = fakeNoir(Keypair.random());
    getTransaction.mockResolvedValue({ status: 'FAILED' });

    const settled = await reconcileOnce({ db, noir, gas: null, log: fakeLog(), now: () => NOW });

    expect(settled).toBe(1);
    const row = db.prepare('SELECT * FROM chain_txs WHERE id = ?').get<Row>('failed_row');
    expect(row?.status).toBe('failed');
    expect(row?.error_code).toBe('CHAIN_FAILED');
  });

  it('logs a failed status read and keeps processing the other rows', async () => {
    const db = openDb(':memory:');
    insertUncertain(db, 'broken', NOW - 1_000);
    insertUncertain(db, 'good', NOW - 2_000);
    const { gas, getStatus } = fakeGas();
    getStatus.mockImplementation((identity: { transactionHash: string }) =>
      identity.transactionHash === 'inner_broken'
        ? Promise.reject(new Error('status endpoint 502'))
        : Promise.resolve(result('succeeded')),
    );
    const { noir } = fakeNoir(Keypair.random());
    const log = fakeLog();

    const settled = await reconcileOnce({ db, noir, gas, log, now: () => NOW });

    expect(settled).toBe(1);
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(db.prepare('SELECT * FROM chain_txs WHERE id = ?').get<Row>('broken')?.status).toBe(
      'submission_unknown',
    );
    expect(db.prepare('SELECT * FROM chain_txs WHERE id = ?').get<Row>('good')?.status).toBe('succeeded');
  });

  it('does not count a row another writer settled between SELECT and UPDATE', async () => {
    const db = openDb(':memory:');
    insertUncertain(db, 'raced', NOW - 1_000);
    const { gas, getStatus } = fakeGas();
    getStatus.mockImplementation(async () => {
      // Simulate a concurrent writer settling the row before our guarded UPDATE runs.
      db.prepare("UPDATE chain_txs SET status = 'failed', error_code = 'GAS_FAILED' WHERE id = ?").run('raced');
      return result('succeeded');
    });
    const { noir } = fakeNoir(Keypair.random());

    const settled = await reconcileOnce({ db, noir, gas, log: fakeLog(), now: () => NOW });

    expect(settled).toBe(0);
    const row = db.prepare('SELECT * FROM chain_txs WHERE id = ?').get<Row>('raced');
    expect(row?.status).toBe('failed');
    expect(row?.error_code).toBe('GAS_FAILED');
  });
});

describe('recoverInterruptedTxs', () => {
  const NOW = 2_000_000_000;

  function insertPending(
    db: Db,
    id: string,
    fields: { gasMode?: 'velo' | 'direct'; veloRequestId?: string | null; innerHash: string | null },
  ): void {
    db.prepare(
      `INSERT INTO chain_txs
         (id, kind, contract_id, method, source_public, status, gas_mode,
          velo_request_id, inner_hash, created_at, updated_at)
       VALUES (?, 'authorize', ?, 'authorize', 'GSOURCE', 'pending', ?, ?, ?, ?, ?)`,
    ).run(
      id,
      PAYMENT_ESCROW,
      fields.gasMode ?? 'velo',
      fields.veloRequestId ?? null,
      fields.innerHash,
      NOW - 5_000,
      NOW - 5_000,
    );
  }

  it('fails only the rows with no hand-off evidence and marks the rest as unknown', () => {
    const db = openDb(':memory:');
    // Nothing was handed off: no inner hash, or still `velo` with no reservation. A `direct` row with no hash died
    // before the hash was computed, which is also before any send.
    insertPending(db, 'no_hash', { innerHash: null });
    insertPending(db, 'direct_no_hash', { gasMode: 'direct', innerHash: null });
    insertPending(db, 'after_prepare', { innerHash: 'inner_after_prepare' });
    // Handed off: the direct marker precedes the send and a reservation precedes `submit`.
    insertPending(db, 'direct_sending', { gasMode: 'direct', innerHash: 'inner_direct_sending' });
    insertPending(db, 'velo_reserved', {
      veloRequestId: 'req_velo_reserved',
      innerHash: 'inner_velo_reserved',
    });
    insertUncertain(db, 'already_unknown', NOW - 1_000);
    db.prepare(
      `INSERT INTO chain_txs
         (id, kind, contract_id, method, source_public, status, gas_mode, created_at, updated_at)
       VALUES ('done', 'authorize', ?, 'authorize', 'GSOURCE', 'succeeded', 'velo', ?, ?)`,
    ).run(PAYMENT_ESCROW, NOW - 1_000, NOW - 1_000);
    db.prepare(
      `INSERT INTO chain_txs
         (id, kind, contract_id, method, source_public, status, gas_mode, created_at, updated_at)
       VALUES ('gone', 'authorize', ?, 'authorize', 'GSOURCE', 'failed', 'velo', ?, ?)`,
    ).run(PAYMENT_ESCROW, NOW - 1_000, NOW - 1_000);
    const log = fakeLog();

    const out = recoverInterruptedTxs({ db, log, now: () => NOW });

    expect(out).toEqual({ failed: 3, unknown: 2 });
    for (const id of ['no_hash', 'direct_no_hash', 'after_prepare']) {
      const row = db.prepare('SELECT * FROM chain_txs WHERE id = ?').get<Row>(id);
      expect(row?.status).toBe('failed');
      expect(row?.error_code).toBe('PREPARE_INTERRUPTED');
    }
    for (const id of ['direct_sending', 'velo_reserved']) {
      const row = db.prepare('SELECT * FROM chain_txs WHERE id = ?').get<Row>(id);
      expect(row?.status).toBe('submission_unknown');
      expect(row?.error_code).toBe('HANDOFF_INTERRUPTED');
      expect(row?.updated_at).toBe(NOW);
    }
    expect(db.prepare('SELECT * FROM chain_txs WHERE id = ?').get<Row>('already_unknown')?.status).toBe(
      'submission_unknown',
    );
    expect(db.prepare('SELECT * FROM chain_txs WHERE id = ?').get<Row>('done')?.status).toBe('succeeded');
    expect(db.prepare('SELECT * FROM chain_txs WHERE id = ?').get<Row>('gone')?.status).toBe('failed');
    expect(log.warn).toHaveBeenCalledTimes(1);
  });

  it('writes nothing and logs nothing when no row is pending', () => {
    const db = openDb(':memory:');
    insertUncertain(db, 'already_unknown', NOW - 1_000);
    const log = fakeLog();

    expect(recoverInterruptedTxs({ db, log, now: () => NOW })).toEqual({ failed: 0, unknown: 0 });
    expect(log.warn).not.toHaveBeenCalled();
  });
});

describe('startReconciler', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('skips a tick while the previous reconcile is still running and stops on the returned fn', async () => {
    vi.useFakeTimers();
    const db = openDb(':memory:');
    insertUncertain(db, 'recent', Date.now() - 1_000);
    const { gas, getStatus, sponsor, submit } = fakeGas();
    getStatus.mockReturnValue(new Promise<GasSubmitResult>(() => {}));
    const { noir } = fakeNoir(Keypair.random());
    const deps = { db, noir, gas, log: fakeLog(), now: Date.now };

    const stop = startReconciler(deps, 5000);
    await vi.advanceTimersByTimeAsync(5000);
    expect(getStatus).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5000);
    expect(getStatus).toHaveBeenCalledTimes(1);

    stop();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(getStatus).toHaveBeenCalledTimes(1);
    expect(sponsor).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });
});
