/**
 * SPK (docs/build-schedule.md): throwaway card -> register -> register_agent -> fund_escrow(1 XLM) -> authorize(),
 * each call sent through the Velo Gas Station (`sponsor` then one `submit`), or with --direct signed and sent straight to
 * Soroban RPC (the Nov 5 23:00 go/no-go fallback, GAS_MODE=direct).
 * Testnet only. Writes nothing to SQLite or .env; prints statuses and tx hashes, never a secret or an XDR.
 *   pnpm --filter api tsx scripts/spike-authorize.ts
 *   pnpm --filter api tsx scripts/spike-authorize.ts --direct
 */
import { randomBytes } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import {
  BASE_FEE,
  Contract,
  Keypair,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  type Transaction,
  type xdr,
} from '@stellar/stellar-sdk';
import { Velo, VeloError, VeloProviderError, type GasSponsorReservation, type GasSubmitResult } from '@carts1024/velo-sdk';
import { loadConfig } from '../src/config';

const ONE_XLM = 10_000_000n;
const PER_TAP_CAP = 500_000_000n; // ₱500 at the demo rate (10 PHP/XLM), the program cap
const TAP_AMOUNT = 5_000_000n; // 0.5 XLM
const EXPERT_TX = 'https://stellar.expert/explorer/testnet/tx/';

const { values } = parseArgs({ options: { direct: { type: 'boolean', default: false } } });
const config = loadConfig();
const server = new rpc.Server(config.STELLAR_RPC_URL);
const programWallet = Keypair.fromSecret(config.PROGRAM_WALLET_SECRET);
const stationA = Keypair.fromSecret(config.STATION_A_SECRET).publicKey();
const velo = values.direct
  ? null
  : new Velo({ apiKey: config.VELO_GAS_API_KEY, baseUrl: config.VELO_GAS_BASE_URL, environment: 'testnet', timeoutMs: 30_000 });
const runId = Date.now().toString(36);

// ScVal encoding, docs/system-design.md §4.3.
const address = (value: string) => nativeToScVal(value, { type: 'address' });
const bytes32 = (hex: string) => nativeToScVal(Buffer.from(hex, 'hex'), { type: 'bytes' });
const i128 = (value: bigint) => nativeToScVal(value, { type: 'i128' });
const u64 = (value: bigint) => nativeToScVal(value, { type: 'u64' });

