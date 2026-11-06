// Builder Handbook requirement 2: every Noir write goes through the Noir SDK on the deployed testnet IDs.
// This module and its callers use `@noirx402/agent-sdk` only; nothing here talks to the chain directly.
import { Keypair, rpc } from '@stellar/stellar-sdk';
import {
  NoirAgentClient,
  TESTNET,
  keypairSigner,
  type NoirNetworkConfig,
  type NoirOperation,
} from '@noirx402/agent-sdk';

/** The deployment the caller must match: the SDK's built-in Testnet contracts and passphrase. */
export type NoirClientConfig = Pick<NoirNetworkConfig, 'rpcUrl' | 'networkPassphrase' | 'contracts'>;

const CONTRACT_NAMES = ['deviceRegistry', 'agentRegistry', 'paymentEscrow'] as const;

/**
 * Refuses to run on any deployment the SDK does not know (handbook: other contract IDs do not count), then builds
 * the client for the built-in Testnet network.
 */
export function createNoirClient(cfg: NoirClientConfig): NoirAgentClient {
  for (const name of CONTRACT_NAMES) {
    if (TESTNET.contracts[name] !== cfg.contracts[name]) {
      throw new Error(`Noir SDK ${name} differs from the configured contract ID`);
    }
  }
  if (TESTNET.networkPassphrase !== cfg.networkPassphrase) {
    throw new Error('Noir SDK network passphrase differs from the configured passphrase');
  }
  return new NoirAgentClient({ network: 'testnet', rpcUrl: cfg.rpcUrl });
}

/**
 * The SDK builds and simulates the call (one invokeHostFunction op, source = signer), then the signer adds its
 * signature; the result is the signed envelope XDR.
 */
export async function signNoirCall(
  noir: NoirAgentClient,
  signer: Keypair,
  op: NoirOperation,
  networkPassphrase: string,
): Promise<string> {
  const unsigned = await noir.prepare(signer.publicKey(), op);
  const signed = await keypairSigner(signer.secret()).signTransaction(unsigned, { networkPassphrase });
  return typeof signed === 'string' ? signed : signed.signedTxXdr;
}

/** What the chain says about a hash: applied, applied but failed, or not indexed (yet). */
export type OnChainOutcome = 'succeeded' | 'failed' | 'not_found';

/**
 * Reads one transaction's outcome over Soroban RPC. This is a read, not a contract call: it needs no signer. A
 * fee-bump transaction is indexed under both its outer and the inner hash, so the locally computed inner hash is
 * enough to confirm a sponsored hand-off. Throws propagate from `getTransaction`; callers decide what a failed read
 * means.
 */
export async function getTransactionOutcome(noir: NoirAgentClient, hash: string): Promise<OnChainOutcome> {
  const { status } = await noir.server.getTransaction(hash);
  if (status === rpc.Api.GetTransactionStatus.SUCCESS) return 'succeeded';
  if (status === rpc.Api.GetTransactionStatus.FAILED) return 'failed';
  return 'not_found';
}

/** GAS_MODE=direct: the Noir SDK submits the signed envelope itself and resolves with the transaction hash. */
export async function submitDirect(noir: NoirAgentClient, signedXdr: string, op: NoirOperation): Promise<string> {
  return noir.submit(signedXdr, op);
}
