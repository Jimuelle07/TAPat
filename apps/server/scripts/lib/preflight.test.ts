import type { CardSummary, Dashboard, HealthResponse, Station, TrancheState } from '@tapat/shared';
import { describe, expect, it } from 'vitest';
import { checkFreshDemo, parsePreflightArgs, type PreflightInput } from './preflight';

const NOW_S = 1_794_015_000;

function card(letter: string, expired: boolean): CardSummary {
  return {
    id: `card_${letter}`,
    beneficiaryId: `ben_${letter}`,
    displayName: `Test ${letter}.`,
    uidLast4: `AL0${letter.slice(1)}`,
    deviceHashPrefix: '5694d225',
    virtual: true,
    status: 'active',
    expiresAtS: expired ? NOW_S - 10 : NOW_S + 86_400,
    expired,
    escrowStroops: '0',
    returnedStroops: '0',
  };
}

function station(id: string): Station {
  return {
    id,
    name: `Station ${id}`,
    publicKey: 'G'.repeat(56),
    status: 'active',
    frozenReason: null,
    frozenAt: null,
    pendingStroops: '0',
    spentStroops: '0',
  };
}

function fresh(gasMode: HealthResponse['gasMode'] = 'velo'): PreflightInput {
  const dashboard = {
    program: { id: 'prog_1', status: 'active', trancheFired: false },
    fundedStroops: '0',
    spentStroops: '0',
    heldStroops: '0',
    pendingStroops: '0',
    escrowRemainingStroops: '0',
    returnedStroops: '0',
    invariantOk: true,
    budget: {
      state: 'verified',
      verifiedStroops: '10000000000',
      fundedStroops: '0',
      remainingStroops: '10000000000',
      checkoutUrl: null,
      paymentIntentId: 'intent_1',
    },
    cards: [card('D1', false), card('D2', false), card('D3', true), card('D5', false)],
    stations: [station('A'), station('B')],
    recentTaps: [],
  } as unknown as Dashboard;
  const tranche = { running: false, fired: false, idx: 0, total: 45, funds: [] } as unknown as TrancheState;
  return { health: { ok: true, rpc: 'ok', velo: 'ok', telegram: 'ok', gasMode }, dashboard, tranche };
}

describe('checkFreshDemo', () => {
  it('passes a fresh seeded demo with gasMode velo', () => {
    expect(checkFreshDemo(fresh('velo'))).toEqual({ failures: [], warnings: [] });
  });

  it('only warns when gasMode is direct', () => {
    const result = checkFreshDemo(fresh('direct'));
    expect(result.failures).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('gasMode');
  });

  it('fails when the tranche already fired', () => {
    const input = fresh();
    (input.dashboard as Dashboard).program.trancheFired = true;
    expect(checkFreshDemo(input).failures.length).toBeGreaterThan(0);
  });

  it('fails and names D3 when its policy has not expired', () => {
    const input = fresh();
    (input.dashboard as Dashboard).cards[2] = card('D3', false);
    const { failures } = checkFreshDemo(input);
    expect(failures.some((f) => f.includes('D3'))).toBe(true);
  });

  it('fails and says Fund budget when the budget is not verified', () => {
    const input = fresh();
    (input.dashboard as Dashboard).budget.state = 'none';
    const { failures } = checkFreshDemo(input);
    expect(failures.some((f) => f.includes('Fund budget'))).toBe(true);
  });

  it('fails when station B is frozen', () => {
    const input = fresh();
    (input.dashboard as Dashboard).stations[1]!.status = 'frozen';
    expect(checkFreshDemo(input).failures.some((f) => f.includes('B'))).toBe(true);
  });

  it('fails without throwing when the dashboard is unavailable', () => {
    const input = { ...fresh(), dashboard: null };
    expect(() => checkFreshDemo(input)).not.toThrow();
    expect(checkFreshDemo(input).failures.length).toBeGreaterThan(0);
  });

  it('fails when a dependency is down or the tranche state is missing', () => {
    const input = fresh();
    (input.health as HealthResponse).telegram = 'down';
    expect(checkFreshDemo(input).failures.some((f) => f.includes('telegram'))).toBe(true);
    expect(checkFreshDemo({ ...fresh(), tranche: null }).failures.length).toBeGreaterThan(0);
  });

  it('only warns when Velo is down but the budget is already verified', () => {
    const input = fresh();
    (input.health as HealthResponse).velo = 'down';
    const { failures, warnings } = checkFreshDemo(input);
    expect(failures).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('health.velo');
  });

  it('fails when Velo is down and the budget is not verified', () => {
    const input = fresh();
    (input.health as HealthResponse).velo = 'down';
    (input.dashboard as Dashboard).budget.state = 'none';
    expect(checkFreshDemo(input).failures).toContain('health.velo is "down", expected "ok"');
  });
});

describe('parsePreflightArgs', () => {
  it('requires --base-url', () => {
    expect(() => parsePreflightArgs([])).toThrow();
  });

  it('normalizes the base url to its origin', () => {
    expect(parsePreflightArgs(['--base-url=https://x.ts.net/path'])).toEqual({ baseUrl: 'https://x.ts.net' });
  });

  it('rejects unknown flags and non-http urls', () => {
    expect(() => parsePreflightArgs(['--base-url=https://x.ts.net', '--bogus=1'])).toThrow();
    expect(() => parsePreflightArgs(['--base-url=ftp://x'])).toThrow();
  });
});
