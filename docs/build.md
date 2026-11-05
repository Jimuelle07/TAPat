# TAPat MVP Sprint — "Demo-ready by Nov 7"

The sprint that ends with the full TAPat MVP working on Stellar testnet: all six features run the 3-minute demo end to end by **Nov 7, 14:00 (feature freeze)**.
Last updated: 2026-11-05

This is the **sprint view**: what the MVP is, what counts as "working", and what we cut if we fall behind. Per-task owners, dependencies, and acceptance checks live in [build-schedule.md](build-schedule.md); this doc points to its task IDs (`C4`, `TR`, `UI2`, …) and does not repeat them.

## 1. Sprint goal

> On Nov 7 at 14:00, `reset-demo` → `seed-demo` → budget checkout → the 7 demo beats run on testnet without a code change. The dashboard ends at **funded ₱4,500 / spent ₱350 / held ₱960 / pending ₱0 / returned ₱3,190**, and every money step has a `succeeded` tx hash.

| | |
|---|---|
| Sprint window | Nov 5 PM → Nov 7 14:00 (≈ 2 working days) |
| Team | Jim (integration owner), Dev2, BegA, BegB — role tags as in [build-schedule.md](build-schedule.md) |
| Demo script | [demo-runbook.md §3](demo-runbook.md) |
| Proof of done | `pnpm demo:e2e` green + one full manual rehearsal on the phone ([test-plan.md](test-plan.md)) |

## 2. MVP scope

### Must work (the demo fails without it)

| Feature | "Working" means (observable on screen) | Build tasks | Owner |
|---|---|---|---|
| **Velo budget** | **Fund budget** on `/` → Freighter pays the Velo checkout → badge **Velo verified ✓** within 3 s (webhook or poller) | C5 | Jim |
| **F3 Tranche Agent** | **Start price feed** on `/demo`: day-15 spike ignored, fires near day 34, funds D1/D2/D5 (3 fund tx hashes), D3 skipped as expired, decision panel shows its numbers | BOC, TR | Dev2, Jim |
| **F4 Tap to pay** | `/station/A`: D1 ₱350 → **Paid** + tx; ₱800 → declined `OVER_CAP`; D3 ₱200 → declined `EXPIRED`; no tx on declines | C1–C4, UI2 | Jim, BegA |
| **F5 Freeze Agent** | Two D2 ₱480 taps at `/station/B` + **Run burst** → Station B **frozen**; **Run settlement** → A claimed (tx), B **HELD ₱960** (no tx) | MID, FRZ, SET | Dev2 |
| **F1 Ghost-free masterlist** | Upload on `/intake` (after the seed) → 4 approved + 4 already enrolled (8 genuine), 1 ghost, 1 underage, 2 uncertain; λ_lo/λ_hi and α/β visible | NM, MT, FIX1–2 | Dev2, BegB |
| **F2 Enrollment** | `/enroll`: D4 record + **Read card** on the sticker + `d4-photo.jpg` → card `active`, `register` + `register_agent` txs | C3, FIX3 | Jim, BegB |
| **F6 Sweep-back + dashboard** | **End program** → sweep txs for D1/D2/D5, totals match §1, invariant line shows OK | SW, SSE | Jim, Dev2 |
| **Demo scripts** | `reset-demo.ts` + `seed-demo.ts` repeatable on the same physical cards | SED | Jim |
| **Honesty labels** | Price series and burst edges say `simulated`; OCR/photo results say `precomputed` | UI1, UI2 | BegA |

### Should work (shown in the demo, but has a fallback)

