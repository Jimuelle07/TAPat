// Verbatim from docs/api-and-data.md §3. Edit the doc first, then this file.

export type Stroops = string;      // integer stroops as a decimal string
export type UnixMs = number;
export type UnixS = number;

export type ProgramStatus = 'draft' | 'active' | 'ending' | 'ended';
export type BeneficiaryStatus = 'approved' | 'rejected' | 'uncertain' | 'evidence_requested' | 'enrolled';
export type CardStatus = 'pending' | 'active' | 'failed' | 'revoked' | 'swept';
export type StationStatus = 'active' | 'frozen';
export type TapStatus = 'authorized' | 'rejected' | 'refused' | 'failed';
export type ChainTxStatus = 'pending' | 'succeeded' | 'failed' | 'submission_unknown';
export type GasMode = 'velo' | 'direct';
export type AgentName = 'intake' | 'tranche' | 'freeze' | 'settlement' | 'sweep';

export interface Program {
  id: string;
  name: string;
  status: ProgramStatus;
  perTapCapStroops: Stroops;
  trancheStroops: Stroops;
  expiresAtS: UnixS;
  priceThresholdPhp: number;
  alpha: number;
  beta: number;
  budgetVerifiedStroops: Stroops;
  budgetFundedStroops: Stroops;
  trancheFired: boolean;
  createdAt: UnixMs;
  // no salt: server-only
}

export interface Beneficiary {
  id: string;
  programId: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  suffix: string | null;
  birthdate: string;            // 'YYYY-MM-DD'
  plate: string;
  toda: string;
  barangay: string;
  source: 'ocr_precomputed' | 'csv';
  score: number | null;
  status: BeneficiaryStatus;
  ruleCode: 'UNDERAGE' | 'PLATE_MULTI_NAME' | 'DUPLICATE_PLATE' | null;
  decisionReason: string | null;
  linkCode: string | null;      // present so the UI can rebuild the deep link
  telegramLinked: boolean;      // derived from telegram_chat_id, which is never exposed
  telegramDeepLink: string;     // server-composed https://t.me/<TELEGRAM_BOT_USERNAME>?start=<link_code>
  createdAt: UnixMs;
}

export interface Card {
  id: string;
  beneficiaryId: string;
  uidLast4: string;
  virtual: boolean;
  agentPublic: string;
  maxAmountStroops: Stroops;
  expiresAtS: UnixS;
  lastNonce: string;            // u64 as decimal string
  status: CardStatus;
  returnedStroops: Stroops;
  error: string | null;
  createdAt: UnixMs;
  // no agent_secret_enc, no device_hash: the web only ever sees CardSummary.deviceHashPrefix and uidLast4
}

/** Row of Dashboard.cards and of the Simulate-tap picker. Never carries a full device hash or full name. */
export interface CardSummary {
  id: string;
  beneficiaryId: string;
  displayName: string;          // first name + last initial, e.g. "Juan D."
  uidLast4: string;
  deviceHashPrefix: string;     // first 8 hex chars of device_hash
  virtual: boolean;
  status: CardStatus;
  expiresAtS: UnixS;
  expired: boolean;             // expiresAtS < now, computed server-side
  escrowStroops: Stroops;       // payment_escrow.balance_of read (same one as Dashboard.escrowRemainingStroops)
  returnedStroops: Stroops;
}

export interface Station {
  id: string;                   // 'A' | 'B'
  name: string;
  publicKey: string;
  status: StationStatus;
  frozenReason: string | null;
  frozenAt: UnixMs | null;
  pendingStroops: Stroops;      // unclaimed tap total for this merchant (§5.2 #16)
  spentStroops: Stroops;        // authorized taps already covered by a succeeded claim (§5.2 #18)
}

export interface Tap {
  id: string;
  cardId: string | null;
  cardRef: string | null;       // fixture card id for SIMULATED_EDGE rows; MIDAS edge key = cardId ?? cardRef
  stationId: string;
  amountStroops: Stroops;
  nonce: string | null;
  status: TapStatus;
  reasonCode: TapReasonCode | null;
  chainTxId: string | null;
  simulated: boolean;
  midasScore: number | null;
  tick: number | null;
  createdAt: UnixMs;
}

export type TapReasonCode =
  | 'EXPIRED' | 'OVER_CAP' | 'POLICY_DENIED' | 'INSUFFICIENT_ESCROW'
  | 'STATION_FROZEN' | 'CARD_NOT_ENROLLED' | 'SIMULATED_EDGE';

export interface ChainTx {
  id: string;
  kind: 'register' | 'register_agent' | 'fund' | 'authorize' | 'claim' | 'revoke_agent' | 'sweep' | 'revoke_device';
  contractId: string;
  method: string;
  sourcePublic: string;
  status: ChainTxStatus;
  gasMode: GasMode;
  veloRequestId: string | null;
  innerHash: string | null;
  outerHash: string | null;
  errorCode: string | null;
  error: string | null;
  createdAt: UnixMs;
  updatedAt: UnixMs;
}

export interface AgentDecision {
  id: string;
  agent: AgentName;
  decision: string;             // vocabulary in §2.2
  inputs: Record<string, unknown>;   // parsed from inputs_json
  outputs: Record<string, unknown>;  // parsed from outputs_json
  txIds: string[];                   // parsed from tx_ids_json
  createdAt: UnixMs;
}

/** SSE `freeze` payload: the decision plus the station state it produced, as flat sibling keys. */
export type FreezeEvent = AgentDecision & {
  stationId: string;
  stationStatus: StationStatus;
};