async function friendbot(publicKey: string): Promise<void> {
  const res = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`);
  if (!res.ok) throw new Error(`friendbot failed for ${publicKey}: HTTP ${res.status}`);
}

async function unsigned(source: string, contractId: string, method: string, args: xdr.ScVal[]): Promise<Transaction> {
  const account = await server.getAccount(source);
  return new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: config.STELLAR_NETWORK_PASSPHRASE })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(300) // room for the sponsor() retries and the status wait in submit()
    .build();
}

/** One invokeHostFunction op, source = signer, exactly one signature (the Gas Station envelope rule). */
async function signed(signer: Keypair, contractId: string, method: string, args: xdr.ScVal[]): Promise<Transaction> {
  const tx = await server.prepareTransaction(await unsigned(signer.publicKey(), contractId, method, args));
  tx.sign(signer);
  return tx;
}

async function read(contractId: string, method: string, args: xdr.ScVal[]): Promise<unknown> {
  const sim = await server.simulateTransaction(await unsigned(programWallet.publicKey(), contractId, method, args));
  if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) {
    throw new Error(`${method}: simulation failed ${rpc.Api.isSimulationError(sim) ? sim.error : ''}`);
  }
  return scValToNative(sim.result.retval);
}

async function submit(step: string, tx: Transaction): Promise<void> {
  if (!velo) {
    const sent = await server.sendTransaction(tx);
    if (sent.status === 'ERROR') throw new Error(`${step}: sendTransaction returned ERROR`);
    const done = await server.pollTransaction(sent.hash, { attempts: 30 });
    console.log(`${step.padEnd(15)} direct  ${done.status.padEnd(9)} tx=${sent.hash}`);
    if (done.status !== 'SUCCESS') throw new Error(`${step}: ${done.status}`);
    return;
  }

  // Stable per run and step: a retried sponsorship reuses the reservation, never a second one.
  const key = `tapat-spk:${runId}:${step}`;
  const xdrBase64 = tx.toXDR();

  // sponsor() only reserves fee exposure and never submits, so a provider failure here is safe to retry
  // with the same signed XDR and the same idempotency key.
  let reservation: GasSponsorReservation | undefined;
  for (let attempt = 1; reservation === undefined; attempt++) {
    try {
      reservation = await velo.gas.sponsor(xdrBase64, { idempotencyKey: key, correlationId: key, timeoutMs: 30_000 });
    } catch (error) {
      if (!(error instanceof VeloProviderError) || attempt >= 4) throw error;
      console.log(`${step.padEnd(15)} velo    sponsor retry ${attempt}/3 after ${error.code ?? 'provider error'}`);
      await sleep(10_000 * attempt);
    }
  }

  // submit() is the single hand-off. Any failure may come after Velo received it (a 5xx arrives as
  // VeloProviderError, a lost response as VeloGasSubmissionUnknownError), so recover by identity, never resubmit.
  const identity = { requestId: reservation.requestId, transactionHash: reservation.transactionHash };
  let result: GasSubmitResult;
  try {
    result = await velo.gas.submit({ ...identity, transactionXdr: xdrBase64 });
  } catch (error) {
    console.log(`${step.padEnd(15)} velo    hand-off uncertain (${error instanceof Error ? error.constructor.name : 'error'}); reading status by identity`);
    result = await velo.gas.getStatus(identity);
  }
  if (result.status === 'claimed' || result.status === 'submitted' || result.status === 'submission_unknown') {
    // waitForResult returns the last non-terminal result when its attempts run out.
    result = await velo.gas.waitForResult(identity, { timeoutMs: 90_000, maxAttempts: 20 });
  }
  console.log(
    `${step.padEnd(15)} velo    ${result.status.padEnd(9)} outer=${result.outerTransactionHash ?? '-'} ` +
      `inner=${result.transactionHash} fee=${result.actualFeeStroops ?? 'unknown'} stroops`,
  );
  if (result.status !== 'succeeded') {
    throw new Error(
      `${step}: Gas Station status ${result.status}; recover with getStatus({ requestId: ${identity.requestId}, ` +
        `transactionHash: ${identity.transactionHash} }), never by resubmitting`,
    );
  }
}

async function main(): Promise<void> {
  const wallet = programWallet.publicKey();
  const deviceHash = randomBytes(32).toString('hex');
  const agent = Keypair.random();
  await friendbot(agent.publicKey()); // the agent is the source of authorize(), so it must exist on chain

  console.log(`mode ${velo ? 'velo (Gas Station)' : 'direct (RPC)'}  run ${runId}`);
  console.log(`throwaway device ${deviceHash.slice(0, 8)}…  agent ${agent.publicKey()}  merchant station A ${stationA}`);

  await submit('register', await signed(programWallet, config.NOIR_DEVICE_REGISTRY_ID, 'register', [
    address(wallet), bytes32(deviceHash), address(agent.publicKey()),
  ]));
  const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 3600);
  await submit('register_agent', await signed(programWallet, config.NOIR_AGENT_REGISTRY_ID, 'register_agent', [
    address(wallet), bytes32(deviceHash), address(agent.publicKey()), i128(PER_TAP_CAP), address(config.XLM_SAC_ID), u64(expiresAt),
  ]));
  await submit('fund_escrow', await signed(programWallet, config.NOIR_PAYMENT_ESCROW_ID, 'fund_escrow', [
    address(config.XLM_SAC_ID), address(wallet), bytes32(deviceHash), i128(ONE_XLM),
  ]));
  const before = (await read(config.NOIR_PAYMENT_ESCROW_ID, 'balance_of', [bytes32(deviceHash)])) as bigint;
  await submit('authorize', await signed(agent, config.NOIR_PAYMENT_ESCROW_ID, 'authorize', [
    address(agent.publicKey()), bytes32(deviceHash), address(stationA), address(config.XLM_SAC_ID), i128(TAP_AMOUNT), u64(BigInt(Date.now())),
  ]));
  const after = (await read(config.NOIR_PAYMENT_ESCROW_ID, 'balance_of', [bytes32(deviceHash)])) as bigint;

  console.log(`escrow balance  ${before} -> ${after} stroops (expected -${TAP_AMOUNT})`);
  if (before - after !== TAP_AMOUNT) throw new Error('escrow balance did not drop by the tap amount');
  console.log(`PASS  spike complete. Check the hashes above on ${EXPERT_TX}<hash>`);
}

main().catch((error: unknown) => {
  if (error instanceof VeloError) {
    console.error(`FAIL  ${error.constructor.name} code=${error.code ?? '-'} status=${error.status ?? '-'} requestId=${error.requestId ?? '-'}: ${error.message}`);
  } else {
    console.error(`FAIL  ${(error instanceof Error ? error.message : String(error)).slice(0, 1500)}`);
  }
  process.exit(1);
});
