# TAPat — Setup (one-time, manual)

Everything a human must do by hand before the demo runs: tools, keys, the Velo project, the public HTTPS origin, the bot, and the physical NFC tags — in the order that works.

Last updated: 2026-11-05

Owner: **Jim** (integration owner). Nobody else runs stages 2–7. Stages 1 and 8 can be handed to BegB.

Related: [API & data contracts](api-and-data.md) §7 (the full env var list and boot rules) · [Build schedule](build-schedule.md) (when each stage must be done) · [Demo runbook](demo-runbook.md) (what to repeat every session) · [SDD](system-design.md) (why these values exist).

---

## 0. How to use this doc

Eight stages, each with: **URL** to open, **action** to take, and the **env var** it fills. Do them in order — stage 2 writes the secrets that stage 4 needs, and stage 5 sets the public HTTPS origin (`PUBLIC_BASE_URL`) that Velo's webhook and the phone both use. Stages 2–6 describe the **prod** profile; where a laptop's dev profile differs, the stage says so. The Telegram bot in stage 6 needs no public URL: it uses long polling.

Work from the repo root (`C:\Users\jomalyne\TAPat`) in **PowerShell**. Two Windows rules that bite:

- `.env` values are **never quoted** and never contain `#`. The Stellar passphrase has semicolons (`Test SDF Network ; September 2015`) — keep it on one line, unquoted, and never wrap it in quotes in PowerShell.
- When you set a variable in PowerShell for a one-off command, use single quotes: `$env:GAS_MODE = 'direct'`. Double quotes are fine here too, but single quotes protect the semicolons.

At the end of every stage, confirm the value is in `apps/server/.env` (created by copying `apps/server/.env.example`). The API refuses to boot and prints any missing variable names — see [api-and-data.md §7.3](api-and-data.md). The committed root `.env.example` lists the same variables in one place, with no real values: its server section is the copy source for `apps/server/.env`, its web section for `apps/web/.env.local`.

```powershell
Copy-Item apps/server/.env.example apps/server/.env
Copy-Item apps/web/.env.example apps/web/.env.local
```

`.env` and `.env.local` are git-ignored and must never be committed. Keep a backup of `.env` on a USB stick for the demo (runbook kit).

---

## Stage 1 — Toolchain: Node 22, pnpm, cloudflared

| | |
|---|---|
| **URL** | https://nodejs.org (only if `winget` fails) |
| **Env var** | none |

```powershell
winget install OpenJS.NodeJS.22
winget install Cloudflare.cloudflared
```

Open a **new** terminal (PATH changes do not apply to the old one), then:

```powershell
node --version     # must print v22.23.4 or a later v22
npm install -g pnpm@9
pnpm --version     # must print 9.x
cloudflared --version
```

Notes:

- Node **22 LTS** at **≥ 22.23.4** is the recorded demo config: `@noirx402/agent-sdk@0.3.0` declares engines `^22.23.4 || ^24.22.1 || >=26.12.1`, and Node 24/26 below those floors (e.g. 26.4) is not supported. `better-sqlite3` prebuilds are verified on 22, `@carts1024/velo-sdk@1.0.0` needs only Node ≥ 22.6, and [prerequisites.md](prerequisites.md) §3/§6 says to use it exactly. The install line above pins `OpenJS.NodeJS.22`, which installs the latest 22.x (the unpinned LTS package id would install a newer major). If `node --version` prints a v22 lower than v22.23.4, or anything other than a v22, run `winget upgrade OpenJS.NodeJS.22`, close and reopen the terminal (PATH changes do not reach an open shell) and, if it still does not, check `where.exe node` for a second Node on PATH — do not continue on a newer version.
- **Noir SDK.** Noir is reached only through `@noirx402/agent-sdk@0.3.0`, pinned in `packages/agent` (`@tapat/agent`), with `@stellar/stellar-sdk` v16 as its peer. It talks to the three contracts over Soroban RPC with the config in `.env.example`; there is no Noir server, account or API key to create — nothing in this doc sets one up.
- If `npm install -g pnpm@9` is blocked by policy, use `corepack enable` and then `pnpm --version` (Corepack ships with Node 22 and downloads pnpm on first use).
- If `winget install Cloudflare.cloudflared` fails, download `cloudflared-windows-amd64.exe` from https://github.com/cloudflare/cloudflared/releases, rename it `cloudflared.exe`, put it in `C:\Users\jomalyne\bin`, and add that folder to PATH.
- `better-sqlite3` needs build tools only as a fallback. If `pnpm install` fails on it, the API switches to `node:sqlite` (see the SDD); nothing in this doc changes.

