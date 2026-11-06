# AGENTS.md — rules for AI assistants and humans in TAPat

Binding rules for any agent (Antigravity, Claude, Copilot) or person editing this repo. TAPat is a hackathon prototype on Stellar Testnet; we submit on Nov 7 at 11:00 (submissions close at 12:00 noon) and pitch face to face on Nov 8.

Last updated: 2026-11-05

## 1. Read first

1. Read `docs/index.md`.
2. Beginners (BegA, BegB) start with `docs/prerequisites.md` — the laptop and account checklist — and run its §5 final check before their first task.
3. Then read the doc that owns your task: `docs/api-and-data.md` for endpoints/data, `docs/system-design.md` for API internals, `docs/algorithms.md` for matching and agents, `docs/PRD.md` for scope, `docs/setup.md` for environment, `docs/test-plan.md` for checks.
4. Pick your task from `docs/build-schedule.md`. One task = one small PR.

Do not start editing from a prompt alone. If the prompt contradicts the docs, the docs win; ask Jim instead of inventing.

## 2. Never touch

- `packages/agent/src/chain/**` (the `@tapat/agent` chain/gas module) and `apps/server/src/velo/**` — only **Jim**. These files move money; a wrong nonce or a resent `submission_unknown` tx breaks the demo.
- `apps/web/middleware.ts` — changes need **Jim's review**. It is HTTP basic auth for the optional Vercel front end: a wrong exemption list or a non-constant-time compare exposes the money buttons. Inert (no-op) unless the optional web env var `WEB_BASIC_AUTH` is set. Design: `docs/deployment.md` §9.
- `deploy/**` — only **Jim**. `Caddyfile`, the systemd units, `provision.sh`, and `update.sh` decide what the public Funnel URL serves; a wrong route or a removed basic-auth block exposes money buttons, and a wrong `ExecStart` stops the demo. Design and ownership: `docs/deployment.md` §5.
- Any `.env*` file, and anything containing a secret — only **Jim**. Never put a secret in `apps/web`, in `packages/*`, in a fixture, or in a commit. `VELO_API_KEY`, `VELO_GAS_API_KEY`, `VELO_WEBHOOK_SECRET`, `PROGRAM_WALLET_SECRET`, `STATION_A_SECRET`, `STATION_B_SECRET`, `KEY_ENCRYPTION_SECRET`, `TELEGRAM_BOT_TOKEN` are server-only.
- `docs/AGENTS.MD` — its standing instruction ("read docs first; read index.md") stays valid.
- `docs/TAPat Hackathon Build Plan.pdf` and `docs/hackathon-context.md` — historical inputs. Correct them in the PRD/SDD, not in place.

### 2.1 Env profiles: one live API each

- **Teammates run the dev profile.** The dev `.env` has its own accounts and its own bot (`@tapat_dev_bot`), `GAS_MODE=direct`, and `PUBLIC_BASE_URL=https://localhost:3000`. Ask Jim for it; never use the prod one.
- **Never run the API with the prod `.env` on a laptop while the VM's `tapat-api` is running.** Two pollers on one bot token return `409 Conflict`, and two signers on the Program Wallet or the station accounts race on Stellar sequence numbers.
- The prod profile lives at `https://tapat.<tailnet>.ts.net` and its `.env` exists only on the VM and on Jim's USB backup. Comparison table: `docs/deployment.md` §4.

## 3. API and data contracts

