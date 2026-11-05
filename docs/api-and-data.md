# TAPat — API & Data Contracts

The single source of truth for TAPat's SQLite schema, REST endpoints, SSE stream, chain call map, environment variables, fixtures, and the shared TypeScript types the UI builds against.

Last updated: 2026-11-05

Related docs: [SDD](system-design.md) (why these calls happen, in what order) · [Algorithms](algorithms.md) (scoring and thresholds behind the numbers) · [PRD](PRD.md) (why the product exists) · [Setup](setup.md) (how to get these values) · [Build schedule](build-schedule.md) (who writes which file) · [Test plan](test-plan.md) (how each contract is checked).

---

## 1. Conventions (read this before writing code)

| Topic | Rule |
|---|---|
| Naming | Database columns are `snake_case`. JSON keys, TypeScript fields, and URL path segments are `camelCase`. Environment variables are `SCREAMING_SNAKE_CASE`. |
| Money | Every amount is an integer count of **stroops** (`1 XLM = 10^7 stroops`). Never a float, never PHP, never XLM on the wire between API and DB. PHP is a display concern only. |
| Money in JSON | Any field whose database column ends in `_stroops` is serialized as a **decimal string** (e.g. `"350000000"`). `bigint` is not JSON-serializable and 64-bit values exceed `Number.MAX_SAFE_INTEGER` for large programs; strings keep one representation everywhere. Deserialize with `BigInt(v)`. |
| Timestamps | Columns ending in `_at` are **unix milliseconds** (`INTEGER`). Columns ending in `_at_s` are **unix seconds** (`INTEGER`) because Soroban `u64` policy expiry is seconds; Stellar ledger time is unix seconds. |
| Identifiers | Primary keys are opaque `TEXT` with a type prefix: `prog_`, `ben_`, `card_`, `tap_`, `ctx_`, `dec_`. `stations.id` is the short label (`A`, `B`) because it appears in the phone URL. `velo_intents.id` is the Velo `paymentIntentId` verbatim. |
| `u64` fields in JSON | `nonce` is serialized as a decimal string for the same reason as stroops. |
| Errors | Every failure uses exactly `{"error":{"code":"<CODE>","message":"<human readable>"}}`. Codes are a closed set (§5.3). No other error shape is allowed. |
| Validation | Bodies and query strings are parsed with `zod` schemas imported from `@tapat/shared` (`packages/shared/schemas.ts`). A parse failure is `400 VALIDATION_ERROR` with the failing path in `message`. |
| Idempotency | Any endpoint that changes money is safe to call twice: budget credit is keyed on `paymentIntentId`, `fund_escrow`/`authorize`/`claim`/`sweep` are keyed on a `chain_txs` row created before submit. |
| Secrets never leave the server | Never serialized: `program.salt`, `cards.agent_secret_enc`, `stations.secret_enc`, `beneficiaries.telegram_chat_id` (exposed as `telegramLinked: boolean` instead), Velo keys, Telegram token. `cards.agent_public` and `stations.public_key` are public keys and may be exposed. |
| Card identity in the UI | The web never receives a full `device_hash`. Every screen and the CSV show only `deviceHashPrefix` (first 8 hex chars) and `uidLast4`. Stations and pickers label a card with `displayName` ("Juan D.") + `uidLast4` — never a full beneficiary name. |
| Shared package | `packages/shared` is published inside the workspace as **`@tapat/shared`** and exports TypeScript source (no build step). §1.3. |
| CORS | The API registers `@fastify/cors` with `origin: 'http://localhost:3000'` (GET methods suffice). This exists only for the manual SSE fallback `/?sse=direct`, which points the laptop at `http://localhost:4000/api/stream` when the Next.js rewrite buffers. Everything else goes through the rewrite locally and through Caddy in prod, so CORS is never involved in a deployed request. |
| Listen host | The API and Next.js bind `127.0.0.1` only — `listen({ port: config.PORT, host: '127.0.0.1' })`, `"dev": "next dev -H 127.0.0.1 -p 3000"` in `apps/web/package.json`, and `next start -H 127.0.0.1 -p 3000`, locally and on the VM. Nothing binds a LAN interface; the only public surface is Caddy behind the Funnel in prod, or a laptop's quick tunnel for its own phone test. See [deployment.md §5](deployment.md). |
| Cache headers | Every `/api/*` response carries `Cache-Control: no-store`, **except** `GET /api/stream`, which keeps `no-cache` next to its `text/event-stream`. One hook in `apps/api/src/server.ts` sets it; no route sets its own. Required because the optional Vercel rewrite honours upstream cache headers ([deployment.md §9](deployment.md)); harmless through Caddy. |
| Simulation labels | Rows created from fixtures carry `simulated = 1`, or `source = 'ocr_precomputed'`, or `velo_intents.purpose = 'budget'` for real money. The UI must render the label it reads; it must never infer "real" from absence of a flag. |

### 1.1 Money helpers (`packages/shared/money.ts`)

```ts
export const STROOPS_PER_XLM = 10_000_000n;
export const DEFAULT_PHP_PER_XLM = 10; // demo rate

/** PHP (number, 2 decimals) -> stroops at the given display rate. */
export function phpToStroops(php: number, phpPerXlm?: number): bigint;
/** stroops -> PHP as a number with 2 decimals (display only). */
export function stroopsToPhp(stroops: bigint | string, phpPerXlm?: number): number;
/** stroops -> "₱1,234.56" (or "1,234.56" with withSymbol=false). */
export function formatPhp(stroops: bigint | string, opts?: { phpPerXlm?: number; withSymbol?: boolean }): string;
/** XLM decimal string for Velo checkout, always exactly 2 decimals ("1000.00"). */
export function stroopsToXlmString(stroops: bigint | string): string;
```

`PHP_PER_XLM = 10` is the demo rate and must be labelled "demo rate" wherever PHP is shown. Web code never re-derives the rate: it reads `phpPerXlm` from `GET /api/dashboard` (or `GET /api/program`) and passes it to these helpers.

### 1.2 Shared constants (`packages/shared/constants.ts`)

```ts
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
```

The activity feed renders `TAP_REASON_LABELS[tap.reasonCode]` plus the tx link; `TapResponse.message` (returned by `POST /api/taps`) is the longer server-composed sentence used on the station page. The Telegram decline uses the label, not the sentence. Web never hardcodes a reason string.

### 1.3 Shared package (`@tapat/shared`)

`packages/shared` is the workspace package both apps import. It ships **TypeScript source**, not a `dist/` build:

```json
{
  "name": "@tapat/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" }
}
```

`src/index.ts` re-exports `money.ts`, `types.ts`, `schemas.ts`, and `constants.ts`, so every consumer uses one specifier:

```ts
import { formatPhp, phpToStroops } from '@tapat/shared';
import type { Dashboard, CardSummary } from '@tapat/shared';
```

Wiring:

| Consumer | Dependency | Compile path |
|---|---|---|
| `apps/web` | `"@tapat/shared": "workspace:*"` | `next.config.ts` sets `transpilePackages: ['@tapat/shared']` so Next compiles the TS source |
| `apps/api` | `"@tapat/shared": "workspace:*"` | `tsx` imports the `.ts` entry directly; no build, no path aliases |

`packages/shared` must stay browser-safe: no `node:` imports, no `better-sqlite3`, no secrets, no `process.env` reads. It carries types, zod schemas, the money helpers and the constants only.

---

## 2. SQLite schema

File: `apps/api/src/db/schema.sql`. Loaded by `better-sqlite3` (fallback: `node:sqlite`) on every API boot with `PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;`.