Done when `node --version` prints v22.23.4 or a later v22 and `pnpm --version` prints 9.x.

---

## Stage 2 — Generate and fund the four Stellar accounts

| | |
|---|---|
| **URL** | none — the script calls `https://friendbot.stellar.org?addr=<public key>` |
| **Env vars** | `PROGRAM_WALLET_SECRET`, `STATION_A_SECRET`, `STATION_B_SECRET` (written automatically); Program Wallet and Budget Office **public keys** are printed for stage 3 and 4 |

The script must exist at `apps/server/scripts/bootstrap-accounts.ts` (Jim, Nov 5 PM). Run:

```powershell
pnpm --filter server tsx scripts/bootstrap-accounts.ts
```

What it does, in order, and what it prints:

| Account | Role | Key handling |
|---|---|---|
| Program Wallet | Velo project owner; owner of every card; signs funding and sweeps | secret written to `apps/server/.env` as `PROGRAM_WALLET_SECRET`; **public key printed** |
| Budget Office | pays the budget checkout from Freighter | **secret printed only** — never written to `.env` (it must not exist on the server); import it into Freighter in stage 3, then treat the printed value as the app's spending wallet |
| Station A `Petron San Roque` | honest merchant | secret written as `STATION_A_SECRET`; public key printed |
| Station B `Rotonda Fuels` | anomalous merchant | secret written as `STATION_B_SECRET`; public key printed |

Then it:

1. Calls friendbot for each of the four accounts and waits for `successful: true`.
2. Writes/replaces the three secret lines in `apps/server/.env` **in place** (it never deletes your other lines).
3. Prints a copy-paste block (labels are printed text, not env vars — none of these go into `.env`; the three server secrets were already written by step 2):

```
program wallet  public  G...
budget office   public  G...
budget office   secret  S...   -> import into Freighter, never into .env
station A       public  G...
station B       public  G...
```

Copy that block into your password manager or the demo kit note. `BUDGET_OFFICE_SECRET` is shown once; if you lose it before importing it into Freighter, re-run the script — it creates a fresh Budget Office account (the old one is harmless on testnet, and nothing on the server depends on it).

`KEY_ENCRYPTION_SECRET` is created here too. The script generates 32 random bytes, writes them as 64 lowercase hex characters, and prints them once. If you ever need to regenerate it by hand, or the line is empty in your `.env`, run:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste that 64-character hex string into `apps/server/.env` as `KEY_ENCRYPTION_SECRET`. An empty value fails the API's boot check, which is intentional. **Back it up.** Every card agent secret is encrypted with it; changing it makes every enrolled card unusable and forces `reset-demo.ts` plus a re-seed.

Done when `apps/server/.env` contains all four lines (`PROGRAM_WALLET_SECRET`, `STATION_A_SECRET`, `STATION_B_SECRET`, `KEY_ENCRYPTION_SECRET`) and the public keys are saved somewhere outside the repo.

**Two profiles, two runs.** These four accounts are the **prod** set: they are the ones the VM runs with. Every teammate laptop uses the **dev** profile, which is a **second** `bootstrap-accounts.ts` run made in a **separate clone** so it cannot overwrite the prod `.env` — different Program Wallet, different stations, a second bot. The two profiles never share an account, and only one API per profile may run at a time. Full comparison: [deployment.md §4](deployment.md).

---

## Stage 3 — Freighter: import the two wallets, switch to Testnet

| | |
|---|---|
| **URL** | https://www.freighter.app (browser extension), then the extension's network selector |
| **Env var** | none — this stage only matters because the Velo project owner **is** the Program Wallet |

