# TAPat Demo Runbook

Everything one person needs to run the 3-minute TAPat demo on testnet, plus the fallbacks and the judge answers.

On Nov 8 the face-to-face pitch is **5 minutes: this 3-minute script runs inside it, followed by 3 minutes of Q&A** (session 13:00–20:00).

Last updated: 2026-11-07

## 1. Kit

| Item | Detail | Check at T-60 |
|---|---|---|
| Laptop | Charger, Chrome, Freighter extension imported with **Program Wallet** and **Budget Office**, both on Testnet. | Charged, Freighter unlocked on Testnet. |
| Deployed app | The prod profile on the VM at `https://tapat.tail1b0e59.ts.net` ([deployment.md](deployment.md)). The site is public: there is no site password, only the officer login (§3 "First step"). Nothing to start here — only check it. | `GET /api/health` green before you leave. |
| Seeded cards | Seeded cards are virtual: D1 `…AL01`, D2 `…AL02`, D3 `…AL03`, D5 `…AL05`; use **Simulate tap** for them. Physical tags D1/D2/D3 only work if the seed was given `--uid-d1=<UID> --uid-d2=<UID> --uid-d3=<UID>` (read each full UID once in the NFC Tools app). D4 enrolls any sticker. | UIDs written next to each tag, or the **Simulate tap** picker lists all four cards. |
| Prod `.env` on USB | The prod `.env` backup ([deployment.md §8](deployment.md)). Needed only for the laptop-host fallback. | File opens and shows 24 variables. |
| Android phone | Chrome, NFC **on**, screen timeout 10 min. This is the station terminal and the enrollment device. | Already logged in as the officer on the Funnel URL; NFC toggle visible. |
| NFC tags | 4 labelled tags: **D1** (card, Telegram linked), **D2** (card), **D3** (sticker, policy expires 600 s after a plain seed, 300 s after a replay), **D4** (sticker, blank — enrolled on stage). NTAG213/215/216 only. D1–D3 are only live if the seed named their UIDs (see **Seeded cards**). | Each tag scanned once in the NFC Tools app. |
| Team phone | Telegram open, logged in as the bot's chat partner, linked to **D1** (the beat-3 receipt). **Re-link D1 after every replay**: the cards are new, so the old link is gone. | `/start <link_code>` already sent for the current D1. |
| Hotspot | Phone hotspot as backup internet. | Hotspot name/password on a sticky note. |
| Backup video | The **2-minute demo video** and the full-length backup recording, both filmed Nov 7 09:00–10:30, on the laptop and on a USB stick. | Both play with Wi-Fi off. |
| Printed runbook | This file, plus the Q&A card from §5. | Two copies. |

**Optional Vercel frontend:** if the team switched it on ([deployment.md §9](deployment.md)), the phone and the judges may use `https://<project>.vercel.app` instead of the Funnel URL; if anything about it misbehaves, fall back to the Funnel URL, which always works.

## 2. T-minus timeline