```sql
-- TAPat schema. Amounts: integer stroops. Times: unix ms unless the column ends in _at_s.

CREATE TABLE program (
  id                     TEXT    PRIMARY KEY,
  name                   TEXT    NOT NULL,
  salt                   TEXT    NOT NULL,              -- 32 hex chars, 16 random bytes; server-only
  status                 TEXT    NOT NULL CHECK (status IN ('draft','active','ending','ended')),
  per_tap_cap_stroops    INTEGER NOT NULL DEFAULT 500000000,
  tranche_stroops        INTEGER NOT NULL DEFAULT 1500000000,
  expires_at_s           INTEGER NOT NULL,              -- 1796054399 = 2026-11-30T23:59:59+08:00
  price_threshold_php    REAL    NOT NULL DEFAULT 65.00,
  alpha                  REAL    NOT NULL DEFAULT 0.05,
  beta                   REAL    NOT NULL DEFAULT 0.02,
  budget_verified_stroops INTEGER NOT NULL DEFAULT 0,
  budget_funded_stroops  INTEGER NOT NULL DEFAULT 0,
  tranche_fired          INTEGER NOT NULL DEFAULT 0,     -- 0/1
  created_at             INTEGER NOT NULL
);

CREATE TABLE beneficiaries (
  id               TEXT    PRIMARY KEY,
  program_id       TEXT    NOT NULL REFERENCES program(id),
  last_name        TEXT    NOT NULL,
  first_name       TEXT    NOT NULL,
  middle_name      TEXT,
  suffix           TEXT,
  birthdate        TEXT    NOT NULL,                     -- 'YYYY-MM-DD'
  plate            TEXT    NOT NULL,                     -- as printed on the OR/CR (normalized for compare, not for display)
  toda             TEXT    NOT NULL,
  barangay         TEXT    NOT NULL,
  source           TEXT    NOT NULL CHECK (source IN ('ocr_precomputed','csv')),
  score            REAL,                                 -- genuineness score s_i in [0,1]
  status           TEXT    NOT NULL CHECK (status IN ('approved','rejected','uncertain','evidence_requested','enrolled')),
  rule_code        TEXT,                                 -- UNDERAGE | PLATE_MULTI_NAME | DUPLICATE_PLATE
  decision_reason  TEXT,
  link_code        TEXT    UNIQUE,                       -- 8 chars, Telegram deep-link token
  telegram_chat_id TEXT,
  created_at       INTEGER NOT NULL
);

CREATE TABLE cards (
  id                  TEXT    PRIMARY KEY,
  beneficiary_id      TEXT    NOT NULL REFERENCES beneficiaries(id),
  device_hash         TEXT    NOT NULL UNIQUE,           -- 64 hex chars, SHA-256
  uid_last4           TEXT    NOT NULL,                  -- last 4 chars of the normalized UID, for humans
  virtual             INTEGER NOT NULL DEFAULT 0,        -- 0/1
  agent_public        TEXT    NOT NULL,                  -- card agent G-address
  agent_secret_enc    TEXT    NOT NULL,                  -- AES-256-GCM ciphertext, never serialized
  max_amount_stroops  INTEGER NOT NULL,
  expires_at_s        INTEGER NOT NULL,
  last_nonce          INTEGER NOT NULL DEFAULT 0,         -- u64; strictly increasing per (device, agent)
  status              TEXT    NOT NULL CHECK (status IN ('pending','active','failed','revoked','swept')),
  returned_stroops    INTEGER NOT NULL DEFAULT 0,         -- amount swept back to the Program Wallet
  error               TEXT,
  created_at          INTEGER NOT NULL
);

CREATE TABLE stations (
  id            TEXT PRIMARY KEY,                        -- 'A' | 'B'
  name          TEXT NOT NULL,                           -- 'Petron San Roque' | 'Rotonda Fuels'
  public_key    TEXT NOT NULL,
  secret_enc    TEXT NOT NULL,                           -- never serialized
  status        TEXT NOT NULL CHECK (status IN ('active','frozen')),
  frozen_reason TEXT,
  frozen_at     INTEGER
);

CREATE TABLE chain_txs (
  id              TEXT    PRIMARY KEY,
  kind            TEXT    NOT NULL,                      -- register|register_agent|fund|authorize|claim|revoke_agent|sweep|revoke_device
  contract_id     TEXT    NOT NULL,
  method          TEXT    NOT NULL,
  source_public   TEXT    NOT NULL,
  status          TEXT    NOT NULL CHECK (status IN ('pending','succeeded','failed','submission_unknown')),
  gas_mode        TEXT    NOT NULL CHECK (gas_mode IN ('velo','direct')),
  velo_request_id TEXT,
  inner_hash      TEXT,                                  -- inner tx hash (what the signer signed)
  outer_hash      TEXT,                                  -- fee-bump hash when Gas Station submitted it
  error_code      TEXT,                                  -- 'ContractRejection:3' | 'VeloRateLimitError' | ...
  error           TEXT,                                  -- full message, for the logs and the UI tooltip
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE taps (
  id             TEXT    PRIMARY KEY,
  card_id        TEXT    REFERENCES cards(id),           -- NULL when the tap was refused before a card was resolved
  card_ref       TEXT,                                   -- virtual card id from a fixture (burst/honest edges, e.g. 'virtual01'); NULL for real cards
  station_id     TEXT    NOT NULL REFERENCES stations(id),
  amount_stroops INTEGER NOT NULL,
  nonce          INTEGER,
  status         TEXT    NOT NULL CHECK (status IN ('authorized','rejected','refused','failed')),
  reason_code    TEXT,                                   -- EXPIRED|OVER_CAP|POLICY_DENIED|INSUFFICIENT_ESCROW|STATION_FROZEN|CARD_NOT_ENROLLED|SIMULATED_EDGE
  chain_tx_id    TEXT    REFERENCES chain_txs(id),
  simulated      INTEGER NOT NULL DEFAULT 0,
  midas_score    REAL,
  tick           INTEGER,                                -- freeze-sim clock tick the edge was scored on
  created_at     INTEGER NOT NULL
);

CREATE TABLE agent_decisions (
  id           TEXT PRIMARY KEY,
  agent        TEXT NOT NULL CHECK (agent IN ('intake','tranche','freeze','settlement','sweep')),
  decision     TEXT NOT NULL,                            -- vocabulary in §2.2
  inputs_json  TEXT NOT NULL,                            -- JSON object, numbers only
  outputs_json TEXT NOT NULL,                            -- JSON object
  tx_ids_json  TEXT NOT NULL DEFAULT '[]',               -- JSON array of chain_txs.id
  created_at   INTEGER NOT NULL
);

CREATE TABLE velo_intents (
  id             TEXT PRIMARY KEY,                       -- Velo paymentIntentId
  purpose        TEXT NOT NULL,                          -- 'budget'
  amount         TEXT NOT NULL,                          -- XLM decimal string, always 2 decimals ('1000.00')
  asset          TEXT NOT NULL,                          -- 'XLM'
  status         TEXT NOT NULL,                          -- 'created'|'paid'|'failed'
  checkout_url   TEXT,
  tx_hash        TEXT,
  payer_address  TEXT,
  created_at     INTEGER NOT NULL,
  paid_at        INTEGER
);

CREATE TABLE webhook_deliveries (
  delivery_id  TEXT PRIMARY KEY,                         -- x-velo-delivery
  type         TEXT NOT NULL,                            -- payment.succeeded|payment.failed|payment.created|contract.event|...
  received_at  INTEGER NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE TABLE price_points (
  program_id TEXT    NOT NULL REFERENCES program(id),
  idx        INTEGER NOT NULL,                            -- 1-based index into the fixture
  price_php  REAL    NOT NULL,
  simulated  INTEGER NOT NULL DEFAULT 1,
  cp_recent  REAL,                                        -- BOCPD P(r_t < 10)
  map_r      INTEGER,                                     -- BOCPD MAP run length
  PRIMARY KEY (program_id, idx)
);

CREATE INDEX idx_beneficiaries_program_status ON beneficiaries(program_id, status);
CREATE INDEX idx_cards_beneficiary            ON cards(beneficiary_id);
CREATE INDEX idx_taps_station_created         ON taps(station_id, created_at);
CREATE INDEX idx_taps_created                 ON taps(created_at);
CREATE INDEX idx_chain_txs_status             ON chain_txs(status);
CREATE INDEX idx_agent_decisions_created      ON agent_decisions(agent, created_at);
```

### 2.1 Schema notes

- `program.salt` is 16 random bytes hex, created by `POST /api/program`. It never appears in any response. `device_hash = SHA-256(utf8("${salt}:${UID}"))` where `UID` is the Web NFC `serialNumber` with colons removed, uppercased ([SDD §3](system-design.md)).
- `cards.device_hash` is `UNIQUE` per program because the program has a single salt; a re-seeded program has a new salt, so the same physical card re-enrolls without an on-chain `AlreadyRegistered`.
- `cards.last_nonce` is persisted **before** `authorize` is submitted. A failed submit keeps the value: `nonce = max(Date.now(), last_nonce + 1)` remains strictly increasing.
- `taps.status` vocabulary: `authorized` (contract accepted), `rejected` (contract refused with `Error #3` or `#2`), `refused` (our API refused before signing: frozen station, unknown card), `failed` (submit/chain failure, no decision).
- `rejected` and `refused` taps write **no** `chain_txs` row and keep `chain_tx_id = NULL`: the rejection is detected during `prepareTransaction` simulation, so nothing was submitted and no hash exists. Only `authorized` and `failed` taps can point at a `chain_txs` row.
- `chain_txs.status = 'submission_unknown'` rows are reconciled to `succeeded` or `failed` by the background reconciler (SDD §3). They are never resubmitted.
- `velo_intents.amount` is a string so `1000.00` stays exact. SQLite `REAL` would lose the trailing digits Velo compares.
- One `program` row exists at a time in the demo build. `reset-demo.ts` deletes every row, then `seed-demo.ts` inserts one.
- Seeded fixed values: program `per_tap_cap_stroops = 500000000` (₱500), `tranche_stroops = 1500000000` (₱1,500), `expires_at_s = 1796054399`, `price_threshold_php = 65.0`, `alpha = 0.05`, `beta = 0.02`. Stations `A` = `Petron San Roque`, `B` = `Rotonda Fuels`.

### 2.2 Decision vocabulary (`agent_decisions.decision`)

