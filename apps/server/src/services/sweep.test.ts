// Sweep (SDD §6.8, api-and-data.md §5.2 #5): the demo's close, proven with the fake Noir client and `GAS_MODE=direct`.
import { Keypair } from '@stellar/stellar-sdk';
import { NoirContractError } from '@tapat/agent';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../db/index';
import { openDb } from '../db/index';
import { createSseBus, type SseBus, type SseEventName } from './sse';
import {
  T0,
  XLM_SAC_ID,
  fakeNoir,
  makeChainDeps,
  seedBeneficiary,
  seedCard,
  seedProgram,
  type FakeNoir,
} from './test-fakes';
import { endProgram, type SweepDeps } from './sweep';

interface Fixture {
  db: Db;
  fake: FakeNoir;
  deps: SweepDeps;
  bus: SseBus;
  events: Array<{ event: SseEventName; data: unknown }>;
  hashes: Record<string, string>;
}

const UIDS = {
  D1: '04A1B2C39C7E',
  D2: '04A1B2C33A54',
  D3: '04A1B2C377B0',
  D4: '04A1B2C3A1B2',
  D5: '04A1B2C3A105',
} as const;

const ESCROW: Record<string, bigint> = {
  D1: 1_150_000_000n,
  D2: 540_000_000n,
  D5: 1_500_000_000n,
};

let fixture: Fixture | undefined;

beforeEach(async () => {
  const db = openDb(':memory:');
  seedProgram(db);
  // `createProgram` writes a draft; the sweep only runs on an active program.
  db.prepare(`UPDATE program SET status = 'active'`).run();

  for (const id of Object.keys(UIDS) as Array<keyof typeof UIDS>) {
    seedBeneficiary(db, { id: `ben_${id}`, firstName: 'Juan', lastName: `Driver${id}` });
  }
  const hashes: Record<string, string> = {};
  for (const id of Object.keys(UIDS) as Array<keyof typeof UIDS>) {
    hashes[id] = await seedCard(db, {
      id: `card_${id}`,
      beneficiaryId: `ben_${id}`,
      uid: UIDS[id],
      agent: Keypair.random(),
      secretEnc: 'v1:unused',
    });
  }

  const fake = fakeNoir();
  fake.getEscrowBalance.mockImplementation(async (hash: string) => {
    const id = (Object.keys(UIDS) as Array<keyof typeof UIDS>).find((key) => hashes[key] === hash);
    return id === undefined ? 0n : (ESCROW[id] ?? 0n);
  });
  fake.getPolicy.mockImplementation(async (hash: string) => ({
    agent: 'GAGENT',
    maxAmount: 500_000_000n,
    asset: XLM_SAC_ID,
    // D3's policy already lapsed, so the sweep must not call `revoke_agent` for it.
    expiresAt: hash === hashes.D3 ? new Date(T0 - 1_000) : new Date(T0 + 86_400_000),
  }));

  const bus = createSseBus();
  const events: Fixture['events'] = [];
  bus.subscribe((event, data) => events.push({ event, data }));
  fixture = {
    db,
    fake,
    bus,
    events,
    hashes,
    deps: {
      db,
      chain: makeChainDeps(db, fake.noir),
      bus,
      programWallet: Keypair.random(),
      config: { XLM_SAC_ID },
      now: () => T0,
    },
  };
});

afterEach(() => {
  fixture?.db.close();
  fixture = undefined;
});

function chainKinds(db: Db): string[] {
  return db.prepare('SELECT kind FROM chain_txs ORDER BY rowid').all<{ kind: string }>().map((row) => row.kind);
}

