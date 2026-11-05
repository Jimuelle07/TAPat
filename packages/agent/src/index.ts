// @tapat/agent: pure agent logic. No env reads, no SQLite, no HTTP — callers pass config and clients in.
export { createNoirClient, signNoirCall, submitDirect } from './chain/noir';
export type { NoirClientConfig } from './chain/noir';
export { submitSponsored } from './chain/gas';
export type { SubmitSponsoredOptions } from './chain/gas';
export { Bocpd, bocpdRun, trancheShouldFire, DEFAULT_BOCPD } from './algorithms/bocpd';
export type { BocpdConfig, BocpdPoint } from './algorithms/bocpd';

// These SDK pins live here, so callers that build the Velo client, type an operation or triage SDK errors use the
// same copies this package does. They are pass-throughs, not extra behaviour.
export { Velo, VeloError } from '@carts1024/velo-sdk';
export { NoirContractError, type NoirOperation } from '@noirx402/agent-sdk';
