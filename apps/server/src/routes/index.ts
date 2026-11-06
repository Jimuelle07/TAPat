// Every REST route, registered in one place (docs/index.md §3). Later sprints add their calls here and widen RouteDeps.
import type { FastifyInstance } from 'fastify';
import type { Keypair } from '@stellar/stellar-sdk';
import type { Config } from '../config';
import type { Db } from '../db/index';
import type { BudgetDeps } from '../services/budget';
import type { ChainDeps } from '../services/chain';
import type { HealthProbes } from '../services/health';
import type { SseBus } from '../services/sse';
import type { TrancheService } from '../services/tranche';
import { registerBudgetRoutes } from './budget';
import { registerEnrollRoutes } from './enroll';
import { registerHealthRoutes } from './health';
import { registerProgramRoutes } from './program';
import { registerStreamRoutes } from './stream';
import { registerTapRoutes } from './taps';
import { registerTrancheRoutes } from './tranche';
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
  /** Tests point this at a temp dir holding the precomputed photo records. */
  fixturesDir?: string;
}

export function registerRoutes(app: FastifyInstance, deps: RouteDeps): void {
  registerHealthRoutes(app, { probes: deps.probes, gasMode: deps.config.GAS_MODE });
  registerProgramRoutes(app, { db: deps.db, phpPerXlm: deps.config.PHP_PER_XLM });
  registerStreamRoutes(app, { bus: deps.bus });
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
  });
  registerBudgetRoutes(app, deps.budget);
  registerWebhookRoutes(app, deps.budget);
  registerTrancheRoutes(app, { tranche: deps.tranche });
}
