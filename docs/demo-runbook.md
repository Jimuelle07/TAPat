# TAPat Demo Runbook

Everything one person needs to run the 3-minute TAPat demo on testnet, plus the fallbacks and the judge answers.

On Nov 8 the face-to-face pitch is **5 minutes: this 3-minute script runs inside it, followed by 3 minutes of Q&A** (session 13:00–20:00).

Last updated: 2026-11-05

## 1. Kit

| Item | Detail | Check at T-60 |
|---|---|---|
| Laptop | Charger, Chrome, Freighter extension imported with **Program Wallet** and **Budget Office**, both on Testnet. | Charged, Freighter unlocked on Testnet. |
| Deployed app | The prod profile on the VM at `https://tapat.<tailnet>.ts.net` ([deployment.md](deployment.md)). Nothing to start here — only check it. | `GET /api/health` green before you leave. |
| Basic-auth card | The Caddy user and password for `https://tapat.<tailnet>.ts.net`, handwritten on a card. Every device logs in once per browser. | Written on the card, two copies. |
| Prod `.env` on USB | The prod `.env` backup ([deployment.md §8](deployment.md)). Needed only for the laptop-host fallback. | File opens and shows 24 variables. |
| Android phone | Chrome, NFC **on**, screen timeout 10 min. This is the station terminal and the enrollment device. | Already logged in to the Funnel URL; NFC toggle visible. |
| NFC tags | 4 labelled tags: **D1** (card, Telegram linked), **D2** (card), **D3** (sticker, policy expires 600 s after seed), **D4** (sticker, blank — enrolled on stage). NTAG213/215/216 only. | Each tag scanned once in the NFC Tools app. |
| Team phone | Telegram open, logged in as the bot's chat partner, linked to **D1** and to one **uncertain** driver for the evidence beat. | `/start <link_code>` already sent for both. |
| Hotspot | Phone hotspot as backup internet. | Hotspot name/password on a sticky note. |
| Backup video | The **2-minute demo video** and the full-length backup recording, both filmed Nov 7 09:00–10:30, on the laptop and on a USB stick. | Both play with Wi-Fi off. |
| Printed runbook | This file, plus the Q&A card from §5. | Two copies. |

**Optional Vercel frontend:** if the team switched it on ([deployment.md §9](deployment.md)), the phone and the judges may use `https://<project>.vercel.app` instead of the Funnel URL; if anything about it misbehaves, fall back to the Funnel URL, which always works.

## 2. T-minus timeline

| Time | Action | Expected |
|---|---|---|
| **T-60** | Confirm the deployment, not a tunnel: `curl https://tapat.<tailnet>.ts.net/api/health` from the laptop, and `sudo tailscale funnel status` over `ssh <ssh-user>@<ip>` ([deployment.md §7](deployment.md)). | `GET /api/health` → `{ok:true, rpc:"ok", velo:"ok", telegram:"ok", gasMode:"velo"}`. The URL is stable — there is nothing to copy, and the Velo webhook already points at `${PUBLIC_BASE_URL}/api/webhooks/velo`. |
| **T-40** | Log in with the basic-auth card on the phone and the laptop, then re-open the phone tabs over the **Funnel URL** (Web NFC needs HTTPS and a user gesture): `/station/A`, `/enroll`. Laptop on `/` and `/demo`. | Each tab loads after one auth prompt; `/station/A` offers a "Enable NFC" button. With no program yet, every page shows "No active program — run `seed-demo.ts`". |
| **T-30** | On the VM: `ssh <ssh-user>@<ip>` (`<ssh-user>` is `ubuntu` on Oracle Cloud, your Google-account user on GCP — [deployment.md §6.2](deployment.md)), then `sudo -H -u tapat pnpm -C /opt/tapat --filter api tsx scripts/reset-demo.ts` and `sudo -H -u tapat pnpm -C /opt/tapat --filter api tsx scripts/seed-demo.ts` ([deployment.md §7](deployment.md)). | Program `active`; D1, D2, D3, D5 enrolled; card count 4; D3 policy expires 600 s after seed time. `/` shows four cards and the **Fund budget** button (badge `none`). `reset-demo` first, every time. |
| **T-20** | On `/` click **Fund budget**. Freighter (Budget Office) pays the Velo checkout for ₱10,000 (1,000 XLM). | Badge goes to "Waiting for Velo…" then **Velo verified ✓** within 3 s of payment (webhook, else poller). `budget.verifiedStroops` = 10000000000 (1,000 XLM), `remainingStroops` = 10000000000. |
| **T-10** | Laptop on `/` (dashboard). Phone on `/station/A`. Second phone tab on `/enroll`. Phone on `/demo` when the beat starts. Silence notifications. | Tabs pre-warmed, no spinner. |
| **T-0** | Start talking. | — |

