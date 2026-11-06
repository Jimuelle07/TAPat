# TAPat Test Plan

What to run before pushing, before the Nov 6 EOD gate, and before walking on stage — with the exact expected numbers.

Last updated: 2026-11-05

## 1. How to run

| Command | Scope | When |
|---|---|---|
| `pnpm test` | All Vitest suites in `packages/shared`, `packages/agent`, `apps/server`, and `apps/web` | Before every push |
| `pnpm --filter server tsx scripts/smoke-testnet.ts` | Live testnet reads and one sponsored write | After any env var or contract ID change; at T-60 |
| `pnpm demo:e2e` | The 7 demo beats headlessly through the API against testnet, asserting the totals — run **on the VM**, in `/opt/tapat` | Nov 6 EOD gate, both Nov 7 rehearsals (07:00–09:00) |

A failure is a bug with a repro, filed against the task id in `docs/build-schedule.md`. Do not "fix" a red algorithmic test by changing α, β, the calibration fixture, or a weight — fix the code or the fixture rows (`fixtures/masterlist/*.csv`), per the plan.

## 2. Unit tests (Vitest, `packages/*`, `apps/server` and `apps/web`)

### 2.1 Algorithms

| File | Test | Exact expectation |
|---|---|---|
| `packages/agent/src/algorithms/names.test.ts` | Normalization | `"Dela Cruz"`, `"De la Cruz"`, `"Delacruz"` all normalize to `delacruz`; `"Ma. Teresa Santos"` → `maria teresa santos` (token map `ma`→`maria`), and `"Sto. Nino"` → `santo nino`; `ñ` → `n`; `"Juan Dela Cruz Jr"` extracts suffix `jr` |
| | Required vector | The Dela Cruz triple for `Juan`, `1980-03-02` → pairwise `p ≥ 0.9` |
| | Negative vector | `"Juan Dela Cruz Jr"` vs `"Juan Dela Cruz Sr"`, **same** birthdate → `p < 0.5` |
| `packages/agent/src/algorithms/matcher.test.ts` | Genuineness | First row `s = 1`; a later exact duplicate of row 1 has `s = 1 − p` |
| | Rules | `UNDERAGE` blocks age < 18 at program start; `PLATE_MULTI_NAME` rejects all records sharing a plate with `p < 0.5`; `DUPLICATE_PLATE` keeps the first and rejects later rows with `p ≥ 0.5` |
| `packages/agent/src/algorithms/crc.test.ts` | Thresholds | On `fixtures/calibration/labeled.json` (n = 400: 320 genuine, 60 ghost, 20 hard negative), empirical wrongful-denial ≤ α = 0.05 and ghost admission ≤ β = 0.02 |
| | Monotonicity | If `λ_lo > λ_hi`, the implementation clamps `λ_lo = λ_hi` and decisions are still `approve | reject | uncertain` only |
| `packages/agent/src/algorithms/bocpd.test.ts` | Fire | `doe-diesel-sim.json` fires at an index in **[33, 36]** |
| | No false fire | The day-15 spike (index 15) does **not** fire: `cpRecent < 0.9` or MAP run length < 3 |
| `packages/agent/src/algorithms/midas.test.ts` | Honest | Every honest seed 1–50 stays below `apps/server/config/midas.json.threshold` |
| | Burst | `fixtures/taps/burst.json` crosses the threshold within its 30 edges |
| | χ² | Zero counts → score 0; `s = 0` or `t ≤ 1` → score 0 (no division by zero) |

### 2.2 Chain, gas, and service behavior (mocked RPC)

