// The chain clients `main()` and the demo scripts share: one place builds the Noir client and the Gas Station handle,
// so a script never carries its own copy of the boot wiring (docs/api-and-data.md §1, SDD §4.2).
import { Velo, createNoirClient, type NoirAgentClient } from '@tapat/agent';
import type { Config } from './config';
import type { Db } from './db/index';
import type { ChainDeps, ChainLog } from './services/chain';

export interface ChainRuntime {
  noir: NoirAgentClient;
  chain: ChainDeps;
}

export function createChainRuntime(config: Config, db: Db, log: ChainLog): ChainRuntime {
  // Handbook requirement: refuse to boot on any deployment the Noir SDK does not know (SDD §4.2).
  const noir = createNoirClient({
    rpcUrl: config.STELLAR_RPC_URL,
    networkPassphrase: config.STELLAR_NETWORK_PASSPHRASE,
    contracts: {
      deviceRegistry: config.NOIR_DEVICE_REGISTRY_ID,
      agentRegistry: config.NOIR_AGENT_REGISTRY_ID,
      paymentEscrow: config.NOIR_PAYMENT_ESCROW_ID,
    },
  });
  const gas =
    config.GAS_MODE === 'velo'
      ? new Velo({
          apiKey: config.VELO_GAS_API_KEY,
          baseUrl: config.VELO_GAS_BASE_URL,
          environment: 'testnet',
          timeoutMs: 30_000,
        }).gas
      : null;
  return { noir, chain: { db, noir, gas, config, log } };
}