If you are re-running after a failed attempt: on the VM (as at T-30) `reset-demo.ts`, `seed-demo.ts`, then the budget checkout again (a new `budget:${programId}:${seq}` idempotency key is generated per attempt).

## 3. The 3-minute script

UI routes: `/` dashboard, `/intake`, `/enroll`, `/station/[id]`, `/demo`. Total 185 s (3:05); hard ceiling 3:30.

| # | Beat | Sec | Spoken line | Exact click / tap | Expected on screen |
|---|---|---|---|---|---|
| 1 | Problem | 20 | "723,000 drivers, ₱5,000 each. ₱2.7B nearly lost to ghosts, ₱709.88M never delivered. The money moves as one lump sum with no rules and no way back." | Stand on `/`, no click. The seeded state is visible: budget ₱10,000 verified, four enrolled cards, funded ₱0, no taps. | Budget badge **Velo verified ✓**, four enrolled cards, five zeroed money tiles (funded, spent, held, pending, returned) plus the invariant line **OK**. |
| 2 | Agent funds | 40 | "This is the Tranche Agent. It watches the DOE diesel price. Here is a one-day spike — it ignores it, because one day is not a shift. Now the real move." | `/demo` → **Start price feed** (`POST /api/agents/tranche/start`). | Price chart streams one point per 700 ms. The day-15 spike raises the changepoint probability briefly and then decays; at day ~34 the probability crosses, the tranche card lights up, and three fund tx hashes appear. Decision panel shows price, segment mean, cp probability, MAP run length. |
| 3 | Tap and pay | 30 | "Driver 1, ₱350 at Station A." — *tap* — "Paid. Free receipt in Telegram." | Phone `/station/A`: amount `350`, **Read card** (or tap tag **D1**), **Charge**. The read shows only `…9C7E` and stays selected for the next charge until another read or **Clear**. Then amount `800`, charge again. Then tag **D3**, amount `200`, charge. | ₱350 → **Paid** + tx hash; Telegram receipt arrives on the team phone in < 10 s. ₱800 → declined `OVER_CAP`, no tx, message names the ₱500 cap. D3 ₱200 → declined `EXPIRED`, no tx. Activity feed on `/` shows all three. |
| 4 | Agent freezes | 35 | "Now a burst at Station B. Two near-cap taps, then a flood." | Phone `/station/B` (or the collapsed **Simulate tap** picker below **Read card** on the laptop — either way it is a real `authorize`): two taps of `480` with tag **D2**. Then laptop `/demo` → **Run burst** (`POST /api/agents/freeze/burst`). Then **Run settlement** (`POST /api/settlement/run`). | MIDAS-F score rises on the `/demo` edge chart toward the `midasThreshold` line; the **station strip** on `/demo` (and `/` on the laptop) flips Station B to a **frozen** badge with its reason. **Settlement result panel** on `/demo`: "A — claimed ₱350 · tx…", "B — HELD ₱960 · station frozen" (no tx). If someone presses **Run burst** before any authorized Station-B tap, the button shows **"Tap D2 at Station B first"** — make the taps, press again. |
| 5 | No ghosts | 30 | "Drop a messy scanned list." — *upload* — "One ghost, one underage driver, two uncertain. The uncertain ones get asked for evidence automatically — no caseworker queue." Then: "Enroll driver 4: one tap, one photo." | `/intake` → upload `fixtures/masterlist/scanned-list.png` (`POST /api/intake/upload`). Show the Telegram evidence request on the team phone. Then phone `/enroll`: pick D4's record, **Read card** on sticker **D4** (the read shows only `…` + last 4), pick `d4-photo.jpg`, **Enroll** (`POST /api/enroll`). | Intake summary: **4 approved + 4 already enrolled**, 1 **rejected — ghost (duplicate)**, 1 **rejected — underage**, 2 **uncertain** with deep links (the 8 genuine rows, 4 of them seeded); λ_lo/λ_hi and α/β visible. Telegram: the Tagalog OR/CR evidence request. Enrollment: card `active`, `photoCheck` shows the precomputed plate/TODA **matched**, two chain txs `succeeded`; the dashboard counts then read approved 3 / enrolled 5. |
| 6 | Money comes back | 20 | "Program ends. Unspent money goes back to the LGU the same day." | Laptop `/demo` → **End program** (`POST /api/program/end`). | Per-card sweep txs: D1 ₱1,150, D2 ₱540, D5 ₱1,500 returned. D3 (policy expired) and D4 (enrolled after the tranche) have ₱0 escrow, so they are marked swept with 0 and no sweep tx (D4 still gets a `revoke_agent` tx). Dashboard: five tiles read funded ₱4,500, spent ₱350, held ₱960, pending ₱0, returned ₱3,190; the invariant line still says **OK**. |
| 7 | Close | 10 | "The agent pays when the crisis is real, refuses when the pattern is wrong, and returns what's left. Testnet alpha on Noir and Velo — auditable today." | Stand on `/` with the five money tiles visible. | All totals visible: 4,500 / 350 / 960 / 0 / 3,190, invariant **OK**. |

