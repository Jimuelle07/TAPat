// Demo seed and reset (build-schedule SED): pure helpers plus the orchestration against fake chain clients.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Keypair } from '@stellar/stellar-sdk';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { NoirOperation } from '@tapat/agent';
import type { Db } from '../db/index';
import { openDb } from '../db/index';
import {
  DEFAULT_D3_EXPIRY_OFFSET_S,
  SEED_CAST,
  parseMasterlistCsv,
  parseSeedArgs,
  planSeed,
  resetDemo,
  seedDemo,
  type SeedDeps,
} from './demo';
import { createSseBus } from './sse';
import {
  BOT_USERNAME,
  KEY_ENCRYPTION_SECRET,
  T0,
  XLM_SAC_ID,
  fakeLog,
  fakeNoir,
  makeChainDeps,
  unsignedXdr,
  type FakeNoir,
} from './test-fakes';

const MASTERLIST = readFileSync(
  resolve(import.meta.dirname, '../../../../fixtures/masterlist/masterlist.csv'),
  'utf8',
);

describe('parseSeedArgs', () => {
  it('defaults D3 to 600 s and every driver to its virtual UID', () => {
    const args = parseSeedArgs([]);
    expect(args.d3ExpiryOffsetS).toBe(DEFAULT_D3_EXPIRY_OFFSET_S);
    expect(DEFAULT_D3_EXPIRY_OFFSET_S).toBe(600);
    expect(args.uids).toEqual({
      D1: 'TAPATVIRTUAL01',
      D2: 'TAPATVIRTUAL02',
      D3: 'TAPATVIRTUAL03',
      D5: 'TAPATVIRTUAL05',
    });
  });

  it('takes --d3-expiry-offset as whole seconds', () => {
    expect(parseSeedArgs(['--d3-expiry-offset=30']).d3ExpiryOffsetS).toBe(30);
  });

  it.each(['0', '-5', '1.5', 'abc', ''])('rejects --d3-expiry-offset=%s (must be a whole number > 0)', (value) => {
    expect(() => parseSeedArgs([`--d3-expiry-offset=${value}`])).toThrow('> 0');
  });

  it('normalizes a physical tag UID (colons removed, uppercased)', () => {
    expect(parseSeedArgs(['--uid-d1=04:a2:1f:9c:9c:7e']).uids.D1).toBe('04A21F9C9C7E');
    expect(parseSeedArgs(['--uid-D2=04A21F9C3A54']).uids.D2).toBe('04A21F9C3A54');
  });

  it('rejects a UID that fails the 4-32 alphanumeric rule, naming the flag', () => {
    expect(() => parseSeedArgs(['--uid-d1=ab_cd'])).toThrow('--uid-d1');
  });

  it('rejects two drivers on one UID', () => {
    expect(() => parseSeedArgs(['--uid-d1=04A21F9C9C7E', '--uid-d2=04:a2:1f:9c:9c:7e'])).toThrow('two drivers');
  });

  it('rejects unknown flags and bare words instead of seeding defaults', () => {
    expect(() => parseSeedArgs(['--d3-expiry=30'])).toThrow('unknown flag');
    expect(() => parseSeedArgs(['--uid-d4=04A21F9C0000'])).toThrow('unknown flag');
    expect(() => parseSeedArgs(['30'])).toThrow('unrecognised argument');
  });

  it('defaults the officer email and leaves the password unset', () => {
    const args = parseSeedArgs([]);
    expect(args.officerEmail).toBe('officer@tapat.demo');
    expect(args.officerPassword).toBeUndefined();
  });

  it('lowercases a custom --officer-email', () => {
    expect(parseSeedArgs(['--officer-email=  Officer@TAPAT.demo ']).officerEmail).toBe('officer@tapat.demo');
  });

  it('rejects an invalid --officer-email, naming the flag', () => {
    expect(() => parseSeedArgs(['--officer-email=not-an-email'])).toThrow('--officer-email');
  });

  it('rejects a --officer-password shorter than 8 characters', () => {
    expect(() => parseSeedArgs(['--officer-password=1234567'])).toThrow('--officer-password');
  });

  it('passes --officer-password through unchanged', () => {
    expect(parseSeedArgs(['--officer-password=hunter2hunter2']).officerPassword).toBe('hunter2hunter2');
  });

  it('leaves --budget-intent unset by default and passes a valid intent id through', () => {
    expect(parseSeedArgs([]).budgetIntent).toBeUndefined();
    expect(parseSeedArgs(['--budget-intent=jx75a9kp5j9fm83vgy5a48h10s8hq4fp']).budgetIntent).toBe(
      'jx75a9kp5j9fm83vgy5a48h10s8hq4fp',
    );
  });

  it.each(['', 'has space', 'a/b', 'id;drop'])('rejects --budget-intent=%s, naming the flag', (value) => {
    expect(() => parseSeedArgs([`--budget-intent=${value}`])).toThrow('--budget-intent');
  });
});

