# TAPat — Product Requirements Document

Product requirements for TAPat, a hackathon prototype that lets an AI agent release, cap, and return fuel aid for tricycle drivers, enforced on-chain by Noir and settled through Velo.

Last updated: 2026-11-05

Companion docs: [`system-design.md`](system-design.md) (how it is built), [`algorithms.md`](algorithms.md) (the decision math), [`api-and-data.md`](api-and-data.md) (endpoints, schema, env), [`demo-runbook.md`](demo-runbook.md) (the 3-minute script).

---

## 1. Problem

The 2026 fuel subsidy showed the trade-off every aid program faces: safe and slow, or fast and leaky. Money moves as one lump sum with no rules attached and no way to recover it until an audit a year later.

| Statistic | Figure | Source |
|---|---|---|
| Drivers slated for the subsidy | 723,000 tricycle drivers at ₱5,000 each | Philippine News Agency (PNA), as cited in `TAPat Hackathon Build Plan.pdf` |
| Leakage at risk | ₱2.7B nearly lost to duplicate and ghost beneficiaries | DSWD, via Daily Tribune, as cited in the build plan |
| Money that never arrived | ₱709.88M in DOTr subsidies unpaid or expired, leftovers returned to the treasury after two years | COA, via Astig.ph and NET25, as cited in the build plan |
| Human cost | DSWD kept payouts in person to stop ghosts; drivers fainted in heat-exposed queues | Build plan, page 1 |

Consequences the product must answer:

1. **No rules on the money.** Once aid is disbursed, nothing stops an over-cap charge or a charge from a station that was never vetted.
2. **No recovery.** Unspent or misused funds are only discovered at audit time.
3. **Verification is manual.** Duplicate and ghost beneficiaries are caught by caseworkers, which is why payouts happen in person and in queues.
4. **Aid arrives late.** A tranche is released on a budget calendar, not on the price shock that actually hurts drivers.

## 2. Users

| User | Role in TAPat | Surface |
|---|---|---|
| LGU program officer | Creates the program, uploads the masterlist, reviews uncertain records, freezes/unfreezes stations, ends the program | Web dashboard `/` |
| TODA enrollment officer | Verifies a driver's identity, taps their card, confirms the plate/TODA photo | Phone `/enroll` |
| Station attendant | Enters the peso amount, has the driver tap the card | Phone `/station/[id]` |
| Driver | Taps the card to pay for fuel, receives a receipt in Telegram | NFC card/sticker + Telegram bot |
| COA auditor | Exports a per-event CSV of every money movement with tx hashes | `GET /api/export/coa.csv` |
| LGU Budget Office | Pays the program budget through a Velo checkout | Freighter wallet on the laptop |

Roles are labels only. Team ownership of the build is tagged **Jim**, **Dev2**, **BegA**, **BegB** in [`build-schedule.md`](build-schedule.md).

## 3. Goals and the three agent money decisions

TAPat's goal is a closed loop: **a clean list in, a driver enrolled in a minute, and an agent that funds, refuses, and returns money.**

The product is judged on three money decisions made by software, each inside limits the LGU signs:

| # | Decision | Agent | On-chain enforcement |
|---|---|---|---|
| G1 | **Fund** — release a tranche only when a price shift is real and above the LGU threshold, and only within verified budget | Tranche Agent | `payment_escrow.fund_escrow()` per card, signed by the Program Wallet |
| G2 | **Refuse** — reject an over-cap or expired payment, and freeze a station whose tap pattern is anomalous | Card agent (per-tap policy) + Freeze Agent | `agent_registry.register_agent()` policy (`max_amount`, `asset`, `expires_at`) enforced inside `payment_escrow.authorize()`; freeze holds `claim()` |
| G3 | **Return** — send unspent balances back to the LGU at program end, the same day | Sweep runner | `agent_registry.revoke_agent()` then `payment_escrow.sweep_on_revoke()` |

