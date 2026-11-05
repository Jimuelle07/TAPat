# TAPat

Repo entry point: pitch, hackathon fit, and where to start.
Last updated: 2026-11-05

**TAPat lets an AI agent release, cap, and return fuel aid for tricycle drivers, enforced on-chain by Noir and settled through Velo.** Verify once, pay many times: no queues, no ghosts, no expired funds. An LGU officer uploads their existing masterlist; a matching + conformal-risk-control pass removes ghosts and flags only the genuinely uncertain drivers for one Telegram evidence message; a driver is enrolled in a minute with an NFC card; a price-driven **Tranche Agent** funds each card's escrow inside a Velo-verified budget; a per-card Noir policy caps, expires, and nonces every **tap-to-pay** authorization at any NFC Android phone; a **Freeze Agent** scores card-to-station tap edges with MIDAS-F and pauses anomalous stations by refusing their taps and withholding `claim()`; and at program end `revoke_agent` + `sweep_on_revoke` return the unspent balance to the LGU the same day, with a COA-ready CSV behind every number. Every contract write is fee-sponsored through Velo Gas Station, so drivers and stations pay no fees.

## Hackathon fit

| Requirement | How TAPat meets it |
|---|---|
| Agentic payment | Tranche Agent funds (`fund_escrow`); Freeze Agent withholds settlement (skips `claim`) and refuses new taps; per-card agents request payment (`authorize`) inside a policy the LGU signed |
| Built with Velo — budget checkout | The LGU Budget Office pays one Velo checkout intent for the program budget; a signed webhook (with polling fallback) ledger-verifies it before any tranche is funded |
| Built with Velo — Gas Station | Every Noir call goes through `velo.gas.sponsorAndSubmit` + `waitForResult`, with identity-based recovery instead of resubmission |
| Built with Velo — signed webhooks | `POST /api/webhooks/velo` verifies `x-velo-signature` over the raw body and dedupes on `x-velo-delivery` |
| Noir `device_registry` | `register` / `revoke` — one device per driver card, owned by the LGU's Program Wallet |
| Noir `agent_registry` | `register_agent` / `revoke_agent` / `get_policy` — per-card `max_amount`, asset, `expires_at`; `check_payment` is enforced inside `authorize` |
| Noir `payment_escrow` | `fund_escrow` / `authorize` / `claim` / `sweep_on_revoke` |
| Auditability | Every automatic decision is produced by a published algorithm (CRC, BOCPD, MIDAS-F) and logged with its input numbers and tx hashes |

Testnet contracts: `device_registry` `CAC4KOLHDLDYDWBOKXNKRN5KVHO56PLOIFXDLTBUWGVN6GVDEB7FQHU5`, `agent_registry` `CCMZDSPTLX7IIJWCYEUM5DJUHOSOYSTHGK777S2TXZWEMC5ZZGPJ3EBV`, `payment_escrow` `CC7EAW5FNJEDBS7THM5IT6XIOHO4AOYMLXT3KSZ3HWUIKEACTW7E5BFS`, native XLM SAC `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`.

## Run the demo

1. **[`docs/setup.md`](docs/setup.md)** — one-time manual setup: Node 22 + pnpm + cloudflared, friendbot-funded accounts, Freighter imports, the Velo project/API key/Gas Station key, the webhook origin, the Telegram bot, and a testnet smoke test.
2. **[`docs/deployment.md`](docs/deployment.md)** — how the apps are hosted for $0: one always-free VM under systemd, Caddy in front, published at `https://tapat.<tailnet>.ts.net`, plus the prod/dev env profiles and the fallback ladder. Optionally, `apps/web` can also run on Vercel Hobby at `https://<project>.vercel.app` (§9) — off by default, and nothing in the demo depends on it.
3. **[`docs/demo-runbook.md`](docs/demo-runbook.md)** — the kit, the T-minus timeline, the 3-minute script beat by beat, fallbacks, and the judge Q&A.

Short version once setup and the deployment are done: the deployed app is the prod profile on the VM at `https://tapat.<tailnet>.ts.net` (Caddy basic auth; one live API, so do not start another with the prod `.env`). Check `GET /api/health`, then run `reset-demo.ts` and `seed-demo.ts` on the VM — or run everything locally on the dev profile by following [`docs/test-guide.md`](docs/test-guide.md), whose `PUBLIC_BASE_URL` is not the Funnel URL.

## Docs

All documentation lives in [`docs/`](docs/index.md) — start with the index for the doc map, the planned repo tree, and the glossary.

- [`docs/prerequisites.md`](docs/prerequisites.md) — what to install and which accounts to create before your first task (beginners start here)
- [`docs/PRD.md`](docs/PRD.md) — problem, users, goals, features F1–F6, hackathon fit, scope limits, success metrics
- [`docs/system-design.md`](docs/system-design.md) — the SDD: architecture, money flow, chain module, service behaviors, SSE, security
- [`docs/algorithms.md`](docs/algorithms.md) — name normalization, matcher, CRC, BOCPD, Count-Min Sketch/MIDAS-F with test vectors
- [`docs/api-and-data.md`](docs/api-and-data.md) — SQLite schema, REST endpoints, contract call map, env vars, fixtures
- [`docs/deployment.md`](docs/deployment.md) — the free always-free-VM deployment: topology, Caddy, Funnel, prod/dev profiles, provisioning, ops, fallbacks
- [`docs/build-schedule.md`](docs/build-schedule.md) — who builds what, Nov 5–8, with acceptance checks
- [`docs/build.md`](docs/build.md) — the Nov 7 MVP sprint goal, scope, and cut line
- [`docs/test-guide.md`](docs/test-guide.md) — run and test the app locally, step by step
- [`docs/test-plan.md`](docs/test-plan.md) — unit, live testnet, manual phone checks, pre-demo checklist