describe('parseMasterlistCsv', () => {
  it('parses quoted fields, embedded commas and CRLF line ends', () => {
    const rows = parseMasterlistCsv(
      'last_name,first_name,middle_name,suffix,birthdate,plate,toda,barangay\r\n"Dela Cruz, Jr",Juan,,,1980-03-02,ABC 1234,"San ""Roque"" TODA",San Roque\r\n',
    );
    expect(rows).toEqual([
      {
        last_name: 'Dela Cruz, Jr',
        first_name: 'Juan',
        middle_name: '',
        suffix: '',
        birthdate: '1980-03-02',
        plate: 'ABC 1234',
        toda: 'San "Roque" TODA',
        barangay: 'San Roque',
      },
    ]);
  });

  it('matches columns by name, in any order', () => {
    const rows = parseMasterlistCsv(
      'barangay,toda,plate,birthdate,suffix,middle_name,first_name,last_name\nSan Roque,San Roque TODA,ABC 1234,1980-03-02,,S,Juan,Dela Cruz',
    );
    expect(rows[0]).toMatchObject({ last_name: 'Dela Cruz', first_name: 'Juan', barangay: 'San Roque' });
  });

  it('rejects a missing, extra or renamed column and a short row', () => {
    expect(() => parseMasterlistCsv('last_name,first_name\nA,B')).toThrow('header must be exactly');
    expect(() =>
      parseMasterlistCsv('last_name,first_name,middle_name,suffix,birthdate,plate,toda,barangay,extra\n1,2,3,4,5,6,7,8,9'),
    ).toThrow('header must be exactly');
    expect(() =>
      parseMasterlistCsv('last_name,first_name,middle_name,suffix,birthdate,plate,toda,barangay\nA,B,C'),
    ).toThrow('row 2 has 3 fields');
  });

  it('reads the committed fixture: 12 rows, the four seeded drivers present, D4 present but not seeded', () => {
    const rows = parseMasterlistCsv(MASTERLIST);
    expect(rows).toHaveLength(12);
    const plan = planSeed(parseSeedArgs([]), rows, T0);
    expect(plan.map((entry) => entry.row.last_name)).toEqual(['Dela Cruz', 'Reyes', 'Bautista', 'Garcia']);
    expect(rows.some((row) => row.last_name === 'Villanueva' && row.first_name === 'Ana')).toBe(true);
  });

  it('keeps the fixture composition of api-and-data §4: one ghost plate, one minor, two Santos variants', () => {
    const rows = parseMasterlistCsv(MASTERLIST);
    const plates = rows.map((row) => row.plate.replace(/[^A-Z0-9]/gi, '').toUpperCase());
    expect(plates.filter((plate) => plate === 'ABC1234')).toHaveLength(2);
    expect(new Set(plates).size).toBe(11);
    const minors = rows.filter((row) => row.birthdate > '2008-11-06');
    expect(minors).toHaveLength(1);
    const santos = rows.filter((row) => row.last_name === 'Santos');
    expect(santos).toHaveLength(3);
  });
});

describe('planSeed', () => {
  const rows = parseMasterlistCsv(MASTERLIST);

  it('puts D3 at seed time + the offset in unix seconds and leaves the others on the program expiry', () => {
    const plan = planSeed(parseSeedArgs(['--d3-expiry-offset=30']), rows, T0);
    expect(plan.find((entry) => entry.tag === 'D3')?.expiresAtS).toBe(Math.floor(T0 / 1000) + 30);
    expect(plan.filter((entry) => entry.tag !== 'D3').every((entry) => entry.expiresAtS === undefined)).toBe(true);
  });

  it('flags only TAPATVIRTUAL UIDs as virtual', () => {
    const plan = planSeed(parseSeedArgs(['--uid-d1=04A21F9C9C7E']), rows, T0);
    expect(plan.map((entry) => [entry.tag, entry.virtual])).toEqual([
      ['D1', false],
      ['D2', true],
      ['D3', true],
      ['D5', true],
    ]);
  });

  it('names the missing driver when the masterlist lacks one', () => {
    expect(() => planSeed(parseSeedArgs([]), rows.filter((row) => row.last_name !== 'Garcia'), T0)).toThrow('D5');
  });

  it('keeps one cast entry per seeded driver and never D4', () => {
    expect(SEED_CAST.map((member) => member.tag)).toEqual(['D1', 'D2', 'D3', 'D5']);
  });
});