Supporting goal (not a money decision, but required for G1): the budget itself is **ledger-verified** before any tranche may be funded — see D1.1 in [`system-design.md`](system-design.md).

### 3.1 Program defaults (D2)

Fixed values for the demo program. Every doc and every seed script uses these; they are stored on the `program` row.

| Parameter | Value | Stored as |
|---|---|---|
| On-chain asset | Native XLM via its SAC (`CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`) | `XLM_SAC_ID` |
| Display rate | `PHP_PER_XLM = 10` (demo rate) | env |
| Per-tap cap | ₱500 (50 XLM = 500,000,000 stroops) | `per_tap_cap_stroops` |
| Tranche per card | ₱1,500 (150 XLM = 1,500,000,000 stroops) | `tranche_stroops` |
| Budget deposit | ₱10,000 (1,000 XLM = 10,000,000,000 stroops) | budget checkout amount |
| Price threshold | ₱65.00 per litre | `price_threshold_php` |
| Policy expiry | `2026-11-30T23:59:59+08:00` (`expires_at_s`) | `expires_at_s` |
| Max wrongful-denial rate α | 0.05 | `alpha` |
| Max ghost-admission rate β | 0.02 | `beta` |

Units: stroops = XLM × 10^7. All money is stored and passed to the chain as integer stroops; pesos exist only at the display and input edges, formatted through `money.ts` in the `@tapat/shared` package (`packages/shared`). The UI labels ₱ values as computed at the **demo rate**.

## 4. Features

Each feature states a user story, acceptance criteria an implementer can test, and whether its data is **real** (produced live by this build) or **simulated/precomputed** (labelled as such per D7).

### F1 — Ghost-free masterlist

**User story.** As an LGU program officer, I upload the messy masterlist I already have and get a clean, defensible list of who is approved, who is rejected and why, and who needs one extra document — without a caseworker queue.

**Acceptance criteria.**

1. `POST /api/intake/upload` accepts `multipart` `file`. A `.png`/`.jpg` is hashed with SHA-256; if the digest matches the `sha256` field of an `fixtures/masterlist/*.ocr.json` fixture, its rows are ingested with `source='ocr_precomputed'`. Any other image returns **422 `OCR_UNAVAILABLE`** with message "OCR model not bundled in demo build; upload CSV".
2. A `.csv` is parsed with the exact columns `last_name,first_name,middle_name,suffix,birthdate(YYYY-MM-DD),plate,toda,barangay`, ingested with `source='csv'`.
3. Every row then goes through names → matcher → hard rules → conformal risk control (CRCs) exactly as specified in [`algorithms.md`](algorithms.md): hard rules `UNDERAGE`, `PLATE_MULTI_NAME`, `DUPLICATE_PLATE` run first and always block; otherwise `s ≥ λ_hi` → `approved`, `s < λ_lo` → `rejected`, in between → `uncertain`.
4. Each affected row stores `score`, `status`, `rule_code`, `decision_reason`, and emits one `intake` SSE event; an `agent_decisions` row with `agent='intake'` records λ_lo, λ_hi, α, β, and the row counts.
5. `GET /api/intake/calibration` returns λ_lo, λ_hi, α, β, n, and the empirical wrongful-denial and ghost-admission rates.
6. Each `uncertain` record is moved to `evidence_requested`; with a linked Telegram chat it also receives the evidence-request message, and unlinked records show the server-composed `telegramDeepLink` (`https://t.me/${TELEGRAM_BOT_USERNAME}?start=${link_code}`) in the UI. `POST /api/beneficiaries/:id/request-evidence` re-sends the request and is also the one-tap appeal: it works from `uncertain` **and** `rejected` (including hard-rule rejections), and 409s from `approved`, `enrolled` and `evidence_requested`.
7. On the demo masterlist, the outcome is exactly **8 genuine (1 ghost and 1 underage rejected, 2 uncertain)** — the fixture is 12 rows = 8 genuine including D1–D5 + 1 ghost + 1 underage + 2 uncertain. Because the demo uploads it after the seed, `IntakeResponse.summary` reads `{ total: 12, approved: 4, rejected: 2, uncertain: 2, enrolled: 4 }`: the 4 seeded genuine rows (D1, D2, D3, D5) keep `enrolled` and are never reported as "approved". If the counts are not these, edit fixture rows — never α, β, or matcher weights.
8. A driver who sends an OR/CR photo as a Telegram file is matched by SHA-256 against `fixtures/orcr/*.json`; equal plate → `approved` and reply `Verified ✅ Pwede ka nang mag-enroll sa TODA.` Any other document → `Natanggap namin. Ire-review ng LGU officer.` with status unchanged.

