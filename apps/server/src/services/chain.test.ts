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
  const noir = { prepare, submit } as unknown as NoirAgentClient;
  return { noir, prepare, submit };
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

  it('records submission_unknown for a non-terminal Velo status and never sends it direct', async () => {
    const { gas, submit, getStatus, waitForResult } = fakeGas();
    submit.mockRejectedValueOnce(new VeloProviderError('lost response', { status: 504 }));
    getStatus.mockResolvedValue(result('submitted'));
    waitForResult.mockResolvedValue(result('submitted'));
    const { noir, submit: noirSubmit } = fakeNoir(Keypair.random());
    const deps = makeDeps({ gas, noir, config: { ...makeDeps().config, GAS_FALLBACK_DIRECT: true } });

    const out = await runChainTx(deps, Keypair.random(), AUTH);

    const row = onlyRow(deps.db);
    expect(row.status).toBe('submission_unknown');
    expect(row.velo_request_id).toBe('req_1');
    expect(out.status).toBe('submission_unknown');
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
    const deps = makeDeps({ gas, noir, db: failNthChainTxUpdate(inner, 2) });

    await expect(runChainTx(deps, Keypair.random(), AUTH)).rejects.toThrow('disk I/O error');

    const row = onlyRow(inner);
    expect(row.status).toBe('pending');
    expect(row.error_code).toBeNull();
    expect(row.inner_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it.each([
    ['failed', 'GAS_FAILED'],
    ['cancelled', 'GAS_CANCELLED'],
  ] as const)('maps a Velo %s status to %s', async (status, code) => {
    const { gas, submit } = fakeGas();
    submit.mockResolvedValue(result(status));
    const deps = makeDeps({ gas });

    const out = await runChainTx(deps, Keypair.random(), AUTH);

    const row = onlyRow(deps.db);
    expect(row.status).toBe('failed');
    expect(row.error_code).toBe(code);
    expect(out.errorCode).toBe(code);
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

  it('settles a recent row and skips one past the 2-minute window', async () => {
    const db = openDb(':memory:');
    insertUncertain(db, 'recent', NOW - 1_000);
    insertUncertain(db, 'stale', NOW - 121_000);
    const { gas, getStatus } = fakeGas();
    getStatus.mockResolvedValue(result('succeeded'));
    const log = fakeLog();

    const settled = await reconcileOnce({ db, gas, log, now: () => NOW });

    expect(settled).toBe(1);
    expect(getStatus).toHaveBeenCalledTimes(1);
    expect(getStatus.mock.calls[0]?.[0]).toEqual({ requestId: 'req_recent', transactionHash: 'inner_recent' });
    const recent = db.prepare('SELECT * FROM chain_txs WHERE id = ?').get<Row>('recent');
    expect(recent?.status).toBe('succeeded');
    expect(recent?.outer_hash).toBe('outer_hash_1');
    expect(db.prepare('SELECT * FROM chain_txs WHERE id = ?').get<Row>('stale')?.status).toBe('submission_unknown');
  });

  it('writes nothing for a non-terminal status', async () => {
    const db = openDb(':memory:');
    insertUncertain(db, 'pending_row', NOW - 1_000);
    const { gas, getStatus } = fakeGas();
    getStatus.mockResolvedValue(result('submitted'));

    const settled = await reconcileOnce({ db, gas, log: fakeLog(), now: () => NOW });

    expect(settled).toBe(0);
    const row = db.prepare('SELECT * FROM chain_txs WHERE id = ?').get<Row>('pending_row');
    expect(row?.status).toBe('submission_unknown');
    expect(row?.updated_at).toBe(NOW - 1_000);
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
    const log = fakeLog();

    const settled = await reconcileOnce({ db, gas, log, now: () => NOW });

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

    const settled = await reconcileOnce({ db, gas, log: fakeLog(), now: () => NOW });

    expect(settled).toBe(0);
    const row = db.prepare('SELECT * FROM chain_txs WHERE id = ?').get<Row>('raced');
    expect(row?.status).toBe('failed');
    expect(row?.error_code).toBe('GAS_FAILED');
  });

  it('does nothing without a Velo client', async () => {
    const db = openDb(':memory:');
    insertUncertain(db, 'recent', NOW - 1_000);
    const { gas, getStatus } = fakeGas();

    const settled = await reconcileOnce({ db, gas: null, log: fakeLog(), now: () => NOW });

    expect(settled).toBe(0);
    expect(getStatus).not.toHaveBeenCalled();
    expect(gas.sponsor).not.toHaveBeenCalled();
    expect(gas.submit).not.toHaveBeenCalled();
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
    const deps = { db, gas, log: fakeLog(), now: Date.now };

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