let db: Db;
let fake: FakeNoir;
let wallet: Keypair;
let deps: SeedDeps;

beforeEach(() => {
  db = openDb(':memory:');
  fake = fakeNoir();
  wallet = Keypair.random();
  const config = {
    KEY_ENCRYPTION_SECRET,
    PHP_PER_XLM: 10,
    STATION_A_SECRET: Keypair.random().secret(),
    STATION_B_SECRET: Keypair.random().secret(),
  };
  deps = {
    db,
    chain: makeChainDeps(db, fake.noir, fakeLog()),
    config,
    now: () => T0,
    enroll: {
      bus: createSseBus(),
      programWallet: wallet,
      config: { KEY_ENCRYPTION_SECRET, XLM_SAC_ID, TELEGRAM_BOT_USERNAME: BOT_USERNAME },
      fund: async () => undefined,
    },
  };
});

afterEach(() => {
  db.close();
});

interface CountRow {
  n: number;
}

function count(table: string): number {
  return db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get<CountRow>()?.n ?? -1;
}

describe('seedDemo', () => {
  it('seeds stations, an active program and four active cards with register + register_agent each', async () => {
    const result = await seedDemo(deps, parseSeedArgs(['--d3-expiry-offset=30']), MASTERLIST);

    expect(result.program.status).toBe('active');
    expect(result.enrolled.map((card) => [card.tag, card.cardId])).toEqual([
      ['D1', 'card_D1'],
      ['D2', 'card_D2'],
      ['D3', 'card_D3'],
      ['D5', 'card_D5'],
    ]);
    expect(
      db.prepare('SELECT id, status FROM cards ORDER BY id').all<{ id: string; status: string }>(),
    ).toEqual([
      { id: 'card_D1', status: 'active' },
      { id: 'card_D2', status: 'active' },
      { id: 'card_D3', status: 'active' },
      { id: 'card_D5', status: 'active' },
    ]);
    expect(
      db.prepare('SELECT kind, status FROM chain_txs ORDER BY rowid').all<{ kind: string; status: string }>(),
    ).toEqual(
      ['D1', 'D2', 'D3', 'D5'].flatMap(() => [
        { kind: 'register', status: 'succeeded' },
        { kind: 'register_agent', status: 'succeeded' },
      ]),
    );
    expect(db.prepare('SELECT id, status FROM stations ORDER BY id').all()).toEqual([
      { id: 'A', status: 'active' },
      { id: 'B', status: 'active' },
    ]);
    expect(db.prepare(`SELECT status FROM program`).get<{ status: string }>()?.status).toBe('active');
  });

  it('enrolls the seeded beneficiaries from the masterlist and leaves D4 out', async () => {
    await seedDemo(deps, parseSeedArgs([]), MASTERLIST);
    const rows = db
      .prepare('SELECT id, last_name, status, source, score FROM beneficiaries ORDER BY id')
      .all<{ id: string; last_name: string; status: string; source: string; score: number }>();
    expect(rows).toEqual([
      { id: 'ben_D1', last_name: 'Dela Cruz', status: 'enrolled', source: 'csv', score: 1 },
      { id: 'ben_D2', last_name: 'Reyes', status: 'enrolled', source: 'csv', score: 1 },
      { id: 'ben_D3', last_name: 'Bautista', status: 'enrolled', source: 'csv', score: 1 },
      { id: 'ben_D5', last_name: 'Garcia', status: 'enrolled', source: 'csv', score: 1 },
    ]);
  });

  it("sets D3's policy expiry to seed time + the offset and gives the others the program expiry", async () => {
    await seedDemo(deps, parseSeedArgs(['--d3-expiry-offset=30']), MASTERLIST);
    const expiries = db
      .prepare('SELECT id, expires_at_s FROM cards ORDER BY id')
      .all<{ id: string; expires_at_s: number }>();
    expect(expiries).toEqual([
      { id: 'card_D1', expires_at_s: 1796054399 },
      { id: 'card_D2', expires_at_s: 1796054399 },
      { id: 'card_D3', expires_at_s: Math.floor(T0 / 1000) + 30 },
      { id: 'card_D5', expires_at_s: 1796054399 },
    ]);
    const registerAgentOps = fake.prepare.mock.calls
      .map((call) => call[1] as NoirOperation)
      .filter((op) => op.kind === 'registerAgent');
    expect(registerAgentOps).toHaveLength(4);
  });

  it('marks virtual UIDs virtual and a named physical tag physical', async () => {
    await seedDemo(deps, parseSeedArgs(['--uid-d1=04A21F9C9C7E']), MASTERLIST);
    expect(
      db.prepare('SELECT id, virtual, uid_last4 FROM cards ORDER BY id').all<{ id: string; virtual: number; uid_last4: string }>(),
    ).toEqual([
      { id: 'card_D1', virtual: 0, uid_last4: '9C7E' },
      { id: 'card_D2', virtual: 1, uid_last4: 'AL02' },
      { id: 'card_D3', virtual: 1, uid_last4: 'AL03' },
      { id: 'card_D5', virtual: 1, uid_last4: 'AL05' },
    ]);
  });

  it('refuses to seed over an existing program', async () => {
    await seedDemo(deps, parseSeedArgs([]), MASTERLIST);
    await expect(seedDemo(deps, parseSeedArgs([]), MASTERLIST)).rejects.toThrow('run reset-demo.ts');
    expect(count('cards')).toBe(4);
  });

  it('reports which driver failed and to run reset-demo.ts when a chain step fails', async () => {
    fake.prepare.mockImplementation(async (source: string, op: NoirOperation) => {
      if (op.kind === 'registerAgent') throw new Error('rpc down');
      return unsignedXdr(source);
    });
    await expect(seedDemo(deps, parseSeedArgs([]), MASTERLIST)).rejects.toThrow(/enrolling D1 failed.*reset-demo\.ts/);
  });
});

