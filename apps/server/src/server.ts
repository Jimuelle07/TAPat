// API entry point: config -> SQLite -> Fastify on 127.0.0.1 (docs/api-and-data.md §1, deployment.md §5).
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { Keypair } from '@stellar/stellar-sdk';
import { Velo } from '@tapat/agent';
import { loadConfig } from './config';
import { openDb } from './db/index';
import { errorHandler } from './errors';
import { registerRoutes } from './routes/index';
import { createChainRuntime } from './runtime';
import { startBudgetPoller, type BudgetDeps } from './services/budget';
import { recoverInterruptedTxs, startReconciler } from './services/chain';
import { createHealthProbes } from './services/health';
import { createSseBus } from './services/sse';
import { createTrancheService } from './services/tranche';

const STREAM_PATH = '/api/stream';

/** The Fastify app with CORS, the /api/* cache rule, multipart and the error envelopes; routes are registered by callers. */
export async function buildServer(options: FastifyServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify(options);

  // Only the laptop's manual SSE fallback (/?sse=direct) calls the API cross-origin.
  await app.register(cors, { origin: 'http://localhost:3000', methods: ['GET'] });
  // `POST /api/enroll` is the only multipart endpoint.
  await app.register(multipart);

  // Every /api/* response is no-store, except the SSE stream, which keeps no-cache (never no-store).
  app.addHook('onSend', async (request, reply, payload) => {
    const path = request.url.split('?', 1)[0];
    if (path === STREAM_PATH) reply.header('Cache-Control', 'no-cache');
    else if (path.startsWith('/api/')) reply.header('Cache-Control', 'no-store');
    return payload;
  });

  app.setNotFoundHandler((request, reply) => {
    const path = request.url.split('?', 1)[0];
    void reply.code(404).send({ error: { code: 'NOT_FOUND', message: `No route for ${request.method} ${path}` } });
  });

  app.setErrorHandler(errorHandler);

  return app;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const db = openDb(config.DATABASE_PATH);
  const app = await buildServer({ logger: true });
  // Refuses to boot on any deployment the Noir SDK does not know (SDD §4.2); the listener has not started yet.
  const { chain } = createChainRuntime(config, db, app.log);
  // The general Velo client: payment intents, the budget checkout and the health probe; the default baseUrl is the testnet one.
  const velo = new Velo({ apiKey: config.VELO_API_KEY, environment: 'testnet', timeoutMs: 30_000 });
  // In-process SSE fan-out: services publish after writing their row, `GET /api/stream` subscribes.
  const bus = createSseBus();
  // The device owner: every card's `register`/`register_agent` is signed by it (SDD §2.4).
  const programWallet = Keypair.fromSecret(config.PROGRAM_WALLET_SECRET);
  const budget: BudgetDeps = { db, velo, bus, config, log: app.log };
  // The price ticker starts on `POST /api/agents/tranche/start`; `stop()` cancels it on close.
  const tranche = createTrancheService({ db, chain, bus, programWallet, config });
  registerRoutes(app, {
    db,
    config,
    probes: createHealthProbes({ config, velo }),
    bus,
    chain,
    programWallet,
    budget,
    tranche,
  });
  // No runChainTx is in flight yet, so every `pending` row is a process that died mid-write (SDD §4.5).
  recoverInterruptedTxs(chain);
  // Always: a direct row is confirmed by the chain too, so the reconciler does not need a Velo client.
  const stopReconciler = startReconciler(chain);
  // The webhook is the fast path; this poller credits a payment whose webhook never arrived (SDD §6.9).
  const stopBudgetPoller = startBudgetPoller(budget);
  app.addHook('onClose', async () => {
    stopReconciler();
    stopBudgetPoller();
    tranche.stop();
    db.close();
  });
  await app.listen({ port: config.PORT, host: '127.0.0.1' });
}

/** True when this file is the process entry (`tsx src/server.ts`), false when imported (tests). */
function isEntryPoint(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
