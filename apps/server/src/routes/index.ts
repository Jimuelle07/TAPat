// Every REST route, registered in one place (docs/index.md §3). Later sprints add their calls here and widen RouteDeps.
import type { FastifyInstance } from 'fastify';
import type { Config } from '../config';
import type { Db } from '../db/index';
import type { HealthProbes } from '../services/health';
import { registerHealthRoutes } from './health';
import { registerProgramRoutes } from './program';

export interface RouteDeps { db: Db; config: Pick<Config, 'GAS_MODE' | 'PHP_PER_XLM'>; probes: HealthProbes }

export function registerRoutes(app: FastifyInstance, deps: RouteDeps): void {
  registerHealthRoutes(app, { probes: deps.probes, gasMode: deps.config.GAS_MODE });
  registerProgramRoutes(app, { db: deps.db, phpPerXlm: deps.config.PHP_PER_XLM });
}
