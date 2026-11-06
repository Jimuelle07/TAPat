// Display helpers. Money still goes through `formatPhp` (AGENTS.md §4); this only adds the design's "PHP" label.
import { formatPhp } from '@tapat/shared';
import type { Beneficiary, ChainTx, Stroops } from '@tapat/shared';

/** "PHP 1,150.00". */
export function php(stroops: Stroops | bigint, phpPerXlm: number): string {
  return `PHP ${formatPhp(stroops, { phpPerXlm, withSymbol: false })}`;
}

/** The money tiles drop an empty ".00": "PHP 4,500", but "PHP 4,500.50". */
export function phpTile(stroops: Stroops | bigint, phpPerXlm: number): string {
  return php(stroops, phpPerXlm).replace(/\.00$/, '');
}

/** `chain_txs.outer_hash ?? inner_hash`, the same rule as the COA export. */
export function txHash(tx: ChainTx | undefined | null): string | null {
  return tx?.outerHash ?? tx?.innerHash ?? null;
}

/** "7f3a…c21e". */
export function shortHash(hash: string): string {
  return hash.length <= 9 ? hash : `${hash.slice(0, 4)}…${hash.slice(-4)}`;
}

/** Same explorer the Telegram receipt links to; the app only runs on testnet. */
export function explorerUrl(hash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${hash}`;
}

/** "Maria Teresa C. Santos", "Pedro R. Reyes Jr." */
export function fullName(b: Pick<Beneficiary, 'firstName' | 'middleName' | 'lastName' | 'suffix'>): string {
  const middle = b.middleName !== null && b.middleName !== '' ? `${b.middleName[0]}.` : null;
  return [b.firstName, middle, b.lastName, b.suffix].filter((part) => part !== null && part !== '').join(' ');
}

/** "Ana V.", matching the server's `displayName`; station screens and pickers never show more. */
export function shortName(b: Pick<Beneficiary, 'firstName' | 'lastName'>): string {
  return `${b.firstName} ${b.lastName.charAt(0)}.`;
}

const DATE = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
const TIME = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });

/** "Nov 30, 2026 · 11:59 PM", in Philippine time wherever the browser is. */
export function dateTime(unixMs: number): string {
  const at = new Date(unixMs);
  return `${DATE.format(at)} · ${TIME.format(at)}`;
}

/** "0.71", as the design prints a matcher score. */
export function score(value: number | null): string {
  return value === null ? 'No score' : value.toFixed(2);
}

/** `amountPhp` rule of `POST /api/taps`: > 0, ≤ 100000, at most 2 decimals. Returns null when the text is not that. */
export function parseAmount(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value > 0 && value <= 100_000 ? value : null;
}
