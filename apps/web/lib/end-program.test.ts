import { describe, expect, it } from 'vitest';
import type { CardSummary, Dashboard, EndProgramResponse, ProgramStatus } from '@tapat/shared';
import { NOT_SWEPT_YET, endView, mergeEndResult, type CardOutcome } from './end-program';

const card = (id: string, status: CardSummary['status'], returnedStroops: string): CardSummary => ({
  id,
  beneficiaryId: `ben_${id}`,
  displayName: 'Juan D.',
  uidLast4: '9C7E',
  deviceHashPrefix: '3f9c1a0b',
  virtual: false,
  status,
  expiresAtS: 0,
  expired: false,
  escrowStroops: '0',
  returnedStroops,
});

const outcome = (cardId: string, status: CardOutcome['status'], returnedStroops: string, reason: string | null = null): CardOutcome => ({
  cardId,
  beneficiaryId: `ben_${cardId}`,
  returnedStroops,
  revokeTxId: null,
  sweepTxId: null,
  status,
  reason,
});

function dashboard(status: ProgramStatus, over: Partial<Dashboard> = {}): Dashboard {
  return {
    program: { status } as Dashboard['program'],
    cards: [],
    recentDecisions: [],
    returnedStroops: '0',
    ...over,
  } as Dashboard;
}

const response = (status: ProgramStatus, cards: CardOutcome[], total: string): EndProgramResponse => ({
  program: { status } as EndProgramResponse['program'],
  cards,
  totalReturnedStroops: total,
});

describe('mergeEndResult', () => {
  it('replaces only the retried card and keeps the cumulative server total', () => {
    const first = [outcome('D1', 'swept', '1150000000'), outcome('D2', 'active', '0', 'CONTRACT_AgentStillActive')];
    const merged = mergeEndResult(first, response('ended', [outcome('D2', 'swept', '540000000')], '1690000000'));
    expect(merged.cards.map((c) => [c.cardId, c.status])).toEqual([['D1', 'swept'], ['D2', 'swept']]);
    expect(merged.totalReturnedStroops).toBe('1690000000');
    expect(merged.program.status).toBe('ended');
  });

  it('returns the first response unchanged when nothing was shown yet', () => {
    const next = response('ended', [outcome('D1', 'swept', '1')], '1');
    expect(mergeEndResult([], next)).toBe(next);
  });
});

describe('endView', () => {
  it('asks to confirm while the program is active and nothing has run', () => {
    expect(endView(dashboard('active'), null)).toMatchObject({ stage: 'confirm', outcomes: [], failures: [] });
  });

  it('keeps a partial response non-final and lists its failed card', () => {
    const view = endView(
      dashboard('active'),
      response('ending', [outcome('D1', 'swept', '1150000000'), outcome('D2', 'active', '0', 'CONTRACT_AgentStillActive')], '1150000000'),
    );
    expect(view.stage).toBe('partial');
    expect(view.failures.map((c) => c.cardId)).toEqual(['D2']);
    expect(view.totalReturnedStroops).toBe('1150000000');
  });

  it('after a reload mid-sweep, shows the unfinished sweep from the cards instead of the confirm sheet', () => {
    const view = endView(
      dashboard('ending', {
        returnedStroops: '1150000000',
        cards: [card('D1', 'swept', '1150000000'), card('D2', 'active', '0'), card('D3', 'swept', '0'), card('D9', 'pending', '0')],
      }),
      null,
    );
    expect(view.stage).toBe('partial');
    expect(view.outcomes.map((c) => [c.cardId, c.status, c.reason])).toEqual([
      ['D1', 'swept', null],
      ['D2', 'active', NOT_SWEPT_YET],
      ['D3', 'swept', 'EMPTY_ESCROW'],
    ]);
    expect(view.failures.map((c) => c.cardId)).toEqual(['D2']);
    expect(view.totalReturnedStroops).toBe('1150000000');
  });

  it('stays partial with no failures when every card is swept but the program is still ending', () => {
    // An end interrupted after the last card landed: the page must still offer Run again so the program can close.
    const view = endView(dashboard('ending', { returnedStroops: '1150000000', cards: [card('D1', 'swept', '1150000000')] }), null);
    expect(view).toMatchObject({ stage: 'partial', failures: [], totalReturnedStroops: '1150000000' });
  });

  it('after a reload of an ended program, lists the closing decision cards as final', () => {
    // The closing decision stores four fields per card; the view fills the missing ids with nulls.
    const cards = [
      { cardId: 'D1', returnedStroops: '1150000000', status: 'swept', reason: null },
      { cardId: 'D3', returnedStroops: '0', status: 'swept', reason: 'EMPTY_ESCROW' },
    ];
    const view = endView(
      dashboard('ended', {
        returnedStroops: '1150000000',
        recentDecisions: [{ agent: 'sweep', decision: 'PROGRAM_ENDED', outputs: { cards } } as unknown as Dashboard['recentDecisions'][number]],
      }),
      null,
    );
    expect(view).toMatchObject({ stage: 'ended', failures: [], totalReturnedStroops: '1150000000' });
    expect(view.outcomes).toEqual([
      { cardId: 'D1', beneficiaryId: '', returnedStroops: '1150000000', revokeTxId: null, sweepTxId: null, status: 'swept', reason: null },
      { cardId: 'D3', beneficiaryId: '', returnedStroops: '0', revokeTxId: null, sweepTxId: null, status: 'swept', reason: 'EMPTY_ESCROW' },
    ]);
  });

  it('lets a dashboard that says ended override an older partial response', () => {
    const cards = [
      { cardId: 'D1', returnedStroops: '1150000000', status: 'swept', reason: null },
      { cardId: 'D2', returnedStroops: '540000000', status: 'swept', reason: null },
    ];
    const view = endView(
      dashboard('ended', {
        returnedStroops: '1690000000',
        recentDecisions: [{ agent: 'sweep', decision: 'PROGRAM_ENDED', outputs: { cards } } as unknown as Dashboard['recentDecisions'][number]],
      }),
      response('ending', [outcome('D1', 'swept', '1150000000'), outcome('D2', 'active', '0', 'CONTRACT_AgentStillActive')], '1150000000'),
    );
    expect(view).toMatchObject({ stage: 'ended', failures: [], totalReturnedStroops: '1690000000' });
    expect(view.outcomes.map((c) => [c.cardId, c.status, c.returnedStroops])).toEqual([
      ['D1', 'swept', '1150000000'],
      ['D2', 'swept', '540000000'],
    ]);
  });

  it('after a reload mid-sweep, Run again keeps every listed card and replaces only the retried one', () => {
    const reloaded = endView(
      dashboard('ending', { returnedStroops: '1150000000', cards: [card('D1', 'swept', '1150000000'), card('D2', 'active', '0')] }),
      null,
    );
    const merged = mergeEndResult(reloaded.outcomes, response('ended', [outcome('D2', 'swept', '540000000')], '1690000000'));
    const view = endView(dashboard('ending'), merged);
    expect(view.stage).toBe('ended');
    expect(view.outcomes.map((c) => [c.cardId, c.status, c.returnedStroops])).toEqual([
      ['D1', 'swept', '1150000000'],
      ['D2', 'swept', '540000000'],
    ]);
    expect(view.totalReturnedStroops).toBe('1690000000');
  });
});
