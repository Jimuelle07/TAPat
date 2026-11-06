// @tapat/agent: pure agent logic. No env reads, no SQLite, no HTTP — callers pass config and clients in.
export { createNoirClient, getTransactionOutcome, signNoirCall, submitDirect } from './chain/noir';
export type { NoirClientConfig, OnChainOutcome } from './chain/noir';
export { GasHandoffError, GasSponsorError, submitSponsored } from './chain/gas';
export type { SubmitSponsoredOptions } from './chain/gas';
export { decryptSecret, encryptSecret, fundWithFriendbot, generateAgentKeypair } from './chain/keys';
export { Bocpd, bocpdRun, trancheShouldFire, DEFAULT_BOCPD } from './algorithms/bocpd';
export type { BocpdConfig, BocpdPoint } from './algorithms/bocpd';
export {
  chiSquare,
  DEFAULT_SKETCH,
  fnv1a32,
  sketchAdd,
  sketchClone,
  sketchDecay,
  sketchEstimate,
  sketchInit,
} from './algorithms/cms';
export type { SketchConfig, SketchState } from './algorithms/cms';
export { DEFAULT_MIDAS, initMidasState, replayMidas, stepMidas } from './algorithms/midas';
export type { EdgeEvent, MidasConfig, MidasScore, MidasState } from './algorithms/midas';

// These SDK pins live here, so callers that build the Velo client, type an operation or triage SDK errors use the
// same copies this package does. They are pass-throughs, not extra behaviour.
export { Velo, VeloAuthError, VeloError, VeloProviderError, VeloValidationError } from '@carts1024/velo-sdk';
export type { GasApi, GasExecutionIdentity, GasSubmitResult } from '@carts1024/velo-sdk';
export { NoirContractError } from '@noirx402/agent-sdk';
export type { NoirAgentClient, NoirOperation, PaymentCheck, PaymentRefusal } from '@noirx402/agent-sdk';
