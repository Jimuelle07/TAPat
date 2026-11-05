# TAPat Test Guide — run and test the app on your own machine

Step-by-step for BegA and BegB: start the app and click through every feature, then check the result against the expected numbers. Install your machine first: [prerequisites.md](prerequisites.md).
Last updated: 2026-11-05

> Works once the Nov 6 tasks are merged ([build.md](build.md)). Before that, `pnpm dev` shows the pages on mock data only.
> Commands are for **PowerShell** on Windows, run from the repo root unless a step says otherwise.

## 0. What you need

Everything is installed and created once, in [prerequisites.md](prerequisites.md) — run its §5 final check before your first task here. You do **not** need Freighter or any Stellar wallet: Jim pays the budget checkout as Budget Office, and you only click **Fund budget**. An Android phone with Chrome and NFC on, plus one NFC card, is optional and only used in §9.

## 1. Get the code

```powershell
git clone <repo-url> TAPat
cd TAPat
pnpm install
```

✅ `pnpm install` ends without a red `ERR`. If it fails on `better-sqlite3`, send Jim the error; do not try to fix it yourself.

## 2. Get the env files

1. Ask Jim for the **dev** `apps/server/.env` — never the prod one. He sends it privately. Save it as `apps/server/.env`. The committed root `.env.example` lists every variable (server and web sections) if you want to see the full set.
   - The dev profile has its **own** accounts and its **own** Telegram bot (`@tapat_dev_bot`), made by a second `bootstrap-accounts.ts` run in a separate clone. It uses `GAS_MODE=direct` and `PUBLIC_BASE_URL=https://localhost:3000`. Profiles: [deployment.md §4](deployment.md).
   - Never use the prod `.env` on a laptop while the VM's API is running: two pollers on the demo bot token return `409 Conflict`, and two signers on the same wallets race on Stellar sequence numbers.
2. Create the web env file:

   ```powershell
   Copy-Item apps/web/.env.example apps/web/.env.local
   ```

Rules: **never commit** `.env` or `.env.local`, never paste them in a group chat, and never edit `.env` values yourself ([AGENTS.md](../AGENTS.md)).

## 3. Run the unit tests

```powershell
pnpm test
```

✅ All suites pass. ❌ If one fails, note the test name and send it to whoever owns that task ([build-schedule.md](build-schedule.md)). Never change α, β, weights, or thresholds to make a test pass.

## 4. Start the app

```powershell
pnpm dev
```

This starts the web app on **http://localhost:3000** and the API on port 4000. Leave this terminal open.

Open **http://localhost:3000/api/health** in Chrome.

✅ You see `{"ok":true,"rpc":"ok","velo":"ok","telegram":"ok","gasMode":"direct"}` — `direct` is expected on the dev profile, which always sends through Soroban RPC and keeps the Velo sponsorship limit for prod. `gasMode:"velo"` on your laptop means you were given the prod `.env`: stop and ask Jim.
❌ If the API terminal prints a list of missing variable names, your `.env` is incomplete — ask Jim.

> ⚠️ You share the **dev** accounts with the whole team. **Tell the team chat before steps 5–8**, and never run them while the deployed prod app is being rehearsed.

> ℹ️ The **deployed app** (the prod profile the demo and the judges use) is at `https://tapat.<tailnet>.ts.net` — ask Jim for the basic-auth login if you want to look. Read-only visits only: **do not press its buttons**, especially **End program** or **Run burst**, and never run `reset-demo` there.

## 5. Reset, seed, and fund the budget

Open a **second** terminal in the repo root:

```powershell
pnpm --filter server tsx scripts/reset-demo.ts
pnpm --filter server tsx scripts/seed-demo.ts --d3-expiry-offset=30
```

`--d3-expiry-offset=30` makes driver D3's card expire 30 seconds after the seed, so you don't have to wait 10 minutes. **Wait 1 minute before step 6.**

Then fund the budget:

1. Open **http://localhost:3000/** and click **Fund budget**. You are sent to the Velo checkout page; copy its URL.
2. Send that link to Jim. He pays it with Freighter as **Budget Office** (Testnet). Never ask for or store the Budget Office secret. If you lose the page, the badge on `/` shows **Waiting for Velo…** with an **Open checkout** link to the same checkout.

✅ The badge turns **Velo verified ✓** within a few seconds and shows ₱10,000. (Your laptop doesn't receive Velo webhooks: the Velo endpoint points at the deployed prod app, not at you. That's expected — the API polls Velo every 3 s instead. **Do not change the webhook URL in the Velo dashboard.**)

⚠️ Two dev-profile quirks, both harmless:

- After Jim pays, the Velo checkout page sends your browser back to `https://localhost:3000/?budget=success`, which **will not load** — `PUBLIC_BASE_URL` is only a value the API needs to satisfy the `https:` rule; nothing serves HTTPS on your laptop. Close the tab. The intent is already paid, and the 3 s poller flips the badge on `/` within a few seconds.
- Telegram receipts and evidence requests on your laptop come from the **dev bot** (`@tapat_dev_bot`), not the demo bot. Link a chat to that one; the demo bot belongs to the VM.

