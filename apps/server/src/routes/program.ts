// GET /api/program, POST /api/program and POST /api/program/end (docs/api-and-data.md §5.2 #2, #3, #5): the current
// program row, a new one, and the sweep that ends it and returns every card's escrow to the Program Wallet.
import type { FastifyInstance } from 'fastify';
import type { Keypair } from '@stellar/stellar-sdk';
import { createProgramBodySchema, type EndProgramResponse, type ProgramResponse } from '@tapat/shared';
import type { Config } from '../config';
import type { Db } from '../db/index';
import type { ChainDeps } from '../services/chain';
import { createProgram, getCurrentProgram } from '../services/program';
import type { SseBus } from '../services/sse';
import { endProgram } from '../services/sweep';

export interface ProgramRouteDeps {
  db: Db;
  phpPerXlm: number;
  chain: ChainDeps;
  bus: SseBus;
  /** The device owner that signs `revoke_agent`/`sweep_on_revoke` and receives the swept funds. */
  programWallet: Keypair;
  config: Pick<Config, 'XLM_SAC_ID'>;
}

export function registerProgramRoutes(app: FastifyInstance, deps: ProgramRouteDeps): void {
  app.get('/api/program', async (): Promise<ProgramResponse> => ({
    program: getCurrentProgram(deps.db),
    phpPerXlm: deps.phpPerXlm,
  }));

  app.post('/api/program', async (request, reply) => {
    const body = createProgramBodySchema.parse(request.body ?? {});
    const program = createProgram(deps.db, body, { phpPerXlm: deps.phpPerXlm });
    return reply.code(201).send({ program });
  });

  app.post('/api/program/end', async (): Promise<EndProgramResponse> =>
    endProgram({
      db: deps.db,
      chain: deps.chain,
      bus: deps.bus,
      programWallet: deps.programWallet,
      config: deps.config,
    }),
  );
}