### Expected totals and the arithmetic

| Tile | Amount | Where it comes from |
|---|---|---|
| Funded | **₱4,500** | 3 escrows × ₱1,500 tranche (D1, D2, D5). D3 is skipped — its policy expired. |
| Spent | **₱350** | D1, one authorized-and-claimed tap at Station A. |
| Held | **₱960** | D2, 2 × ₱480 at the frozen Station B — authorized, pending, not claimable. |
| Pending | ₱0 | Station A was claimed; Station B is frozen. |
| Returned | **₱3,190** | D1 (1,500 − 350 = 1,150) + D2 (1,500 − 960 = 540) + D5 (1,500 − 0 = 1,500). |

Check: 350 + 960 + 3,190 = **4,500** ✓ and funded = spent + held + pending + escrow remaining + returned (escrow remaining is ₱0 after the sweeps).

D3's rejected ₱200, the ₱800 `OVER_CAP` tap, and the 30 simulated burst edges move **no money**: rejected and refused rows have `chain_tx_id = NULL`.

### Button → endpoint map

`/demo` has exactly **five buttons**, in this order: **Start price feed**, **Run burst**, **Run settlement**, **Unfreeze Station B**, **End program**.

| Screen | Control | Endpoint |
|---|---|---|
| `/` | Fund budget (badge state `none`) / Open checkout (`waiting`) | `POST /api/program/budget-checkout` (state from `GET /api/dashboard.budget`) |
| `/` | (auto) totals, cards, budget badge | `GET /api/dashboard` |
| `/` | (auto) live updates | `GET /api/stream` (SSE) |
| `/` | Export COA CSV | `GET /api/export/coa.csv` |
| `/intake` | Upload list | `POST /api/intake/upload` |
| `/intake` | Thresholds panel | `GET /api/intake/calibration` |
| `/intake` | Request evidence | `POST /api/beneficiaries/:id/request-evidence` |
| `/enroll` | Enroll | `POST /api/enroll` |
| `/enroll` | Beneficiary search | `GET /api/beneficiaries` |
| `/station/[id]` | Read card → Charge (posts the normalized UID) | `POST /api/taps` |
| `/station/[id]` | Simulate tap picker (collapsed; labelled `simulated`; lists only `active` cards, D3 tagged `expired`) | `POST /api/taps` with `{cardId, amountPhp, simulated:true}` |
| `/demo` | Start price feed | `POST /api/agents/tranche/start` |
| `/demo` | (auto) price chart + tranche decision panel | `GET /api/agents/tranche/state` + SSE `price`/`tranche` |
| `/demo` | (auto) edge chart + station strip | `GET /api/dashboard` (`recentTaps`, `midasThreshold`, `stations`) + SSE `tap`/`freeze` |
| `/demo` | (auto) settlement result panel | the last `POST /api/settlement/run` response (`SettlementResponse`) |
| `/demo` | Tranche state | `GET /api/agents/tranche/state` |
| `/demo` | Run burst | `POST /api/agents/freeze/burst` |
| `/demo` | Run settlement | `POST /api/settlement/run` |
| `/demo` | Unfreeze Station B (LGU only) | `POST /api/stations/B/unfreeze` |
| `/demo` | End program | `POST /api/program/end` |