| File | Test | Exact expectation |
|---|---|---|
| `packages/agent/src/chain/noir.test.ts` | Contract check | The SDK's `TESTNET.contracts` or `networkPassphrase` differing from the configured `NOIR_*_ID` / `STELLAR_NETWORK_PASSPHRASE` makes `createNoirClient` throw the mismatch-naming `Error`; `apps/server` turns that into exit 1 with the listener never started |
| | Error mapping | A `NoirContractError{contract, code, errorName, method}` is mapped through the per-contract tables in [system-design.md §4.4](system-design.md); device code `4` → `AlreadyRegistered`. The SDK does the encoding: amounts are bigint stroops, `deviceHash` is 64 hex, `expiresAt` is a `Date` |
| `packages/agent/src/chain/gas.test.ts` | Sponsor retry | `velo.gas.sponsor(xdr, {idempotencyKey})` is retried **only** on `VeloProviderError`, with the same XDR and the same idempotency key |
| | Single hand-off | Exactly one `velo.gas.submit({requestId, transactionHash, transactionXdr})` per operation |
| | Submission unknown | Any failure of that `submit` (including a lost response) is followed by `getStatus(identity)` — **never** a second `submit`; the result stays non-terminal, so `apps/server` records `submission_unknown`, confirms it on chain by inner hash for up to 30 s, and its reconciler re-checks it every 5 s for up to 6 min |
| | Status mapping | `succeeded` → `succeeded`; `failed` and `cancelled` → `submission_unknown` with `GAS_FAILED`/`GAS_CANCELLED` as a hint, not accepted as terminal; a later Velo `succeeded` or a chain read of the inner hash settles it (`succeeded`, or `failed`/`CHAIN_FAILED`); `claimed`/`submitted`/`submission_unknown` → non-terminal, confirmed on chain, else owned by the reconciler |
| | Fallback | Direct only after a `sponsor()` failure (nothing was handed off): with `GAS_FALLBACK_DIRECT=true` the **same** XDR goes through `submitDirect` and `apps/server` records the row as `gas_mode='direct'`; with the flag false it fails without sending, and a failure after `submit` never falls back |
| `apps/server/src/services/tap.test.ts` | Frozen station | Frozen station → 423 `STATION_FROZEN`, and **no** `chain_txs` row is created |
| | Unknown card | Unknown `device_hash` → 404 `CARD_NOT_ENROLLED` |
| | Reason mapping | A mocked `NoirContractError` #3 (`AgentNotAuthorized`) on `authorize` → `checkPayment` reason `expired` → `EXPIRED`, `over_limit` → `OVER_CAP`, `no_agent`/`wrong_agent`/`wrong_asset`/`invalid_amount` → `POLICY_DENIED`; `#2` (`InsufficientBalance`) → `INSUFFICIENT_ESCROW` |
| | Other codes | Mocked code 6 (`DuplicateAuth`), 8 (`DeviceNotRegistered`), 9, 10 → tap `failed`, `reasonCode = null`, the SDK's synthesized message (`<contract>.<method> failed: <Name> (#<code>)`) kept in `chain_txs.error` with the code and method, response `502 CHAIN_ERROR` |
| | Message | `TapResponse.message` is non-empty for both outcomes and contains the peso amount and the cap sentence on an `OVER_CAP` decline |
| | Nonce | `nonce = max(Date.now(), last_nonce + 1)`, persisted **before** submit; a failed submit keeps it and the next nonce is still strictly greater |
| | No money on rejection | `rejected`/`refused` tap rows have `chain_tx_id = NULL`; a `failed` tap points at a `chain_txs` row whose status is `failed` |
| `apps/server/src/services/enroll.test.ts` | UID format | `04:a2:1f:9c:a1:b2` normalizes to `04A21F9CA1B2`; `TAPATVIRTUAL05` and `TAPATE2E04` pass `^[0-9A-Z]{4,32}$`; `ab_cd` (underscore), `a` (too short), 40 chars (too long) → 400 `VALIDATION_ERROR` |
| | Photo check | `samplePhoto=d4-photo.jpg` with a mismatching plate **or** TODA → 422 `PHOTO_MISMATCH`; matching → `photoCheck = {source:'precomputed', plate, toda, matched:true}`; uploaded photo without `officerConfirmed` → 422 `PHOTO_CONFIRMATION_REQUIRED`; with it → `source:'officer_confirmed'`, `plate:null`, `toda:null` |
| | Retry | A forced `register_agent` failure leaves one `cards` row `failed`; retrying the same `uid` reuses that row id and keypair, and when `get_owner` returns the Program Wallet the retry issues only `register_agent` |
| | Duplicate | A second `uid` matching an existing `active` card → 409 `CARD_ALREADY_ENROLLED`; a `failed` card's UID does **not** trigger 409 |
| `apps/server/src/services/dashboard.test.ts` | Counts | Status buckets are disjoint: `approved` excludes `enrolled`; after the seeded+scripted state `enrolled = 5`, `beneficiaries = 12`, and `beneficiaries − approved − uncertain − enrolled` equals the rejected row count (2) |
| | Budget badge | `budget.state` is `none` with no `velo_intents` row, `waiting` with an unpaid row (and that row's `checkoutUrl`), `verified` after credit; `remainingStroops = verified - funded` |
| | Cards | `Dashboard.cards` returns one `CardSummary` per card with `displayName` in "Juan D." format, `deviceHashPrefix` exactly 8 hex chars, and no `deviceHash` and no full beneficiary name anywhere in the JSON |
| | Series | `midasThreshold` equals `apps/server/config/midas.json.threshold`; `recentTaps` newest first, max 50 |
| `apps/server/src/services/budget.test.ts` | Webhook idempotency | The same `x-velo-delivery` delivered twice credits `budget_verified_stroops` **once**; a second delivery with a new id but the same `paymentIntentId` also credits once |
| | Signature | A bad `x-velo-signature` → 400 `WEBHOOK_SIGNATURE_INVALID`, nothing stored as paid |
| | Poller | A `paymentIntents.retrieve` that turns `paid` credits once even if the webhook never arrives |
| `apps/server/src/services/tranche.test.ts` | Eligibility | An expired card (D3) is skipped with a reason; a program with `tranche_fired = 1` does not fire again |
| | Budget guard | Remaining budget < tranche → stop, log `BUDGET_EXHAUSTED`, fund nothing further |
| | Decision log | Exactly one `agent_decisions` row per fire, containing price, segment mean, threshold, cp probability, MAP run length, budget before/after, and per-card funded/skipped reasons with tx ids |
| `apps/server/src/services/settlement.test.ts` | Freeze hold | Frozen station with pending > 0 → one `HELD` decision with the amount and zero txs; active station → one `claim` |
| `apps/server/src/services/freeze.test.ts` | Burst precondition | `POST /api/agents/freeze/burst` with **no `authorized` Station-B tap at all** → 409 `INVALID_STATE`, `message = "Tap D2 at Station B first"`, zero burst rows written |
| | Gate accepts a simulated tap | One `POST /api/taps` with `{stationId:'B', amountPhp:480, cardId:'card_D2', simulated:true}` (a real `authorize`) is enough for burst to return 202 — the gate reads `taps.status='authorized'`, not `taps.simulated` |
| | Scored re-emit | After scoring, `taps.midas_score`/`tick` are set and a second SSE `tap` with the **same id** is emitted (clients upsert) |
| `apps/server/src/services/sse.test.ts` | Payload shapes | Each emitted `data` parses against the §3 type for its event: `price`→`PricePoint`, `tranche`/`settlement`/`sweep`/`intake`→`AgentDecision`, `enroll`→`Card`, `tap`→`Tap`, `freeze`→`FreezeEvent` (flat `stationId`/`stationStatus`), `budget`→`Program`, `chain_tx`→`ChainTx` |
| `apps/server/src/services/intake.test.ts` | Calibration shape | `GET /api/intake/calibration` returns exactly `{alpha, beta, lambdaLo, lambdaHi, n, wrongfulDenialRate, ghostAdmissionRate, feasible}` |
| | Summary buckets | After the demo upload (seeded program: D1/D2/D3/D5 already `enrolled`) `IntakeResponse.summary` deep-equals `{ total: 12, approved: 4, rejected: 2, uncertain: 2, enrolled: 4 }`, and `approved + rejected + uncertain + enrolled === total`; the 4 `enrolled` rows are D1/D2/D3/D5 and keep `status='enrolled'` |
| | Evidence states | `request-evidence` succeeds from `uncertain` and `rejected`, fails 409 from `approved`, `enrolled`, `evidence_requested`; success sets status `evidence_requested` |
| | Deep link | `Beneficiary.telegramDeepLink` equals `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${link_code}` for every row |
| `apps/server/src/services/sweep.test.ts` | Order | Per card: `revoke_agent` only while the policy is active, then `sweep_on_revoke`; `device_registry.revoke` is **not** called; `returned_stroops` sums to ₱3,190 on the seeded demo |
| | Zero escrow | A card with `balance_of` = 0 (D3, D4) is marked `swept` with `returned_stroops = 0` and **no** `sweep_on_revoke` tx (the contract would return 0; skipping saves a sponsored tx) |
| `packages/shared/money.test.ts` | Conversions | 350 PHP → 35 XLM → `350000000n` stroops → `"₱350.00"`; `PHP_PER_XLM = 10`; no float drift on 480 and 1,500 |
| `packages/shared/index.test.ts` | Package surface | `import { formatPhp, TAP_REASON_LABELS } from '@tapat/shared'` resolves (package `name: "@tapat/shared"`, `main: ./src/index.ts`, no build step); the entry re-exports `money.ts`, `types.ts`, `schemas.ts`, `constants.ts`; importing it in a browser-safe context touches no `node:` module |
| `packages/shared/device-hash.test.ts` | Device hash | `SHA-256(utf8("${salt}:${UID}"))` where `UID` = serialNumber with colons removed, uppercased; two salts give different hashes for the same card |
| `apps/web/middleware.test.ts` | Unset env | With `WEB_BASIC_AUTH` unset, a request to `/` passes unchanged (no-op: local dev, the VM's web behind Caddy) |
| | 401 paths | With `WEB_BASIC_AUTH=user:pass` set: no `Authorization` header → `401` + `WWW-Authenticate: Basic realm="TAPat"`; wrong credentials → `401`; the correct `Basic base64(user:pass)` → passes |
| | Exempt paths | `/api/webhooks/velo` and `/api/health` pass with **no** header even when the env var is set |
| `apps/server/src/server.test.ts` | Cache headers | `GET /api/dashboard` → `Cache-Control: no-store`; `GET /api/stream` → `text/event-stream` with `no-cache` in `Cache-Control` (never `no-store`) |

The two rows above are unit-only and never gate the demo: `middleware.ts` is inert without `WEB_BASIC_AUTH`, and `no-store` is harmless through Caddy. Their live proof is the optional Vercel checklist in [deployment.md §9.4](deployment.md), run only if that front end is switched on.

## 3. Live testnet checks

### 3.1 `scripts/smoke-testnet.ts` (manual, Jim)

1. `noir.getPolicy` on a random 32-byte hash → `null` (the SDK treats `agent_registry`'s `AgentNotFound` #2 as "no policy"), and `noir.checkPayment` on it → `{ ok: false, reason: 'no_agent' }` (expected; proves RPC, contract ID and the SDK read path).
2. One sponsored `registerDevice` of a throwaway hash through `packages/agent/src/chain/gas.ts` with `GAS_MODE=velo` (`noir.prepare` → sign → `sponsor` → one `submit`) → `chain_txs` row `succeeded` with `gas_mode='velo'`; the tx opens on Stellar Expert.
3. One `checkout.sessions.create` of 1 XLM → returns `{checkoutUrl, paymentIntentId}`; the intent is retrievable with status `created`.

### 3.2 `pnpm demo:e2e` (the Nov 6 EOD gate)

Runs the 7 beats headlessly through the API (no browser, no phone) against testnet. The budget payment cannot be made headlessly (Velo only accepts it through the hosted checkout): the script creates the checkout via `POST /api/program/budget-checkout`, prints `checkoutUrl`, and waits up to 5 min for `budget_verified_stroops` to become non-zero while the operator pays it in Freighter as Budget Office. D4 is enrolled with the virtual UID `TAPATE2E04` and `samplePhoto=d4-photo.jpg`. Assertions:

| Assertion | Expected |
|---|---|
| Program seeded | 4 cards: D1, D2, D3, D5 `active`. The e2e seeds with `seed-demo.ts --d3-expiry-offset=30` (default `600`; must be > 0, Noir rejects a past expiry with `InvalidPolicy`) and waits until 35 s after seed before starting the price feed, so D3 is expired for both the tranche and beat 3 |
| Budget verified | `budget_verified_stroops = 10000000000` (1,000 XLM, ₱10,000) |
| Tranche fire | 3 `fund_escrow` txs `succeeded`; total `budget_funded_stroops = 4500000000` (450 XLM, ₱4,500) — each card 1,500,000,000; exactly one `agent_decisions` row with agent `tranche` |
| Tap D1 ₱350 | `authorized` with a `succeeded` tx |
| Tap ₱800 | `rejected`, `reason_code='OVER_CAP'`, `chain_tx_id IS NULL` |
| Tap D3 ₱200 | `rejected`, `reason_code='EXPIRED'`, `chain_tx_id IS NULL` |
| Burst | 2 D2 taps (any origin, `simulated` irrelevant) + 30 simulated edges; Station B `frozen`; a `freeze` decision exists with `midas_score ≥ threshold` |
| Settlement | Station A: 1 `claim` tx `succeeded`; Station B: `HELD` decision with `960000000` stroops (96 XLM), no tx |
| Intake | `POST /api/intake/upload` with `masterlist.csv` → exactly 1 ghost (`DUPLICATE_PLATE` or CRC reject on the Dela Cruz duplicate), 1 `UNDERAGE`, 2 `uncertain`/`evidence_requested`; already-enrolled rows stay `enrolled` and `summary` deep-equals `{ total: 12, approved: 4, rejected: 2, uncertain: 2, enrolled: 4 }` (buckets disjoint, sum = total) |
| Enroll D4 | `POST /api/enroll` (`uid=TAPATE2E04`, `samplePhoto=d4-photo.jpg`) → card `active`, `register` + `register_agent` txs `succeeded`, `photoCheck.source='precomputed'` with `matched:true`, D4 not funded |
| Dashboard | `counts.enrolled = 5`, `counts.approved = 3`, `counts.uncertain = 2`, `counts.beneficiaries = 12` (disjoint buckets); `cards` has 5 `CardSummary` rows with 8-hex `deviceHashPrefix` and no `deviceHash`; `budget.state = 'verified'`; `midasThreshold` non-null |
| End program | 5 cards marked `swept` (D3 and D4 with `returned_stroops = 0` and no sweep tx); sum `returned_stroops = 3190000000` (319 XLM) |
| Totals invariant | funded 4,500 = spent 350 + held 960 + pending 0 + escrow remaining 0 + returned 3,190 |
| Chain coverage | Every money row (`fund`, `claim`, `sweep`, authorized tap) points to a `chain_txs` row with `status='succeeded'` |
| Labels | `price_points.simulated = 1` for every seeded price; burst taps `simulated = 1` |

If `GAS_MODE=direct` is active, the same assertions hold with `gas_mode='direct'` — the run still passes, and the report names the mode.

## 4. Manual phone checks (before the Nov 7 07:00–09:00 rehearsals)

All of these run against the **deployed app**, `https://tapat.<tailnet>.ts.net` (prod profile), after one basic-auth login on the phone. Hosting acceptance list: [deployment.md §13](deployment.md). If the **optional** Vercel frontend is switched on, substitute `https://<project>.vercel.app` and add its checklist ([deployment.md §9.4](deployment.md)); none of these checks may be skipped because of it.

- [ ] The phone loads `https://tapat.<tailnet>.ts.net/station/A` over HTTPS (not `http://`, not a LAN IP, not a quick tunnel), after the Caddy login prompt.
- [ ] **Enable NFC** is tapped as a user gesture; Chrome shows no "NFC not supported" notice.
- [ ] Each of the 4 tags produces a `reading` event and resolves the expected card; `/station/[id]` shows only `displayName` + `uidLast4` (D1 "Juan D. …9C7E", D2 "Pedro R. …3A54", D3 "Ramon B. …77B0", D4 "Ana V. …A1B2"), never a full name or a full hash.
- [ ] `/enroll` **Read card** shows only `…` + the last 4 of the normalized UID (the same string the kit note records, no colons) and posts `uid` normalized; the `simulated` picker on `/station/[id]` lists only `active` cards and keeps D3 with an `expired` tag.
- [ ] After **Run burst**, the station strip on `/demo` (and on `/`) shows Station B with a **frozen** badge and its `frozenReason`; after **Run settlement** the `/demo` settlement panel shows "A — claimed ₱350 · tx…" and "B — HELD ₱960 · station frozen".
- [ ] A read stays selected for the next **Charge** until another read or **Clear**; scanning a second tag replaces it.
- [ ] An unknown tag returns `CARD_NOT_ENROLLED` on screen with a readable message (not a raw 404).
- [ ] D1 ₱350 at Station A → **Paid** on screen in < 2 s, Telegram receipt on the team phone in < 10 s.
- [ ] Telegram receipt text matches: `TAPat ⛽ Paid ₱350.00 at Petron San Roque`, balance line, `https://stellar.expert/explorer/testnet/tx/{hash}`.
- [ ] ₱800 → the on-screen reason says over cap and names the policy's `max_amount`; D3 → expired; no tx link on either.
- [ ] **Simulate tap** picker charges D5 without a tag and the laptop dashboard updates within 1 s.
- [ ] A second scan of the same tag 1 s later creates a second nonce and still succeeds (nonce strictly increasing).
- [ ] `/enroll` with tag D4 + `d4-photo.jpg` completes in one pass; a photo mismatch (wrong plate/TODA) is blocked with 422 `PHOTO_MISMATCH` and the field named on screen.

## 5. Pre-demo dry-run checklist

Run in order at T-60 on show day. Every line is a pass/fail.

**Environment**

- [ ] Deployed app healthy: `curl https://tapat.<tailnet>.ts.net/api/health` → `{ok:true, rpc:"ok", velo:"ok", telegram:"ok", gasMode:"velo"}`, and `sudo tailscale funnel status` shows the Funnel on `:8080` ([deployment.md §7](deployment.md)).
- [ ] VM services are the ones serving: `systemctl is-active tapat-api tapat-web caddy`, and **no other API is running on the prod `.env`** (no laptop process, or the demo bot will `409`).
- [ ] Velo webhook endpoint = `https://tapat.<tailnet>.ts.net/api/webhooks/velo` — set once, unchanged since DEP2.
- [ ] If `gasMode` is `direct`, that is a recorded, accepted fallback.
- [ ] Phone tabs open on the Funnel URL after the basic-auth login: `/station/A`, `/enroll`; laptop on `https://tapat.<tailnet>.ts.net/` and `/demo`.
- [ ] Freighter unlocked on Testnet with Program Wallet and Budget Office.
- [ ] Telegram bot polling (`getUpdates` returns 200, no `409 Conflict` from a second poller).

**State**

- [ ] On the VM: `sudo -H -u tapat pnpm -C /opt/tapat --filter server tsx scripts/reset-demo.ts` then `... scripts/seed-demo.ts` completes without error; second run of both also succeeds (same physical cards, no `AlreadyRegistered`).
- [ ] D3's policy `expires_at_s` is ~600 s after seed — confirm from the card list on `/` (data from `GET /api/dashboard`), not from the wall clock.
- [ ] Budget checkout paid; badge **Velo verified ✓**; `budget_verified_stroops` = 10000000000.
- [ ] Dashboard shows five zeroed money tiles (funded / spent / held / pending / returned) and the invariant line **OK** before the run.

**Beats**

- [ ] Beat 2: **Start price feed** does not fire at index 15 and fires by index 36; 3 fund tx hashes visible.
- [ ] Beat 3: D1 ₱350 paid + receipt; ₱800 `OVER_CAP`; D3 `EXPIRED`.
- [ ] Beat 4: **Run burst** freezes Station B (frozen badge in the station strip on `/demo` and `/`); **Run settlement** → settlement panel shows A claimed (tx), B `HELD ₱960`.
- [ ] Beat 5: scan upload summary reads 4 approved + 4 already enrolled, 1 ghost, 1 underage, 2 uncertain; evidence request arrives on the team phone; D4 enrolls (dashboard counts then approved 3 / enrolled 5).
- [ ] Beat 6: **End program** → 3 sweep txs, returned ₱3,190.
- [ ] Totals: funded ₱4,500 / spent ₱350 / held ₱960 / pending ₱0 / returned ₱3,190; invariant line **OK**.
- [ ] `GET /api/export/coa.csv` downloads with 9 columns, one row per money event, tx hash on every on-chain row.
- [ ] Fallbacks exercised once today: **Simulate tap** works (and satisfies the burst gate); `GAS_MODE=direct` restart takes ≤ 15 s; on a laptop, `/?sse=direct` reconnects the dashboard stream; the SSH-forward hosting fallback in [deployment.md §10](deployment.md) step 2 was tried once; backup video plays offline.

**People**

- [ ] Printer runbook + Q&A card in hand.
- [ ] Phone screen timeout raised, notifications off.
- [ ] Backup video and the prod `.env` backup (USB) on the laptop, plus the basic-auth credentials card.

## 6. What is not tested by design

- Real OCR and vision inference (fixtures only) — labelled `precomputed`.
- Velo hosted checkout UI beyond creating the session and polling the intent.
- Telegram delivery guarantees (we test < 10 s on the demo network once).
- Concurrency beyond the sequential demo path: one station, one settlement runner, one tranche fire.
