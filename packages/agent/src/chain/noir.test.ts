import { describe, expect, it } from 'vitest';
import { NoirAgentClient, TESTNET } from '@noirx402/agent-sdk';
import { createNoirClient, type NoirClientConfig } from './noir';

function testnet(): NoirClientConfig {
  return {
    rpcUrl: 'https://soroban-testnet.stellar.org',
    networkPassphrase: TESTNET.networkPassphrase,
    contracts: { ...TESTNET.contracts },
  };
}

describe('createNoirClient', () => {
  it.each(['deviceRegistry', 'agentRegistry', 'paymentEscrow'] as const)(
    'refuses a deployment whose %s differs from the SDK',
    (name) => {
      const config = testnet();
      config.contracts[name] = `CDIFFERENT${'A'.repeat(45)}`;
      expect(() => createNoirClient(config)).toThrow(`Noir SDK ${name} differs from the configured contract ID`);
    },
  );

  it('refuses a deployment whose passphrase differs from the SDK', () => {
    const config = testnet();
    config.networkPassphrase = 'Public Global Stellar Network ; September 2015';
    expect(() => createNoirClient(config)).toThrow(
      'Noir SDK network passphrase differs from the configured passphrase',
    );
  });

  it('builds the Testnet client when the deployment matches exactly', () => {
    expect(createNoirClient(testnet())).toBeInstanceOf(NoirAgentClient);
  });
});
