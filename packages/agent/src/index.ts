// @tapat/agent: pure agent logic. No env reads, no SQLite, no HTTP — callers pass config and clients in.
export { createNoirClient, signNoirCall, submitDirect } from './chain/noir';
export type { NoirClientConfig } from './chain/noir';
export { GasHandoffError, GasSponsorError, submitSponsored } from './chain/gas';
export type { SubmitSponsoredOptions } from './chain/gas';
export { decryptSecret, encryptSecret, fundWithFriendbot, generateAgentKeypair } from './chain/keys';

// These SDK pins live here, so callers that build the Velo client, type an operation or triage SDK errors use the
// same copies this package does. They are pass-throughs, not extra behaviour.
export { Velo, VeloAuthError, VeloError, VeloProviderError, VeloValidationError } from '@carts1024/velo-sdk';
export type { GasApi, GasExecutionIdentity, GasSubmitResult } from '@carts1024/velo-sdk';
export { NoirContractError } from '@noirx402/agent-sdk';
export type { NoirAgentClient, NoirOperation } from '@noirx402/agent-sdk';
