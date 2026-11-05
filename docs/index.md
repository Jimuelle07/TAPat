# TAPat Docs Index

Start here: the map of every TAPat document, the repo layout it describes, and the vocabulary the docs assume.

Last updated: 2026-11-05

## 1. Reading order

Beginners (BegA, BegB): read `docs/prerequisites.md` first — it installs your laptop and creates your accounts, and every other doc assumes it is done. Then `docs/test-guide.md` to run the app locally.

New to the project? Read `docs/PRD.md` (why), then `docs/system-design.md` (how), then the doc for your task in §2.

## 2. Documents

| Doc | Purpose | Owner | Read when |
|---|---|---|---|
| [`prerequisites.md`](prerequisites.md) | Laptop checklist: hardware, accounts, software to install, phone setup, final check | BegB | **First, before any task** — install once, then never again |
| [`PRD.md`](PRD.md) | Problem, users, F1–F6 with acceptance criteria, hackathon fit, demo metrics | Jim | Before the deck, the pitch, or any scope question |
| [`system-design.md`](system-design.md) | SDD: architecture, money flow D1, chain/gas/keys modules, service behaviors, SSE, Telegram, security | Jim | Before touching anything in `apps/api` |
| [`algorithms.md`](algorithms.md) | Exact specs and test vectors for name matching, CRC, BOCPD, MIDAS-F | Dev2 | Before writing or debugging `apps/api/src/algorithms/**` or any agent decision |
| [`api-and-data.md`](api-and-data.md) | SQLite schema, REST endpoints, error codes, contract call map, env vars, fixtures | Jim | Before any endpoint, table, env var, or UI data change |
| [`setup.md`](setup.md) | One-time manual setup: accounts, Freighter, Velo project + Gas key, public HTTPS origin (prod Funnel / dev quick tunnel), Telegram bot, cards | Jim | Day 1, and any time an env var looks wrong |
| [`deployment.md`](deployment.md) | Free deployment design: the always-free VM, Caddy, Tailscale Funnel URL, the prod/dev env profiles, provisioning, ops, fallback ladder, judging period, and the **optional** Vercel frontend (§9) | Jim | When provisioning the VM, on demo day, and for judge access |
| [`build-schedule.md`](build-schedule.md) | Day-by-day tasks with owners, acceptance checks, gates, critical path | Jim | Every morning, and whenever a task feels blocked |
| [`build.md`](build.md) | MVP sprint goal, scope, cut line | Jim | Planning and stand-ups |
| [`test-guide.md`](test-guide.md) | Run and test the app locally, step by step | BegB | Before reporting a task done |
| [`demo-runbook.md`](demo-runbook.md) | Kit, T-minus timeline, the 3-minute script, fallbacks, judge Q&A | Jim | T-60 on show day, and before every rehearsal |
| [`test-plan.md`](test-plan.md) | Unit vectors, live testnet checks, phone checks, dry-run checklist | Dev2 | Before every push and at the Nov 6 EOD gate |
| [`hackathon-context.md`](hackathon-context.md) | Background notes on the hackathon, Noir, and Velo | Jim | When checking where a claim came from. **Background only** — where it disagrees with the SDD or API docs, the SDD wins (for example, `authorize()` moves no tokens) |
| [`TAPat Hackathon Build Plan.pdf`](TAPat%20Hackathon%20Build%20Plan.pdf) | The original submitted plan: problem stats, F1–F6 wording, demo beats, judge Q&A | Jim | As the source for PRD problem figures and demo beats. Its one-checkout-per-tap claim is superseded by the SDD (see PRD §5.1) |
| [`Velo x Noir Agentic Payment Hackathon — Builder Handbook.pdf`](Velo%20x%20Noir%20Agentic%20Payment%20Hackathon%20%E2%80%94%20Builder%20Handbook.pdf) | The organizers' handbook (Nov 5 update): eligibility, the required SDKs, submission format, schedule, venues, judging weights | Jim | **The authority on hackathon rules** — submission, eligibility, and schedule questions. The PRD, SDD, and API docs follow it; where another doc drifted from it, the doc was corrected |
| `AGENTS.MD` (this folder) | Short standing instruction: read the docs first, start at `index.md` | — | Automatically, if you are an AI assistant. Leave it unchanged |
| [`../AGENTS.md`](../AGENTS.md) | Rules for AI assistants and humans working in the repo | Jim | Before your first edit |
| [`../README.md`](../README.md) | One-paragraph pitch, hackathon fit, how to run the demo | Jim | First contact with the repo |

## 3. Planned repository layout

Built from the plan. What is on disk today: `apps/api` (`src/config.ts`, `src/server.ts`, `src/db/`, `scripts/`), `apps/web`, `packages/shared`, `fixtures/` and `deploy/`. `apps/api/src/chain/`, `src/algorithms/` and `src/services/` are planned (tasks C/NM/MT/BOC), and `docs/` describes the target each of them fills.

