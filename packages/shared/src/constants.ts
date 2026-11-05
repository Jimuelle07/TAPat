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

/** HTTP error codes, the closed set in docs/api-and-data.md §5.3. Tap reason codes are not error codes. */
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'CARD_NOT_ENROLLED',
  'WEBHOOK_SIGNATURE_INVALID',
  'CARD_ALREADY_ENROLLED',
  'INVALID_STATE',
  'OCR_UNAVAILABLE',
  'PHOTO_MISMATCH',
  'PHOTO_CONFIRMATION_REQUIRED',
  'STATION_FROZEN',
  'CHAIN_ERROR',
  'INTERNAL',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];
