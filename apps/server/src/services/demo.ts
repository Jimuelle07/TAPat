// The demo seed and reset (build-schedule SED, SDD §2.5): the logic behind `scripts/seed-demo.ts` and
// `scripts/reset-demo.ts`, kept here so it is tested against fakes and reuses the C3 enrollment service and
// `runChainTx` instead of carrying its own chain code. The scripts only load config, open the DB and print.
import { Keypair } from '@stellar/stellar-sdk';
import { encryptSecret } from '@tapat/agent';
import { z } from 'zod';
import { uidSchema, VIRTUAL_UID_PREFIX, type Program } from '@tapat/shared';
import type { Config } from '../config';
import type { Db } from '../db/index';
import { newLinkCode } from './beneficiaries';
import { runChainTx, type ChainDeps } from './chain';
import { enrollCard, type CardRow, type EnrollDeps } from './enroll';
import { createProgram, getCurrentProgram } from './program';

/** The four seeded drivers. D4 is approved by intake and enrolled live, so the seed never touches it. */
export type SeedTag = 'D1' | 'D2' | 'D3' | 'D5';

interface CastMember {
  tag: SeedTag;
  lastName: string;
  firstName: string;
  /** Used when no `--uid-<tag>` flag names the physical tag; D5 is always the documented virtual UID. */
  defaultUid: string;
}

/** SDD §2.5. The names key into `fixtures/masterlist/masterlist.csv`, the only source of each driver's record. */
export const SEED_CAST: readonly CastMember[] = [
  { tag: 'D1', lastName: 'Dela Cruz', firstName: 'Juan', defaultUid: 'TAPATVIRTUAL01' },
  { tag: 'D2', lastName: 'Reyes', firstName: 'Pedro', defaultUid: 'TAPATVIRTUAL02' },
  { tag: 'D3', lastName: 'Bautista', firstName: 'Ramon', defaultUid: 'TAPATVIRTUAL03' },
  { tag: 'D5', lastName: 'Garcia', firstName: 'Lito', defaultUid: 'TAPATVIRTUAL05' },
];

/** SDD §2.5: D3's policy expires this many seconds after seed time unless `--d3-expiry-offset` says otherwise. */
export const DEFAULT_D3_EXPIRY_OFFSET_S = 600;

/** The officer account the seed creates or refreshes; judges log in with it. */
const DEFAULT_OFFICER_EMAIL = 'officer@tapat.demo';

/** `signupBodySchema`'s email rule: trimmed, lowercased, a valid address. */
const officerEmailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

export interface SeedArgs {
  /** Seconds after seed time that D3's policy expires. Always > 0: `register_agent` rejects a past expiry. */
  d3ExpiryOffsetS: number;
  /** Normalized UID per seeded driver. */
  uids: Record<SeedTag, string>;
  /** Lowercased email of the officer account to create or refresh. */
  officerEmail: string;
  /** New password for the officer account; `undefined` leaves an existing hash untouched. */
  officerPassword: string | undefined;
  /** A Velo payment intent that is already paid; the seed adopts it as the verified budget. */
  budgetIntent: string | undefined;
}

/**
 * Parses `--d3-expiry-offset=<seconds>` (default 600, must be a whole number > 0), the optional
 * `--uid-d1=<UID>` / `--uid-d2` / `--uid-d3` / `--uid-d5` flags that name the physical tags, `--officer-email=` /
 * `--officer-password=`, and `--budget-intent=<paymentIntentId>` (`[A-Za-z0-9_-]+`). Anything else throws, so a typo
 * never silently seeds the defaults.
 */