describe('POST /api/program/end', () => {
  it('revokes the live policies, sweeps the non-zero escrows and ends the program', async () => {
    const { deps, db, fake, events } = fixture as Fixture;
    const response = await endProgram(deps);

    expect(response.program.status).toBe('ended');
    expect(response.totalReturnedStroops).toBe('3190000000');
    expect(
      response.cards.map((card) => [card.cardId, card.returnedStroops, card.status, card.reason]),
    ).toEqual([
      ['card_D1', '1150000000', 'swept', null],
      ['card_D2', '540000000', 'swept', null],
      ['card_D3', '0', 'swept', 'EMPTY_ESCROW'],
      ['card_D4', '0', 'swept', 'EMPTY_ESCROW'],
      ['card_D5', '1500000000', 'swept', null],
    ]);
    // D3 never had a live policy, so it has no revoke tx; D4 does have one but no escrow.
    expect(response.cards[2]?.revokeTxId).toBeNull();
    expect(response.cards[2]?.sweepTxId).toBeNull();
    expect(response.cards[3]?.revokeTxId).not.toBeNull();
    expect(response.cards[3]?.sweepTxId).toBeNull();
    expect(response.cards.map((card) => card.sweepTxId !== null)).toEqual([true, true, false, false, true]);

    // Revoke always precedes the sweep for the same card — the ordering `AgentStillActive` comes from.
    expect((fake.prepare.mock.calls as Array<[string, { kind: string }]>).map((call) => call[1].kind)).toEqual([
      'revokeAgent',
      'sweepOnRevoke',
      'revokeAgent',
      'sweepOnRevoke',
      'revokeAgent',
      'revokeAgent',
      'sweepOnRevoke',
    ]);
    expect(chainKinds(db)).toEqual([
      'revoke_agent',
      'sweep',
      'revoke_agent',
      'sweep',
      'revoke_agent',
      'revoke_agent',
      'sweep',
    ]);
    expect(db.prepare(`SELECT COUNT(*) AS n FROM chain_txs WHERE status != 'succeeded'`).get<{ n: number }>()?.n).toBe(0);

    const cards = db
      .prepare('SELECT id, status, returned_stroops FROM cards ORDER BY rowid')
      .all<{ id: string; status: string; returned_stroops: number }>();
    expect(cards.every((card) => card.status === 'swept')).toBe(true);
    expect(cards.map((card) => card.returned_stroops)).toEqual([1_150_000_000, 540_000_000, 0, 0, 1_500_000_000]);

    // One PROGRAM_ENDED decision with the total, and one decision per card.
    const decisions = db
      .prepare(`SELECT decision, outputs_json, tx_ids_json FROM agent_decisions WHERE agent = 'sweep' ORDER BY rowid`)
      .all<{ decision: string; outputs_json: string; tx_ids_json: string }>();
    expect(decisions.map((decision) => decision.decision)).toEqual([
      'SWEPT',
      'SWEPT',
      'SKIPPED',
      'SKIPPED',
      'SWEPT',
      'PROGRAM_ENDED',
    ]);
    expect(JSON.parse(decisions[5]?.outputs_json ?? '{}')).toMatchObject({ totalReturnedStroops: '3190000000' });
    expect(JSON.parse(decisions[5]?.tx_ids_json ?? '[]')).toHaveLength(7);

    const sweep = events.filter((entry) => entry.event === 'sweep');
    expect(sweep).toHaveLength(1);
    expect(sweep[0]?.data).toMatchObject({ agent: 'sweep', decision: 'PROGRAM_ENDED' });
  });

  it('skips the sweep transaction for a zero escrow but still sweeps the card', async () => {
    const { deps, db } = fixture as Fixture;
    db.prepare('DELETE FROM cards WHERE id IN (?, ?)').run('card_D1', 'card_D2');
    db.prepare('DELETE FROM cards WHERE id = ?').run('card_D5');

    const response = await endProgram(deps);
    expect(response.totalReturnedStroops).toBe('0');
    expect(response.cards.map((card) => [card.cardId, card.status, card.reason])).toEqual([
      ['card_D3', 'swept', 'EMPTY_ESCROW'],
      ['card_D4', 'swept', 'EMPTY_ESCROW'],
    ]);
    expect(chainKinds(db)).toEqual(['revoke_agent']);
  });

  it('answers 502 only when the program row cannot be updated', async () => {
    const { deps, db } = fixture as Fixture;
    // The guarded `ending -> ended` write matches nothing (a competing writer settled it), so the program cannot end.
    const original = db.prepare;
    db.prepare = ((sql: string) => {
      const statement = original(sql);
      if (!sql.includes(`SET status = 'ended'`)) return statement;
      return { ...statement, run: () => ({ changes: 0, lastInsertRowid: 0 }) };
    }) as typeof db.prepare;

    try {
      await expect(endProgram(deps)).rejects.toMatchObject({ statusCode: 502, code: 'CHAIN_ERROR' });
    } finally {
      db.prepare = original;
    }
    expect(db.prepare('SELECT status FROM program').get<{ status: string }>()?.status).toBe('ending');
    expect(db.prepare(`SELECT COUNT(*) AS n FROM agent_decisions WHERE decision = 'PROGRAM_ENDED'`).get<{ n: number }>()?.n).toBe(0);
  });

  it('keeps one failed card active and leaves the program ending', async () => {
    const { deps, db, fake, hashes } = fixture as Fixture;
    const realPrepare = fake.prepare.getMockImplementation() as (source: string, op: { kind: string }) => Promise<string>;
    fake.prepare.mockImplementation(async (source: string, op: { kind: string; deviceHash?: string }) => {
      if (op.kind === 'sweepOnRevoke' && op.deviceHash === hashes.D2) {
        throw new NoirContractError('paymentEscrow', 4, 'AgentStillActive', 'sweep_on_revoke');
      }
      return realPrepare(source, op);
    });
    const response = await endProgram(deps);
    expect(response.program.status).toBe('ending');
    expect(response.cards.map((card) => [card.cardId, card.status, card.reason])).toEqual([
      ['card_D1', 'swept', null],
      ['card_D2', 'active', 'CONTRACT_AgentStillActive'],
      ['card_D3', 'swept', 'EMPTY_ESCROW'],
      ['card_D4', 'swept', 'EMPTY_ESCROW'],
      ['card_D5', 'swept', null],
    ]);
    expect(response.totalReturnedStroops).toBe('2650000000');
    expect(db.prepare('SELECT status FROM cards WHERE id = ?').get<{ status: string }>('card_D2')?.status).toBe('active');
    const decision = db
      .prepare(
        `SELECT decision, outputs_json FROM agent_decisions
          WHERE agent = 'sweep' AND decision = 'SWEPT' AND outputs_json LIKE '%card_D2%'
          ORDER BY rowid LIMIT 1`,
      )
      .get<{ decision: string; outputs_json: string }>();
    expect(decision?.decision).toBe('SWEPT');
    expect(JSON.parse(decision?.outputs_json ?? '{}')).toMatchObject({ error: 'CONTRACT_AgentStillActive' });
    expect(db.prepare(`SELECT COUNT(*) AS n FROM agent_decisions WHERE decision = 'PROGRAM_ENDED'`).get<{ n: number }>()?.n).toBe(0);

    // Run again: only the unfinished card is retried, the total is cumulative, and the program ends once.
    fake.prepare.mockImplementation(realPrepare);
    const retry = await endProgram(deps);
    expect(retry.cards.map((card) => [card.cardId, card.status, card.reason])).toEqual([['card_D2', 'swept', null]]);
    expect(retry.program.status).toBe('ended');
    expect(retry.totalReturnedStroops).toBe('3190000000');
    const closing = db
      .prepare(`SELECT inputs_json, outputs_json, tx_ids_json FROM agent_decisions WHERE decision = 'PROGRAM_ENDED'`)
      .all<{ inputs_json: string; outputs_json: string; tx_ids_json: string }>();
    expect(closing).toHaveLength(1);
    // The audit row covers both calls: five cards processed and swept, and every revoke/sweep tx either call made.
    expect(JSON.parse(closing[0]?.inputs_json ?? '{}')).toEqual({ cardsProcessed: 5, cardsSwept: 5 });
    const bothCalls = [...response.cards, ...retry.cards]
      .flatMap((card) => [card.revokeTxId, card.sweepTxId])
      .filter((id) => id !== null);
    expect(new Set(JSON.parse(closing[0]?.tx_ids_json ?? '[]'))).toEqual(new Set(bothCalls));
    // A reload of /demo/end reads every card from the closing decision, including the four the first call swept.
    expect(JSON.parse(closing[0]?.outputs_json ?? '{}')).toEqual({
      totalReturnedStroops: '3190000000',
      cards: [
        { cardId: 'card_D1', returnedStroops: '1150000000', status: 'swept', reason: null },
        { cardId: 'card_D2', returnedStroops: '540000000', status: 'swept', reason: null },
        { cardId: 'card_D3', returnedStroops: '0', status: 'swept', reason: 'EMPTY_ESCROW' },
        { cardId: 'card_D4', returnedStroops: '0', status: 'swept', reason: 'EMPTY_ESCROW' },
        { cardId: 'card_D5', returnedStroops: '1500000000', status: 'swept', reason: null },
      ],
    });
  });

  it('answers 409 INVALID_STATE to a call made while another end is still running', async () => {
    const { deps, db } = fixture as Fixture;
    const first = endProgram(deps);
    await expect(endProgram(deps)).rejects.toMatchObject({ statusCode: 409, code: 'INVALID_STATE', message: 'program end already running' });
    expect((await first).program.status).toBe('ended');
    expect(db.prepare(`SELECT COUNT(*) AS n FROM agent_decisions WHERE decision = 'PROGRAM_ENDED'`).get<{ n: number }>()?.n).toBe(1);
  });

  it('answers 409 INVALID_STATE on a second call and leaves the ended program alone', async () => {
    const { deps, db } = fixture as Fixture;
    await endProgram(deps);
    const before = db.prepare('SELECT COUNT(*) AS n FROM chain_txs').get<{ n: number }>()?.n;

    await expect(endProgram(deps)).rejects.toMatchObject({ statusCode: 409, code: 'INVALID_STATE' });
    expect(db.prepare('SELECT status FROM program').get<{ status: string }>()?.status).toBe('ended');
    expect(db.prepare('SELECT COUNT(*) AS n FROM chain_txs').get<{ n: number }>()?.n).toBe(before);
  });

  it('resumes a program an interrupted call left in ending', async () => {
    const { deps, db } = fixture as Fixture;
    db.prepare(`UPDATE program SET status = 'ending'`).run();

    const response = await endProgram(deps);
    expect(response.program.status).toBe('ended');
    expect(response.totalReturnedStroops).toBe('3190000000');
  });

  it('answers 409 INVALID_STATE for a draft program and 404 without one', async () => {
    const { deps, db } = fixture as Fixture;
    db.prepare(`UPDATE program SET status = 'draft'`).run();
    await expect(endProgram(deps)).rejects.toMatchObject({ statusCode: 409, code: 'INVALID_STATE' });

    db.prepare('DELETE FROM cards').run();
    db.prepare('DELETE FROM beneficiaries').run();
    db.prepare('DELETE FROM program').run();
    await expect(endProgram(deps)).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });

  it('never revokes a policy it could not read', async () => {
    const { deps, db, fake } = fixture as Fixture;
    fake.getPolicy.mockRejectedValue(new Error('rpc unavailable'));

    const response = await endProgram(deps);
    expect(response.program.status).toBe('ending');
    expect(response.cards.every((card) => card.status === 'active')).toBe(true);
    expect(response.cards.every((card) => card.reason === 'rpc unavailable')).toBe(true);
    expect(db.prepare('SELECT COUNT(*) AS n FROM chain_txs').get<{ n: number }>()?.n).toBe(0);
  });
});
