/**
 * SPK (docs/build-schedule.md): throwaway card -> registerDevice -> registerAgent -> fundEscrow(1 XLM) -> checkPayment
 * -> authorize. Every Noir call goes through the production pipeline, `runChainTx` (`apps/server/src/services/chain.ts`):
 * the SDK prepares it, this process signs it, and it is submitted by the Velo Gas Station, or with --direct by the
 * Noir SDK (the Nov 5 23:00 go/no-go fallback, GAS_MODE=direct). Builder Handbook requirement 2: Noir only through
 * the Noir SDK, on the deployed IDs. Testnet only. Writes to an in-memory SQLite only; prints statuses and tx hashes,
 * never a secret or an XDR.
 *   pnpm --filter server tsx scripts/spike-authorize.ts
 *   pnpm --filter server tsx scripts/spike-authorize.ts --direct
 */
import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import { Keypair } from '@stellar/stellar-sdk';
import {
  NoirContractError,
  Velo,
  VeloError,
  createNoirClient,
  type NoirOperation,
} from '@tapat/agent';
import { loadConfig } from '../src/config';
import { openDb } from '../src/db/index';
import { runChainTx, type ChainDeps, type ChainTxResult } from '../src/services/chain';

const ONE_XLM = 10_000_000n;
const PER_TAP_CAP = 500_000_000n; // ₱500 at the demo rate (10 PHP/XLM), the program cap
const TAP_AMOUNT = 5_000_000n; // 0.5 XLM
const EXPERT_TX = 'https://stellar.expert/explorer/testnet/tx/';

const { values } = parseArgs({ options: { direct: { type: 'boolean', default: false } } });
const config = loadConfig();

// The SDK's built-in Testnet deployment must be exactly the one in .env (handbook: other contract IDs do not count).
const noir = createNoirClient({
  rpcUrl: config.STELLAR_RPC_URL,
  networkPassphrase: config.STELLAR_NETWORK_PASSPHRASE,
  contracts: {
    deviceRegistry: config.NOIR_DEVICE_REGISTRY_ID,
    agentRegistry: config.NOIR_AGENT_REGISTRY_ID,
    paymentEscrow: config.NOIR_PAYMENT_ESCROW_ID,
  },
});
const programWallet = Keypair.fromSecret(config.PROGRAM_WALLET_SECRET);
const stationA = Keypair.fromSecret(config.STATION_A_SECRET).publicKey();
const velo = values.direct
  ? null
  : new Velo({ apiKey: config.VELO_GAS_API_KEY, baseUrl: config.VELO_GAS_BASE_URL, environment: 'testnet', timeoutMs: 30_000 });
const runId = Date.now().toString(36);
const chain: ChainDeps = {
  db: openDb(':memory:'), // the spike exercises the production pipeline, including the chain_txs writes
  noir,
  gas: velo?.gas ?? null,
  config: { ...config, GAS_MODE: values.direct ? 'direct' : 'velo', GAS_FALLBACK_DIRECT: false },
  log: {
    warn: (obj, message) => console.warn(`${message}${chainTxSuffix(obj)}`),
    error: (obj, message) => console.error(`${message}${chainTxSuffix(obj)}`),
  },
};

function chainTxSuffix(obj: object): string {
  const { chainTxId } = obj as { chainTxId?: string };
  return chainTxId === undefined ? '' : ` chainTxId=${chainTxId}`;
}

async function friendbot(publicKey: string): Promise<void> {
  const res = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`);
  if (!res.ok) throw new Error(`friendbot failed for ${publicKey}: HTTP ${res.status}`);
}

function submit(step: string, result: ChainTxResult): void {
  console.log(
    `${step.padEnd(15)} ${result.gasMode.padEnd(6)} ${result.status.padEnd(19)} inner=${result.innerHash ?? '-'} ` +
      `outer=${result.outerHash ?? '-'} code=${result.errorCode ?? '-'}`,
  );
  if (result.status !== 'succeeded') {
    throw new Error(
      `${step}: chain_txs row ${result.chainTxId} is ${result.status} (${result.errorCode ?? 'no code'}); ` +
        'recover by identity, never by resubmitting',
    );
  }
}

async function run(step: string, signer: Keypair, op: NoirOperation): Promise<void> {
  submit(step, await runChainTx(chain, signer, op));
}

async function main(): Promise<void> {
  const deviceHash = randomBytes(32).toString('hex');
  const agent = Keypair.random();
  await friendbot(agent.publicKey()); // the agent is the source of authorize(), so it must exist on chain

  console.log(`mode ${velo ? 'velo (Gas Station)' : 'direct (Noir SDK submit)'}  run ${runId}`);
  console.log(`throwaway device ${deviceHash.slice(0, 8)}…  agent ${agent.publicKey()}  merchant station A ${stationA}`);

  const asset = config.XLM_SAC_ID;
  await run('registerDevice', programWallet, { kind: 'registerDevice', deviceHash, agent: agent.publicKey() });
  await run('registerAgent', programWallet, {
    kind: 'registerAgent', deviceHash, agent: agent.publicKey(), asset, maxAmount: PER_TAP_CAP,
    expiresAt: new Date(Date.now() + 3_600_000),
  });
  await run('fundEscrow', programWallet, { kind: 'fundEscrow', deviceHash, token: asset, amount: ONE_XLM });

  const before = await noir.getEscrowBalance(deviceHash);
  const check = await noir.checkPayment({ deviceHash, agent: agent.publicKey(), asset, amount: TAP_AMOUNT });
  console.log(`checkPayment    ${check.ok ? 'ok' : `refused: ${check.reason}`}`);
  if (!check.ok) throw new Error(`checkPayment refused: ${check.reason}`);
  const overCap = await noir.checkPayment({ deviceHash, agent: agent.publicKey(), asset, amount: PER_TAP_CAP + 1n });
  console.log(`checkPayment    over cap -> ${overCap.ok ? 'ok (UNEXPECTED)' : overCap.reason}`);

  await run('authorize', agent, {
    kind: 'authorize', deviceHash, merchant: stationA, asset, amount: TAP_AMOUNT, nonce: BigInt(Date.now()),
  });
  const after = await noir.getEscrowBalance(deviceHash);

  console.log(`escrow balance  ${before} -> ${after} stroops (expected -${TAP_AMOUNT})`);
  if (before - after !== TAP_AMOUNT) throw new Error('escrow balance did not drop by the tap amount');
  console.log(`PASS  spike complete. Check the hashes above on ${EXPERT_TX}<hash>`);
}

main().catch((error: unknown) => {
  if (error instanceof VeloError) {
    console.error(`FAIL  ${error.constructor.name} code=${error.code ?? '-'} status=${error.status ?? '-'} requestId=${error.requestId ?? '-'}: ${error.message}`);
  } else if (error instanceof NoirContractError) {
    console.error(`FAIL  NoirContractError ${error.contract}.${error.method} #${error.code} ${error.errorName}`);
  } else {
    console.error(`FAIL  ${(error instanceof Error ? error.message : String(error)).slice(0, 1500)}`);
  }
  process.exit(1);
});