| agent | decision values | meaning |
|---|---|---|
| `intake` | `APPROVED`, `REJECTED`, `UNCERTAIN`, `EVIDENCE_REQUESTED`, `EVIDENCE_VERIFIED`, `EVIDENCE_UNMATCHED` | one row per beneficiary the intake pipeline or the Telegram evidence flow decided |
| `tranche` | `FUNDED`, `BUDGET_EXHAUSTED` | one row per price-feed fire; per-card detail lives in `outputs_json` (keys in §5.2 #11) |
| `freeze` | `BASELINE_SET`, `FROZEN`, `UNFROZEN` | baseline replay result, the freeze itself (score + rule), and the manual unfreeze |
| `settlement` | `CLAIMED`, `HELD`, `NOTHING_PENDING` | one row per station per settlement run |
| `sweep` | `SWEPT`, `SKIPPED`, `PROGRAM_ENDED` | one row per card per program end, plus a closing row |

`BUDGET_EXHAUSTED` and `HELD` come from the plan. The rest are the minimum extra codes the dashboard needs to render a decision feed; they are all listed in Naming gaps at the bottom of this doc.

---

## 3. Shared TypeScript types (`packages/shared/types.ts`)

These are the exact shapes the API returns and the exact shapes `apps/web/mocks/*.json` must contain. Every field marked `string` for money is a stroop decimal string; `number` is safe for all money-free fields.

```ts
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
  midasThreshold: number;       // from apps/api/config/midas.json; the freeze line on the edge chart
  fundedStroops: Stroops;       // = program.budget_funded_stroops (chain_txs has no amount column)
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
```

`GET /api/health` is the only endpoint that returns `HealthResponse` directly (no envelope). `GET /api/beneficiaries` and `GET /api/stations` return arrays directly. Everything else returns one of the envelopes above.

---

## 4. Fixtures

All fixtures are committed files; no model is bundled in the demo build.

| Path | Produced by | Consumed by |
|---|---|---|
| `fixtures/masterlist/scanned-list.png` | BegB: print `masterlist.csv` as a table, hand-write 2 corrections on it, photograph | `POST /api/intake/upload` (image branch) |
| `fixtures/masterlist/scanned-list.ocr.json` | BegB: `{ "sha256": "<hex of the png>", "rows": [...] }` mirroring the CSV plus the 2 handwritten corrections | `POST /api/intake/upload` looks up `sha256` |
| `fixtures/masterlist/masterlist.csv` | hand-authored seed list; header `last_name,first_name,middle_name,suffix,birthdate,plate,toda,barangay` | `POST /api/intake/upload` (csv branch), `seed-demo.ts` |
| `fixtures/calibration/labeled.json` | `gen-calibration.ts` seed 42 (320 genuine, 60 duplicate ghosts, 20 hard negatives) | CRC calibration at API boot, `GET /api/intake/calibration`, `test-plan.md` unit vectors |
| `fixtures/prices/doe-diesel-sim.json` | `gen-prices.ts` seed 3 (45 daily points) | Tranche Agent price stream |
| `fixtures/taps/honest-history.json` | `gen-taps.ts` seed 7 (60 honest ticks) | Freeze Agent baseline replay on program start |
| `fixtures/taps/burst.json` | `gen-taps.ts` (20 virtual cards → Station B over 3 ticks = 30 edges) | `POST /api/agents/freeze/burst` |
| `fixtures/enroll/d4-photo.jpg` + `.json` | BegB photo; `.json` = `{ "plate": "...", "toda": "..." }` precomputed | `POST /api/enroll` `samplePhoto=d4-photo.jpg` |
| `fixtures/orcr/<plate>.jpg` + `.json` | BegB photo; `.json` = `{ "plate": "...", "sha256": "..." }` | Telegram evidence matching |

**Masterlist rule (from the plan, non-negotiable):** the masterlist is **12 rows = 8 genuine (including D1–D5) + 1 ghost + 1 underage + 2 uncertain**, and after calibration it must produce exactly that outcome (1 ghost rejected, 1 underage rejected, 2 uncertain). Because the demo uploads it after the seed, `IntakeResponse.summary` reads `{ total: 12, approved: 4, rejected: 2, uncertain: 2, enrolled: 4 }` — the 8 genuine rows are 4 approved + 4 already enrolled, and the officer-visible count is never "8 approved". If the rows do not produce these counts, edit the fixture rows. Never change `alpha`, `beta`, or the matcher weights to make the demo look right.

Fixture JSON shapes:

```jsonc
// fixtures/masterlist/scanned-list.ocr.json
{ "sha256": "<sha256 of scanned-list.png>", "rows": [ { "last_name": "Dela Cruz", "first_name": "Juan", "middle_name": "Santos", "suffix": null, "birthdate": "1980-03-02", "plate": "ABC 1234", "toda": "San Roque TODA", "barangay": "San Roque" } ] }

// fixtures/prices/doe-diesel-sim.json
{ "source": "simulated", "currency": "PHP", "unit": "L", "seed": 3, "points": [ { "idx": 1, "price_php": 58.81 }, /* ...45 total... */ ] }

// fixtures/taps/honest-history.json
{ "source": "simulated", "seed": 7, "tick_ms": 1000, "ticks": [ { "tick": 1, "card_ref": "virtual01", "station_id": "A", "amount_php": 120 } ] }

// fixtures/taps/burst.json
{ "source": "simulated", "edges": [ { "tick_offset": 1, "card_ref": "virtual01", "station_id": "B", "amount_php": 480 } ] }
```

---

## 5. REST API

Base path `/api`. Server: Fastify 5 on `PORT` (4000), listening on `127.0.0.1` only (never a LAN interface). Locally the browser reaches it through the Next.js rewrite `/api/:path*` → `${API_ORIGIN}/api/:path*`; in prod Caddy routes `/api/*` directly to Fastify, so the rewrite is not on the request path. The browser never calls Fastify directly except the laptop's SSE fallback.

### 5.1 Endpoint index

| # | Method | Path | Purpose | Owner doc |
|---|---|---|---|---|
| 1 | GET | `/api/health` | liveness of RPC, Velo, Telegram + gas mode | runbook T-60 |
| 2 | GET | `/api/program` | current program + demo rate, or `null` | — |
| 3 | POST | `/api/program` | create program (demo defaults, fresh salt) | seed-demo |
| 4 | POST | `/api/program/budget-checkout` | create the Velo budget checkout session | PRD F3 |
| 5 | POST | `/api/program/end` | revoke + sweep every card | PRD F6 |
| 6 | POST | `/api/intake/upload` | masterlist in, decisions out | PRD F1 |
| 7 | GET | `/api/intake/calibration` | λ_lo, λ_hi, empirical rates | algorithms §CRC |
| 8 | GET | `/api/beneficiaries` | list with scores/status | PRD F1 |
| 9 | POST | `/api/beneficiaries/:id/request-evidence` | Telegram evidence request / appeal | PRD F1 |
| 10 | POST | `/api/enroll` | card + agent + on-chain policy | PRD F2 |
| 11 | POST | `/api/agents/tranche/start` | play the simulated price feed | PRD F3 |
| 12 | GET | `/api/agents/tranche/state` | feed progress and funding outcome | PRD F3 |
| 13 | POST | `/api/taps` | one tap (real NFC UID or simulated) | PRD F4 |
| 14 | POST | `/api/agents/freeze/burst` | replay the anomaly burst | PRD F5 |
| 15 | POST | `/api/stations/:id/unfreeze` | LGU unfreezes; next settlement claims | PRD F5 |
| 16 | GET | `/api/stations` | stations + pending balances | PRD F4/F5 |
| 17 | POST | `/api/settlement/run` | claim per station, held if frozen | PRD F5 |
| 18 | GET | `/api/dashboard` | all numbers + invariant + feeds | PRD F6 |
| 19 | GET | `/api/export/coa.csv` | COA audit export | PRD F6 |
| 20 | GET | `/api/stream` | SSE: every state change | all |
| 21 | POST | `/api/webhooks/velo` | Velo webhook receiver | PRD F3 |

### 5.2 Endpoint reference

#### 1. `GET /api/health`

No request. Response 200:

```json
{ "ok": true, "rpc": "ok", "velo": "ok", "telegram": "ok", "gasMode": "velo" }
```

- `rpc`: `GET STELLAR_RPC_URL/health` (1 s timeout). `velo`: a `paymentIntents.retrieve` of a stored intent, or `gas.getStatus` on the last request, whichever is cheaper; `'down'` if the call throws. `telegram`: `getMe` result cached 30 s.
- `ok` is `true` when `rpc === 'ok'`; Velo and Telegram being down is degraded, not fatal.
- Errors: `500 INTERNAL`.

#### 2. `GET /api/program`

No request. Response 200: `{ "program": Program | null, "phpPerXlm": 10 }`. `phpPerXlm` is returned even when there is no program, so `/station/[id]` can format amounts before seeding.

```json
{ "program": null, "phpPerXlm": 10 }
```

Every page renders "No active program — run `seed-demo.ts`" when `program === null`. Errors: `500 INTERNAL`.

#### 3. `POST /api/program`

Request body (all optional; omitted fields take the demo defaults):

```json
{ "name": "TODA Fuel Aid — San Roque", "perTapCapPhp": 500, "tranchePhp": 1500, "expiresAt": "2026-11-30T23:59:59+08:00", "priceThresholdPhp": 65.0, "alpha": 0.05, "beta": 0.02 }
```

Response 201: `{ "program": Program }` (the server generates `id` (`prog_` + 8 chars) and `salt` (16 random bytes hex). `status` starts `'draft'`.)

- The endpoint recomputes the CRC thresholds from `fixtures/calibration/labeled.json` and caches them in-process.
- Errors: `400 VALIDATION_ERROR` (bad `expiresAt`, `alpha` not in (0,1), PHP amount not 2 decimals), `409 INVALID_STATE` (a program already exists).

#### 4. `POST /api/program/budget-checkout`

Request body:

```json
{ "amountPhp": 10000 }
```

Response 201: `{ "checkoutUrl": "https://pay.velo-build.dev/...", "paymentIntentId": "pi_..." }`

Steps: `amount = stroopsToXlmString(phpToStroops(amountPhp))` → `velo.checkout.sessions.create({ amount, asset: "XLM", description: "TAPat fuel program budget", successUrl: `${PUBLIC_BASE_URL}/?budget=success`, cancelUrl: `${PUBLIC_BASE_URL}/?budget=cancel` }, { idempotencyKey: `budget:${programId}:${seq}` })` → insert `velo_intents` (`purpose='budget'`, `status='created'`). `seq` is `count(velo_intents where purpose='budget') + 1`.

- `amountPhp` must be a whole peso amount with 2 decimals; `10000` → `"1000.00"` XLM.
- If Velo rejects `asset:"XLM"`, use `asset:"native"` (Velo passes both through as-is). This is the only allowed fallback.
- Errors: `400 VALIDATION_ERROR`, `404 NOT_FOUND` (no program), `409 INVALID_STATE` (program `ending`/`ended`), `502 CHAIN_ERROR` (`code:'VELO_CALL_FAILED'` in `message` when the SDK throws).

#### 5. `POST /api/program/end`

No request body. Response 200:

```json
{
  "program": { "id": "prog_a1b2c3d4", "name": "TODA Fuel Aid — San Roque", "status": "ended", "perTapCapStroops": "500000000", "trancheStroops": "1500000000", "expiresAtS": 1796054399, "priceThresholdPhp": 65, "alpha": 0.05, "beta": 0.02, "budgetVerifiedStroops": "10000000000", "budgetFundedStroops": "4500000000", "trancheFired": true, "createdAt": 1793808000000 },
  "cards": [
    { "cardId": "card_D1", "beneficiaryId": "ben_D1", "returnedStroops": "1150000000", "revokeTxId": "ctx_r1", "sweepTxId": "ctx_w1", "status": "swept", "reason": null },
    { "cardId": "card_D2", "beneficiaryId": "ben_D2", "returnedStroops": "540000000", "revokeTxId": "ctx_r2", "sweepTxId": "ctx_w2", "status": "swept", "reason": null },
    { "cardId": "card_D3", "beneficiaryId": "ben_D3", "returnedStroops": "0", "revokeTxId": null, "sweepTxId": null, "status": "swept", "reason": "EMPTY_ESCROW" },
    { "cardId": "card_D4", "beneficiaryId": "ben_D4", "returnedStroops": "0", "revokeTxId": "ctx_r4", "sweepTxId": null, "status": "swept", "reason": "EMPTY_ESCROW" },
    { "cardId": "card_D5", "beneficiaryId": "ben_D5", "returnedStroops": "1500000000", "revokeTxId": "ctx_r5", "sweepTxId": "ctx_w5", "status": "swept", "reason": null }
  ],
  "totalReturnedStroops": "3190000000"
}
```

D3 is the zero-balance case: its policy already expired, so no `revoke_agent`, no sweep, `returnedStroops = 0`. `totalReturnedStroops` = 1,150 + 540 + 0 + 1,500 = ₱3,190.

Steps (sequential, per card in enrollment order): program → `ending`; for each card with `status='active'`:

1. Read `bal = payment_escrow.balance_of(device_hash)`.
2. If `bal == 0` (e.g. D3, never funded): **skip `sweep_on_revoke`** (Noir would return `0` and transfer nothing; skipping saves a sponsored tx), still `revoke_agent` when the policy is active, then card `swept` with `returned_stroops=0`, no sweep tx, `decision='SKIPPED'` with `outputs_json.reason='EMPTY_ESCROW'`.
3. Else: `revoke_agent` when the policy is active (`expires_at_s >= now`, i.e. not yet expired); then `sweep_on_revoke` (Program Wallet) → card `swept`, `returned_stroops` = swept amount, `decision='SWEPT'`.
4. A card already `failed` or `swept`/`revoked` is skipped.

Program → `ended`. `device_registry.revoke` is **not** called here (`reset-demo.ts` does that).

- This is not idempotent by request id, but it is safe to re-call: cards already `swept`/`revoked` are skipped.
- Errors: `404 NOT_FOUND`, `409 INVALID_STATE` (`status='draft'`), `502 CHAIN_ERROR` (a sweep failed; the response is still 200 with that card's `reason` and `status` unchanged — a hard failure only when `program` cannot be updated).

#### 6. `POST /api/intake/upload`

`multipart/form-data`, exactly one file field named `file`. Accepted: `image/png`, `image/jpeg` (≤ 5 MB), `text/csv` (≤ 1 MB).

CSV columns (header required, this order): `last_name,first_name,middle_name,suffix,birthdate,plate,toda,barangay`. `birthdate` = `YYYY-MM-DD`; `middle_name`/`suffix` may be empty.

Response 200: `IntakeResponse`.

```json
{
  "rows": [
    { "id": "ben_01", "programId": "prog_a1b2c3d4", "lastName": "Dela Cruz", "firstName": "Juan", "middleName": "Santos", "suffix": null, "birthdate": "1980-03-02", "plate": "ABC 1234", "toda": "San Roque TODA", "barangay": "San Roque", "source": "ocr_precomputed", "score": 1.0, "status": "approved", "ruleCode": null, "decisionReason": "genuine", "linkCode": "k7m2x9qp", "telegramLinked": false, "telegramDeepLink": "https://t.me/tapat_demo_bot?start=k7m2x9qp", "createdAt": 1793808000123 }
  ],
  "summary": { "total": 12, "approved": 4, "rejected": 2, "uncertain": 2, "enrolled": 4 },
  "calibration": { "alpha": 0.05, "beta": 0.02, "lambdaLo": 0.62, "lambdaHi": 0.81, "n": 400, "wrongfulDenialRate": 0.041, "ghostAdmissionRate": 0.013, "feasible": true }
}
```

Image branch: SHA-256 the bytes; compare to `scanned-list.ocr.json.sha256`; on match ingest its `rows` with `source='ocr_precomputed'`. On mismatch → `422 OCR_UNAVAILABLE`, message: `"OCR model not bundled in demo build; upload CSV"`. CSV branch: ingest with `source='csv'`.

After ingest: hard rules → matcher → CRC (see [algorithms.md](algorithms.md)); each row gets `status` and one `agent_decisions` row; every `uncertain`/`evidence_requested` beneficiary with a linked chat gets the Telegram evidence request.

The fixture masterlist is **12 rows = 8 genuine (including D1–D5) + 1 ghost + 1 underage + 2 uncertain**. The demo uploads it *after* the seed, when D1, D2, D3 and D5 are already `enrolled`; those four rows keep `status='enrolled'` (they are genuine, and the card must not be orphaned), so the officer-visible counts are `approved 4 + enrolled 4` — the 8 genuine rows, never "8 approved". `summary` buckets are disjoint and always sum to `total`: the example above is `4 + 2 + 2 + 4 = 12`. After D4 enrolls live, the same program reads `approved 3, enrolled 5` (§5.2 #18).

- Re-uploading for the same program deletes prior non-enrolled rows first (enrolled beneficiaries are untouched, so a demo re-run never orphans a card).
- Errors: `400 VALIDATION_ERROR` (missing field, bad MIME, bad CSV header), `404 NOT_FOUND` (no program), `422 OCR_UNAVAILABLE`.

#### 7. `GET /api/intake/calibration`

No request. Response 200: `CalibrationResponse` — λ_lo, λ_hi, α, β, calibration size `n`, and the two empirical rates measured on the calibration fixture. Computed once at boot from `fixtures/calibration/labeled.json`.

```json
{ "alpha": 0.05, "beta": 0.02, "lambdaLo": 0.62, "lambdaHi": 0.81, "n": 400, "wrongfulDenialRate": 0.041, "ghostAdmissionRate": 0.013, "feasible": true }
```

Errors: `500 INTERNAL`.

#### 8. `GET /api/beneficiaries`

Query: `?status=<BeneficiaryStatus>` (optional, repeatable: `?status=uncertain&status=evidence_requested`), `?limit=` (default 200, max 500). Response 200: `Beneficiary[]`, newest first.

```json
[
  { "id": "ben_D1", "programId": "prog_a1b2c3d4", "lastName": "Dela Cruz", "firstName": "Juan", "middleName": "Santos", "suffix": null, "birthdate": "1980-03-02", "plate": "ABC 1234", "toda": "San Roque TODA", "barangay": "San Roque", "source": "ocr_precomputed", "score": 1, "status": "enrolled", "ruleCode": null, "decisionReason": "genuine", "linkCode": "k7m2x9qp", "telegramLinked": true, "telegramDeepLink": "https://t.me/tapat_demo_bot?start=k7m2x9qp", "createdAt": 1793808000123 },
  { "id": "ben_07", "programId": "prog_a1b2c3d4", "lastName": "Santos", "firstName": "Maria Teresa", "middleName": "C", "suffix": null, "birthdate": "1979-07-19", "plate": "XYZ 7788", "toda": "Rotonda TODA", "barangay": "Rotonda", "source": "ocr_precomputed", "score": 0.71, "status": "uncertain", "ruleCode": null, "decisionReason": "score 0.71 inside [0.62, 0.81)", "linkCode": "p4wq8zr2", "telegramLinked": false, "telegramDeepLink": "https://t.me/tapat_demo_bot?start=p4wq8zr2", "createdAt": 1793808000124 }
]
```

Errors: `400 VALIDATION_ERROR`, `500 INTERNAL`.

#### 9. `POST /api/beneficiaries/:id/request-evidence`

No body. Sends the evidence request and moves the beneficiary to `evidence_requested`. Allowed from `uncertain` (evidence request) and from `rejected` (the one-tap appeal, including hard-rule rejections such as `UNDERAGE`). `approved`, `enrolled` and `evidence_requested` → `409 INVALID_STATE`. Response 200: `RequestEvidenceResponse`. `deepLink = https://t.me/${TELEGRAM_BOT_USERNAME}?start=${link_code}` (returned even when `telegramSent` is false, so the officer can hand the phone over).

```json
{
  "beneficiary": { "id": "ben_07", "programId": "prog_a1b2c3d4", "lastName": "Santos", "firstName": "Maria Teresa", "middleName": "C", "suffix": null, "birthdate": "1979-07-19", "plate": "XYZ 7788", "toda": "Rotonda TODA", "barangay": "Rotonda", "source": "ocr_precomputed", "score": 0.71, "status": "evidence_requested", "ruleCode": null, "decisionReason": "score 0.71 inside [0.62, 0.81)", "linkCode": "p4wq8zr2", "telegramLinked": true, "telegramDeepLink": "https://t.me/tapat_demo_bot?start=p4wq8zr2", "createdAt": 1793808000124 },
  "telegramSent": true,
  "deepLink": "https://t.me/tapat_demo_bot?start=p4wq8zr2"
}
```

Each call writes an `intake/EVIDENCE_REQUESTED` decision. Errors: `404 NOT_FOUND`, `409 INVALID_STATE` (status `approved`, `enrolled` or `evidence_requested`). A Telegram send failure is **not** an error: the response is still 200 with `telegramSent:false`, so the officer can use the `deepLink` instead.

#### 10. `POST /api/enroll`

`multipart/form-data`. Fields (types matter: multipart is all strings, the server coerces and validates):

| Field | Type | Required | Notes |
|---|---|---|---|
| `beneficiaryId` | string | yes | must be `approved` |
| `uid` | string | yes | the **normalized** UID from **Read card** / `readUid()` (`04A21F9CA1B2`) or a virtual UID; the server re-normalizes idempotently (colons removed, uppercased), then requires `^[0-9A-Z]{4,32}$` — alphanumeric so virtual UIDs like `TAPATVIRTUAL05` pass |
| `samplePhoto` | string | one of | the dropdown is hardcoded to `d4-photo.jpg` (the only committed sample); precomputed `{plate,toda}` |
| `photo` | file (`image/jpeg`,`image/png`) | one of | an officer's live photo; no model runs |
| `officerConfirmed` | `"true"` \| `"false"` | with `photo` | must be `"true"` when `photo` is used |

Response 201: `EnrollResponse`.

```json
{
  "card": { "id": "card_9f31", "beneficiaryId": "ben_04", "uidLast4": "A1B2", "virtual": false, "agentPublic": "G...", "maxAmountStroops": "500000000", "expiresAtS": 1796054399, "lastNonce": "0", "status": "active", "returnedStroops": "0", "error": null, "createdAt": 1793808123456 },
  "beneficiary": { "id": "ben_04", "programId": "prog_a1b2c3d4", "lastName": "Villanueva", "firstName": "Ana", "middleName": "Reyes", "suffix": null, "birthdate": "1991-11-04", "plate": "ABC 1234", "toda": "San Roque TODA", "barangay": "San Roque", "source": "ocr_precomputed", "score": 0.97, "status": "enrolled", "ruleCode": null, "decisionReason": "genuine", "linkCode": "t9x2m4qd", "telegramLinked": false, "telegramDeepLink": "https://t.me/tapat_demo_bot?start=t9x2m4qd", "createdAt": 1793808000125 },
  "deviceHashPrefix": "3f9c1a0b",
  "photoCheck": { "source": "precomputed", "plate": "ABC 1234", "toda": "San Roque TODA", "matched": true },
  "chainTxIds": ["ctx_reg_04", "ctx_pol_04"]
}
```

Steps: photo check (`samplePhoto` → the fixture's `{plate,toda}` must equal the record, plates compared normalized: uppercase, spaces/dashes removed, else `422 PHOTO_MISMATCH`; `photo` → requires `officerConfirmed=true`, and `photoCheck.source = 'officer_confirmed'` with `plate`/`toda` `null`) → generate card agent keypair + friendbot → `device_registry.register` → `agent_registry.register_agent(max_amount = per_tap_cap_stroops, asset = XLM_SAC_ID, expires_at = program.expires_at_s)` → card `active`, beneficiary `enrolled`, SSE `enroll`.

- Duplicate: the UID already has a non-`failed` card in this program → `409 CARD_ALREADY_ENROLLED`.
- **Chain failure and retry**: the card row is `status='failed'` with `error` stored. Retrying `POST /api/enroll` with the same `uid` **reuses that same card row and the same agent keypair** and resumes from the failed step: read `device_registry.get_owner(device_hash)`; if it already returns the Program Wallet, `register` succeeded, so skip to `register_agent`. A second card row is never created (`cards.device_hash` is `UNIQUE`); the audit trail is `chain_txs`.
- Errors: `400 VALIDATION_ERROR` (bad fields, or a `uid` failing `^[0-9A-Z]{4,32}$` after normalization), `404 NOT_FOUND` (beneficiary or program), `409 CARD_ALREADY_ENROLLED`, `409 INVALID_STATE` (beneficiary not `approved`), `422 PHOTO_MISMATCH` (sample-photo plate or TODA ≠ the record; `message` names the field), `422 PHOTO_CONFIRMATION_REQUIRED` (uploaded photo without confirmation), `502 CHAIN_ERROR`.

#### 11. `POST /api/agents/tranche/start`

No body. Response 202: `{ "started": true, "points": 45, "tickMs": 700 }`. Resets the stream, deletes prior `price_points` for the program, replays `fixtures/prices/doe-diesel-sim.json` one point per `PRICE_TICK_MS`, and fires at most once per program (`tranche_fired`).

- A second call while running → `409 INVALID_STATE` (`"tranche already running"`). After it fired → `409 INVALID_STATE` (`"tranche already fired"`). With `budget_verified_stroops = 0` → `409 INVALID_STATE` (`"no verified budget"`).
- Eligibility: cards `active` with `expires_at_s > now`, in enrollment order. `amount = min(tranche_stroops, budget_verified - budget_funded)`. On `remaining < tranche` → decision `BUDGET_EXHAUSTED`, no further funding.
- The single `tranche` decision row carries `inputs_json = { pricePhp, segmentMeanPhp, thresholdPhp, cpRecent, mapR, budgetBeforeStroops }` and `outputs_json = { budgetAfterStroops, funded: [{ cardId, deviceHashPrefix, amountStroops, chainTxId }], skipped: [{ cardId, reason }] }`; `tx_ids_json` = the funding tx ids in order.
- Errors: `404 NOT_FOUND`, `409 INVALID_STATE`, `502 CHAIN_ERROR` (a `fund_escrow` failed; the run continues with the next card and the failure appears in `outputs.funded` with that card's `chainTxId`).

#### 12. `GET /api/agents/tranche/state`

No request. Response 200: `TrancheState`. Polled by `/demo` until `running === false`; `points` lets `/demo` redraw the chart after a reload.

```json
{
  "running": false, "fired": true, "idx": 45, "total": 45, "lastPricePhp": 70.91, "cpRecent": 0.94, "mapR": 5, "thresholdPhp": 65,
  "budgetVerifiedStroops": "10000000000", "budgetFundedStroops": "4500000000",
  "points": [
    { "programId": "prog_a1b2c3d4", "idx": 1, "pricePhp": 58.81, "simulated": true, "cpRecent": 0.02, "mapR": 0 },
    { "programId": "prog_a1b2c3d4", "idx": 45, "pricePhp": 70.91, "simulated": true, "cpRecent": 0.94, "mapR": 5 }
  ],
  "funds": [
    { "cardId": "card_D1", "beneficiaryId": "ben_D1", "amountStroops": "1500000000", "txId": "ctx_f1", "status": "succeeded", "reason": null },
    { "cardId": "card_D2", "beneficiaryId": "ben_D2", "amountStroops": "1500000000", "txId": "ctx_f2", "status": "succeeded", "reason": null },
    { "cardId": "card_D3", "beneficiaryId": "ben_D3", "amountStroops": "0", "txId": null, "status": "skipped", "reason": "EXPIRED" },
    { "cardId": "card_D5", "beneficiaryId": "ben_D5", "amountStroops": "1500000000", "txId": "ctx_f3", "status": "succeeded", "reason": null }
  ]
}
```

(`points` is truncated to 2 of 45 here.) Errors: `404 NOT_FOUND`, `500 INTERNAL`.

#### 13. `POST /api/taps`

Two accepted bodies, discriminated by `simulated`:

```json
{ "stationId": "A", "amountPhp": 350, "uid": "04A21F9CA1B2" }
```

```json
{ "stationId": "B", "amountPhp": 480, "cardId": "card_D2", "simulated": true }
```

`stationId`: `A` | `B`. `amountPhp`: number with ≤ 2 decimals. `uid`: the card UID — pages post the **normalized** value from **Read card** (`readUid()`: colons removed, uppercased); the server re-normalizes idempotently and requires `^[0-9A-Z]{4,32}$` after that, else `400 VALIDATION_ERROR`. `cardId`: required when `simulated` is true.

Response 200 (yes, 200 even for a declined tap — the decline is a business outcome the UI must render, and the row must reach the activity feed):

```json
{
  "tap": { "id": "tap_7c1e", "cardId": "card_D1", "cardRef": null, "stationId": "A", "amountStroops": "350000000", "nonce": "1793808200000", "status": "authorized", "reasonCode": null, "chainTxId": "ctx_7c1e", "simulated": false, "midasScore": 0.12, "tick": 61, "createdAt": 1793808201234 },
  "balanceStroops": "1150000000",
  "message": "Paid ₱350.00 at Petron San Roque — escrow balance ₱1,150.00."
}
```

A declined tap returns the same envelope with `status:'rejected'`, its `reasonCode`, `balanceStroops:null` and a `message` sentence the station page renders verbatim:

```json
{
  "tap": { "id": "tap_8001", "cardId": "card_D1", "cardRef": null, "stationId": "A", "amountStroops": "800000000", "nonce": "1793808201000", "status": "rejected", "reasonCode": "OVER_CAP", "chainTxId": null, "simulated": false, "midasScore": 0.14, "tick": 63, "createdAt": 1793808201123 },
  "balanceStroops": null,
  "message": "Declined: ₱800.00 is over the ₱500.00 per-tap cap — rejected by the Noir contract (Soroban simulation of `authorize` returned Error #3); no tx submitted."
}
```

Order of operations (must not be reordered):

1. Station unknown → `404 NOT_FOUND`. Station `frozen` → record a `refused` tap (`reason_code='STATION_FROZEN'`, `card_id=NULL`, no nonce, no `chain_txs` row) and return `423 STATION_FROZEN` with **no** chain call and **no** card lookup.
2. Resolve `device_hash` from `uid` (or use `cardId`); no card / card not `active` → record a `refused` tap (`reason_code='CARD_NOT_ENROLLED'`, `card_id=NULL`, no `chain_txs` row) and return `404 CARD_NOT_ENROLLED`.
3. `nonce = max(Date.now(), cards.last_nonce + 1)`; persist it; then `payment_escrow.authorize(agent, device_hash, merchant=station, asset=XLM_SAC, amount, nonce)`.
4. On `ContractRejection`, map by the contract code — the exact closed mapping:

   | `payment_escrow` code | outcome |
   |---|---|
   | `3` `AgentNotAuthorized` | read `agent_registry.get_policy(device_hash)`: `now > expires_at` (strict, as Noir's `is_expired`) → `rejected` / `EXPIRED`; `amount > max_amount` → `rejected` / `OVER_CAP`; else `rejected` / `POLICY_DENIED`. Response 200 |
   | `2` `InsufficientBalance` | `rejected` / `INSUFFICIENT_ESCROW`. Response 200 |
   | any other code (`6` `DuplicateAuth`, `8` `DeviceNotRegistered`, `9` `InvalidAsset`, `10` `InvalidRecipient`, `11` `InvalidAmount`, …) | `failed`, `reasonCode = null`; the contract name + code stay in `chain_txs.error_code` (`"ContractRejection:6"`); response `502 CHAIN_ERROR` |

5. Write the tap row, `agent_decisions` is not written for taps (the tap row is the record), feed the Freeze Agent, SSE `tap`, and send the Telegram receipt/decline when the driver is linked. After the Freeze Agent scores a tap it writes `taps.midas_score`/`taps.tick` and re-emits `tap` with the same `id` (clients upsert by `id`).
6. `502 CHAIN_ERROR` also covers a submit that failed with no contract decision: the tap row is `failed`, `reason_code = null`, and `chain_tx_id` points at the failed tx.

Amount validation: `amountPhp` must be > 0 and ≤ 100000. An over-cap amount is **not** rejected by the API — it must reach the contract so the demo shows the real `Error #3` → `OVER_CAP` mapping.

Errors: `400 VALIDATION_ERROR`, `404 NOT_FOUND`, `404 CARD_NOT_ENROLLED`, `423 STATION_FROZEN`, `502 CHAIN_ERROR`.

#### 14. `POST /api/agents/freeze/burst`

No body. Response 202: `{ "accepted": true, "edges": 30, "tickMs": 100 }`. Replays `fixtures/taps/burst.json` (20 virtual `card_ref`s → Station B, 30 edges, emitted 100 ms apart). Each edge is written directly by the burst service (it does not go through `POST /api/taps`) as a `taps` row with `simulated=1`, `status='refused'`, `reason_code='SIMULATED_EDGE'`, `card_id=NULL`, `chain_tx_id=NULL` — the virtual card refs are synthetic, so no `authorize` is attempted and **no money moves**; only the anomaly pattern is real. Those rows still feed the Freeze Agent's scorer exactly like authorized taps (edge key `card_ref|station_id`).

Freezing happens when MIDAS-F crosses `apps/api/config/midas.json.threshold` or `NEAR_CAP_STREAK`/`VOLUME_SPIKE` fires; the freeze writes a `freeze/FROZEN` decision (`midas_score`, `threshold`, `rule`) and SSE `freeze` (`FreezeEvent`).

- The 2 D2 taps at ₱480 are **not** part of this fixture; they come through `POST /api/taps` before the burst (runbook order). The gate is **at least one `authorized` tap at Station B**, whatever its origin: a tap made with **Read card** or with **Simulate tap** counts, because a Simulate-tap tap is a real on-chain `authorize` (`simulated` only records how the UID was supplied). Until such a tap exists, burst returns `409 INVALID_STATE` with `message: "Tap D2 at Station B first"` (the `/demo` button renders that message verbatim).
- Errors: `404 NOT_FOUND`, `409 INVALID_STATE` (no prior authorized Station-B tap, or already frozen), `500 INTERNAL`.

#### 15. `POST /api/stations/:id/unfreeze`

No body. Response 200: `{ "station": Station }`. Sets `status='active'`, clears `frozen_reason`/`frozen_at`, writes a `freeze/UNFROZEN` decision, SSE `freeze`. Held pending stays in escrow until the next `POST /api/settlement/run`. Errors: `404 NOT_FOUND`, `409 INVALID_STATE` (already active).

#### 16. `GET /api/stations`

No request. Response 200: `Station[]`.

```json
[
  { "id": "A", "name": "Petron San Roque", "publicKey": "G...", "status": "active", "frozenReason": null, "frozenAt": null, "pendingStroops": "0", "spentStroops": "350000000" },
  { "id": "B", "name": "Rotonda Fuels", "publicKey": "G...", "status": "frozen", "frozenReason": "MIDAS 2.31 >= 1.78 (NEAR_CAP_STREAK)", "frozenAt": 1793808400000, "pendingStroops": "960000000", "spentStroops": "0" }
]
```

`spentStroops` is the inverse of the `pendingStroops` query below (`t.created_at <=` the station's `MAX(chain_txs.updated_at)` for a `succeeded` claim), so `spentStroops + pendingStroops` = that station's authorized taps.

`pendingStroops` is derived from our own tables (no new column, no chain read in the hot path):

```sql
SELECT COALESCE(SUM(t.amount_stroops), 0) FROM taps t
WHERE t.station_id = ? AND t.status = 'authorized'
  AND t.created_at > COALESCE((
    SELECT MAX(c.updated_at) FROM chain_txs c
    WHERE c.kind = 'claim' AND c.status = 'succeeded'
      AND c.source_public = (SELECT public_key FROM stations WHERE id = ?)
  ), 0);
```

`updated_at` (not `created_at`) is the claim boundary: it is set when the claim is marked `succeeded`, i.e. after execution, so a tap authorized between submit and execution is counted as claimed rather than pending.

Errors: `500 INTERNAL`.

#### 17. `POST /api/settlement/run`

No body. Response 200: `SettlementResponse`.

```json
{
  "stations": [
    { "stationId": "A", "stationName": "Petron San Roque", "pendingStroops": "0", "action": "nothing_pending", "chainTxId": null, "decisionId": "dec_s1" },
    { "stationId": "B", "stationName": "Rotonda Fuels", "pendingStroops": "960000000", "action": "held", "chainTxId": null, "decisionId": "dec_s2" }
  ]
}
```

Per station, using the same query as #16: `pending == 0` → `NOTHING_PENDING`. `pending > 0` and the station is `frozen` → `HELD` with the amount, **no tx**. `pending > 0` and the station is `active` → `claim(XLM_SAC, station)` signed by the station key → `CLAIMED`. SSE `settlement` per station.

Errors: `404 NOT_FOUND` (no program), `502 CHAIN_ERROR` (a claim failed; other stations still run).

#### 18. `GET /api/dashboard`

No request. Response 200: `Dashboard`. Snapshot after the demo's close (post-sweep):

```json
{
  "program": { "id": "prog_a1b2c3d4", "name": "TODA Fuel Aid — San Roque", "status": "ended", "perTapCapStroops": "500000000", "trancheStroops": "1500000000", "expiresAtS": 1796054399, "priceThresholdPhp": 65, "alpha": 0.05, "beta": 0.02, "budgetVerifiedStroops": "10000000000", "budgetFundedStroops": "4500000000", "trancheFired": true, "createdAt": 1793808000000 },
  "phpPerXlm": 10,
  "midasThreshold": 1.78,
  "fundedStroops": "4500000000",
  "spentStroops": "350000000",
  "heldStroops": "960000000",
  "pendingStroops": "0",
  "escrowRemainingStroops": "0",
  "returnedStroops": "3190000000",
  "invariantOk": true,
  "budget": {
    "state": "verified",
    "verifiedStroops": "10000000000",
    "fundedStroops": "4500000000",
    "remainingStroops": "5500000000",
    "checkoutUrl": "https://pay.velo-build.dev/cs_test_7f21",
    "paymentIntentId": "pi_test_7f21"
  },
  "counts": { "beneficiaries": 12, "approved": 3, "uncertain": 2, "enrolled": 5, "cardsActive": 0, "tapsAuthorized": 3, "tapsRejected": 2, "tapsRefused": 30 },
  "cards": [
    { "id": "card_D1", "beneficiaryId": "ben_D1", "displayName": "Juan D.", "uidLast4": "9C7E", "deviceHashPrefix": "3f9c1a0b", "virtual": false, "status": "swept", "expiresAtS": 1796054399, "expired": false, "escrowStroops": "0", "returnedStroops": "1150000000" },
    { "id": "card_D2", "beneficiaryId": "ben_D2", "displayName": "Pedro R.", "uidLast4": "3A54", "deviceHashPrefix": "a71d4c22", "virtual": false, "status": "swept", "expiresAtS": 1796054399, "expired": false, "escrowStroops": "0", "returnedStroops": "540000000" },
    { "id": "card_D3", "beneficiaryId": "ben_D3", "displayName": "Ramon B.", "uidLast4": "77B0", "deviceHashPrefix": "5c02e8f6", "virtual": false, "status": "swept", "expiresAtS": 1793808600, "expired": true, "escrowStroops": "0", "returnedStroops": "0" },
    { "id": "card_D4", "beneficiaryId": "ben_D4", "displayName": "Ana V.", "uidLast4": "A1B2", "deviceHashPrefix": "e4b81d90", "virtual": false, "status": "swept", "expiresAtS": 1796054399, "expired": false, "escrowStroops": "0", "returnedStroops": "0" },
    { "id": "card_D5", "beneficiaryId": "ben_D5", "displayName": "Lito G.", "uidLast4": "AL05", "deviceHashPrefix": "0d6a93c1", "virtual": true, "status": "swept", "expiresAtS": 1796054399, "expired": false, "escrowStroops": "0", "returnedStroops": "1500000000" }
  ],
  "stations": [
    { "id": "A", "name": "Petron San Roque", "publicKey": "G...", "status": "active", "frozenReason": null, "frozenAt": null, "pendingStroops": "0", "spentStroops": "350000000" },
    { "id": "B", "name": "Rotonda Fuels", "publicKey": "G...", "status": "frozen", "frozenReason": "MIDAS 2.31 >= 1.78 (NEAR_CAP_STREAK)", "frozenAt": 1793808400000, "pendingStroops": "960000000", "spentStroops": "0" }
  ],
  "recentTaps": [
    { "id": "tap_7c1e", "cardId": "card_D1", "cardRef": null, "stationId": "A", "amountStroops": "350000000", "nonce": "1793808200000", "status": "authorized", "reasonCode": null, "chainTxId": "ctx_7c1e", "simulated": false, "midasScore": 0.12, "tick": 61, "createdAt": 1793808201234 },
    { "id": "tap_b001", "cardId": null, "cardRef": "virtual01", "stationId": "B", "amountStroops": "480000000", "nonce": null, "status": "refused", "reasonCode": "SIMULATED_EDGE", "chainTxId": null, "simulated": true, "midasScore": 2.31, "tick": 72, "createdAt": 1793808450100 }
  ],
  "recentDecisions": [
    { "id": "dec_t1", "agent": "tranche", "decision": "FUNDED", "inputs": { "pricePhp": 71.2, "segmentMeanPhp": 70.9, "thresholdPhp": 65, "cpRecent": 0.94, "mapR": 5, "budgetBeforeStroops": "10000000000" }, "outputs": { "budgetAfterStroops": "4500000000", "funded": [ { "cardId": "card_D1", "deviceHashPrefix": "3f9c1a0b", "amountStroops": "1500000000", "chainTxId": "ctx_f1" }, { "cardId": "card_D2", "deviceHashPrefix": "a71d4c22", "amountStroops": "1500000000", "chainTxId": "ctx_f2" }, { "cardId": "card_D5", "deviceHashPrefix": "0d6a93c1", "amountStroops": "1500000000", "chainTxId": "ctx_f3" } ], "skipped": [ { "cardId": "card_D3", "reason": "EXPIRED" } ] }, "txIds": ["ctx_f1", "ctx_f2", "ctx_f3"], "createdAt": 1793808250000 }
  ]
}
```

(`recentTaps` holds up to 50 rows and `recentDecisions` up to 20; both are truncated here. `cards` is in enrollment order and carries every card, whatever its status.)

`counts` buckets are **disjoint**: `approved` counts only beneficiaries still awaiting enrollment, so the four beneficiary status buckets (`approved` + `uncertain` + `enrolled` + the rejected rows) sum to `beneficiaries` (12 = 3 + 2 + 5 + 2). After the scripted demo `enrolled` is **5** (D1, D2, D3, D5 seeded + D4 enrolled on stage).

`budget.state` drives the badge on `/`: `none` → **Fund budget** button; `waiting` (a budget `velo_intents` row exists but is not `paid`) → "Waiting for Velo…" + **Open checkout** link to `checkoutUrl`; `verified` → "Velo verified ✓ ₱{verified}" + remaining. `Fund budget` navigates the same tab to `checkoutUrl`; `/?budget=success` → toast "Payment sent — waiting for Velo verification" + refetch; `/?budget=cancel` → toast "Checkout cancelled".

`cards` is the source for the **card list on `/`** and for the **Simulate tap** picker on `/station/[id]`; both show `displayName` + `uidLast4` + `deviceHashPrefix` only. The picker offers **only cards with `status='active'`** (a `swept`/`revoked`/`failed` card can no longer `authorize`), and among those a card with `expired: true` stays selectable with an `expired` tag — D3 must remain tappable so the demo can show `EXPIRED` from the chain.

Page placement of this response (see also §5.6 and [SDD §8](system-design.md)):

| Page | Renders |
|---|---|
| `/` | budget badge (`budget`), the five money tiles + invariant line, the **station strip** (`stations`: name, `active`/`frozen` badge, `frozenReason`, `spentStroops`, `pendingStroops`, plus `heldStroops` for frozen stations), the card list (`cards`), and **one merged activity feed** |
| `/demo` | the five agent buttons, the price chart + tranche decision panel, the **edge chart** (`recentTaps` vs the `midasThreshold` line), the same **station strip**, and the settlement result panel (last `SettlementResponse`, one line per station: "A — claimed ₱350 · tx…", "B — HELD ₱960 · station frozen") |

The activity feed is **one list**: `recentTaps` and `recentDecisions` merged, sorted by `createdAt` descending, capped at 50 rows.

`midasThreshold` draws the freeze line on the `/demo` edge chart; the chart's points are `recentTaps` (upserted by `id`) plus SSE `tap`.

Numbers are computed from our tables plus one chain read:

- `fundedStroops` = `program.budget_funded_stroops` (incremented by the Tranche Agent as each `fund_escrow` succeeds; `chain_txs` has no amount column)
- `spentStroops` = Σ `amount_stroops` of `authorized` taps **at or below** their station's claim boundary (the `#16` query inverted: `t.created_at <=` the station's `MAX(chain_txs.updated_at)` for a `succeeded` claim)
- `heldStroops` = the `#16` sum over `frozen` stations
- `pendingStroops` = the `#16` sum over `active` stations
- `escrowRemainingStroops` = Σ `payment_escrow.balance_of(XLM_SAC, device_hash)` over `active` cards — the one chain read, deliberately kept independent so the invariant is a real cross-check and not a tautology
- `returnedStroops` = Σ `cards.returned_stroops`
- `invariantOk` = `funded === spent + held + pending + escrowRemaining + returned`

Demo expectation: `funded = 4500000000`, `spent = 350000000`, `held = 960000000`, `pending = 0`, `returned = 3190000000`, `escrowRemaining = 0` → invariant holds. Errors: `404 NOT_FOUND`, `500 INTERNAL`.

#### 19. `GET /api/export/coa.csv`

No request. Response 200, `text/csv; charset=utf-8`, filename `tapat-coa-<programId>.csv`.

Header exactly: `timestamp,event,card_hash_prefix,station,amount_php,amount_xlm,tx_hash,agent_decision_id`

Rows: one per money-ish event, oldest first — `fund`, `tap_authorized`, `tap_rejected`, `settlement_claimed`, `settlement_held`, `sweep`, `budget_credited`. `timestamp` is ISO-8601 with `+08:00`. `card_hash_prefix` = first 8 hex chars of `device_hash` (never the full hash, never a UID). `amount_php`/`amount_xlm` have 2 decimals; empty for events with no amount. `tx_hash` = `chain_txs.outer_hash ?? inner_hash` (empty for `HELD`). `agent_decision_id` empty when the row came from a tap.

Example line:

```csv
timestamp,event,card_hash_prefix,station,amount_php,amount_xlm,tx_hash,agent_decision_id
2026-11-05T10:12:04+08:00,fund,3f9c1a0b,,1500.00,150.00,9a1f...,dec_t1
```

Errors: `404 NOT_FOUND`, `500 INTERNAL`.

### 5.3 Error codes (closed set)

| Code | HTTP | Raised by | Meaning |
|---|---|---|---|
| `VALIDATION_ERROR` | 400 | any | zod parse or business validation failed; `message` names the field |
| `NOT_FOUND` | 404 | any `:id` route | id unknown, or no program exists |
| `CARD_NOT_ENROLLED` | 404 | `POST /api/taps` | no card for that device hash in this program |
| `WEBHOOK_SIGNATURE_INVALID` | 401 | `POST /api/webhooks/velo` | HMAC verify failed |
| `CARD_ALREADY_ENROLLED` | 409 | `POST /api/enroll` | UID already has a non-`failed` card in this program |
| `INVALID_STATE` | 409 | program/agents/stations/beneficiaries | the resource is in the wrong state for the action; `message` says which (e.g. `"Tap D2 at Station B first"`, `"no verified budget"`, `"tranche already fired"`) |
| `OCR_UNAVAILABLE` | 422 | `POST /api/intake/upload` | image hash not in fixtures |
| `PHOTO_MISMATCH` | 422 | `POST /api/enroll` | sample-photo plate or TODA ≠ the beneficiary record |
| `PHOTO_CONFIRMATION_REQUIRED` | 422 | `POST /api/enroll` | uploaded photo without `officerConfirmed=true` |
| `STATION_FROZEN` | 423 | `POST /api/taps` | station frozen; tap refused before signing |
| `CHAIN_ERROR` | 502 | any chain call | submit/contract failure not otherwise mapped; `message` carries `ContractRejection:<code>` or the Velo error class |
| `INTERNAL` | 500 | any | unexpected error; the full stack is logged, never returned |

Tap reason codes are **never** HTTP error codes. `EXPIRED`, `OVER_CAP`, `POLICY_DENIED`, `INSUFFICIENT_ESCROW` and `SIMULATED_EDGE` (burst fixture rows) live only in `tap.reasonCode`; `STATION_FROZEN`/`CARD_NOT_ENROLLED` appear in `tap.reasonCode` **and** as the two error codes above. `BUDGET_EXHAUSTED` and `HELD` are `agent_decisions.decision` values, never HTTP codes.

### 5.4 SSE — `GET /api/stream`

`Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, no compression (compression buffers events). One JSON object per `data:` line — the **camelCase REST shape from §3**, never the DB row.

```
event: tap
data: {"id":"tap_7c1e","cardId":"card_D1","cardRef":null,"stationId":"A","amountStroops":"350000000","nonce":"1793808200000","status":"authorized","reasonCode":null,"chainTxId":"ctx_7c1e","simulated":false,"midasScore":0.12,"tick":61,"createdAt":1793808201234}

event: tranche
data: {"id":"dec_t1","agent":"tranche","decision":"FUNDED","inputs":{"pricePhp":71.2,"segmentMeanPhp":70.9,"thresholdPhp":65,"cpRecent":0.94,"mapR":5,"budgetBeforeStroops":"10000000000"},"outputs":{"budgetAfterStroops":"4500000000","funded":[{"cardId":"card_D1","deviceHashPrefix":"3f9c1a0b","amountStroops":"1500000000","chainTxId":"ctx_f1"}],"skipped":[{"cardId":"card_D3","reason":"EXPIRED"}]},"txIds":["ctx_f1"],"createdAt":1793808250000}

```

Event types (closed set): `price`, `tranche`, `enroll`, `tap`, `freeze`, `settlement`, `sweep`, `budget`, `chain_tx`, `intake`.

| Event | `data` payload (§3 type) |
|---|---|
| `price` | `PricePoint` — `{ programId, idx, pricePhp, simulated, cpRecent, mapR }` |
| `tranche` | `AgentDecision` (agent `tranche`) |
| `enroll` | `Card` |
| `tap` | `Tap` |
| `freeze` | `FreezeEvent` — `AgentDecision` plus flat `stationId` and `stationStatus` |
| `settlement` | `AgentDecision` (agent `settlement`) |
| `sweep` | `AgentDecision` (agent `sweep`) |
| `budget` | `Program` (the updated row) |
| `chain_tx` | `ChainTx` |
| `intake` | `AgentDecision` (agent `intake`) |

Scored-tap re-emit: after the Freeze Agent scores a tap it writes `taps.midas_score`/`taps.tick` and emits a **second** `tap` event with the same `id`. Clients upsert by `id`, so the row updates in place instead of duplicating. `Dashboard.recentTaps` and SSE `tap` are the only sources of edge-chart points.

Heartbeat: `: ping` every 15 s (a comment line, ignored by clients). On connect the server sends nothing historical; clients load `GET /api/dashboard` (and `GET /api/agents/tranche/state` for the price chart) first, then open the stream.

Client rule (no env var, no switch): `apps/web/lib/sse.ts` exports `useStream(onEvent)` — a client hook that hardcodes `new EventSource('/api/stream')` (relative, so it is same-origin everywhere: it rides the Next.js rewrite on a laptop and Caddy's `/api/*` route in prod; both carry SSE). The only alternative is manual: **when running locally**, the laptop may open `/?sse=direct`, which makes the dashboard connect to `http://localhost:4000/api/stream` instead. That call is a cross-origin GET from `http://localhost:3000`, which is why the API enables `@fastify/cors` for that origin (§1); it is a laptop-only debugging aid and is documented in the test guide, never as a setting. It does nothing on the deployed Funnel URL, where the API is not reachable at `:4000`. Phone pages do not need SSE.

### 5.5 `POST /api/webhooks/velo`

Fastify **encapsulated plugin** registered at prefix `/api/webhooks/velo`. It registers its own `application/json` content-type parser that keeps the body as a `Buffer` (`{ parseAs: 'buffer' }`), scoped to the plugin so other routes keep normal JSON parsing.

Handling order (this order is required — the HMAC covers the raw bytes):

1. `x-velo-delivery` header missing → `400 VALIDATION_ERROR`.
2. `Velo.webhooks.verify({ payload: rawBody, signature: req.headers['x-velo-signature'], secret: VELO_WEBHOOK_SECRET })` → failure = `401 WEBHOOK_SIGNATURE_INVALID`, nothing stored.
3. `INSERT OR IGNORE INTO webhook_deliveries` on `delivery_id`. If the insert was ignored (duplicate delivery) → `200 {"received":true}` immediately.
4. Store `payload_json`; `type` = payload `type`.
5. Dispatch:
   - `payment.succeeded` → `velo.paymentIntents.retrieve(payload.data.paymentIntentId)`; require `status === 'paid'`, `purpose === 'budget'`, the intent is known, and `asset`/`amount` equal the stored `velo_intents` row. Then in **one transaction**: if `velo_intents.status !== 'paid'` → set `status='paid'`, `paid_at`, `tx_hash`, `payer_address`; `program.budget_verified_stroops += phpToStroops(...)`. Idempotency is the `status !== 'paid'` guard plus the delivery PK; crediting twice from one intent is impossible. SSE `budget`.
   - `payment.failed` → `velo_intents.status='failed'`.
   - `payment.created` and everything else (including `contract.event`) → stored only.
6. Always respond `200 {"received":true}` after step 4, even if step 5's handler throws (the throw is logged; Velo must not retry a delivery we already recorded). Never return 5xx to Velo.

The 3 s `paymentIntents.retrieve` poller in the API covers a missed or delayed webhook with the same idempotent credit path. Response bodies: `200 {"received":true}`, `400 VALIDATION_ERROR`, `401 WEBHOOK_SIGNATURE_INVALID`.

### 5.6 Front-end mocks — `apps/web/mocks/`

BegA builds the UI mock-first from these committed files. Each file is **the §5.2 example verbatim** (same keys, same stroop strings) so swapping a mock for the API is a one-line change.

Data access has exactly one front door: **`apps/web/lib/api.ts` is the only module in the web app that fetches.** Every function returns the typed shape from `@tapat/shared`:

```ts
// UI1 (mock):      return dashboardMock as Dashboard;
// UI2 (live):      return fetch('/api/dashboard').then((r) => r.json() as Promise<Dashboard>);
export async function getDashboard(): Promise<Dashboard>;

/** `body` is the §5.2 #13 request shape: { stationId, amountPhp, uid | cardId+simulated }. */
export async function postTap(body: {
  stationId: string;
  amountPhp: number;
  uid?: string;
  cardId?: string;
  simulated?: boolean;
}): Promise<TapResponse>;
```

UI1's function bodies return the imported `apps/web/mocks/*.json`; UI2 replaces each body with the `fetch('/api/...')` call above and nothing else in the page changes — that is the "one-line change". Pages that need SSE or forms are client components using plain `fetch` + React state; no extra data library. Real-time comes only from `useStream(onEvent)` in `apps/web/lib/sse.ts` (§5.4).

| File | Shape |
|---|---|
| `program.json` | `ProgramResponse` (`{"program": Program\|null, "phpPerXlm": 10}`; use `null` for the empty-state page) |
| `dashboard.json` | `Dashboard` (§5.2 #18) |
| `beneficiaries.json` | `Beneficiary[]` (§5.2 #8) |
| `calibration.json` | `CalibrationResponse` (§5.2 #7) |
| `stations.json` | `Station[]` (§5.2 #16) |
| `tranche-state.json` | `TrancheState` (§5.2 #12) |
| `intake-response.json` | `IntakeResponse` (§5.2 #6) |
| `enroll-response.json` | `EnrollResponse` (§5.2 #10) |
| `tap-response-paid.json` | `TapResponse`, `status:'authorized'` (§5.2 #13) |
| `tap-response-declined.json` | `TapResponse`, `status:'rejected'`, `reasonCode:'OVER_CAP'` |
| `settlement-response.json` | `SettlementResponse` (§5.2 #17) |
| `end-response.json` | `EndProgramResponse` (§5.2 #5) |
| `health.json` | `HealthResponse` (§5.2 #1) |
| `sse-events.json` | `Array<{ event: string; data: unknown }>` — one entry per §5.4 event type, `data` as that row |

Every `Tap` in those files includes `cardRef` (null for real cards). The mocks contain no secrets and no full `deviceHash`. Only `apps/web/lib/api.ts` imports them — a page never reaches into `mocks/` directly; that is what makes UI2 a one-line-per-function swap.

---

## 6. Chain call map

Every write goes through `apps/api/src/chain/soroban.ts` → `gas.ts`. Signers are `Keypair`s loaded from env or decrypted from `cards.agent_secret_enc` ([SDD §3](system-design.md)).

| TAPat action | Contract | Method | Signer | Args (in order) |
|---|---|---|---|---|
| enroll a card | `device_registry` (`NOIR_DEVICE_REGISTRY_ID`) | `register` | Program Wallet | `wallet: Address`, `device_hash: BytesN<32>`, `agent: Address` (card agent) |
| enroll a card (policy) | `agent_registry` (`NOIR_AGENT_REGISTRY_ID`) | `register_agent` | Program Wallet (device owner) | `wallet: Address`, `device_hash: BytesN<32>`, `agent: Address`, `max_amount: i128` (stroops), `asset: Address` (`XLM_SAC_ID`), `expires_at: u64` |
| Tranche funding | `payment_escrow` (`NOIR_PAYMENT_ESCROW_ID`) | `fund_escrow` | Program Wallet | `token: Address` (`XLM_SAC_ID`), `wallet: Address` (Program Wallet), `device_hash: BytesN<32>`, `amount: i128` |
| tap | `payment_escrow` | `authorize` | card agent (decrypted) | `agent: Address`, `device_hash: BytesN<32>`, `merchant: Address` (station public key), `asset: Address` (`XLM_SAC_ID`), `amount: i128`, `nonce: u64` |
| settlement | `payment_escrow` | `claim` | station keypair | `token: Address` (`XLM_SAC_ID`), `merchant: Address` (station public key) |
| end program | `agent_registry` | `revoke_agent` | Program Wallet (device owner) | `wallet: Address`, `device_hash: BytesN<32>` |
| end program | `payment_escrow` | `sweep_on_revoke` | Program Wallet | `token: Address` (`XLM_SAC_ID`), `device_hash: BytesN<32>`, `agent: Address` (card agent) |
| `reset-demo.ts` | `device_registry` | `revoke` | Program Wallet | `wallet: Address`, `device_hash: BytesN<32>` |
| tap pre-check, UI reason | `agent_registry` | `get_policy` (read) | Program Wallet (simulation source) | `device_hash: BytesN<32>` → `{owner, agent, max_amount, asset, expires_at}` |
| enrollment retry | `device_registry` | `get_owner` (read) | Program Wallet (simulation source) | `device_hash: BytesN<32>` → `Option<Address>`; some(wallet) means `register` already succeeded |
| dashboard, tap response, sweep | `payment_escrow` | `balance_of` (read) | Program Wallet | `device_hash: BytesN<32>` → `i128` |
| settlement, stations | `payment_escrow` | (no read) | — | unclaimed totals come from our own tables (#16), not a chain read |
| `smoke-testnet.ts` only | `payment_escrow` | `pending_balance` (read) | Program Wallet | `merchant: Address` → `i128` (all tokens) — availability check for the settlement path |

Arg encoding: `nativeToScVal(address, { type: 'address' })`, `nativeToScVal(Buffer.from(hex, 'hex'), { type: 'bytes' })` for `device_hash`, `{ type: 'i128' }` with a `bigint` for amounts, `{ type: 'u64' }` with a `bigint` for `nonce`/`expires_at`.

Contract errors map to `CHAIN_ERROR` with `message = "ContractRejection:3"` style, using the tables below.

| `payment_escrow` | code | | `device_registry` | code | | `agent_registry` | code |
|---|---|---|---|---|---|---|---|
| `AlreadyInitialized` | 1 | | `AlreadyInitialized` | 1 | | `AlreadyInitialized` | 1 |
| `InsufficientBalance` | 2 | | `DeviceNotFound` | 2 | | `AgentNotFound` | 2 |
| `AgentNotAuthorized` | 3 | | `NotOwner` | 3 | | `AlreadyRegistered` | 3 |
| `NotDeviceOwner` | 4 | | `AlreadyRegistered` | 4 | | `InvalidPolicy` | 4 |
| `NothingToClaim` | 5 | | | | | `NotOwner` | 5 |
| `DuplicateAuth` | 6 | | | | | | |
| `AgentStillActive` | 7 | | | | | | |
| `DeviceNotRegistered` | 8 | | | | | | |
| `InvalidAsset` | 9 | | | | | | |
| `InvalidRecipient` | 10 | | | | | | |
| `InvalidAmount` | 11 | | | | | | |

Contract behavior that the services rely on (verified against `noirx402/noir` `main`):
- `register_agent` panics `InvalidPolicy` when `expires_at != 0 && expires_at <= ledger now`, so every seeded expiry must be in the future.
- A policy is expired when `ledger now > expires_at` (strict).
- `sweep_on_revoke` checks only `is_auth(device_hash, agent)` (agent matches and not expired) → `AgentStillActive`. With a zero balance it returns `0` and transfers nothing. `revoke_agent` on a missing policy panics `AgentNotFound` (#2).
- A panic inside a nested contract call (e.g. `device_registry.get_owner` → `DeviceNotFound` inside `sweep_on_revoke`) surfaces as `Error(Contract, #N)` too and can collide with the invoked contract's table; map by the invoked contract and keep the raw diagnostic string in `chain_txs.error`.

Events the indexer sees (for debugging only, nothing depends on them): `("fund", device)`, `("authorize", device, merchant)`, `("claim", merchant)`, `("defund", device)`, `("sweep", device)`.

Noir contract IDs and the XLM SAC ID (copied character-for-character; never retyped):

```
NOIR_DEVICE_REGISTRY_ID=CAC4KOLHDLDYDWBOKXNKRN5KVHO56PLOIFXDLTBUWGVN6GVDEB7FQHU5
NOIR_AGENT_REGISTRY_ID=CCMZDSPTLX7IIJWCYEUM5DJUHOSOYSTHGK777S2TXZWEMC5ZZGPJ3EBV
NOIR_PAYMENT_ESCROW_ID=CC7EAW5FNJEDBS7THM5IT6XIOHO4AOYMLXT3KSZ3HWUIKEACTW7E5BFS
XLM_SAC_ID=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
```

### 6.1 Velo calls

| Call | Used by | Notes |
|---|---|---|
| `velo.checkout.sessions.create({ amount, asset, description, successUrl, cancelUrl }, { idempotencyKey })` | `POST /api/program/budget-checkout` | `amount` is an XLM decimal string (`"1000.00"`), `asset` is `"XLM"`; returns `{ checkoutUrl, paymentIntentId }` |
| `velo.paymentIntents.retrieve(paymentIntentId)` | webhook `payment.succeeded`, 3 s poller | returns `status`, `receiverAddress`, `payerAddress`; `paid` requires a classic `payment` op to the project `ownerAddress` with the exact asset and amount |
| `velo.gas.sponsorAndSubmit(signedXdr, { idempotencyKey, correlationId })` | `chain/gas.ts`, `GAS_MODE=velo` | keys are `chain_txs.id` so a retry of the same row can never double-sponsor |
| `velo.gas.waitForResult(identity, { timeoutMs: 30000 })` | `chain/gas.ts` | only `succeeded` is success; `claimed`/`submitted`/`submission_unknown` still running; `failed`/`cancelled` terminal |
| `velo.gas.getStatus(identity)` | reconciliation of `submission_unknown`, and `/api/health` | polled every 5 s for ≤ 2 min, then the row stays `submission_unknown` for the logs |
| `Velo.webhooks.verify({ payload, signature, secret })` | webhook plugin | needs the raw body |

Rules that the code must respect: the SDK is ESM-only server-side (`@carts1024/velo-sdk@0.1.0-alpha.4`, pinned exactly); envelope = one `invokeHostFunction` op, G-account source, exactly one signature from that source; `allowedContractIds` must list the 3 Noir contracts; never resubmit after `VeloGasSubmissionUnknownError`.

---

## 7. Environment variables

Two files: 24 API variables in `apps/api/.env` and 2 web variables in `apps/web/.env.local`. The API refuses to boot if any API variable below is missing or malformed, and prints the missing names.

### 7.1 `apps/api/.env.example`

```dotenv
# --- server ---
PORT=4000
DATABASE_PATH=./data/tapat.db
# Public HTTPS origin; Web NFC and Velo webhooks both use it.
# prod: https://tapat.<tailnet>.ts.net  (the Funnel URL, set once; never the optional Vercel URL; deployment.md §4)
# dev:  https://localhost:3000          (or a laptop quick-tunnel URL for phone tests)
PUBLIC_BASE_URL=https://localhost:3000

# --- Stellar / Soroban (testnet) ---
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
NOIR_DEVICE_REGISTRY_ID=CAC4KOLHDLDYDWBOKXNKRN5KVHO56PLOIFXDLTBUWGVN6GVDEB7FQHU5
NOIR_AGENT_REGISTRY_ID=CCMZDSPTLX7IIJWCYEUM5DJUHOSOYSTHGK777S2TXZWEMC5ZZGPJ3EBV
NOIR_PAYMENT_ESCROW_ID=CC7EAW5FNJEDBS7THM5IT6XIOHO4AOYMLXT3KSZ3HWUIKEACTW7E5BFS
XLM_SAC_ID=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC

# --- signing keys (printed by scripts/bootstrap-accounts.ts) ---
PROGRAM_WALLET_SECRET=S...
STATION_A_SECRET=S...
STATION_B_SECRET=S...
# 64 hex chars (32 bytes). Generate with:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Losing it makes every encrypted card agent unusable.
KEY_ENCRYPTION_SECRET=

# --- Velo Gas Station ---
# velo = sponsor every contract write; direct = always send via Soroban RPC.
GAS_MODE=velo
GAS_FALLBACK_DIRECT=true
VELO_GAS_BASE_URL=https://www.velo-build.dev
VELO_GAS_API_KEY=tg_test_...
# Velo project (general) API key, used by checkout + paymentIntents.
VELO_API_KEY=tk_live_...
# From the Velo dashboard webhook endpoint.
VELO_WEBHOOK_SECRET=...

# --- Telegram ---
TELEGRAM_BOT_TOKEN=123456789:AA...
TELEGRAM_BOT_USERNAME=tapat_demo_bot

# --- demo timing / display ---
PHP_PER_XLM=10
PRICE_TICK_MS=700
FREEZE_TICK_MS=1000
```

### 7.2 `apps/web/.env.example`

`apps/web/.env.example` is committed; each developer copies it to `apps/web/.env.local` (Next.js convention, git-ignored). These two file names are the only ones used anywhere in the docs.

```dotenv
# Where Next.js rewrites /api/:path* to. The browser never sees the API port directly.
API_ORIGIN=http://localhost:4000

# OPTIONAL. HTTP basic auth for apps/web/middleware.ts, as `user:password`.
# Leave it unset (local dev, the VM's web behind Caddy): the middleware is a no-op.
# Set it only in the Vercel project when the optional Vercel frontend is on (deployment.md §9).
# WEB_BASIC_AUTH=officer:change-me
```

### 7.3 Boot rule (`apps/api/src/config.ts`)

`zod` parses `process.env` once at boot:

| Variable | Rule |
|---|---|
| `PORT` | coerce int, 1–65535, default 4000 |
| `DATABASE_PATH` | non-empty string |
| `PUBLIC_BASE_URL` | URL, `https:` required |
| `STELLAR_RPC_URL` | URL |
| `STELLAR_NETWORK_PASSPHRASE` | literal `Test SDF Network ; September 2015` |
| `NOIR_DEVICE_REGISTRY_ID`, `NOIR_AGENT_REGISTRY_ID`, `NOIR_PAYMENT_ESCROW_ID`, `XLM_SAC_ID` | `/^C[A-Z2-7]{55}$/` |
| `PROGRAM_WALLET_SECRET`, `STATION_A_SECRET`, `STATION_B_SECRET` | `/^S[A-Z2-7]{55}$/` |
| `KEY_ENCRYPTION_SECRET` | `/^[0-9a-f]{64}$/` |
| `GAS_MODE` | enum `velo` \| `direct` |
| `GAS_FALLBACK_DIRECT` | `'true'` \| `'false'` → boolean |
| `VELO_GAS_BASE_URL` | URL |
| `VELO_GAS_API_KEY` | starts with `tg_test_` |
| `VELO_API_KEY` | starts with `tk_test_` or `tk_live_` (the dashboard now issues `tk_live_`; Velo checkout still runs on Stellar Testnet) |
| `VELO_WEBHOOK_SECRET` | min length 16 |
| `TELEGRAM_BOT_TOKEN` | contains `:` |
| `TELEGRAM_BOT_USERNAME` | `/^[A-Za-z0-9_]{5,32}$/` (no leading `@`) |
| `PHP_PER_XLM` | coerce number > 0, default 10 |
| `PRICE_TICK_MS`, `FREEZE_TICK_MS` | coerce int ≥ 100, defaults 700 / 1000 |

On failure: `console.error` the zod issues (variable name + rule, never the value), then `process.exit(1)`. On success the parsed object is the only way the rest of the code reads config — `process.env` is not read anywhere else.

`apps/web` reads 1 required variable and 1 optional one (2 total):

| Variable | Rule |
|---|---|
| `API_ORIGIN` | required, a URL; the build fails if it is unset |
| `WEB_BASIC_AUTH` | optional `user:password`; when set, `apps/web/middleware.ts` requires basic auth on every path except `/api/webhooks/velo` and `/api/health`. Unset → the middleware is a no-op. Set only in the Vercel project ([deployment.md §9](deployment.md)) |

---

## 8. Cross-references

- Why each call exists and in what order: [system-design.md](system-design.md) §2 (money flow), §3 (chain module), §5 (service behaviors).
- Every threshold and score formula cited above: [algorithms.md](algorithms.md).
- Where each env value comes from, in order: [setup.md](setup.md) §2–§7.
- Who writes which file, and when: [build-schedule.md](build-schedule.md).
- Which of these contracts are tested and how: [test-plan.md](test-plan.md).

## Naming gaps filled by this doc

Names the plan did not specify, chosen minimally here. The integrator must reconcile these into the SDD, runbook, and code:

1. `Stroops` JSON encoding = decimal string; `nonce`/`u64` = decimal string.
2. `packages/shared/money.ts` exports: `STROOPS_PER_XLM`, `DEFAULT_PHP_PER_XLM`, `phpToStroops`, `stroopsToPhp`, `formatPhp`, `stroopsToXlmString`.
3. Extra error codes: `NOT_FOUND`, `INVALID_STATE`, `VALIDATION_ERROR`, `CHAIN_ERROR`, `INTERNAL`, `WEBHOOK_SIGNATURE_INVALID`, `PHOTO_MISMATCH`.
4. `agent_decisions.decision` vocabulary beyond `BUDGET_EXHAUSTED` and `HELD`: `APPROVED`, `REJECTED`, `UNCERTAIN`, `EVIDENCE_REQUESTED`, `EVIDENCE_VERIFIED`, `EVIDENCE_UNMATCHED`, `FUNDED`, `BASELINE_SET`, `FROZEN`, `UNFROZEN`, `CLAIMED`, `NOTHING_PENDING`, `SWEPT`, `SKIPPED`, `PROGRAM_ENDED`.
5. `chain_txs.kind` vocabulary: `register`, `register_agent`, `fund`, `authorize`, `claim`, `revoke_agent`, `sweep`, `revoke_device`.
6. `stations.id` values `A` and `B`.
7. `Station.pendingStroops` and `Station.spentStroops` in `GET /api/stations`.
8. `Dashboard`: `phpPerXlm`, `midasThreshold`, `escrowRemainingStroops`, `invariantOk`, `budget`, `cards`, `counts` (disjoint buckets), `recentTaps`, `recentDecisions`.
9. Response envelope interfaces (`ProgramResponse` (with `phpPerXlm`), `IntakeResponse`, `EnrollResponse`, `TapResponse` (with `message`), `SettlementResponse`, `EndProgramResponse`, `RequestEvidenceResponse`, `BurstResponse`, `TrancheStartResponse`, `TrancheState` (with `points`), `CalibrationResponse`) plus `CardSummary`, `PricePoint`, `FreezeEvent`.
10. Read method names `balance_of(device_hash)` and `pending_balance(merchant)` — verified against `noirx402/noir` `main` source; `smoke-testnet.ts` still exercises them on the deployed IDs.
11. `POST /api/taps` returns HTTP 200 for a declined tap (`status: 'rejected'` + `reasonCode`) and 423 only for a frozen station.
12. `POST /api/program` request field names (`perTapCapPhp`, `tranchePhp`, `expiresAt`, `priceThresholdPhp`, `alpha`, `beta`).
13. `velo_intents.purpose` value `'budget'`; idempotency key shape `budget:${programId}:${seq}`.
14. Fixture JSON shapes in §4 (snake_case: `source`, `price_php`, `card_ref`, `tick_offset`).
15. Tap `reason_code='SIMULATED_EDGE'` for burst edges written by `POST /api/agents/freeze/burst`.
16. `taps.card_ref` / `Tap.cardRef` for fixture (virtual) card ids on `SIMULATED_EDGE` rows.
17. Privacy surface: `CardSummary` (`displayName`, `uidLast4`, `deviceHashPrefix`) is the only card identity the web or the CSV ever sees; `Card` and `EnrollResponse` carry no `deviceHash`.
18. `TAP_REASON_LABELS` in `packages/shared/constants.ts` (§1.2).
19. `apps/web/mocks/` file list (§5.6).
20. Workspace package name `@tapat/shared`, `main: ./src/index.ts` (TS source, no build), `next.config` `transpilePackages: ['@tapat/shared']`, and the `"workspace:*"` dependency in both apps (§1.3).
21. `IntakeResponse.summary.enrolled` — the fifth, disjoint bucket (§3, §5.2 #6).
22. `apps/web/lib/api.ts` as the only fetch module and `apps/web/lib/sse.ts` `useStream(onEvent)` (§5.6, §5.4); page placement of `Dashboard.stations` and the edge chart (§5.2 #18).