## 6. Click through the demo (laptop only)

Do the steps in order. Open each page in its own tab.

| # | Page → action | Expected result |
|---|---|---|
| 1 | `/demo` → **Start price feed** | The chart streams points labelled `simulated`. The day-15 spike does nothing. Around day 34 the agent fires: 3 fund tx hashes (D1, D2, D5); D3 skipped as expired. |
| 2 | `/station/A` → **Simulate tap** → D1, amount `350` → **Charge** | **Paid** + tx hash |
| 3 | Same, D1, amount `800` | Declined: `OVER_CAP`, no tx |
| 4 | Same, D3, amount `200` | Declined: `EXPIRED`, no tx |
| 5 | `/station/B` → **Simulate tap** → D2, `480`, twice | Both **Paid**. A Simulate tap is still a real on-chain payment; only the card read is simulated. |
| 6 | `/demo` → **Run burst** | The edge chart on `/demo` shows the MIDAS-F score crossing the threshold line. The station strip shows Station B **frozen**. If you get "Tap D2 at Station B first", row 5 didn't go through: check it shows **Paid**. |
| 7 | `/demo` → **Run settlement** | The settlement panel on `/demo` reads "A — claimed ₱350 · tx…" and "B — HELD ₱960 · station frozen" |
| 8 | `/intake` → upload `fixtures/masterlist/masterlist.csv` (or `scanned-list.png`) | Summary: 12 total, 4 approved, 4 enrolled (D1, D2, D3, D5 from the seed), 2 rejected (1 ghost, 1 underage), 2 uncertain. λ_lo / λ_hi and α / β are shown, and the uncertain rows have Telegram links. |
| 9 | `/demo` → **End program** | Sweep txs for D1, D2, D5; D3 swept with ₱0 and no tx |

Click any tx hash: it should open on Stellar Expert (testnet).

## 7. Check the totals

On `/` after step 6, row 9:

| Tile | Expected |
|---|---|
| Funded | ₱4,500 |
| Spent | ₱350 |
| Held | ₱960 |
| Pending | ₱0 |
| Returned | ₱3,190 |

✅ The invariant line says **OK**. Any other number is a bug: report it (step 10).

To run again, start over from step 5.

## 8. *(Optional)* Telegram

On `/intake`, open an uncertain driver's Telegram link on your phone and press **Start**. Then click **Request evidence** for that row.

✅ The bot sends the Tagalog OR/CR request. After you link D1 the same way (before step 6), tap receipts arrive in under 10 s.

## 9. *(Optional)* Real NFC on the phone

Web NFC needs HTTPS, so open a **quick tunnel** in a third terminal:

```powershell
cloudflared tunnel --url http://localhost:3000
```

1. On the Android phone, open the printed `https://…trycloudflare.com` URL in **Chrome**, then go to `/station/A`.
2. Tap **Read card** and hold the card on the back of the phone.

A quick tunnel is fine for the **phone pages only** (`/station/*`, `/enroll`): it has a new URL every run and **carries no SSE**, so keep `/` and `/demo` on `http://localhost:3000` on the laptop. It is never the demo origin — the deployed app at the Funnel URL is, and the pre-demo checklist's tag tests are run there.

✅ The page shows `…` followed by the card's last 4 UID characters. If nothing happens within 15 s, the **Simulate tap** picker opens; that's the fallback. If a tag never reads, see [setup.md stage 8](setup.md).

To test enrollment, open `/enroll` on the phone, choose D4's record, press **Read card** and hold the sticker to the phone, pick `d4-photo.jpg`, and press **Enroll**. The card should become `active` with two tx hashes. This adds a fifth card, but D4 is never funded, so the step 7 totals stay the same.

## 10. If something breaks

| Symptom | Do this |
|---|---|
| API exits and lists env var names | Your `.env` is missing values: ask Jim |
| Port 3000 or 4000 already in use | Close the other `pnpm dev` terminal, or restart the PC |
| `/api/health` shows `rpc` not ok | Testnet or internet is down: wait, then retry |
| D3 tap is **Paid** instead of `EXPIRED` | You started too fast: redo step 5 and wait 1 minute |
| Totals are off | Redo from step 5 (`reset-demo` first, every time) |
| Station B shows `STATION_FROZEN` on a new tap | Expected after the burst. **Unfreeze Station B** on `/demo` releases it, but then the next settlement claims the ₱960 and the step 7 totals no longer apply |
| Page says "No active program" | Run step 5 |
| Velo checkout congratulates you, then a blank tab | Expected on dev: the success URL is `https://localhost:3000`. Close it; the badge follows within 3 s |
| `/api/health` says `gasMode:"velo"` | You have the prod `.env`. Stop the API and ask Jim for the dev one |
| Telegram receipt asks you to restart from an unknown bot | You messaged the demo bot. The dev profile's bot ends in `_dev_bot` |

**Report a bug** in the team chat with:

```
Task ID: (from build-schedule.md, e.g. C4)
Step: (e.g. test-guide §6 row 3)
Expected:
Actual:
Screenshot + last 20 lines of the pnpm dev terminal
```