export function parseSeedArgs(argv: readonly string[]): SeedArgs {
  const uids: Record<SeedTag, string> = Object.fromEntries(
    SEED_CAST.map((member) => [member.tag, member.defaultUid]),
  ) as Record<SeedTag, string>;
  let d3ExpiryOffsetS = DEFAULT_D3_EXPIRY_OFFSET_S;
  let officerEmail = DEFAULT_OFFICER_EMAIL;
  let officerPassword: string | undefined;
  let budgetIntent: string | undefined;

  for (const arg of argv) {
    const match = /^--([a-z0-9-]+)=(.*)$/i.exec(arg);
    if (match === null) throw new Error(`unrecognised argument "${arg}"; flags look like --name=value`);
    const name = (match[1] as string).toLowerCase();
    const value = match[2] as string;
    if (name === 'd3-expiry-offset') {
      if (!/^\d+$/.test(value) || Number(value) <= 0) {
        throw new Error(`--d3-expiry-offset must be a whole number of seconds > 0, got "${value}"`);
      }
      d3ExpiryOffsetS = Number(value);
      continue;
    }
    if (name === 'officer-email') {
      const parsed = officerEmailSchema.safeParse(value);
      if (!parsed.success) {
        throw new Error(`--officer-email: ${parsed.error.issues[0]?.message ?? 'invalid email'}`);
      }
      officerEmail = parsed.data;
      continue;
    }
    if (name === 'officer-password') {
      if (value.length < 8) throw new Error(`--officer-password must be at least 8 characters, got ${value.length}`);
      officerPassword = value;
      continue;
    }
    if (name === 'budget-intent') {
      if (!/^[A-Za-z0-9_-]+$/.test(value)) {
        throw new Error(`--budget-intent must be a payment intent id ([A-Za-z0-9_-]+), got "${value}"`);
      }
      budgetIntent = value;
      continue;
    }
    const tag = /^uid-(d[1235])$/.exec(name)?.[1]?.toUpperCase() as SeedTag | undefined;
    if (tag === undefined) throw new Error(`unknown flag --${name}`);
    const parsed = uidSchema.safeParse(value);
    if (!parsed.success) throw new Error(`--uid-${tag.toLowerCase()}: ${parsed.error.issues[0]?.message ?? 'invalid UID'}`);
    uids[tag] = parsed.data;
  }

  const seen = new Set<string>();
  for (const member of SEED_CAST) {
    const uid = uids[member.tag];
    if (seen.has(uid)) throw new Error(`UID ${uid} is used for two drivers; every card needs its own UID`);
    seen.add(uid);
  }
  return { d3ExpiryOffsetS, uids, officerEmail, officerPassword, budgetIntent };
}

/** The eight CSV columns of api-and-data.md §5.2 #6, as the file names them. */
const MASTERLIST_COLUMNS = [
  'last_name',
  'first_name',
  'middle_name',
  'suffix',
  'birthdate',
  'plate',
  'toda',
  'barangay',
] as const;

export type MasterlistRow = Record<(typeof MASTERLIST_COLUMNS)[number], string>;

/** One CSV record: quoted fields (with `""` escapes and embedded commas) and CR/LF line ends. */
function splitCsv(text: string): string[][] {
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i] as string;
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      record.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      record.push(field);
      field = '';
      if (record.some((value) => value !== '')) records.push(record);
      record = [];
    } else field += char;
  }
  record.push(field);
  if (record.some((value) => value !== '')) records.push(record);
  return records;
}

/** Parses the masterlist: the header must name exactly the eight columns (any order); a short row is an error. */
export function parseMasterlistCsv(text: string): MasterlistRow[] {
  const [header, ...body] = splitCsv(text.replace(/^\uFEFF/, ''));
  if (header === undefined) throw new Error('masterlist is empty');
  const names = header.map((name) => name.trim());
  const missing = MASTERLIST_COLUMNS.filter((column) => !names.includes(column));
  if (missing.length > 0 || names.length !== MASTERLIST_COLUMNS.length) {
    throw new Error(`masterlist header must be exactly ${MASTERLIST_COLUMNS.join(',')}`);
  }
  return body.map((values, index) => {
    if (values.length !== names.length) {
      throw new Error(`masterlist row ${index + 2} has ${values.length} fields, expected ${names.length}`);
    }
    return Object.fromEntries(names.map((name, i) => [name, (values[i] as string).trim()])) as MasterlistRow;
  });
}