| Time | Action | Expected |
|---|---|---|
| **T-60** | Confirm the deployment, not a tunnel. From the laptop: `pnpm --filter server tsx scripts/demo-preflight.ts --base-url=https://tapat.tail1b0e59.ts.net` (read-only, no secrets), then `curl https://tapat.tail1b0e59.ts.net/api/health` and, over `ssh <ssh-user>@<ip>`, `sudo tailscale funnel status` ([deployment.md §7](deployment.md)). | Preflight's last line is `GO` (exit 0); `NO-GO (<n> failures)` lists each drift, so replay (below) and run it again. A `WARN gasMode is "direct"…` line means Noir writes are not Velo-sponsored on this run; it never blocks `GO`. `GET /api/health` → `{ok:true, rpc:"ok", velo:"ok", telegram:"ok", gasMode:"velo"}` is the target; prod currently reports `direct`, and switching is Jim's VM `.env` change (§4 Gas Station row in reverse). The URL is stable — there is nothing to copy, and the Velo webhook already points at `${PUBLIC_BASE_URL}/api/webhooks/velo`. |
| **T-40** | Log in as the officer on the phone and the laptop (§3 "First step"), then re-open the phone tabs over the **Funnel URL** (Web NFC needs HTTPS and a user gesture): `/station/A`, `/enroll`. Laptop on `/desktop` and `/demo` (a laptop is sent from `/x` to `/desktop/x` automatically). | Each tab loads; `/station/A` offers **Read card** (Chrome on Android with NFC on) and **Simulate tap**. With no program yet, every page shows **No active program** — run `seed-demo.ts`. |
| **T-30** | If preflight already said `GO`, skip this step. Otherwise on the VM: `ssh <ssh-user>@<ip>` (`<ssh-user>` is `ubuntu` on Oracle Cloud, your Google-account user on GCP — [deployment.md §6.2](deployment.md)), stop `tapat-api` first (`sudo systemctl stop tapat-api`; `reset-demo.ts` has no API guard of its own) and start it after (`sudo systemctl start tapat-api`), then `sudo -H -u tapat pnpm -C /opt/tapat --filter server tsx scripts/reset-demo.ts` and `sudo -H -u tapat pnpm -C /opt/tapat --filter server tsx scripts/seed-demo.ts --officer-email=<email> [--officer-password=<password>]` ([deployment.md §7](deployment.md)); on an already-seeded deployment use the one-command replay in the paragraph below the table instead. `--officer-email` defaults to `officer@tapat.demo`; without `--officer-password` the seed generates one. Optional `--budget-intent=<paid intent id>` adopts a Velo payment intent that is already paid (credited only after Velo reports `paid`) and prints `Budget: … verified by Velo`; without it, T-20's live **Fund budget** checkout stays the path. The seed also loads `masterlist.csv` through intake and prints `Masterlist: total=… approved=… rejected=… uncertain=… enrolled=…`. On an already-seeded deployment (the seed refuses while a program exists) run `sudo -H -u tapat pnpm -C /opt/tapat --filter server tsx scripts/create-officer.ts --officer-email=<email> [--officer-password=<password>]` instead — it creates or promotes the officer without touching the program or the chain — and copy its printed login into the submission form. | Program `active`; D1, D2, D3, D5 enrolled; card count 4; D3 policy expires 600 s after seed time. `/desktop` shows four cards and a **Fund budget** button (budget panel **No budget yet**). The seed prints `Officer login: <email> / <password>` (or `Officer login: <email> (password unchanged)` on a re-run): copy it into the submission form. `reset-demo` first, every time. |
| **T-20** | On `/desktop` click **Fund budget** (the **Fund the budget** sheet opens; press **Fund budget** in it). Freighter (Budget Office) pays the Velo checkout for ₱10,000 (1,000 XLM). Skip this if the seed or replay adopted a paid intent. | Status goes to **Waiting for Velo…** then **Verified by Velo** (laptop) or **Velo verified** (phone) within 3 s of payment (webhook, else poller). `budget.verifiedStroops` = 10000000000 (1,000 XLM), `remainingStroops` = 10000000000. |
| **T-10** | Laptop on `/desktop`. Phone on `/station/A`. Second phone tab on `/enroll`. Phone on `/demo` when the beat starts. Silence notifications. | Tabs pre-warmed, no spinner. |
| **T-0** | Start talking. | — |

If you are re-running after a failed attempt, or a judge pressed buttons: on the VM run `sudo systemctl stop tapat-api; sudo -H -u tapat pnpm -C /opt/tapat --filter server tsx scripts/replay-demo.ts [--uid-d1=…]; sudo systemctl start tapat-api`, then preflight. Add `--dry-run` first to see the steps (no chain calls and no data changes). The replay settles, ends the program, resets and re-seeds in one command; it reuses the already-paid Velo intent (no Freighter), defaults D3's expiry to 300 s (preflight says `NO-GO` on D3 until then; never go below ~180 s: the seed registers D1 and D2 first, and a D3 expiry already in the past fails the seed), leaves the officer password unchanged, and refuses to run while `tapat-api` is up. Re-link D1's Telegram (`/start <link_code>`) afterwards, because the cards are new.

**Warning:** anyone can sign up as an officer on the public URL and press buttons. Run preflight right before presenting, and replay if it says `NO-GO`.

## 3. The 3-minute script

UI routes: `/` is a static landing page with hardcoded sample numbers — never present from it. The live dashboard is `/desktop` on the laptop and `/dashboard` on the phone; the other routes are `/intake`, `/enroll`, `/station/[id]` and `/demo` (with `/demo/tranche`, `/demo/freeze`, `/demo/settlement`, `/demo/end`). A laptop browser is redirected from `/x` to `/desktop/x`, so the paths below work on both. Total 185 s (3:05); hard ceiling 3:30.

**First step (~10 s): log in as the officer.** On the laptop and on the phone, press **Log in** in the top-right and use the officer account from the submission form (each browser keeps its own session). Every state-changing button is locked with "Officer login required" until an officer session is active; the session lasts 12 h.