1. Install the Freighter extension in Chrome on the laptop and create/import a profile.
2. **Import account → Secret key** → paste `BUDGET_OFFICE_SECRET` from stage 2. Name it `TAPat Budget Office`. This is the wallet that pays the programme budget checkout on stage.
3. **Import account → Secret key** → paste `PROGRAM_WALLET_SECRET` (copy it from `apps/server/.env`). Name it `TAPat Program Wallet`. This account must be the one connected to Velo in stage 4, because Velo fixes the receiver address per project and the plan requires that receiver to be the Program Wallet.
4. Switch the network selector to **Testnet** and keep it there. Mainnet must never be selected.
5. Copy each account's `G...` address and confirm it matches the public keys printed in stage 2 (Freighter shows the address under the account name). A mismatch means you imported the wrong secret — stop and fix it now, because stage 4 binds the Velo project owner permanently.

Done when both accounts appear in Freighter, both show a nonzero testnet XLM balance (friendbot's 10,000 XLM), and the network reads Testnet.

---

## Stage 4 — Velo project, API key, Gas Station key, contract allow-list

| | |
|---|---|
| **URL** | https://velo-build.dev |
| **Env vars** | `VELO_API_KEY`, `VELO_GAS_API_KEY` |

> **All velo-build.dev menu paths below are unverified — follow dashboard labels.** The dashboard is a testnet alpha and its navigation changes. If a label differs, choose the closest match: the objects you need are (a) a project bound to your connected wallet, (b) a general/project API key, (c) a Gas Station testnet key, (d) a contract allow-list with a relayer balance and request limits.

1. Open https://velo-build.dev and sign in. If sign-in is wallet-based, connect **Freighter** and pick `TAPat Program Wallet` (unverified — follow dashboard labels).
2. Create a project named **`TAPat`** (unverified — follow dashboard labels). Confirm the project's `ownerAddress` / receiver address is the **Program Wallet public key** from stage 2. This is the only address Velo will accept a classic `payment` to, so it must be the Program Wallet.
   - If the project already exists from an earlier attempt, delete it and re-create rather than editing the owner.
3. Create a **general / project API key**: **API Keys → Generate key → API access: General project API**. The dashboard issues it with the prefix `tk_live_` (older keys may read `tk_test_`; both are accepted, and Velo checkout still runs on Stellar Testnet only). Paste it into `apps/server/.env` as `VELO_API_KEY`. This key is used for `checkout.sessions.create` and `paymentIntents.retrieve`.
4. Create a **Gas Station · Testnet key** (unverified — follow dashboard labels). It is prefixed `tg_test_`. Paste it as `VELO_GAS_API_KEY`. Also confirm `VELO_GAS_BASE_URL=https://www.velo-build.dev` (already set in `.env.example`).
5. **Link the 3 Noir contracts** to the Gas Station allow-list (`allowedContractIds`, max 20). Paste them exactly:

   ```
   CAC4KOLHDLDYDWBOKXNKRN5KVHO56PLOIFXDLTBUWGVN6GVDEB7FQHU5   device_registry
   CCMZDSPTLX7IIJWCYEUM5DJUHOSOYSTHGK777S2TXZWEMC5ZZGPJ3EBV   agent_registry
   CC7EAW5FNJEDBS7THM5IT6XIOHO4AOYMLXT3KSZ3HWUIKEACTW7E5BFS   payment_escrow
   ```

   Sponsorship is rejected for any contract not on this list. If a call comes back rejected with a validation error that names a contract, this list is the first thing to check.
6. **Fund the managed relayer** for the project (unverified — follow dashboard labels show the address and a suggested amount). The relayer pays the transaction fees; an unfunded relayer makes every sponsored write fail. Send it testnet XLM from the Program Wallet, or use friendbot on the relayer address: `https://friendbot.stellar.org?addr=<relayer address>`.
7. **Set limits** to **50 XLM / day** and **300 requests / wallet / hour**, then **enable sponsorship** (unverified — follow dashboard labels). The Gas Station defaults are 10 XLM/day and 100 req/wallet/hour; the demo needs more because every contract write is sponsored. 50/300 is still far above the demo's real usage (under 20 writes).
8. Confirm the Gas Station shows **active** and the allow-list shows **3 contracts**.

Done when `VELO_API_KEY` starts with `tk_live_` (or `tk_test_`), `VELO_GAS_API_KEY` starts with `tg_test_`, and the dashboard shows the project active with sponsorship enabled.

> **SDK pin.** The app pins `@carts1024/velo-sdk@1.0.0` exactly — it is npm `latest` as of Nov 5, so the Builder Handbook (Nov 5) advice to install `@alpha` predates the release and does not apply here.

If Velo cannot be set up by **23:00 on Nov 5**, continue with `GAS_MODE=direct` in `.env` and keep Velo for the budget checkout and webhooks only — this is the plan's go/no-go fallback ([build-schedule.md](build-schedule.md)). Nothing else in the stack changes.

---

## Stage 5 — Public HTTPS origin (`PUBLIC_BASE_URL`) and the Velo webhook endpoint

| | |
|---|---|
| **URL** | `https://tapat.<tailnet>.ts.net` (prod, set once) or a local quick tunnel for phone tests; then https://velo-build.dev → webhooks (unverified — follow dashboard labels) |
| **Env vars** | `PUBLIC_BASE_URL`, `VELO_WEBHOOK_SECRET` |

The phone needs HTTPS for Web NFC, and Velo needs a public HTTPS URL to deliver webhooks.

**Prod (the demo and the judges): one stable URL, set once.** The VM's Tailscale Funnel publishes Caddy at `https://tapat.<tailnet>.ts.net`, and that string goes into the prod `.env` as `PUBLIC_BASE_URL` — it does not change between sessions, so this stage is done once per deployment, not once per session. Provisioning and the `tailscale funnel --bg 8080` step: [deployment.md §6.2–§6.3](deployment.md). In that setup the browser talks to Caddy, which routes `/api/*` straight to Fastify on `127.0.0.1:4000` and everything else to Next.js on `127.0.0.1:3000`; the Next.js rewrite is not on the request path in prod.

**Dev (a laptop, local testing): a quick tunnel, phone pages only.**

```powershell
# terminal 1
pnpm --filter server dev          # Fastify on PORT=4000, bound to 127.0.0.1

# terminal 2
pnpm --filter web dev          # Next.js on 3000, bound to 127.0.0.1 (`next dev -H 127.0.0.1 -p 3000`)

# terminal 3
cloudflared tunnel --url http://localhost:3000
```

`cloudflared` prints a URL like `https://harbor-lime-42.trycloudflare.com`. Point the tunnel at Next.js (3000), not at Fastify: locally the app's `/api/:path*` rewrite forwards every API call — including `/api/webhooks/velo` — to `API_ORIGIN`. That is what gives the phone one HTTPS origin. A quick tunnel gets a new URL on every restart, and **quick tunnels carry no SSE**: use one only for the phone pages (`/station/*`, `/enroll`), and open `/` and `/demo` on `http://localhost:3000` on the laptop.

Then, for either profile:

1. Put the origin into `apps/server/.env` as `PUBLIC_BASE_URL` (bare origin: `https://`, no trailing slash, no path) and restart the API so the value is loaded. Prod sets it to `https://tapat.<tailnet>.ts.net`; a laptop dev profile may use `https://localhost:3000` (the value only has to satisfy the `https:` rule) or its quick-tunnel URL for phone tests. `apps/web/.env.local` is not involved — the browser uses relative `/api/*` URLs.
2. In Velo, create **one** webhook endpoint (unverified — follow dashboard labels) with URL:

   ```
   ${PUBLIC_BASE_URL}/api/webhooks/velo
   ```

   Subscribe to `payment.succeeded`, `payment.failed`, and `payment.created` (adding `contract.event` is optional; we store it and ignore it).
3. Copy the endpoint's **signing secret** into `apps/server/.env` as `VELO_WEBHOOK_SECRET` and restart the API. Without it the webhook route answers a delivery with `400 WEBHOOK_SIGNATURE_INVALID` and the budget never verifies. This is the same secret in both profiles — dev simply receives no deliveries, because the Velo endpoint points at prod only and the dev 3 s poller credits the budget instead.
4. Open `${PUBLIC_BASE_URL}/api/health` and confirm it returns `"ok": true`. On prod Caddy answers `/api/health` without basic auth, so `curl` works; every other path returns `401` until you log in with the Caddy credentials ([deployment.md §5.1](deployment.md)).

**The Velo endpoint is registered once, against prod.** A laptop never needs it: the 3 s `paymentIntents.retrieve` poller credits a missed webhook anyway, so a stale endpoint costs time, not money. Do not repoint the prod webhook at a laptop — the dev profile would then receive the prod program's deliveries into a database that has never heard of that intent. If a stable laptop URL is ever unavoidable, create a named tunnel on a Cloudflare account instead of a quick tunnel ([deployment.md §10](deployment.md) step 3 shows the `tailscale funnel` laptop variant).

Done when `curl.exe https://tapat.<tailnet>.ts.net/api/health` (or your dev quick-tunnel URL) returns `"ok": true` and the Velo dashboard marks the endpoint as reachable / the test delivery as `200`.

> **Optional — Vercel frontend.** If the team also publishes `apps/web` on Vercel Hobby, the browser entry URL for judges and the phone may become `https://<project>.vercel.app`. `PUBLIC_BASE_URL` stays `https://tapat.<tailnet>.ts.net`: it is what Velo's webhook and the checkout redirect use, and only the browser's entry URL changes. The Vercel project needs `API_ORIGIN=https://tapat.<tailnet>.ts.net` plus `WEB_BASIC_AUTH`; the Funnel URL keeps working. This is not required for setup: full steps, security and acceptance are in [deployment.md §9](deployment.md).

---

## Stage 6 — Telegram bot

| | |
|---|---|
| **URL** | https://t.me/BotFather |
| **Env vars** | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` |

1. In Telegram, open **@BotFather** → `/newbot` → name it `TAPat` and set a username ending in `bot`, e.g. `tapat_demo_bot`. BotFather replies with an HTTP API token shaped `123456789:AA...`.
2. Paste the token into `apps/server/.env` as `TELEGRAM_BOT_TOKEN` and the username **without the leading `@`** as `TELEGRAM_BOT_USERNAME=tapat_demo_bot`.
3. Restart the API. It uses **long polling** (`getUpdates`) inside the API process — do **not** call `setWebhook`; a webhook would break polling and needs another public URL.
4. On the team demo phone, install Telegram, open the bot, press **Start**, and send anything. The API logs `telegram chat <id> seen`. This chat will be linked to D1 during the demo (or pre-linked by the seed) — nothing to configure here.
5. Send `/start` once from the demo phone so the bot conversation sits at the top of the chat list and the receipt is visible on stage.

Done when `GET /api/health` reports `"telegram": "ok"` and a message you send to the bot appears in the API log within 5 s.

**A second bot for the dev profile.** The bot above is the **demo (prod)** bot and only the VM polls it. Teammates on laptop dev profiles create a **second** bot with @BotFather — e.g. `@tapat_dev_bot` — and put its token and username in the **dev** `.env`. Two pollers on one token return `409 Conflict`, so a laptop starting with the prod `.env` would silently steal the demo bot's updates ([deployment.md §4](deployment.md)).

---

## Stage 7 — Smoke-test the testnet path

| | |
|---|---|
| **URL** | none — hits Soroban RPC, friendbot, and Velo |
| **Env vars** | reads everything above; writes nothing new |

```powershell
pnpm --filter server tsx scripts/smoke-testnet.ts
```

It performs exactly three checks and prints a PASS/FAIL line for each:

1. **Read a policy that must not exist.** Calls `noir.getPolicy(random deviceHash)` through `@noirx402/agent-sdk` and expects `null` — for an unknown hash the SDK returns `null` instead of throwing. This proves the contract ID, the RPC URL, the passphrase, and the client config are right without writing anything.
2. **One sponsored `registerDevice` of a throwaway hash.** Generates a throwaway keypair, uses its address as the `agent` argument for a random `deviceHash`, and takes that write down the Noir SDK path: the SDK's `registerDevice` operation through `noir.prepare(signer.publicKey(), op)`, signed server-side, then handed to the Gas Station (`velo.gas.sponsor` → `velo.gas.submit`). Expect `status: "succeeded"` and a `gas_mode: "velo"` record. Nothing is funded, so the leftover registration can never spend anything; it is never stored in `.env`. If sponsorship is rejected and `GAS_FALLBACK_DIRECT=true`, the line prints `WARN ... gas_mode=direct` instead of PASS: the chain path works, but Gas Station is not sponsoring yet (fix stage 4, or apply the Nov 5 23:00 go/no-go in [build-schedule.md](build-schedule.md)).
3. **One 1 XLM checkout session.** `velo.checkout.sessions.create({ amount: "1.00", asset: "native", description: "TAPat smoke test", successUrl: "${PUBLIC_BASE_URL}/?smoke=ok", cancelUrl: "${PUBLIC_BASE_URL}/?smoke=cancel" }, { idempotencyKey: "smoke:<timestamp>" })` and asserts a `checkoutUrl`. Do **not** pay it; the session is only proof that `VELO_API_KEY` and the project binding work.

Expected output:

```
PASS  getPolicy(random hash) -> null, as expected
PASS  registerDevice(throwaway) -> succeeded  gas_mode=velo  hash=...
PASS  checkout.sessions.create(1 XLM) -> https://...
```

If check 1 fails: the contract ID, passphrase, or RPC URL is wrong — the API refuses to boot when the SDK's built-in TESTNET IDs or network passphrase disagree with `NOIR_*_ID` / `STELLAR_NETWORK_PASSPHRASE`. If check 2 fails with a contract allow-list error: stage 4 step 5. If check 2 fails with a relayer balance error: stage 4 step 6. If check 3 fails: `VELO_API_KEY` or the project owner binding.

The script also reads `noir.getEscrowBalance(random hash)` (expects `0`) and `noir.getPendingBalance(Station A)` as a silent check on the SDK read methods used by the dashboard and sweep; a failure prints FAIL on line 1.

Done when all three lines say PASS.

---

## Stage 8 — Card agents, physical tags, and the enrollment phone

| | |
|---|---|
| **URL** | the app at `${PUBLIC_BASE_URL}/enroll` (prod: `https://tapat.<tailnet>.ts.net/enroll`; dev: a laptop quick tunnel), plus the Play Store for "NFC Tools" |
| **Env var** | none |

Buy **NTAG213 / NTAG215 / NTAG216** cards and stickers — these are NDEF-compatible. NTAG216 stickers are the safest for the demo. Avoid MIFARE Classic and hotel-key stock: Web NFC cannot read them.

1. Label the physical tags with a marker before enrolling, so stage hands do not swap them: **D1**, **D2**, **D3** (a sticker), **D4** (a sticker, enrolled live). D5 is virtual (`TAPATVIRTUAL05`) and has no tag.
2. On the Android phone, install **Chrome** (Web NFC is Chrome-on-Android only — Firefox and iOS will not read tags) and turn NFC on in Settings.
3. Open `${PUBLIC_BASE_URL}/enroll` in Chrome — the Funnel URL in prod (log in once with the Caddy credentials), or a quick tunnel for a local test. HTTPS and a tap gesture are both required for `new NDEFReader().scan()`; a quick tunnel is fine here because this page needs no SSE.
4. On `/enroll`, press **Read card**, then tap each tag on the phone back cover (the read needs both the HTTPS page and the button press — Web NFC starts on a user gesture). The page shows only `…` plus the last four characters of the **normalized** UID (upper case, no colons), e.g. `…9C7E`; that normalization is what `readUid()` returns and what the page posts as `uid`. If nothing happens, press **Read card** again and:
   - Confirm the tag is NDEF-formatted: install **NFC Tools** → *Other* → *Write* → write an empty NDEF record. This reformats the tag and is the fix for "the phone vibrates but `reading` never fires".
   - Try another tag; some cheap cards ship locked.
   - Confirm the URL is `https://` and the page got a genuine user gesture (a button press — Web NFC will not scan otherwise).
5. Record the four tags in the demo kit note as `label → …last4` exactly as shown after **Read card** (D1 `…9C7E`, D2 `…3A54`, D3 `…77B0`, D4 `…A1B2` in the seeded demo), matched to D1–D4. Do not write down the raw serial with its separators: nothing in the app displays it. On stage, D1, D2 and D3 are tapped (D3 must be read to show `EXPIRED`), and D4 is enrolled live with `samplePhoto`; the tags only need to be readable, not pre-enrolled.

Done when each of the four tags shows its `…last4` on the enrollment page at `${PUBLIC_BASE_URL}/enroll` after **Read card**, and the same four labels + last-4 strings are in the kit note.

---

## Env var → stage map

Every variable in [api-and-data.md §7](api-and-data.md), where it comes from, and whether the committed templates already have a usable default (`apps/server/.env.example` for the server, `apps/web/.env.example` for the web app — the root `.env.example` mirrors both with no real values):

| Env var | Filled in | Source |
|---|---|---|
| `PORT` | — | `.env.example` default `4000` |
| `DATABASE_PATH` | — | `.env.example` default `./data/tapat.db` |
| `PUBLIC_BASE_URL` | Stage 5 | prod: `https://tapat.<tailnet>.ts.net`, set once; dev: `https://localhost:3000` or a laptop quick-tunnel URL |
| `STELLAR_RPC_URL` | — | `.env.example` default `https://soroban-testnet.stellar.org` |
| `STELLAR_NETWORK_PASSPHRASE` | — | `.env.example` default `Test SDF Network ; September 2015` |
| `NOIR_DEVICE_REGISTRY_ID` | — | `.env.example`, fixed contract ID |
| `NOIR_AGENT_REGISTRY_ID` | — | `.env.example`, fixed contract ID |
| `NOIR_PAYMENT_ESCROW_ID` | — | `.env.example`, fixed contract ID |
| `XLM_SAC_ID` | — | `.env.example`, fixed SAC ID |
| `PROGRAM_WALLET_SECRET` | Stage 2 | `bootstrap-accounts.ts` writes it |
| `STATION_A_SECRET` | Stage 2 | `bootstrap-accounts.ts` writes it |
| `STATION_B_SECRET` | Stage 2 | `bootstrap-accounts.ts` writes it |
| `KEY_ENCRYPTION_SECRET` | Stage 2 | `bootstrap-accounts.ts` generates 64 hex chars — back it up |
| `GAS_MODE` | Stage 4 | `velo`; `direct` only on the go/no-go fallback |
| `GAS_FALLBACK_DIRECT` | — | `.env.example` default `true` |
| `VELO_GAS_BASE_URL` | — | `.env.example` default `https://www.velo-build.dev` |
| `VELO_GAS_API_KEY` | Stage 4 | Gas Station · Testnet key (`tg_test_…`) |
| `VELO_API_KEY` | Stage 4 | project API key (`tk_live_…`, or an older `tk_test_…`) |
| `VELO_WEBHOOK_SECRET` | Stage 5 | the webhook endpoint's signing secret |
| `TELEGRAM_BOT_TOKEN` | Stage 6 | BotFather |
| `TELEGRAM_BOT_USERNAME` | Stage 6 | BotFather, no `@` |
| `PHP_PER_XLM` | — | `.env.example` default `10` (demo rate) |
| `PRICE_TICK_MS` | — | `.env.example` default `700` |
| `FREEZE_TICK_MS` | — | `.env.example` default `1000` |
| `API_ORIGIN` (web) | — | `apps/web/.env.local`, default `http://localhost:4000` |
| `WEB_BASIC_AUTH` (web) | — | **Optional.** `user:password`; set only in the Vercel project when the optional Vercel frontend is on ([deployment.md §9](deployment.md)). Unset everywhere else: `apps/web/middleware.ts` is then a no-op |

## Boot checklist

- [ ] `node --version` → v22.23.4 or a later v22, `pnpm --version` → 9.x, `cloudflared --version` → any
- [ ] `apps/server/.env` has all 24 API variables; `apps/web/.env.local` has the 1 required web variable, `API_ORIGIN` (the optional `WEB_BASIC_AUTH` exists only in the Vercel project, if that front end is on)
- [ ] You know which profile this `.env` is: **prod** (VM only, one copy on Jim's USB) or **dev** (laptop, second accounts + second bot) — [deployment.md §4](deployment.md)
- [ ] Both secrets wallets imported into Freighter on Testnet with a testnet XLM balance
- [ ] Velo project `TAPat` owned by the Program Wallet; sponsorship active; 3 contracts allow-listed
- [ ] Prod: `PUBLIC_BASE_URL=https://tapat.<tailnet>.ts.net`, set once, and the Velo webhook points at `${PUBLIC_BASE_URL}/api/webhooks/velo` ([deployment.md §6.3](deployment.md))
- [ ] `GET ${PUBLIC_BASE_URL}/api/health` → `{ok:true, rpc:"ok", velo:"ok", telegram:"ok", gasMode:"velo"}`
- [ ] `smoke-testnet.ts` → three PASS lines
- [ ] 4 tags labelled D1–D4 and reading over HTTPS in Chrome on the Android phone
- [ ] Bot conversation open on the demo phone
- [ ] `.env` backed up outside the repo (and, for prod, on the USB stick in the demo kit)