```text
TAPat/
├─ apps/
│  ├─ web/                     Next.js (App Router) + Tailwind — the LGU dashboard, intake,
│  │  ├─ app/                  enrollment and station pages; browser never sees a secret
│  │  │  ├─ page.tsx           /            dashboard: budget badge, five money tiles + invariant,
│  │  │  │                                   station strip, card list, one merged activity feed;
│  │  │  │                                   /?sse=direct is the laptop-style SSE fallback
│  │  │  ├─ intake/            /intake      upload + review the masterlist, thresholds panel
│  │  │  ├─ enroll/            /enroll      Read card + one photo, then Enroll
│  │  │  ├─ station/[id]/      /station/A   the phone terminal: amount, Read card, Charge,
│  │  │  │                                   collapsed Simulate tap picker
│  │  │  └─ demo/              /demo        five agent buttons, price chart + tranche panel,
│  │  │                                      edge chart (MIDAS vs threshold), station strip,
│  │  │                                      settlement result panel
│  │  ├─ lib/api.ts            the ONLY module that fetches; typed with @tapat/shared; returns
│  │  │                        apps/web/mocks/*.json in UI1, fetch('/api/...') in UI2
│  │  ├─ lib/sse.ts            useStream(onEvent) — client hook; EventSource('/api/stream'), upsert by id
│  │  ├─ lib/nfc.ts            readUid(opts?): Promise<string> — Web NFC, UID normalized (colons removed, uppercased)
│  │  ├─ middleware.ts         basic auth, a no-op unless WEB_BASIC_AUTH is set; only for the
│  │  │                        optional Vercel host (deployment.md §9); Jim reviews changes
│  │  ├─ components/           shared UI: money tiles, badges, decision log
│  │  ├─ mocks/                mock JSON for mock-first development (BegA, Nov 5); file list in api-and-data §5.6
│  │  └─ .env.example          API_ORIGIN (required) + commented WEB_BASIC_AUTH (optional);
│  │                           copied to .env.local (git-ignored)
│  └─ api/                     Fastify 5 + tsx — every secret, every chain write
│     ├─ src/
│     │  ├─ chain/             noir.ts (NoirAgentClient + wrappers), gas.ts, keys.ts
│     │  ├─ algorithms/        names, matcher, crc, bocpd, cms, midas (pure functions)
│     │  ├─ services/          intake, enroll, tap, tranche, freeze, settlement, sweep,
│     │  │                     budget, dashboard, telegram, sse
│     │  ├─ routes/            one file per endpoint group in api-and-data.md §5
│     │  ├─ db/                schema.sql + the driver (better-sqlite3, node:sqlite fallback)
│     │  └─ server.ts          boots config, db, routes, agents
│     ├─ scripts/              bootstrap-accounts, smoke-testnet, seed-demo, reset-demo,
│     │                        gen-prices, gen-taps, gen-calibration, calibrate-midas
│     ├─ config/midas.json     calibrated MIDAS-F threshold (written by calibrate-midas.ts)
│     └─ .env.example          every env var; the API refuses to boot without them
├─ packages/
│  └─ shared/                  @tapat/shared — types, zod schemas, money.ts, constants; TS source
│                              (main: ./src/index.ts), transpilePackages in next.config; used by web + api
├─ fixtures/                   precomputed model output and simulated streams (labelled)
│  ├─ masterlist/              scanned-list.png + .ocr.json, masterlist.csv
│  ├─ calibration/             labeled.json (CRC calibration set)
│  ├─ prices/                  doe-diesel-sim.json (45 daily points)
│  ├─ taps/                    honest-history.json, burst.json
│  ├─ enroll/                  d4-photo.jpg + .json
│  └─ orcr/                    OR/CR evidence photos + .json
├─ deploy/                     PROTECTED (Jim only): Caddyfile, tapat-api.service, tapat-web.service,
│                              provision.sh, update.sh — the VM's routing, systemd units, and scripts
├─ docs/                       this set
├─ pnpm-workspace.yaml         apps/*, packages/* — workspace package names: `apps/api/package.json`
│                              has `"name": "api"`, `apps/web/package.json` has `"name": "web"`, so
│                              every `--filter api` / `--filter web` resolves
├─ package.json                root scripts: dev (`pnpm -r --parallel --filter api --filter web dev`),
│                              test (`pnpm -r test`), demo:e2e
└─ AGENTS.md, README.md
```

Folder responsibilities:

- `apps/web` is presentation only. It talks to `/api/*` through the Next.js rewrite and never holds a Velo, Telegram, or agent key.
- `apps/api` owns every secret, every contract write, every agent decision, and SQLite. Agents run inside this process.
- `packages/shared` (published inside the workspace as `@tapat/shared`) is the only place money is formatted (`PHP_PER_XLM`, `money.ts`). It exports TS source: `apps/web` consumes it via `transpilePackages: ['@tapat/shared']` in `next.config.ts`, `apps/api` via `tsx`; both declare `"@tapat/shared": "workspace:*"`. The API stores bigint stroops; the UI never does arithmetic on pesos.
- `apps/web/lib/api.ts` is the single fetch module (mock JSON in UI1, `/api/*` in UI2); `apps/web/lib/sse.ts` `useStream(onEvent)` is the single SSE entry point. Pages hold no fetch calls of their own.
- `fixtures/` feeds the precomputed and simulated paths. Their consumers are listed in `docs/api-and-data.md` §4.
- `apps/api/scripts/` holds the one-shot operational scripts; they are not part of the request path.
- `deploy/` is the free-deployment surface described in `docs/deployment.md` §5: the Caddyfile that routes `/api/*` to Fastify and adds basic auth, the two systemd units, and `provision.sh` / `update.sh`. It holds no secret. It is a protected path — only Jim edits it, and it is never a place for `.env` values.