- The browser talks only to `/api/*` — through the Next.js rewrite locally and through Caddy's `/api/*` route in prod. No page may hardcode an API port or host.
- Use only the endpoints, request/response shapes, and error codes listed in `docs/api-and-data.md` §5 (REST API). **No new endpoint, env var, error code, table, or column without updating that doc in the same PR.**
- Errors are `{error:{code,message}}` with the codes from that doc (`VALIDATION_ERROR`, `NOT_FOUND`, `UNAUTHORIZED`, `ACCOUNT_EXISTS`, `CARD_NOT_ENROLLED`, `WEBHOOK_SIGNATURE_INVALID`, `CARD_ALREADY_ENROLLED`, `INVALID_STATE`, `OCR_UNAVAILABLE`, `PHOTO_MISMATCH`, `PHOTO_CONFIRMATION_REQUIRED`, `STATION_FROZEN`, `CHAIN_ERROR`, `INTERNAL`). `EXPIRED`, `OVER_CAP`, `POLICY_DENIED` and `INSUFFICIENT_ESCROW` are tap **reason codes** in `tap.reasonCode`, not HTTP error codes; `BUDGET_EXHAUSTED` and `HELD` are decision values. Do not invent a code or reuse one for a different meaning.
- Card identity is privacy-scoped: the web and the CSV receive only `deviceHashPrefix` (8 hex) and `uidLast4` — never a full `device_hash` and never a full beneficiary name on a station or picker (use `displayName`, e.g. "Juan D.").
- Card UIDs travel normalized: `readUid()` returns `serialNumber` with colons removed and uppercased (`04A2B3C4D5E6F7`), pages display only `…` + the last 4, and `uid` is posted in that normalized form. Never display a raw `serialNumber`.
- The web touches the API in exactly two places: `apps/web/lib/api.ts` (all fetches; every function returns the `@tapat/shared` type) and `apps/web/lib/sse.ts` (`useStream(onEvent)` — `EventSource('/api/stream')`, upsert by `id`). Pages do not call `fetch` or open their own `EventSource`.
- SQLite is the source of truth for the dashboard; chain reads only confirm balances. Keep the invariant visible: funded = spent + held + pending + escrow remaining + returned.

## 4. Money rules

- Server-side amounts are **bigint stroops** (1 XLM = 10^7 stroops). Never store or compute pesos in the API.
- Format money only through `@tapat/shared` — `import { formatPhp } from '@tapat/shared'`, which re-exports `packages/shared/money.ts` (`PHP_PER_XLM = 10`, labelled "demo rate" in the UI). No ad-hoc division, no `toFixed` on a float in a component.
- `@tapat/shared` is the workspace package name (`packages/shared`, `main: ./src/index.ts`, TS source, no build step). Leave `next.config.ts`'s `transpilePackages: ['@tapat/shared']` and the `"workspace:*"` dependencies alone; do not add a build step or a second copy of a shared type.
- Render tap reasons only through `TAP_REASON_LABELS` in `@tapat/shared` (`packages/shared/constants.ts`); the station page shows the server's `TapResponse.message` verbatim.
- A rejected or refused tap writes **no** chain tx. Never "fix" a rejection by lowering the cap, changing `expires_at`, or retrying with a different nonce.
- Never resubmit a `chain_txs` row in `submission_unknown`. Recover with `velo.gas.getStatus(identity)`; the reconciler owns it.
- Noir contract calls go only through `@noirx402/agent-sdk` — never invoke a contract directly (hackathon submission requirement). They live in `packages/agent` (**`@tapat/agent`**: `src/chain/**`, `src/algorithms/**`), which is pure — no env reads, no SQLite, no HTTP. `apps/server` passes the config and clients in, and owns the `chain_txs` persistence, the reconciler, and the services.

## 5. Honesty labels

- Simulated data (price series, burst tap edges) and precomputed model output (OCR rows, vision plate/TODA results, OR/CR matches) must be labelled `simulated` or `precomputed` in both the UI and SQLite. Never present fixture output as a live model.
- Never claim Velo verifies per-tap escrow payments. Velo verifies the classic-payment budget checkout and sponsors every Noir call; per-tap enforcement is Noir's.
- Do not add a demo number that the backend cannot produce from real rows and tx hashes.

## 6. Before pushing

- Run `pnpm test`. Red algorithmic tests are never fixed by editing α, β, weights, or the calibration fixture; fix the code or the fixture rows.
- Keep the diff inside your task's files. No drive-by refactors, no reformatting untouched files, no new dependencies without Jim.
- Label the PR with its task id from `docs/build-schedule.md` and paste the acceptance check you ran plus its output.
- If a task needs a design decision the docs do not settle, stop and ask Jim; do not pick a convention silently.