| # | Beat | Sec | Spoken line | Exact click / tap | Expected on screen |
|---|---|---|---|---|---|
| 1 | Problem | 20 | "723,000 drivers, ₱5,000 each. ₱2.7B nearly lost to ghosts, ₱709.88M never delivered. The money moves as one lump sum with no rules and no way back." | Stand on `/desktop` (phone: `/dashboard`), no click. The seeded state is visible: budget ₱10,000 verified, four enrolled cards, funded ₱0, no taps. | Budget status **Verified by Velo** (laptop) or **Velo verified** (phone), four enrolled cards, the ledger with funded and the five parts (spent, held, pending, escrow, returned) all ₱0, and the invariant line **Invariant holds: funded equals spent + held + pending + escrow + returned.** (laptop) or **Balanced** (phone). |
| 2 | Agent funds | 40 | "This is the Tranche Agent. It watches the DOE diesel price. Here is a one-day spike — it ignores it, because one day is not a shift. Now the real move." | `/demo` → **Start price feed** (opens `/demo/tranche`), then press **Start price feed** there (`POST /api/agents/tranche/start`; the button reads **Feed running** while it streams). | Price chart streams one point per 700 ms. The **One-day spike ignored** notice appears for the day-15 spike (changepoint probability briefly up, then decays); at day ~34 the probability crosses, the tranche status lights up, and three fund tx hashes appear under **Funding**. The **Tranche decision** card shows price, segment mean, threshold, changepoint probability and run length. |
| 3 | Tap and pay | 30 | "Driver 1, ₱350 at Station A." — *tap* — "Paid. Free receipt in Telegram." | Phone `/station/A`: amount `350`, **Read card** (or tap tag **D1**; a virtual card uses **Simulate tap** → `Juan D. …AL01`), **Charge**. The read shows only `…` and the last 4 characters of the UID (virtual D1: `…AL01`) and stays selected for the next charge until another read or **Clear**. Then amount `800`, charge again. Then **D3**, amount `200`, charge. | ₱350 → **Paid** + tx hash; Telegram receipt arrives on the team phone in < 10 s. ₱800 → declined `OVER_CAP`, no tx, message names the ₱500 cap. D3 ₱200 → declined `EXPIRED`, no tx. **Recent activity** on `/desktop` (**Recent taps** on the phone) shows all three. |
| 4 | Agent freezes | 35 | "Now a burst at Station B. Two near-cap taps, then a flood." | Phone `/station/B` (or the **Simulate tap** button on the laptop's `/desktop/station/B` — either way it is a real `authorize`): two taps of `480` with **D2**. Then laptop `/demo` → **Run burst** (opens `/demo/freeze`), and press **Run burst** there (`POST /api/agents/freeze/burst`; the button reads **Burst running**). Back on `/demo`, press **Run settlement** (`POST /api/settlement/run`, posts in place and opens `/demo/settlement`). | MIDAS-F score rises on the `/demo/freeze` edge chart toward the `midasThreshold` line, and a **Station B frozen** notice shows its reason; the **Stations** list on `/demo` (and the dashboard) flips Station B to **Frozen**. **Last run** on `/demo/settlement`: "A — claimed ₱350 · tx…", "B — HELD ₱960" with "Station frozen, no tx". If **Run burst** is pressed before any authorized Station-B tap, `/demo/freeze` shows **Burst did not start** and the button turns into **Go to Station B** — make the taps, press **Run burst** again. |
| 5 | No ghosts | 30 | "Drop a messy scanned list." — *upload* — "One ghost, one underage driver. The ghost can appeal in one tap — no caseworker queue." Then: "Enroll driver 4: one tap, one photo." | `/intake` → choose `fixtures/masterlist/scanned-list.png`, press **Upload masterlist** (`POST /api/intake/upload`). Open the rejected ghost row under **Rejected**; its beneficiary page has **Appeal with evidence** (`POST /api/beneficiaries/:id/request-evidence`; **Request evidence** appears only for `uncertain` rows). The **Send the link by hand** sheet then shows the deep link; it appears only when `telegramSent` is false. Then phone `/enroll`: pick D4's record, **Read card** on sticker **D4** (the read shows only `…` + last 4), pick `d4-photo.jpg`, **Enroll** (`POST /api/enroll`). | Intake results: **6 approved + 4 already enrolled**, 1 **rejected — ghost (duplicate plate)**, 1 **rejected — underage**, **0 uncertain**; λ_lo = λ_hi = 0.05 and α/β visible under **Calibration**. The ghost row moves to `evidence_requested` and its `deepLink` is rendered (the chat is not linked, so `telegramSent: false`). Enrollment: card `active`, `photoCheck` shows the precomputed plate/TODA **matched**, two chain txs `succeeded`; the dashboard counts then read approved 5 / enrolled 5. |
| 6 | Money comes back | 20 | "Program ends. Unspent money goes back to the LGU the same day." | Laptop `/demo` → **End program** (opens `/demo/end` with the **End this program?** confirm sheet); press **End program** in the sheet (`POST /api/program/end`; **Keep running** cancels). | Per-card sweep txs: D1 ₱1,150, D2 ₱540, D5 ₱1,500 returned. D3 (policy expired) and D4 (enrolled after the tranche) have ₱0 escrow, so they are marked swept with 0 and no sweep tx (D4 still gets a `revoke_agent` tx). **Returned to the LGU wallet** shows ₱3,190 with a **Per card** list. **View final totals**: funded ₱4,500, spent ₱350, held ₱960, pending ₱0, returned ₱3,190; the invariant line still says **Invariant holds: …** (laptop) or **Balanced** (phone). |
| 7 | Close | 10 | "The agent pays when the crisis is real, refuses when the pattern is wrong, and returns what's left. Testnet alpha on Noir and Velo — auditable today." | Stand on `/desktop` (phone: `/dashboard`) with the ledger visible. | All totals visible: 4,500 / 350 / 960 / 0 / 3,190, invariant **Invariant holds: …** (laptop) or **Balanced** (phone). |

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

`/demo` has exactly **five buttons**, in this order: **Start price feed**, **Run burst**, **Run settlement**, **Unfreeze Station B**, **End program**. **Start price feed**, **Run burst** and **End program** open a sub-page (`/demo/tranche`, `/demo/freeze`, `/demo/end`) where the POST happens; **Run settlement** posts in place and then opens `/demo/settlement`. Every state-changing control in this map needs an officer session: a logged-out visitor is sent to log in first, and only a legacy viewer account (signup now creates officers only) sees **Officer login required** instead of the button.

| Screen | Control | Endpoint |
|---|---|---|
| `/desktop` (phone `/dashboard`) | Fund budget (status **No budget yet**) / Open checkout (**Waiting for Velo**), via the **Fund the budget** sheet | `POST /api/program/budget-checkout` (state from `GET /api/dashboard.budget`) |
| `/desktop` (phone `/dashboard`) | (auto) ledger, cards, budget status | `GET /api/dashboard` |
| `/desktop` (phone `/dashboard`) | (auto) live updates | `GET /api/stream` (SSE) |
| `/desktop` (phone `/dashboard`) | Export for COA | `GET /api/export/coa.csv` |
| `/intake` | Upload masterlist | `POST /api/intake/upload` |
| `/intake/beneficiaries/[id]` | Appeal with evidence (`rejected`) / Request evidence (`uncertain`) | `POST /api/beneficiaries/:id/request-evidence` |
| `/enroll` | Enroll | `POST /api/enroll` |
| `/enroll` | Beneficiary search | `GET /api/beneficiaries` |
| `/station/[id]` | Read card → Charge (posts the normalized UID) | `POST /api/taps` |
| `/station/[id]` | Simulate tap picker (collapsed; labelled `simulated`; lists only `active` cards, D3 tagged `expired`) | `POST /api/taps` with `{cardId, amountPhp, simulated:true}` |
| `/demo/tranche` | Start price feed | `POST /api/agents/tranche/start` |
| `/demo/tranche` | (auto) price chart + tranche decision card | `GET /api/agents/tranche/state` + SSE `price`/`tranche` |
| `/demo/freeze` | (auto) edge chart | `GET /api/dashboard` (`recentTaps`, `midasThreshold`) + SSE `tap`/`freeze` |
| `/demo` | (auto) **Stations** list | `GET /api/dashboard` (`stations`) + SSE `freeze` |
| `/demo/settlement` | (auto) **Last run** list | the `settlement` decisions in `GET /api/dashboard` after `POST /api/settlement/run` |
| `/demo/freeze` | Run burst | `POST /api/agents/freeze/burst` |
| `/demo` | Run settlement | `POST /api/settlement/run` |
| `/demo` | Unfreeze Station B (LGU only) | `POST /api/stations/B/unfreeze` |
| `/demo/end` | End program (confirm sheet) | `POST /api/program/end` |

## 4. Fallbacks

| Failure | Symptom | Fix (say nothing, keep talking) |
|---|---|---|
| NFC | No `reading` event, or the card is not read twice. | The **Simulate tap** picker under **Read card** expands on the failed read; pick the driver by initial + `uidLast4` (`Juan D. …AL01`). Say "same code path, the tap is simulated". |
| Gas Station | 5xx from Velo Gas, or `chain_txs.gas_mode` stuck. | On the VM: `ssh <ssh-user>@<ip>`, `sudo -H -u tapat nano /opt/tapat/apps/server/.env` to set `GAS_MODE=direct`, then `sudo systemctl restart tapat-api` (~10 s), keep going. Velo still verifies the budget and delivers the webhooks. Never resubmit a `submission_unknown` tx. To go the other way (prod reports `direct` today), set `GAS_MODE=velo` the same way. |
| Webhook | Budget status stays on **Waiting for Velo…**. | Say nothing; the 3 s poller credits within 3 s. If it does not, re-open `/desktop` (phone `/dashboard`) to force a `GET /api/dashboard`. |
| Budget checkout | Freighter rejects, or the **Checkout cancelled** toast appears (Velo returns to `/?budget=cancel`, which redirects to the dashboard). | Status returns to **No budget yet** with **Fund budget**; press it again (a new `budget:${programId}:${seq}` key). There is no surviving budget to fall back on — `reset-demo.ts` deletes every row, including `velo_intents` — so retry once with Freighter unlocked; if Velo is still failing, skip beat 2 and narrate the tranche from the backup video. A replay reuses the paid intent, so it needs no checkout. |
| No program | Every page shows **No active program**. | `seed-demo.ts` (T-30) or the replay, then the budget checkout if it was not adopted. Never present on this state. |
| Testnet / RPC down | `GET /api/health` shows `rpc:"down"`, taps fail with 502. | Play the backup video and narrate over it. Do not fight it on stage. |
| Telegram | Receipt does not arrive. | Show the activity feed row on `/desktop/activity` (phone `/activity`): `TAP_REASON_LABELS` label + tx link. It is written regardless. |
| SSE | Dashboard stops updating. | Reload `/desktop` (phone `/dashboard`) on the Funnel URL first. `/?sse=direct` (it redirects to the dashboard) is **local only**: it points the stream at `http://localhost:4000/api/stream`, which does not exist on the deployed origin. If Funnel SSE is genuinely broken, use the hosting rows below. |
| Funnel down | Nothing loads at `https://tapat.<tailnet>.ts.net`; `ssh` still works. | [deployment.md §10](deployment.md) step 2: SSH port-forward `-L 3000:127.0.0.1:3000 -L 4000:127.0.0.1:4000`, open `http://localhost:3000` on the laptop (there `/?sse=direct` does work); the phone uses **Simulate tap** on the laptop. |
| VM down | Neither the Funnel URL nor `ssh` answers. | [deployment.md §10](deployment.md) step 3: host on Jim's laptop with the prod `.env` from the USB, then `tailscale funnel 3000`. ~10 min, and the demo state starts fresh. |
| Tailscale down entirely | No Funnel and no SSH forward. | [deployment.md §10](deployment.md) step 4: laptop + `cloudflared tunnel --url http://localhost:3000` for the **phone pages only** (`/station/*`, `/enroll`). Keep `/desktop` and `/demo` on `http://localhost:3000` — a quick tunnel carries no SSE. |
| Wrong seed state | D3 taps still authorize; totals off; a judge pressed buttons; preflight says `NO-GO`. | On the VM: `sudo systemctl stop tapat-api; sudo -H -u tapat pnpm -C /opt/tapat --filter server tsx scripts/replay-demo.ts [--uid-d1=…]; sudo systemctl start tapat-api`, then preflight. Add `--dry-run` first to see the steps (no chain calls and no data changes). It reuses the paid Velo intent (no Freighter), defaults D3's expiry to 300 s, leaves the officer password unchanged, and refuses to run while `tapat-api` is up. Re-link D1's Telegram afterwards. Use a fallback beat to buy time. |

## 5. Judge Q&A

| Question | Answer |
|---|---|
| Where's the agent, really? | Two agents move money on their own: the Tranche Agent funds escrows, and the Freeze Agent withholds a station's settlement. Both act inside limits the LGU signed — per-tap cap, tranche size, verified budget, expiry. |
| Is AI deciding who gets aid? | Inside an error bound the LGU sets. Conformal risk control caps wrongful denials at α = 0.05 and ghost admissions at β = 0.02, every rejection can be appealed in one tap (the officer sends the evidence request from the row, over Telegram when the chat is linked and as a deep link otherwise), and hard rules such as the under-18 check are visible in the row's `ruleCode`. |
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
