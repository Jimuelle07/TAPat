import { describe, expect, it, vi } from 'vitest';
import { NoirAgentClient, TESTNET } from '@noirx402/agent-sdk';
import { createNoirClient, getTransactionOutcome, type NoirClientConfig } from './noir';

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

describe('getTransactionOutcome', () => {
  function fakeClient(status: string) {
    const getTransaction = vi.fn().mockResolvedValue({ status });
    return { noir: { server: { getTransaction } } as unknown as NoirAgentClient, getTransaction };
  }

  it.each([
    ['SUCCESS', 'succeeded'],
    ['FAILED', 'failed'],
    ['NOT_FOUND', 'not_found'],
  ] as const)('maps %s to %s and reads the hash passed in', async (status, outcome) => {
    const { noir, getTransaction } = fakeClient(status);

    await expect(getTransactionOutcome(noir, 'inner_hash_1')).resolves.toBe(outcome);
    expect(getTransaction).toHaveBeenCalledWith('inner_hash_1');
  });

  it('propagates a read failure', async () => {
    const error = new Error('rpc down');
    const noir = { server: { getTransaction: vi.fn().mockRejectedValue(error) } } as unknown as NoirAgentClient;

    await expect(getTransactionOutcome(noir, 'inner_hash_1')).rejects.toBe(error);
  });
});
