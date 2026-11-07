import { Keypair } from '@stellar/stellar-sdk';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../src/db/index';
import { openDb } from '../../src/db/index';
import { seedBeneficiary, seedCard, seedProgram } from '../../src/services/test-fakes';
import { describePlan, parseReplayArgs, planReplay } from './replay';

let db: Db;

beforeEach(() => {
  db = openDb(':memory:');
});

afterEach(() => {
  db.close();
});

function addStation(id: string, status: 'active' | 'frozen'): void {
  db.prepare(`INSERT INTO stations (id, name, public_key, secret_enc, status) VALUES (?, ?, 'G', 'x', ?)`).run(
    id,
    `Station ${id}`,
    status,
  );
}

function addIntent(id: string, status: 'created' | 'paid', paidAt: number | null): void {
  db.prepare(
    `INSERT INTO velo_intents (id, purpose, amount, asset, status, created_at, paid_at)
     VALUES (?, 'budget', '1000.00', 'XLM', ?, 1, ?)`,
  ).run(id, status, paidAt);
}

describe('planReplay', () => {
  it('plans nothing against an empty database and notes the missing budget intent', () => {
    const plan = planReplay(db, []);
    expect(plan).toMatchObject({ programId: null, settle: false, end: false, budgetIntentId: null });
    expect(describePlan(plan).some((step) => step.startsWith('NOTE:') && step.includes('Fund budget'))).toBe(true);
  });

  it('settles, ends, unfreezes and reuses the newest paid budget intent', () => {
    seedProgram(db);
    db.prepare(`UPDATE program SET status = 'active'`).run();
    addStation('A', 'active');
    addStation('B', 'frozen');
    addIntent('pi_old', 'paid', 100);
    addIntent('pi_new', 'paid', 200);
    addIntent('pi_open', 'created', null);
    const plan = planReplay(db, ['--d3-expiry-offset=60']);
    expect(plan.frozenStations).toEqual(['B']);
    expect(plan.settle).toBe(true);
    expect(plan.end).toBe(true);
    expect(plan.budgetIntentId).toBe('pi_new');
    expect(plan.seedArgs).toContain('--budget-intent=pi_new');
    const steps = describePlan(plan);
    expect(steps[0]).toBe('unfreeze B');
    expect(steps.some((step) => step.startsWith('NOTE:'))).toBe(false);
  });

  it('skips End program for an ended program with no active cards but still settles', () => {
    seedProgram(db);
    db.prepare(`UPDATE program SET status = 'ended'`).run();
    const plan = planReplay(db, []);
    expect(plan).toMatchObject({ end: false, reopenEnded: false, settle: true });
  });

  it('plans end without re-open for an ending program', () => {
    seedProgram(db);
    db.prepare(`UPDATE program SET status = 'ending'`).run();
    expect(planReplay(db, [])).toMatchObject({ end: true, settle: true, reopenEnded: false });
  });

  it('re-opens an ended program while a card is still active', async () => {
    seedProgram(db);
    db.prepare(`UPDATE program SET status = 'ended'`).run();
    seedBeneficiary(db, { id: 'ben_1' });
    await seedCard(db, { id: 'card_1', beneficiaryId: 'ben_1', uid: '04AABBCCDDEE01', agent: Keypair.random(), secretEnc: 'x' });
    const plan = planReplay(db, []);
    expect(plan).toMatchObject({ end: true, reopenEnded: true, unsweptCardIds: ['card_1'] });
    expect(describePlan(plan).some((step) => step.startsWith('re-open ended program') && step.includes('card_1'))).toBe(true);
  });

  it('keeps the operator budget intent and does not consult the database', () => {
    addIntent('pi_db', 'paid', 100);
    const plan = planReplay(db, ['--budget-intent=abc']);
    expect(plan.budgetIntentId).toBe('abc');
    expect(plan.seedArgs.filter((arg) => arg.startsWith('--budget-intent='))).toEqual(['--budget-intent=abc']);
  });
});

describe('parseReplayArgs', () => {
  it('strips --dry-run, passes the rest through and defaults the D3 expiry to 60 s', () => {
    const parsed = parseReplayArgs(['--dry-run', '--uid-d1=04A2B3C4D5E6F7']);
    expect(parsed.dryRun).toBe(true);
    expect(parsed.seedArgs).toContain('--uid-d1=04A2B3C4D5E6F7');
    expect(parsed.seedArgs).toContain('--d3-expiry-offset=60');
    expect(parsed.seedArgs).not.toContain('--dry-run');
  });

  it('keeps an operator D3 expiry', () => {
    const parsed = parseReplayArgs(['--d3-expiry-offset=120']);
    expect(parsed.dryRun).toBe(false);
    expect(parsed.seedArgs).toEqual(['--d3-expiry-offset=120']);
  });

  it('rejects an unknown flag before anything runs', () => {
    expect(() => parseReplayArgs(['--bogus=1'])).toThrow();
  });
});