/** What the seed derives per driver before any chain call: the record, the UID, the virtual flag, the expiry. */
export interface SeedPlanEntry {
  tag: SeedTag;
  beneficiaryId: string;
  cardId: string;
  row: MasterlistRow;
  uid: string;
  virtual: boolean;
  /** Set only for D3; the others take the program's expiry. */
  expiresAtS: number | undefined;
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Pairs each seeded driver with their masterlist row. A missing driver is an error, never a guess. */
export function planSeed(args: SeedArgs, rows: readonly MasterlistRow[], seedTimeMs: number): SeedPlanEntry[] {
  return SEED_CAST.map((member) => {
    const row = rows.find((r) => sameName(r.last_name, member.lastName) && sameName(r.first_name, member.firstName));
    if (row === undefined) {
      throw new Error(`masterlist has no row for ${member.tag} ${member.firstName} ${member.lastName}`);
    }
    const uid = args.uids[member.tag];
    return {
      tag: member.tag,
      beneficiaryId: `ben_${member.tag}`,
      cardId: `card_${member.tag}`,
      row,
      uid,
      virtual: uid.startsWith(VIRTUAL_UID_PREFIX),
      expiresAtS: member.tag === 'D3' ? Math.floor(seedTimeMs / 1000) + args.d3ExpiryOffsetS : undefined,
    };
  });
}

const STATIONS = [
  { id: 'A', name: 'Petron San Roque', secret: 'STATION_A_SECRET' },
  { id: 'B', name: 'Rotonda Fuels', secret: 'STATION_B_SECRET' },
] as const;

export interface SeedDeps {
  db: Db;
  chain: ChainDeps;
  enroll: Omit<EnrollDeps, 'db' | 'chain' | 'id'>;
  config: Pick<Config, 'KEY_ENCRYPTION_SECRET' | 'PHP_PER_XLM' | 'STATION_A_SECRET' | 'STATION_B_SECRET'>;
  now?: () => number;
}

export interface SeedResult {
  program: Program;
  enrolled: Array<{ tag: SeedTag; cardId: string; uidLast4: string; virtual: boolean; expiresAtS: number; chainTxIds: string[] }>;
}

/**
 * Seeds the demo: both stations, one program with a fresh salt, then D1/D2/D3/D5 approved and enrolled through the
 * same `enrollCard` the API uses (real `register` + `register_agent`), then the program goes `active`. The seed
 * is the officer, so each photo check is `officer_confirmed`. D4 is deliberately not seeded.
 */
export async function seedDemo(deps: SeedDeps, args: SeedArgs, masterlistCsv: string): Promise<SeedResult> {
  const now = deps.now ?? Date.now;
  if (getCurrentProgram(deps.db) !== null) {
    throw new Error('a program already exists; run reset-demo.ts before seeding again');
  }
  const seedTime = now();
  const plan = planSeed(args, parseMasterlistCsv(masterlistCsv), seedTime);

  const program = deps.db.transaction(() => {
    for (const station of STATIONS) {
      const secret = deps.config[station.secret];
      deps.db
        .prepare(`INSERT INTO stations (id, name, public_key, secret_enc, status) VALUES (?, ?, ?, ?, 'active')`)
        .run(
          station.id,
          station.name,
          Keypair.fromSecret(secret).publicKey(),
          encryptSecret(secret, deps.config.KEY_ENCRYPTION_SECRET),
        );
    }
    const created = createProgram(deps.db, {}, { phpPerXlm: deps.config.PHP_PER_XLM, now: () => seedTime });
    for (const entry of plan) {
      deps.db
        .prepare(
          `INSERT INTO beneficiaries
             (id, program_id, last_name, first_name, middle_name, suffix, birthdate, plate, toda, barangay,
              source, score, status, rule_code, decision_reason, link_code, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'csv', 1, 'approved', NULL, 'genuine', ?, ?)`,
        )
        .run(
          entry.beneficiaryId,
          created.id,
          entry.row.last_name,
          entry.row.first_name,
          entry.row.middle_name === '' ? null : entry.row.middle_name,
          entry.row.suffix === '' ? null : entry.row.suffix,
          entry.row.birthdate,
          entry.row.plate,
          entry.row.toda,
          entry.row.barangay,
          newLinkCode(),
          seedTime,
        );
    }
    return created;
  });

  const enrolled: SeedResult['enrolled'] = [];
  for (const entry of plan) {
    try {
      const response = await enrollCard(
        { ...deps.enroll, db: deps.db, chain: deps.chain, id: () => entry.cardId, now: () => seedTime },
        {
          beneficiaryId: entry.beneficiaryId,
          uid: entry.uid,
          hasPhoto: true,
          officerConfirmed: true,
          virtual: entry.virtual,
          ...(entry.expiresAtS === undefined ? {} : { expiresAtS: entry.expiresAtS }),
        },
      );
      enrolled.push({
        tag: entry.tag,
        cardId: response.card.id,
        uidLast4: response.card.uidLast4,
        virtual: response.card.virtual,
        expiresAtS: response.card.expiresAtS,
        chainTxIds: response.chainTxIds,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`enrolling ${entry.tag} failed (${reason}); run reset-demo.ts, then seed-demo.ts again`);
    }
  }

  deps.db.prepare(`UPDATE program SET status = 'active' WHERE id = ?`).run(program.id);
  return { program: { ...program, status: 'active' }, enrolled };
}

export interface ResetDeps {
  db: Db;
  chain: ChainDeps;
  /** The device owner: `device_registry.revoke` requires it. */
  programWallet: Keypair;
}

export interface ResetResult {
  /** Cards whose device hash was freed on chain. */
  revoked: string[];
  /** Cards with nothing to revoke: never registered, or already revoked. */
  skipped: string[];
}

/** Child tables first: every foreign key points at a table later in this list. */
const TABLES_IN_DELETE_ORDER = [
  'taps',
  'chain_txs',
  'agent_decisions',
  'price_points',
  'velo_intents',
  'webhook_deliveries',
  'cards',
  'beneficiaries',
  'stations',
  'program',
] as const;

/**
 * Frees every card's device hash (`device_registry.revoke`, Program Wallet) so the same physical tags enroll again,
 * then deletes every row. It refuses while any registered card still has escrow: revoking the device then would
 * strand those funds (the escrow resolves its owner through the registry), so End program must run first. Nothing
 * is deleted unless every revoke succeeded.
 */
export async function resetDemo(deps: ResetDeps): Promise<ResetResult> {
  const cards = deps.db.prepare('SELECT * FROM cards ORDER BY created_at, id').all<CardRow>();
  const wallet = deps.programWallet.publicKey();

  const registered: CardRow[] = [];
  const skipped: string[] = [];
  const funded: string[] = [];
  for (const card of cards) {
    const owner = await deps.chain.noir.getDeviceOwner(card.device_hash);
    if (owner !== wallet) {
      skipped.push(card.id);
      continue;
    }
    if ((await deps.chain.noir.getEscrowBalance(card.device_hash)) > 0n) funded.push(card.id);
    registered.push(card);
  }
  if (funded.length > 0) {
    throw new Error(`cards ${funded.join(', ')} still hold escrow; run End program before reset-demo.ts`);
  }

  const revoked: string[] = [];
  for (const card of registered) {
    const result = await runChainTx(deps.chain, deps.programWallet, { kind: 'revokeDevice', deviceHash: card.device_hash });
    if (result.status !== 'succeeded') {
      throw new Error(
        `revoke of ${card.id} did not succeed (${result.status}${result.errorCode === null ? '' : `, ${result.errorCode}`}); nothing was deleted`,
      );
    }
    revoked.push(card.id);
  }

  deps.db.transaction(() => {
    for (const table of TABLES_IN_DELETE_ORDER) deps.db.exec(`DELETE FROM ${table}`);
  });
  return { revoked, skipped };
}
