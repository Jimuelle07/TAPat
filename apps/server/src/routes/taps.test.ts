// POST /api/taps wiring (docs/api-and-data.md §5.2 #13): body validation and the HTTP status of each outcome.
import { Keypair } from '@stellar/stellar-sdk';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { NoirContractError, encryptSecret, type NoirOperation } from '@tapat/agent';
import type { Db } from '../db/index';
import { openDb } from '../db/index';
import { buildServer } from '../server';
import { createSseBus } from '../services/sse';
import {
  KEY_ENCRYPTION_SECRET,
  T0,
  XLM_SAC_ID,
  fakeLog,
  fakeNoir,
  makeChainDeps,
  seedBeneficiary,
  seedCard,
  seedProgram,
  seedStation,
  unsignedXdr,
  type FakeNoir,
} from '../services/test-fakes';
import { registerTapRoutes } from './taps';

const D1_UID = '04A21F9C9C7E';

const ErrorBody = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
const TapBody = z.object({
  tap: z.object({
    id: z.string(),
    status: z.string(),
    reasonCode: z.string().nullable(),
    chainTxId: z.string().nullable(),
    amountStroops: z.string(),
  }),
  balanceStroops: z.string().nullable(),
  message: z.string(),
});

let app: FastifyInstance | undefined;
let db: Db | undefined;
let fake: FakeNoir;

beforeEach(async () => {
  db = openDb(':memory:');
  seedProgram(db);
  seedBeneficiary(db, { id: 'ben_D1' });
  seedStation(db, { id: 'A', name: 'Petron San Roque' });
  seedStation(db, { id: 'B', name: 'Rotonda Fuels' });
  const agent = Keypair.random();
  await seedCard(db, {
    id: 'card_D1',
    beneficiaryId: 'ben_D1',
    uid: D1_UID,
    agent,
    secretEnc: encryptSecret(agent.secret(), KEY_ENCRYPTION_SECRET),
  });
  fake = fakeNoir();
  app = await buildServer();
  registerTapRoutes(app, {
    db,
    chain: makeChainDeps(db, fake.noir, fakeLog()),
    bus: createSseBus(),
    config: { KEY_ENCRYPTION_SECRET, XLM_SAC_ID, PHP_PER_XLM: 10 },
    now: () => T0,
  });
});

afterEach(async () => {
  await app?.close();
  db?.close();
  app = undefined;
  db = undefined;
});

async function tap(payload: unknown) {
  return (app as FastifyInstance).inject({ method: 'POST', url: '/api/taps', payload: payload as object });
}

describe('POST /api/taps', () => {
  it('answers 200 with an authorized tap for a UID read', async () => {
    fake.getEscrowBalance.mockResolvedValue(1_150_000_000n);
    const response = await tap({ stationId: 'A', amountPhp: 350, uid: '04:a2:1f:9c:9c:7e' });
    expect(response.statusCode).toBe(200);
    const body = TapBody.parse(response.json());
    expect(body.tap.status).toBe('authorized');
    expect(body.tap.amountStroops).toBe('350000000');
    expect(body.balanceStroops).toBe('1150000000');
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('answers 200 (not an error) for a declined tap, with the reason and no tx', async () => {
    fake.prepare.mockImplementation(async (source: string, op: NoirOperation) => {
      if (op.kind === 'authorize') throw new NoirContractError('paymentEscrow', 3, 'AgentNotAuthorized', 'authorize');
      return unsignedXdr(source);
    });
    fake.checkPayment.mockResolvedValue({ ok: false, reason: 'over_limit' });

    const response = await tap({ stationId: 'A', amountPhp: 800, uid: D1_UID });

    expect(response.statusCode).toBe(200);
    const body = TapBody.parse(response.json());
    expect(body.tap).toMatchObject({ status: 'rejected', reasonCode: 'OVER_CAP', chainTxId: null });
    expect(body.balanceStroops).toBeNull();
    expect(body.message).toContain('₱800.00');
  });

  it('answers 502 CHAIN_ERROR for an unmapped contract code', async () => {
    fake.prepare.mockImplementation(async (source: string, op: NoirOperation) => {
      if (op.kind === 'authorize') throw new NoirContractError('paymentEscrow', 8, 'DeviceNotRegistered', 'authorize');
      return unsignedXdr(source);
    });
    const response = await tap({ stationId: 'A', amountPhp: 100, uid: D1_UID });
    expect(response.statusCode).toBe(502);
    expect(ErrorBody.parse(response.json()).error).toEqual({ code: 'CHAIN_ERROR', message: 'CONTRACT_DeviceNotRegistered' });
  });

  it('answers 423 STATION_FROZEN and never reaches the chain', async () => {
    (db as Db).prepare(`UPDATE stations SET status = 'frozen' WHERE id = 'B'`).run();
    const response = await tap({ stationId: 'B', amountPhp: 480, cardId: 'card_D1', simulated: true });
    expect(response.statusCode).toBe(423);
    expect(ErrorBody.parse(response.json()).error.code).toBe('STATION_FROZEN');
    expect(fake.prepare).not.toHaveBeenCalled();
  });

  it('answers 404 CARD_NOT_ENROLLED for a UID with no card', async () => {
    const response = await tap({ stationId: 'A', amountPhp: 350, uid: '04A21F9C0000' });
    expect(response.statusCode).toBe(404);
    expect(ErrorBody.parse(response.json()).error.code).toBe('CARD_NOT_ENROLLED');
  });

  it.each([
    ['a missing amount', { stationId: 'A', uid: D1_UID }],
    ['a zero amount', { stationId: 'A', amountPhp: 0, uid: D1_UID }],
    ['an amount above ₱100,000', { stationId: 'A', amountPhp: 100000.01, uid: D1_UID }],
    ['an amount with 3 decimals', { stationId: 'A', amountPhp: 1.234, uid: D1_UID }],
    ['an unknown station', { stationId: 'C', amountPhp: 100, uid: D1_UID }],
    ['a uid that is not alphanumeric', { stationId: 'A', amountPhp: 100, uid: 'ab_cd' }],
    ['a simulated tap without cardId', { stationId: 'A', amountPhp: 100, simulated: true }],
  ])('answers 400 VALIDATION_ERROR for %s, before any row is written', async (_label, payload) => {
    const response = await tap(payload);
    expect(response.statusCode).toBe(400);
    expect(ErrorBody.parse(response.json()).error.code).toBe('VALIDATION_ERROR');
    expect((db as Db).prepare('SELECT COUNT(*) AS n FROM taps').get<{ n: number }>()?.n).toBe(0);
  });

  it('lets an over-cap amount reach the contract instead of rejecting it in the API', async () => {
    const response = await tap({ stationId: 'A', amountPhp: 800, uid: D1_UID });
    expect(response.statusCode).toBe(200);
    expect(fake.prepare).toHaveBeenCalled();
  });
});