**Real / simulated.** Matching, rules, CRC and thresholds are **real** (computed live, seeded calibration set). OCR text and the OR/CR match are **precomputed** — the API reads fixture JSON and the UI marks those rows `precomputed`.

### F2 — One-minute enrollment

**User story.** As a TODA enrollment officer, I tap a blank card and take one photo, and the driver is enrolled with a per-tap cap, the program asset, and the program expiry already enforced on-chain.

**Acceptance criteria.**

1. `POST /api/enroll` (multipart) takes `beneficiaryId` (must be `approved`), `uid` (the normalized UID returned by **Read card** on `/enroll`, i.e. `readUid()`'s output with colons already removed and uppercased), and either `samplePhoto` (the committed sample `d4-photo.jpg`) or an uploaded `photo`.
2. The UID is normalized (colons removed, uppercased) and must then match `^[0-9A-Z]{4,32}$` (alphanumeric, so virtual UIDs such as `TAPATVIRTUAL05` pass), else **400 `VALIDATION_ERROR`**.
3. The card hash is `device_hash = SHA-256(utf8("${program.salt}:${UID}"))` (D3). The raw UID and the full hash are never stored for display or shown anywhere: the API exposes only `deviceHashPrefix` (first 8 hex chars) and `uidLast4`.
4. Photo check: a fixture sample resolves to precomputed `{plate, toda}`, which must equal the record after normalization (uppercase, spaces and dashes removed) — otherwise **422 `PHOTO_MISMATCH`**. An uploaded photo has no model in this build and requires `officerConfirmed=true`, else **422 `PHOTO_CONFIRMATION_REQUIRED`**. The response's `photoCheck` reports `{source, plate, toda, matched}` so the officer sees what was compared.
5. On success the API creates the card's agent keypair, friendbot-funds it, then calls `device_registry.register(programWallet, device_hash, agent)` and `agent_registry.register_agent(programWallet, device_hash, agent, max_amount=cap, asset=XLM_SAC, expires_at=program.expires_at)` — the Program Wallet signs both, so sweeps return to the LGU. Card status `active`, beneficiary status `enrolled`, SSE `enroll`.
6. A UID that already has a non-`failed` card in this program returns **409 `CARD_ALREADY_ENROLLED`**. A new program gets a new salt, so the same physical card can be re-enrolled.
7. Any chain failure leaves the card in `failed` with the error stored, and retrying the same UID **reuses that card row and keypair**, resuming at the failed step (if `device_registry.get_owner(device_hash)` already returns the Program Wallet, `register` is skipped). A second card row is never created.
8. Only `uidLast4` and `deviceHashPrefix` are displayed; the station and dashboard never receive the full UID or the full hash.

**Real / simulated.** Card creation, key generation, both registry calls and Gas Station sponsorship are **real** on testnet. The plate/TODA photo result is **precomputed** from `fixtures/enroll/d4-photo.json` and is labelled so in the UI.

### F3 — Tranche Agent

**User story.** As an LGU program officer, I want the tranche released by the price shock itself — not by a budget calendar — so drivers get help the week fuel spikes, within money the LGU actually verified.

**Acceptance criteria.**

1. `POST /api/agents/tranche/start` resets the stream and plays `fixtures/prices/doe-diesel-sim.json` one point per `PRICE_TICK_MS=700`. Each point emits SSE `price` and writes a `price_points` row with `cp_recent` and `map_r`.
2. BOCPD runs on every point. The fire rule is exactly: `cpRecent ≥ 0.9` ∧ `3 ≤ r* < t−1` ∧ `mean(last r*+1 prices) ≥ price_threshold_php` (₱65.00).
3. The one-day spike at point 15 must **not** fire. The sustained shift fires near point 34 (accepted window: index 33–36).
4. Eligible cards are `status='active'` with `expires_at > now`, in enrollment order. For each, the amount is `min(tranche_stroops, budget_remaining)`.
5. Funding stops when remaining budget is below one tranche, and one `agent_decisions` row (agent `tranche`, decision `BUDGET_EXHAUSTED`) is logged with the numbers.
6. Each card is funded by a sequential `payment_escrow.fund_escrow(token, programWallet, device_hash, amount)` signed by the Program Wallet, fee-sponsored through Velo Gas Station. Each funding writes a `chain_txs` row (`kind='fund'`) and emits SSE `chain_tx`.
7. Exactly **one** decision row (agent `tranche`, decision `FUNDED`) records `{price, segment mean, threshold, cp prob, MAP run length, budget before/after, cards funded/skipped with reasons, tx hashes}` and emits SSE `tranche`.
8. The agent fires **at most once per program** (`program.tranche_fired`).
9. Expired cards (D3, `expires_at` ≈ seed time + 600 s) are skipped with reason `EXPIRED` and never produce a tx. `pnpm --filter server tsx scripts/seed-demo.ts` takes `--d3-expiry-offset=<seconds>` (default `600`, i.e. `expires_at_s = now + 600`; must be > 0 because Noir's `register_agent` rejects a past expiry with `InvalidPolicy`); `pnpm demo:e2e` passes `30` and waits until D3 has expired before starting the price feed.
10. On the seeded demo program the agent funds **D1, D2 and D5** ("funds three escrows", 3 × ₱1,500 = ₱4,500) in enrollment order. D4 is enrolled live on stage *after* the tranche has fired, so it is never funded — with no escrow, a payment attempt would return `INSUFFICIENT_ESCROW`, and the demo does not attempt one.

**Real / simulated.** BOCPD, the trigger rule and the funding transactions are **real**. The price series is **simulated** (`fixtures/prices/doe-diesel-sim.json`, generated by `gen-prices.ts` seed 3) and every UI surface labels it `simulated`.

### F4 — Tap to pay

**User story.** As a station attendant, I type the peso amount, the driver taps their card, and the payment is either accepted with a receipt or refused with a reason — in seconds, with no new hardware.

**Acceptance criteria.**

1. `POST /api/taps` takes `{stationId, amountPhp, uid}` for a **Read card** tap (the normalized UID), or `{stationId, amountPhp, cardId, simulated:true}` for the simulated-tap picker. A Simulate-tap tap is still a real on-chain `authorize`; `simulated` only records how the card was identified.
2. Evaluation order is fixed and observable:
   1. Station `frozen` → **423 `STATION_FROZEN`**, no chain call, tap row `refused`.
   2. No card for that `device_hash` in this program → **404 `CARD_NOT_ENROLLED`**.
   3. Otherwise submit `payment_escrow.authorize(agent, device_hash, merchant=stationAccount, XLM_SAC, amount, nonce)`.
3. `nonce = max(Date.now(), cards.last_nonce + 1)` and is persisted **before** submit.
4. There is no local pre-check: the contract refuses during the SDK's `prepare()` simulation, so no tx is submitted. On a `NoirContractError` from `authorize` with code 3 (`AgentNotAuthorized`), the API calls the SDK's `checkPayment({deviceHash, agent, asset, amount, requireEscrow: false})` and maps its reason: `expired` → **`EXPIRED`**; `over_limit` → **`OVER_CAP`**; `no_agent`/`wrong_agent`/`wrong_asset`/`invalid_amount` → **`POLICY_DENIED`**. Code 2 (`InsufficientBalance`) → **`INSUFFICIENT_ESCROW`**. Any other contract code (`6`, `8`, `9`, `10`, `11`, …) is a **`failed`** tap with `reason_code = null` and **502 `CHAIN_ERROR`**. `TapResponse.message` carries the sentence the station page shows, e.g. "Declined: ₱800.00 is over the ₱500.00 per-tap cap — rejected by the Noir contract (simulation of `authorize` returned Error #3); no tx submitted".
5. Every attempt writes one `taps` row with `status` ∈ `authorized|rejected|refused|failed`, its `reason_code`, `nonce`, `chain_tx_id`, `simulated`, and is fed to the Freeze Agent.
6. A linked driver gets a Telegram receipt for both outcomes, within 10 s:
   - `TAPat ⛽ Paid ₱{amt} at {station}\nBalance: ₱{bal}\nTx: https://stellar.expert/explorer/testnet/tx/{hash}`
   - `TAPat ⛽ Declined ₱{amt} at {station}: {reason}`
7. SSE `tap` carries the tap row. The station page shows paid/declined with the reason and the tx hash.
8. Fees are never paid by the station or the driver: every call goes through the Gas Station (`GAS_MODE=velo`), falling back to a direct submission through the Noir SDK (`noir.submit`) only when `sponsor()` failed before hand-off and `GAS_FALLBACK_DIRECT=true`.
9. Demo tap matrix at Station A (station id `A`, route `/station/A`; Station B is id `B`, route `/station/B`): D1 ₱350 → `authorized`; ₱800 → **`OVER_CAP`**; D3 ₱200 → **`EXPIRED`**.

**Real / simulated.** Everything on the tap path is **real**: Web NFC UID read, nonce, `authorize`, Gas Station sponsorship, Telegram receipt. Only taps created by the burst/`simulated:true` path are marked `simulated` in the DB and UI.

### F5 — Freeze Agent

**User story.** As an LGU program officer, I want a station that starts charging near the cap every time, or suddenly far above its normal volume, paused automatically — before its claim is settled.

**Acceptance criteria.**

1. On program start the agent replays 60 ticks of honest history (`fixtures/taps/honest-history.json`, seed 7) to set baselines; replay is labelled `simulated`.
2. Every tap edge (real or simulated) is scored with MIDAS-F (2×1024 Count-Min Sketch, decay 0.6, χ² score, log1p of edge/source/destination maxima).
3. Two LGU rules are evaluated on every tick: `NEAR_CAP_STREAK` = 3 consecutive taps ≥ 90% of cap at one station; `VOLUME_SPIKE` = taps at one station in the last 10 ticks > 3 × that station's baseline mean per 10 ticks.
4. The station is frozen when `midas_score ≥ apps/server/config/midas.json.threshold` **or** any rule fires. Station `status='frozen'` with `frozen_reason` and `frozen_at`; one `agent_decisions` row (agent `freeze`) records score, threshold, and firing rule; SSE `freeze` carries the decision plus `stationId`/`stationStatus`. `GET /api/dashboard` exposes the same `midasThreshold` so the edge chart can draw the line.
5. Freezing is **prospective plus settlement-blocking**: new taps are refused with **423 `STATION_FROZEN`** before signing, and that station's `claim()` is skipped. Pending payments already authorized stay in the escrow.
6. Unfreezing is manual only: `POST /api/stations/:id/unfreeze` (the `/demo` **Unfreeze Station B** button) sets status `active` and clears the reason. Held pending is released by the next settlement run.
7. The demo burst is split in two halves by design. Two D2 taps of ₱480 at Station B (₱480 each, sequential) go through `POST /api/taps` first — made with **Read card** on the phone or with **Simulate tap** on a laptop; either way it is a real on-chain `authorize`, and the `simulated` flag does not affect the gate. **Run burst** (`POST /api/agents/freeze/burst`) then posts only the 30 simulated edges from `fixtures/taps/burst.json` (20 virtual cards → Station B over 3 ticks, 100 ms apart). Because the honest baseline needs an authorized edge at that station, burst returns **409 `INVALID_STATE`** with the message `"Tap D2 at Station B first"` until at least one authorized Station-B tap exists. The score crosses the threshold within those 30 edges and Station B freezes; the frozen badge appears in the station strip on `/` and `/demo`.

**Real / simulated.** MIDAS-F, the rules, and the freeze decision are **real**. The honest baseline and the 30-edge burst are **simulated** fixtures, labelled as such.

### F6 — Sweep-back and dashboard (incl. COA CSV)

**User story.** As an LGU program officer, at program end I want the unspent money back in the LGU wallet the same day, and one screen (and one CSV) that shows funded, spent, held and returned with a tx hash behind every number.

**Acceptance criteria.**

1. `POST /api/program/end` sets program status `ending`.
2. Per card, sequentially: if the policy is still active, `agent_registry.revoke_agent(programWallet, device_hash)` (Program Wallet signs). Then read `payment_escrow.balance_of(device_hash)`:
   - balance > 0 → `payment_escrow.sweep_on_revoke(XLM_SAC, device_hash, agent)`, card `swept` with `returned_stroops` set, one `chain_txs` row (`kind='sweep'`), decision `SWEPT`, SSE `sweep`.
   - balance = 0 (e.g. D3, never funded, or a card whose whole tranche was spent) → **skip `sweep_on_revoke`**: no tx, card `swept` with `returned_stroops = 0`, decision `SKIPPED` with reason `EMPTY_ESCROW`. Noir would return 0 and move nothing, so skipping only saves a sponsored tx; `revoke_agent` still runs when the policy is active.
3. `device_registry.revoke` is **not** called on stage; `pnpm --filter server tsx scripts/reset-demo.ts` performs it between runs.
4. Program status becomes `ended`. Each card gets one `agent_decisions` row (agent `sweep`, `SWEPT` or `SKIPPED`, returned amount and tx hash), followed by one `PROGRAM_ENDED` row.
5. `GET /api/dashboard` returns funded, spent per station, held (pending at frozen stations), pending (pending at active stations), escrow remaining, returned, the budget badge state, the card summaries, `stations`, and the disjoint beneficiary counts — computed from our DB plus chain reads. `/` renders **five money tiles** (funded, spent, held, pending, returned) plus one invariant line showing escrow remaining and **OK / MISMATCH**: **funded = spent + held + pending + escrow remaining + returned**, plus a **station strip** (name, active/frozen badge, frozen reason, spent, pending, held), the card list, and one merged activity feed (`recentTaps` + `recentDecisions`, newest first). `/demo` renders the same station strip, the **edge chart** (MIDAS score per tap against the `midasThreshold` line) and the **settlement result panel** (one line per station from `SettlementResponse`: "A — claimed ₱350 · tx…", "B — HELD ₱960 · station frozen") — those are the observation points for a freeze and for held money.
6. `GET /api/export/coa.csv` returns columns `timestamp,event,card_hash_prefix,station,amount_php,amount_xlm,tx_hash,agent_decision_id` covering every money event: fund, authorize, claim, held decision, sweep, budget credit.
7. `POST /api/settlement/run` settles each station with `pending_balance > 0`: a frozen station logs decision **`HELD`** with the amount and submits no tx; an active station gets `payment_escrow.claim(XLM_SAC, station)` signed by the station account. SSE `settlement`.

**Real / simulated.** Sweeps, claims, dashboard arithmetic, and the CSV are **real**. Nothing on this path is simulated.

## 5. Hackathon fit

TAPat must show an **agentic payment** built **with Velo** and using **all three Noir contracts for what they were built for**. The Builder Handbook (Nov 5) states six build requirements; all six are submission-eligibility conditions, not suggestions.

| Requirement (Builder Handbook, Nov 5) | How TAPat meets it |
|---|---|
| An agentic payment (submission eligibility) | Two agents move money inside LGU-signed limits: the Tranche Agent funds escrows, the Freeze Agent refuses taps and withholds settlement. See the `Agentic payment` row below |
| **Noir only through `@noirx402/agent-sdk`** (eligibility) | Every read and write goes through `@noirx402/agent-sdk@0.3.0` (pinned exactly) in `packages/agent/src/chain/noir.ts`; there is no direct contract invocation. `createNoirClient` throws unless the SDK's `TESTNET` contract IDs and passphrase equal `NOIR_*_ID` / `STELLAR_NETWORK_PASSPHRASE`, and `apps/server` refuses to boot on a mismatch, because calling other contract IDs does not count |
| Built with the **Velo SDK** for the rest | `@carts1024/velo-sdk@1.0.0` pinned exactly (npm `latest` = 1.0.0, published 2026-11-05; the handbook's `@alpha` advice predates that release): the budget checkout, the Gas Station sponsor/submit, and the signed webhooks |
| Stellar **Testnet** | Every contract ID, tx hash, and Stellar Expert link in this repo is Testnet; XLM is displayed as PHP at the fixed demo rate |
| Public GitHub **monorepo** with the handbook's root `README.md` template | One pnpm workspace (`apps/server`, `apps/web`, `packages/agent`, `packages/shared`) and a root `README.md` in the handbook's section order |
| A **live website** reachable at submission | `https://tapat.<tailnet>.ts.net` (the Funnel URL, behind basic auth), kept up and seeded from submission through judging ([deployment.md §11](deployment.md)) |

Judging criteria and weights (Builder Handbook, Nov 5):

| Criterion | Weight |
|---|---|
| Agentic payments fit | 30% |
| Technical execution | 25% |
| Innovation | 20% |
| Real-world potential | 15% |
| Pitch and demo | 10% |

How the build maps to the Noir and Velo requirements:

| Requirement | How TAPat meets it |
|---|---|
| Agentic payment | Tranche Agent funds (`fund_escrow`); Freeze Agent withholds settlement (skips `claim`) and refuses new taps; per-card agents request payment (`authorize`) inside a policy the LGU signed |
| Built with Velo — budget checkout | The LGU Budget Office wallet pays one Velo checkout intent for the program budget; the intent is ledger-verified (webhook + polling) before any tranche can be funded |
| Built with Velo — Gas Station | Every contract write is fee-sponsored: `velo.gas.sponsor(xdr, {idempotencyKey})`, then exactly one `velo.gas.submit(...)`; a non-terminal status goes to the reconciler (`getStatus`), never a resubmission |
| Built with Velo — signed webhooks | `POST /api/webhooks/velo` verifies `x-velo-signature` (HMAC over the raw body) and dedupes on `x-velo-delivery` |
| Noir `device_registry` | `register` (one device per driver card, owned by the Program Wallet/LGU) and `revoke` (reset only) |
| Noir `agent_registry` | `register_agent` (per-card `max_amount`, asset `XLM_SAC`, `expires_at`), `revoke_agent` (at sweep), `get_policy` (the SDK reads it as `getPolicy`). `check_payment` is enforced inside `payment_escrow.authorize`, so a policy breach surfaces as `AgentNotAuthorized=3`; the SDK's `checkPayment` then names the reason |
| Noir `payment_escrow` | `fund_escrow` (tranche), `authorize` (tap), `claim` (settlement), `sweep_on_revoke` (return) |

| Contract | Testnet ID |
|---|---|
| `device_registry` | `CAC4KOLHDLDYDWBOKXNKRN5KVHO56PLOIFXDLTBUWGVN6GVDEB7FQHU5` |
| `agent_registry` | `CCMZDSPTLX7IIJWCYEUM5DJUHOSOYSTHGK777S2TXZWEMC5ZZGPJ3EBV` |
| `payment_escrow` | `CC7EAW5FNJEDBS7THM5IT6XIOHO4AOYMLXT3KSZ3HWUIKEACTW7E5BFS` |
| Native XLM SAC | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |

Each automatic decision is backed by a published algorithm, so a COA auditor can check the number instead of trusting the agent: **Conformal Risk Control** (approve/reject with a bounded wrongful-denial rate, arXiv 2208.02814), **BOCPD** (fund only on a sustained shift, arXiv 0710.3742), **MIDAS-F** (freeze on an anomalous tap pattern, arXiv 1911.04464 / 2009.08452). Specs and test vectors: [`algorithms.md`](algorithms.md).

### 5.1 Correction vs the build plan PDF (D1.8)

The build plan's PDF says "**Checkout session per tap**". That is superseded, and this section is the only place the original wording appears outside the judge Q&A in [`demo-runbook.md`](demo-runbook.md).

**Why.** Velo marks a payment intent `paid` only for a classic `payment` operation whose destination is the Velo project's owner address, with the exact asset and the exact amount. A Noir `authorize()` or `claim()` call is a contract invocation, so it can never mark a Velo intent paid. The Velo receiver address is fixed per project, and the only way to submit a payment is Velo's hosted checkout page.

**What TAPat does instead.** Velo verifies the **budget** (one checkout intent from the LGU Budget Office to the Program Wallet's project) and then sponsors **every Noir call** through the Gas Station, with signed webhooks and idempotent delivery handling. Taps themselves are escrow authorizations, not checkout sessions. The replacement phrase used in the pitch is: **"Velo-verified budget checkout + Gas Station on every Noir call + signed webhooks."**

## 6. Demo-scope limits

Each limit is deliberate and stated to judges rather than hidden.

1. **Testnet only.** Everything runs on Stellar Testnet; XLM is displayed as PHP at the fixed demo rate `PHP_PER_XLM = 10`, labelled "demo rate" in the UI.
2. **No real OCR or vision.** OCR text and plate/TODA/OR-CR photo results are precomputed fixtures, labelled `precomputed`. The CSV path is fully live.
3. **No PDAX cash-out.** Drivers receive no fiat in this build (PDAX is UAT only), so "money returned" means returned to the LGU wallet.
4. **No clawback of held pending payments.** Noir has no mechanism to reverse a pending payment. A frozen station's held money is released only by LGU unfreeze → `claim`.
5. **Custodial station and card-agent keys.** Station secrets and encrypted card-agent secrets live server-side for the demo; a production build would move them to HSM/device custody.
6. **Simulated streams.** The price series, the burst edges, and the honest baseline are fixtures; only real phone taps and real transaction results are live.
7. **Not production hosting.** The apps run on one always-free VM behind Tailscale Funnel at `https://tapat.<tailnet>.ts.net`, with one shared basic-auth login in front — a demo vehicle, not a production deployment ([deployment.md](deployment.md)).

## 7. Success metrics for the demo

1. **The 3-minute script runs end to end on testnet** — all 7 beats, one take, from `GET /api/health` green to the dashboard totals.
2. **Every money action shows a tx hash** — each fund, authorize, claim, and sweep row carries a `succeeded` `chain_txs` row, visible on screen and in the COA CSV.
3. **The fallback path works** with the internet up but Gas Station down: set `GAS_MODE=direct`, restart the API (≈10 s), and the same script completes with `gas_mode='direct'` rows.
4. **Expected end state of the demo program** (asserted by `pnpm demo:e2e`):

| Line | Amount | Where it came from |
|---|---|---|
| Funded | ₱4,500 | 3 tranches × ₱1,500: D1, D2, D5 |
| Spent | ₱350 | D1 at Station A |
| Held | ₱960 | D2, 2 × ₱480 pending at frozen Station B |
| Returned | ₱3,190 | (1,500 − 350) + (1,500 − 960) + 1,500 |

Arithmetic check: 350 + 960 + 3,190 = 4,500 ✓ (matches funded exactly, and D3/D4 were never funded).
