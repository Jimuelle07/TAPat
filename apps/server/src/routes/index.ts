// Every REST route, registered in one place (docs/index.md §3). Later sprints add their calls here and widen RouteDeps.
import type { FastifyInstance } from 'fastify';
import type { Keypair } from '@stellar/stellar-sdk';
import type { Config } from '../config';
import type { Db } from '../db/index';
import type { BudgetDeps } from '../services/budget';
import type { ChainDeps } from '../services/chain';
import { createDashboardService, loadMidasThreshold } from '../services/dashboard';
import type { FreezeService } from '../services/freeze';
import type { HealthProbes } from '../services/health';
import type { SseBus } from '../services/sse';
import type { TrancheService } from '../services/tranche';
import { registerAgentRoutes } from './agents';
import { registerBudgetRoutes } from './budget';
import { registerDashboardRoutes } from './dashboard';
import { registerEnrollRoutes } from './enroll';
import { registerHealthRoutes } from './health';
import { registerProgramRoutes } from './program';
import { registerSettlementRoutes } from './settlement';
import { registerStationRoutes } from './stations';
import { registerStreamRoutes } from './stream';
import { registerTapRoutes } from './taps';
import { registerTrancheRoutes } from './tranche';
import { registerUnfreezeRoutes } from './unfreeze';
import { registerWebhookRoutes } from './webhooks';

export interface RouteDeps {
  db: Db;
  config: Pick<
    Config,
    'GAS_MODE' | 'PHP_PER_XLM' | 'KEY_ENCRYPTION_SECRET' | 'XLM_SAC_ID' | 'TELEGRAM_BOT_USERNAME'
  >;
  probes: HealthProbes;
  bus: SseBus;
  chain: ChainDeps;
  /** The device owner that signs `register`/`register_agent` and owns every card on chain. */
  programWallet: Keypair;
  /** Velo checkout + webhook + poller dependencies (the same object `main()` hands to the poller). */
  budget: BudgetDeps;
  /** The Tranche Agent; `main()` stops it on close. */
  tranche: TrancheService;
  /** The Freeze Agent: `POST /api/agents/freeze/burst`, unfreeze, and the tap hand-off; `main()` starts it. */
  freeze: FreezeService;
  /** `MIDAS` task writes `apps/server/config/midas.json`; absent, the documented threshold is used. */
  midasThreshold?: number;
  /** Tests point this at a temp dir holding the precomputed photo records. */
  fixturesDir?: string;
}

export function registerRoutes(app: FastifyInstance, deps: RouteDeps): void {
  // One instance per API process: the dashboard's 5 s escrow cache is shared by `cards[]` and the total.
  const dashboard = createDashboardService({
    db: deps.db,
    noir: deps.chain.noir,
    config: deps.config,
    midasThreshold: deps.midasThreshold ?? loadMidasThreshold(),
  });

  registerHealthRoutes(app, { probes: deps.probes, gasMode: deps.config.GAS_MODE });
  registerProgramRoutes(app, {
    db: deps.db,
    phpPerXlm: deps.config.PHP_PER_XLM,
    chain: deps.chain,
    bus: deps.bus,
    programWallet: deps.programWallet,
    config: deps.config,
  });
  registerStreamRoutes(app, { bus: deps.bus });
  registerStationRoutes(app, { db: deps.db });
  registerDashboardRoutes(app, { dashboard });
  registerEnrollRoutes(app, {
    db: deps.db,
    chain: deps.chain,
    bus: deps.bus,
    programWallet: deps.programWallet,
    config: deps.config,
    ...(deps.fixturesDir === undefined ? {} : { fixturesDir: deps.fixturesDir }),
  });
  registerTapRoutes(app, {
    db: deps.db,
    chain: deps.chain,
    bus: deps.bus,
    config: deps.config,
    onTap: (tap) => deps.freeze.enqueue(tap),
  });
  registerBudgetRoutes(app, deps.budget);
  registerWebhookRoutes(app, deps.budget);
  registerTrancheRoutes(app, { tranche: deps.tranche });
  registerAgentRoutes(app, { freeze: deps.freeze });
  registerUnfreezeRoutes(app, { freeze: deps.freeze });
  registerSettlementRoutes(app, { db: deps.db, chain: deps.chain, bus: deps.bus, config: deps.config });
}