/** One point of the Tranche Agent price stream. Also the SSE `price` payload. */
export interface PricePoint {
  programId: string;
  idx: number;                  // 1-based index into the fixture
  pricePhp: number;
  simulated: boolean;
  cpRecent: number | null;      // BOCPD P(r_t < 10)
  mapR: number | null;          // BOCPD MAP run length
}

export interface HealthResponse {
  ok: boolean;
  rpc: 'ok' | 'down';
  velo: 'ok' | 'down';
  telegram: 'ok' | 'down';
  gasMode: GasMode;
}

export interface CalibrationResponse {
  alpha: number;
  beta: number;
  lambdaLo: number;
  lambdaHi: number;
  n: number;                    // calibration set size
  wrongfulDenialRate: number;   // empirical, measured on the calibration fixture
  ghostAdmissionRate: number;   // empirical, measured on the calibration fixture
  feasible: boolean;            // lambdaLo <= lambdaHi on the grid (before clamping)
}

export interface TrancheState {
  running: boolean;
  fired: boolean;
  idx: number;                  // points consumed
  total: number;                // 45
  lastPricePhp: number | null;
  cpRecent: number | null;
  mapR: number | null;
  thresholdPhp: number;
  budgetVerifiedStroops: Stroops;
  budgetFundedStroops: Stroops;
  points: PricePoint[];         // full series so far, so /demo redraws the chart after a reload
  funds: Array<{ cardId: string; beneficiaryId: string; amountStroops: Stroops; txId: string | null; status: ChainTxStatus | 'skipped'; reason: string | null }>;
}

export interface Dashboard {
  program: Program;
  phpPerXlm: number;            // demo rate, for formatPhp()
  midasThreshold: number;       // from apps/server/config/midas.json; the freeze line on the edge chart
  fundedStroops: Stroops;       // Σ tranche-decision fund amounts whose chain_txs row is succeeded (§5.2 #18)
  spentStroops: Stroops;        // Σ authorized taps already covered by a succeeded claim (§5.2 #18)
  heldStroops: Stroops;         // unclaimed taps at frozen stations, same rule
  pendingStroops: Stroops;      // unclaimed taps at active stations, same rule
  escrowRemainingStroops: Stroops; // Σ payment_escrow.balance_of over active cards (chain read)
  returnedStroops: Stroops;     // Σ cards.returned_stroops
  invariantOk: boolean;         // funded === spent + held + pending + escrowRemaining + returned
  budget: {
    state: 'none' | 'waiting' | 'verified';
    verifiedStroops: Stroops;
    fundedStroops: Stroops;
    remainingStroops: Stroops;  // verified - funded, never negative
    checkoutUrl: string | null; // latest budget velo_intents row's checkout_url
    paymentIntentId: string | null;
  };
  counts: {                     // status buckets are disjoint: `approved` excludes `enrolled`
    beneficiaries: number;
    approved: number;
    uncertain: number;
    enrolled: number;
    cardsActive: number;
    tapsAuthorized: number;
    tapsRejected: number;
    tapsRefused: number;
  };
  cards: CardSummary[];         // enrollment order
  stations: Station[];
  recentTaps: Tap[];            // newest first, max 50
  recentDecisions: AgentDecision[]; // newest first, max 20
}

// Response envelopes (one per endpoint that is not a bare list)
export interface ProgramResponse { program: Program | null; phpPerXlm: number }
export interface BudgetCheckoutResponse { checkoutUrl: string; paymentIntentId: string }
export interface IntakeResponse {
  rows: Beneficiary[];
  /** Disjoint buckets: approved + rejected + uncertain + enrolled === total. */
  summary: {
    total: number;
    approved: number;
    rejected: number;
    uncertain: number;
    enrolled: number;           // rows whose existing status was `enrolled` and stayed that way (re-seeded cards)
  };
  calibration: CalibrationResponse;
}
export interface EnrollResponse {
  card: Card;
  beneficiary: Beneficiary;
  deviceHashPrefix: string;     // first 8 hex chars, safe for the UI and the CSV
  photoCheck: {
    source: 'precomputed' | 'officer_confirmed';
    plate: string | null;       // precomputed plate, null for an officer-confirmed upload
    toda: string | null;
    matched: boolean;           // always true when source = 'officer_confirmed'
  };
  chainTxIds: string[];         // [register, register_agent] (only the steps that ran)
}
export interface TapResponse { tap: Tap; balanceStroops: Stroops | null; message: string }
export interface UnfreezeResponse { station: Station }
export interface SettlementResponse {
  stations: Array<{
    stationId: string;
    stationName: string;
    pendingStroops: Stroops;
    action: 'claimed' | 'held' | 'nothing_pending';
    chainTxId: string | null;
    decisionId: string;
  }>;
}
export interface EndProgramResponse {
  program: Program;
  cards: Array<{
    cardId: string;
    beneficiaryId: string;
    returnedStroops: Stroops;
    revokeTxId: string | null;
    sweepTxId: string | null;
    status: CardStatus;
    reason: string | null;
  }>;
  totalReturnedStroops: Stroops;
}
export interface RequestEvidenceResponse {
  beneficiary: Beneficiary;
  telegramSent: boolean;
  deepLink: string | null;      // https://t.me/<bot>?start=<link_code>
}
export interface BurstResponse { accepted: boolean; edges: number; tickMs: number }
export interface TrancheStartResponse { started: boolean; points: number; tickMs: number }