describe('resetDemo', () => {
  async function seeded(): Promise<void> {
    await seedDemo(deps, parseSeedArgs([]), MASTERLIST);
    fake.getDeviceOwner.mockResolvedValue(wallet.publicKey());
    fake.getEscrowBalance.mockResolvedValue(0n);
    fake.prepare.mockClear();
  }

  it('revokes every registered device through the chain pipeline, then empties the database', async () => {
    await seeded();

    const result = await resetDemo({ db, chain: deps.chain, programWallet: wallet });

    expect(result.revoked).toEqual(['card_D1', 'card_D2', 'card_D3', 'card_D5']);
    const ops = fake.prepare.mock.calls.map((call) => call[1] as NoirOperation);
    expect(ops.map((op) => op.kind)).toEqual(['revokeDevice', 'revokeDevice', 'revokeDevice', 'revokeDevice']);
    for (const table of ['taps', 'chain_txs', 'agent_decisions', 'cards', 'beneficiaries', 'stations', 'program']) {
      expect(count(table)).toBe(0);
    }
  });

  it('skips a card that is not registered on chain and still revokes the rest', async () => {
    await seeded();
    fake.getDeviceOwner.mockImplementation(async (hash: string) => {
      const first = db.prepare(`SELECT device_hash FROM cards WHERE id = 'card_D2'`).get<{ device_hash: string }>();
      return hash === first?.device_hash ? null : wallet.publicKey();
    });

    const result = await resetDemo({ db, chain: deps.chain, programWallet: wallet });

    expect(result.skipped).toEqual(['card_D2']);
    expect(result.revoked).toEqual(['card_D1', 'card_D3', 'card_D5']);
  });

  it('refuses while a card still holds escrow, without revoking or deleting anything', async () => {
    await seeded();
    fake.getEscrowBalance.mockResolvedValueOnce(1_150_000_000n);

    await expect(resetDemo({ db, chain: deps.chain, programWallet: wallet })).rejects.toThrow('End program');

    expect(fake.prepare).not.toHaveBeenCalled();
    expect(count('cards')).toBe(4);
  });

  it('keeps every row when a revoke fails', async () => {
    await seeded();
    fake.prepare.mockImplementation(async () => {
      throw new Error('rpc down');
    });

    await expect(resetDemo({ db, chain: deps.chain, programWallet: wallet })).rejects.toThrow('rpc down');

    expect(count('cards')).toBe(4);
    expect(count('program')).toBe(1);
  });

  it('lets the next seed run on the emptied database with a fresh salt', async () => {
    await seeded();
    const firstSalt = db.prepare('SELECT salt FROM program').get<{ salt: string }>()?.salt;

    await resetDemo({ db, chain: deps.chain, programWallet: wallet });
    await seedDemo(deps, parseSeedArgs([]), MASTERLIST);

    expect(count('cards')).toBe(4);
    expect(db.prepare('SELECT salt FROM program').get<{ salt: string }>()?.salt).not.toBe(firstSalt);
  });
});