## 4. Glossary

| Term | Meaning in TAPat |
|---|---|
| **Escrow** | Per-device balance inside `payment_escrow`, funded by the Program Wallet via `fund_escrow`. One escrow per card. |
| **Tranche** | One ₱1,500 (150 XLM) escrow funding per card, released by the Tranche Agent when the price changepoint fires. |
| **Pending** | Payments appended by `authorize()` for a merchant, waiting to be claimed. Moves no tokens at authorization time. |
| **Claim** | `claim(token, merchant)`: one SAC transfer from the escrow to the merchant for all of that merchant's pending payments. Signed by the station. |
| **Held** | Pending money at a **frozen** station. TAPat skips its `claim()`, so the money sits in escrow. Noir cannot claw pending payments back; only unfreeze → claim releases it. |
| **Sweep** | `sweep_on_revoke`: returns a device's unspent escrow to its owner (the Program Wallet, i.e. the LGU) at program end, after `revoke_agent`. |
| **Device hash** | `SHA-256(utf8("<program.salt>:<UID>"))` with the card UID's colons removed and uppercased. Raw UIDs are never stored; the UI only ever sees `deviceHashPrefix` (8 hex) and `uidLast4`. |
| **UID** | The card UID, always the **normalized** form: Web NFC's `serialNumber` with colons removed and letters uppercased (`04A2B3C4D5E6F7`). `readUid()` returns it that way; pages show only `…` + last 4 and post the normalized string. |
| **Stroops** | 1 XLM = 10^7 stroops. All server-side money is bigint stroops. |
| **Demo rate** | `PHP_PER_XLM = 10`, the fixed conversion the UI uses and labels "demo rate". |
| **Intent** | A Velo payment intent (`velo_intents` row), created by `checkout.sessions.create` for the program budget. Paid only by a classic payment to the project's receiver. |
| **Gas Station** | Velo's fee sponsor. Every Noir contract write is submitted through it (`GAS_MODE=velo`), with a direct-RPC fallback before dispatch. |
| **Freeze** | Station status set by the Freeze Agent (MIDAS-F score or an LGU rule). New taps are refused before signing; settlement is held. Unfreeze is manual. |
| **MIDAS-F** | Streaming anomaly score over card→station edges using Count-Min Sketch with decay and filtering. |
| **BOCPD** | Bayesian online changepoint detection — decides when a price move is a sustained shift, not a spike. |
| **CRC** | Conformal risk control — picks the approve/reject thresholds so wrongful denials stay under α and ghost admissions under β. |
| **Ghost** | A duplicate beneficiary on the masterlist. Label `ghost = duplicate` in the calibration set. |
| **Simulated / precomputed** | Data that is not live: the price series, burst tap edges, OCR/vision outputs. Always labelled in the UI and in SQLite. |
| **Env profile (prod/dev)** | The same 24 env var names with different values. **prod** runs only on the VM, holds the demo bot, `GAS_MODE=velo`, and `PUBLIC_BASE_URL=https://tapat.<tailnet>.ts.net`; **dev** runs on teammate laptops, uses a second `bootstrap-accounts.ts` run in a separate clone, a second bot, `GAS_MODE=direct`, and a local `PUBLIC_BASE_URL`. Never run two live APIs on one profile (Telegram returns `409 Conflict`; Stellar sequence numbers race). `docs/deployment.md` §4. |
| **Funnel** | Tailscale Funnel: the free public HTTPS front door, `https://tapat.<tailnet>.ts.net`. It is reached over an outbound connection from the VM, so no inbound port is opened, and the certificate is Tailscale's. It publishes Caddy on `127.0.0.1:8080` and therefore supports SSE. `docs/deployment.md` §2–§3. |
| **Vercel frontend (optional)** | `apps/web` additionally published on Vercel Hobby at `https://<project>.vercel.app`, in front of the same VM (the API never moves). **Off by default**: no demo beat, gate, or critical-path task depends on it. Switched on or off by configuration only — the optional web env var `WEB_BASIC_AUTH` turns on basic auth in `apps/web/middleware.ts`, and the API serves `/api/*` as `no-store`. `docs/deployment.md` §9. |
| **SSE** | Server-Sent Events on `GET /api/stream`. Each event's `data` is the **camelCase REST shape** from `docs/api-and-data.md` §3 (e.g. `tap` → `Tap`, `freeze` → `FreezeEvent`), never a DB row; scored taps are re-emitted with the same `id`, so clients upsert. |
