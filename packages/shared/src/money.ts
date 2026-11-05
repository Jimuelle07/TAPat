// docs/api-and-data.md §1.1. All arithmetic is bigint on exact decimal values; rounding is half up
// (half away from zero for negatives). PHP is a display concern only: the API stores stroops.

export const STROOPS_PER_XLM = 10_000_000n;
export const DEFAULT_PHP_PER_XLM = 10; // demo rate

/** An exact decimal: value = units / 10^scale. */
interface Decimal {
  units: bigint;
  scale: number;
}

/** Parses the shortest round-trip decimal form of a finite number ("1.005" stays 1.005, not 1.00499…). */
function toDecimal(value: number, name: string): Decimal {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be a finite number`);
  const [mantissa, exponentText] = String(value).toLowerCase().split('e');
  const exponent = exponentText === undefined ? 0 : Number(exponentText);
  const negative = mantissa.startsWith('-');
  const [whole, fraction = ''] = (negative ? mantissa.slice(1) : mantissa).split('.');
  let units = BigInt(whole + fraction);
  let scale = fraction.length - exponent;
  if (scale < 0) {
    units *= 10n ** BigInt(-scale);
    scale = 0;
  }
  return { units: negative ? -units : units, scale };
}

function toStroops(stroops: bigint | string): bigint {
  if (typeof stroops === 'bigint') return stroops;
  if (!/^-?\d+$/.test(stroops)) throw new RangeError(`stroops must be an integer string, got "${stroops}"`);
  return BigInt(stroops);
}

/** numerator / denominator rounded half away from zero; denominator > 0. */
function divRound(numerator: bigint, denominator: bigint): bigint {
  const negative = numerator < 0n;
  const magnitude = negative ? -numerator : numerator;
  const quotient = (2n * magnitude + denominator) / (2n * denominator);
  return negative ? -quotient : quotient;
}

function rate(phpPerXlm: number): Decimal {
  const decimal = toDecimal(phpPerXlm, 'phpPerXlm');
  if (decimal.units <= 0n) throw new RangeError('phpPerXlm must be > 0');
  return decimal;
}

/** stroops -> PHP centavos at the given rate, rounded half up. */
function stroopsToCentavos(stroops: bigint | string, phpPerXlm: number): bigint {
  const r = rate(phpPerXlm);
  return divRound(toStroops(stroops) * 100n * r.units, STROOPS_PER_XLM * 10n ** BigInt(r.scale));
}

function formatCents(cents: bigint, grouping: boolean): string {
  const negative = cents < 0n;
  const magnitude = negative ? -cents : cents;
  let whole = (magnitude / 100n).toString();
  if (grouping) whole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = (magnitude % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

/** PHP (number, 2 decimals) -> stroops at the given display rate. */
export function phpToStroops(php: number, phpPerXlm: number = DEFAULT_PHP_PER_XLM): bigint {
  const amount = toDecimal(php, 'php');
  const r = rate(phpPerXlm);
  // stroops = php * STROOPS_PER_XLM / phpPerXlm, with both decimals made integral.
  return divRound(
    amount.units * STROOPS_PER_XLM * 10n ** BigInt(r.scale),
    r.units * 10n ** BigInt(amount.scale),
  );
}

/** stroops -> PHP as a number with 2 decimals (display only). */
export function stroopsToPhp(stroops: bigint | string, phpPerXlm: number = DEFAULT_PHP_PER_XLM): number {
  return Number(formatCents(stroopsToCentavos(stroops, phpPerXlm), false));
}

/** stroops -> "₱1,234.56" (or "1,234.56" with withSymbol=false). */
export function formatPhp(
  stroops: bigint | string,
  opts: { phpPerXlm?: number; withSymbol?: boolean } = {},
): string {
  const text = formatCents(stroopsToCentavos(stroops, opts.phpPerXlm ?? DEFAULT_PHP_PER_XLM), true);
  if (opts.withSymbol === false) return text;
  return text.startsWith('-') ? `-₱${text.slice(1)}` : `₱${text}`;
}

/** XLM decimal string for Velo checkout, always exactly 2 decimals ("1000.00"). */
export function stroopsToXlmString(stroops: bigint | string): string {
  return formatCents(divRound(toStroops(stroops), STROOPS_PER_XLM / 100n), false);
}