## 4. Fallbacks

| Failure | Symptom | Fix (say nothing, keep talking) |
|---|---|---|
| NFC | No `reading` event, or the card is not read twice. | The **Simulate tap** picker under **Read card** expands on the failed read; pick the driver by initial + `uidLast4` (`Juan D. …9C7E`). Say "same code path, the tap is simulated". |
| Gas Station | 5xx from Velo Gas, or `chain_txs.gas_mode` stuck. | On the VM: `ssh <ssh-user>@<ip>`, `sudo -H -u tapat nano /opt/tapat/apps/api/.env` to set `GAS_MODE=direct`, then `sudo systemctl restart tapat-api` (~10 s), keep going. Velo still verifies the budget and delivers the webhooks. Never resubmit a `submission_unknown` tx. |
| Webhook | Budget badge stays on "Waiting for Velo…". | Say nothing; the 3 s poller credits within 3 s. If it does not, re-open `/` to force a `GET /api/dashboard`. |
| Budget checkout | Freighter rejects, or `/?budget=cancel` toast appears. | Badge returns to **Fund budget**; press it again (a new `budget:${programId}:${seq}` key). There is no surviving budget to fall back on — `reset-demo.ts` deletes every row, including `velo_intents` — so retry once with Freighter unlocked; if Velo is still failing, skip beat 2 and narrate the tranche from the backup video. |
| No program | Every page shows "No active program — run `seed-demo.ts`". | `seed-demo.ts` (T-30), then the budget checkout. Never present on this state. |
| Testnet / RPC down | `GET /api/health` shows `rpc:"down"`, taps fail with 502. | Play the backup video and narrate over it. Do not fight it on stage. |
| Telegram | Receipt does not arrive. | Show the activity feed row on `/`: `TAP_REASON_LABELS` label + tx link. It is written regardless. |
| SSE | Dashboard stops updating. | Reload `/` on the Funnel URL first. `/?sse=direct` is **local only**: it points the dashboard at `http://localhost:4000/api/stream`, which does not exist on the deployed origin. If Funnel SSE is genuinely broken, use the hosting rows below. |
| Funnel down | Nothing loads at `https://tapat.<tailnet>.ts.net`; `ssh` still works. | [deployment.md §10](deployment.md) step 2: SSH port-forward `-L 3000:127.0.0.1:3000 -L 4000:127.0.0.1:4000`, open `http://localhost:3000` on the laptop (there `/?sse=direct` does work); the phone uses **Simulate tap** on the laptop. |
| VM down | Neither the Funnel URL nor `ssh` answers. | [deployment.md §10](deployment.md) step 3: host on Jim's laptop with the prod `.env` from the USB, then `tailscale funnel 3000`. ~10 min, and the demo state starts fresh. |
| Tailscale down entirely | No Funnel and no SSH forward. | [deployment.md §10](deployment.md) step 4: laptop + `cloudflared tunnel --url http://localhost:3000` for the **phone pages only** (`/station/*`, `/enroll`). Keep `/` and `/demo` on `http://localhost:3000` — a quick tunnel carries no SSE. |
| Basic auth | 401 loop, or the phone keeps asking. | Retype the Caddy user and password from the credentials card. The file is `/etc/caddy/tapat-users` on the VM ([deployment.md §5.1](deployment.md)). |
| Wrong seed state | D3 taps still authorize; totals off. | On the VM: `reset-demo.ts` → `seed-demo.ts` → budget checkout. Takes ~40 s; use a fallback beat to buy time. |

