// API entry point: config -> SQLite -> Fastify on 127.0.0.1 (docs/api-and-data.md §1, deployment.md §5).
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import cors from '@fastify/cors';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { Velo, createNoirClient } from '@tapat/agent';
import { loadConfig } from './config';
import { openDb } from './db/index';
import { registerRoutes } from './routes/index';
import { recoverInterruptedTxs, startReconciler, type ChainDeps } from './services/chain';
import { createHealthProbes } from './services/health';

const STREAM_PATH = '/api/stream';

/** The Fastify app with CORS, the /api/* cache rule and the NOT_FOUND envelope; routes are registered by callers. */
export async function buildServer(options: FastifyServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify(options);

  // Only the laptop's manual SSE fallback (/?sse=direct) calls the API cross-origin.
  await app.register(cors, { origin: 'http://localhost:3000', methods: ['GET'] });

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

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, 'unhandled route error');
    void reply.code(500).send({ error: { code: 'INTERNAL', message: 'Internal error' } });
  });

  return app;
}

async function main(): Promise<void> {
  const config = loadConfig();
  // Handbook requirement: refuse to boot on any deployment the Noir SDK does not know (SDD §4.2).
  const noir = createNoirClient({
    rpcUrl: config.STELLAR_RPC_URL,
    networkPassphrase: config.STELLAR_NETWORK_PASSPHRASE,
    contracts: {
      deviceRegistry: config.NOIR_DEVICE_REGISTRY_ID,
      agentRegistry: config.NOIR_AGENT_REGISTRY_ID,
      paymentEscrow: config.NOIR_PAYMENT_ESCROW_ID,
    },
  });
  const db = openDb(config.DATABASE_PATH);
  const gas =
    config.GAS_MODE === 'velo'
      ? new Velo({
          apiKey: config.VELO_GAS_API_KEY,
          baseUrl: config.VELO_GAS_BASE_URL,
          environment: 'testnet',
          timeoutMs: 30_000,
        }).gas
      : null;
  const app = await buildServer({ logger: true });
  // Chain-writing routes take `chain` as they land (Sprint 2+); the reconciler needs it now.
  const chain: ChainDeps = { db, noir, gas, config, log: app.log };
  // The general Velo client (payment intents now, checkout in C5); the default baseUrl is the testnet one.
  const velo = new Velo({ apiKey: config.VELO_API_KEY, environment: 'testnet', timeoutMs: 30_000 });
  registerRoutes(app, { db, config, probes: createHealthProbes({ config, velo }) });
  // No runChainTx is in flight yet, so every `pending` row is a process that died mid-write (SDD §4.5).
  recoverInterruptedTxs(chain);
  // Always: a direct row is confirmed by the chain too, so the reconciler does not need a Velo client.
  const stopReconciler = startReconciler(chain);
  app.addHook('onClose', async () => {
    stopReconciler();
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
