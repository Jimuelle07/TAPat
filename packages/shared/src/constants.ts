import type { TapReasonCode } from './types';

/** Human labels for the activity feed and the Telegram decline clause; keys are the closed set in §3. */
export const TAP_REASON_LABELS: Record<TapReasonCode, string> = {
  EXPIRED: 'card expired',
  OVER_CAP: 'over the ₱500.00 per-tap cap',
  POLICY_DENIED: 'not permitted by the card policy',
  INSUFFICIENT_ESCROW: 'no fuel credit left on the card',
  STATION_FROZEN: 'station paused by the Freeze Agent',
  CARD_NOT_ENROLLED: 'card not enrolled',
  SIMULATED_EDGE: 'simulated edge (no card)',
};

/** A simulated (no-hardware) card UID starts with this prefix; the server stores such a card with `virtual = 1`. */
export const VIRTUAL_UID_PREFIX = 'TAPATVIRTUAL';