## 5. Judge Q&A

| Question | Answer |
|---|---|
| Where's the agent, really? | Two agents move money on their own: the Tranche Agent funds escrows, and the Freeze Agent withholds a station's settlement. Both act inside limits the LGU signed — per-tap cap, tranche size, verified budget, expiry. |
| Is AI deciding who gets aid? | Inside an error bound the LGU sets. Conformal risk control caps wrongful denials at α = 0.05 and ghost admissions at β = 0.02, uncertain drivers are asked for evidence automatically over Telegram, and every rejection can be appealed in one tap. |
| Do stations need new hardware? | No. Any NFC-capable Android phone runs the station page in Chrome. |
| What stops a station from overcharging? | The on-chain per-tap cap enforced by `authorize()`, a Telegram receipt to the driver on every tap, and the Freeze Agent pausing stations with anomalous tap patterns. |
| NFC cards can be cloned. | One agent per card caps the damage to one driver's allocation: the policy's `max_amount` and the escrow balance bound any loss. |
| Can you restrict spending to fuel? | Honest answer: **Noir has no merchant allow-list.** `authorize()` accepts any merchant address. What TAPat adds: card agent keys are held server-side and the service only signs `authorize()` for **registered station accounts** in our own DB, and settlement `claim()` is signed by those same station accounts. A missing allow-list at the contract layer is one of the first things we would add for mainnet. |
| What about data privacy? | OCR and matching run on the LGU laptop. Stations see a card hash prefix, a first name and initial, and the tap result — never full names. |
| Is the fuel crisis over? | Fuel spikes recur, and the rail works for any AICS-style program. |
| Is this production-ready? | No. Testnet alpha, like Noir and Velo. Mainnet needs a security audit first, and non-custodial card agents. |

### Updated answers for the demo build

| Question | Answer |
|---|---|
| Why not a Velo checkout session per tap? | Velo marks an intent paid only for a **classic payment** to the project's fixed receiver address — escrow `authorize()`/`claim()` can never satisfy it. So TAPat uses Velo where it verifies exactly: a **Velo-verified budget checkout** for the program funding, **Gas Station sponsoring every Noir call**, and **signed webhooks** for the credit. Per tap, the enforcement is Noir's cap/expiry/escrow and the driver's receipt. Replacing "checkout session per tap" with this is the design correction we made after reading Velo's verification code. |
| What happens to held money? | It stays in the driver's escrow as pending payments. Noir has no clawback of pending payments, so the only release is the LGU unfreezing the station and running settlement — then `claim()` pays the station. If the program ends first, the money still returns to the LGU only after the station is unfrozen and claimed, or through the sweep path for unspent escrow. The dashboard shows it as **held**, never as spent. |
| Is the OCR real? | Precomputed in this build. The pipeline is real and accepts a CSV live; the PNG path looks up `scanned-list.ocr.json` by the file's SHA-256, and unlabelled images return 422 `OCR_UNAVAILABLE` rather than pretending. Swapping in a real OCR model is one adapter. |
| What is simulated in this demo? | The DOE price series, the 30 burst tap edges, the OCR/vision outputs, and the OR/CR matching are labelled `simulated` or `precomputed` in the UI and in SQLite. Every contract write, escrow balance, and tx hash is real on Stellar Testnet. |
| Why hold the card agent keys on a server? | Demo simplification so enrollment is one minute. Cards stay owned by the Program Wallet, so a compromised server cannot steal escrow — sweeps return to the LGU. Production moves each agent key to the driver's device or a passkey. |