| Item | Fallback if not ready by Nov 7 12:00 |
|---|---|
| Gas Station sponsorship on every Noir call | `GAS_MODE=direct` (decided at the Nov 5 23:00 go/no-go); Velo story = budget checkout + webhooks |
| **Hosted at the stable Funnel URL** (`https://tapat.<tailnet>.ts.net`, one always-free VM, Caddy + basic auth, [deployment.md](deployment.md)) | **Jim's laptop + Funnel** (`tailscale funnel 3000`, [deployment.md §10](deployment.md) step 3) — same URL shape, ~10 min of setup, demo state starts fresh |
| Web NFC reads on the phone | **Simulate tap** picker on `/station/[id]` |
| Telegram receipts + evidence request (TG1) | Receipt text visible in the dashboard activity feed |
| OCR image branch (`scanned-list.png`) | Upload `masterlist.csv` on `/intake` (same rows, same result) |
| OR/CR evidence match in Telegram | Show the evidence request only; skip the reply |
| COA CSV export | Show the dashboard tiles only |
| *Optional:* `apps/web` also published on Vercel Hobby (`https://<project>.vercel.app`, [deployment.md §9](deployment.md)) | Skip it — the Funnel URL serves the same app, and no demo beat or gate changes |

### Won't do in this sprint

PDAX cash-out, a real OCR/vision model, login/auth, mainnet, clawback of held payments, multiple programs at once. These are the stated demo limits in [PRD.md §6](PRD.md).

## 3. Sprint backlog by day

The tasks are the ones in [build-schedule.md](build-schedule.md). This table only groups them and states what must be **demonstrable** at each checkpoint.

| Checkpoint | Must be demonstrable | Tasks that get you there |
|---|---|---|
| **Nov 5, 23:00 — go/no-go** | A sponsored `authorize()` round trip from a script; all five pages render on mocks; name matcher passes the Dela Cruz vector | M0, S1–S7, SPK, M1, SH, NM, BOC, UI1, FIX1 |
| **Nov 6, 12:00 — midday** | Enroll + tap through the real API (`curl` or UI): ₱350 paid, ₱800 `OVER_CAP`; MIDAS threshold calibrated; bot replies to `/start` | C1–C4, MT, MID, TG1, FIX2–3 |
| **Nov 6, EOD — demo gate** | `pnpm demo:e2e` green **on the VM** against testnet with the §1 totals, over the same Funnel URL the demo uses | C5, TR, SED, FRZ, SET, SW, SSE, CSV, UI2, TP1, DEP1–DEP2 |
| **Nov 7, 10:00 — rehearsal 1** | Full 3-minute run on the phone + laptop, timed | All of the above; bug fixes only |
| **Nov 7, 14:00 — feature freeze** | 2 of 3 rehearsals hit the §1 totals; `git tag demo-ready` | Bug fixes with a repro only |

After 14:00 the work is the backup video, README, submission text, and the printed kit — see [build-schedule.md §6](build-schedule.md).

## 4. Definition of done (every task)

1. Its acceptance check in [build-schedule.md](build-schedule.md) passes, run by someone other than the author when possible.
2. `pnpm test` is green.
3. Request and response shapes match [api-and-data.md](api-and-data.md); no new endpoint, env var, or error code.
4. Every money amount is bigint stroops on the server and formatted only through `packages/shared/money.ts`.
5. Simulated / precomputed data is labelled in the UI and the DB.
6. Merged as one small PR per task; no secrets in `apps/web`, no `.env` committed ([AGENTS.md](../AGENTS.md)).

## 5. Cut line — when we are behind

Decide at each checkpoint in §3, in this order. **Never cut a money decision** (fund, refuse/hold, return) or a tx hash.

1. Telegram OR/CR evidence reply → keep the request only.
2. OCR image branch → upload the CSV.
3. COA CSV export → dashboard only.
4. Telegram receipts → activity feed.
5. Web NFC → Simulate tap picker.
6. Gas Station → `GAS_MODE=direct`.
7. VM hosting → Jim's laptop + Funnel ([deployment.md §10](deployment.md) step 3); a quick tunnel serves the phone pages only, never `/` or `/demo`.
8. Live demo → backup video (only if testnet itself is down).

## 6. Daily rhythm

- **09:00 and 18:00 stand-up (10 min):** each person says done / next / blocked, against the task IDs. Jim updates the checkpoint status in §3.
- **Blocked > 30 min:** post in the team chat with the task ID and the exact error; Jim or Dev2 picks it up.
- **Beginners (BegA, BegB):** run the app on your own machine with [test-guide.md](test-guide.md) before you report "done".
- **Bugs on Nov 7:** file with the task ID, steps, expected vs actual, screenshot; Jim triages, no feature work after 14:00.
