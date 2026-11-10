/*
 * A fake-but-close model of Philippine diesel pump prices for the landing page's simulation. Pure and
 * deterministic: the same seed always gives the same year. This is NOT DOE data and the model is simplified.
 */

export interface DieselWeek {
  week: number; // 1-based
  crudeUsd: number; // Dubai crude, US$/bbl
  phpPerUsd: number; // peso per US dollar
  pumpPhp: number; // pump price this week, PHP/L, 2 decimals
  changePhp: number; // this Tuesday's adjustment, rounded to 0.05
  event: string | null; // market event that began this week
}

export const WEEKS_PER_YEAR = 52;
export const LITRES_PER_BARREL = 158.987;
/** Diesel trades above crude by a refining margin; applied as a flat multiplier on the crude cost. */
export const DIESEL_CRACK_FACTOR = 1.25;
export const DIESEL_EXCISE_PHP = 6.0; // PHP per litre
/** Margins, freight and logistics, PHP per litre (before VAT). */
export const DIESEL_MARGIN_PHP = 9.5;
export const DIESEL_VAT_RATE = 0.12;

const CRUDE_MEAN = 80;
const CRUDE_SIGMA = 3;
const CRUDE_REVERSION = 0.12;
const CRUDE_MIN = 55;
const CRUDE_MAX = 120;
const FX_MEAN = 57.5;
const FX_SIGMA = 0.25;
const FX_REVERSION = 0.15;
const FX_MIN = 54;
const FX_MAX = 61;
const SHOCK_DECAY = 0.85;
const FX_SHOCK_DECAY = 0.9;
const SHOCK_CHANCE = 0.08;
const FX_SHOCK_CHANCE = 0.05;

const CRUDE_SHOCKS: ReadonlyArray<{ label: string; min: number; max: number }> = [
  { label: "OPEC+ output cut", min: 8, max: 12 },
  { label: "Refinery outage in Asia", min: 5, max: 8 },
  { label: "Supply scare in the Gulf", min: 6, max: 10 },
  { label: "Demand slowdown", min: -10, max: -6 },
  { label: "Crude inventory build", min: -7, max: -4 },
];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round05 = (v: number) => Math.round(v / 0.05) * 0.05;
const round2 = (v: number) => Number(v.toFixed(2));

/** Pump price implied by a week's benchmark crude and exchange rate, before the Tuesday rounding. */
export function pumpFromBenchmark(crudeUsd: number, phpPerUsd: number): number {
  const productCost = ((crudeUsd * phpPerUsd) / LITRES_PER_BARREL) * DIESEL_CRACK_FACTOR;
  return (productCost + DIESEL_EXCISE_PHP + DIESEL_MARGIN_PHP) * (1 + DIESEL_VAT_RATE);
}

export function simulateDieselYear(seed: number): DieselWeek[] {
  const rand = mulberry32(seed * 2654435761 + 12345);
  const normal = () => {
    const u = Math.max(rand(), 1e-12);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
  };

  let crudeBase = CRUDE_MEAN;
  let fxBase = FX_MEAN;
  let crudeShock = 0;
  let fxShock = 0;
  let crude = CRUDE_MEAN;
  let fx = FX_MEAN;
  // Pumps move on the prior week's benchmark, so the opening pump price reflects the week before week 1.
  let pump = round2(round05(pumpFromBenchmark(crude, fx)));

  const weeks: DieselWeek[] = [];
  for (let week = 1; week <= WEEKS_PER_YEAR; week++) {
    // Tuesday adjustment: pump for this week follows last week's benchmark (1-week lag).
    const target = pumpFromBenchmark(crude, fx);
    const delta = round05(target - pump);
    pump = round2(pump + delta);

    // Then the market moves to this week's benchmark. Draw order is fixed so a seed is always the same year.
    crudeBase += CRUDE_REVERSION * (CRUDE_MEAN - crudeBase) + CRUDE_SIGMA * normal();
    fxBase += FX_REVERSION * (FX_MEAN - fxBase) + FX_SIGMA * normal();
    const shockRoll = rand();
    const shockPick = rand();
    const shockSize = rand();
    const fxRoll = rand();
    const fxSize = rand();

    crudeShock *= SHOCK_DECAY;
    fxShock *= FX_SHOCK_DECAY;
    let event: string | null = null;
    if (shockRoll < SHOCK_CHANCE) {
      const s = CRUDE_SHOCKS[Math.floor(shockPick * CRUDE_SHOCKS.length)] as (typeof CRUDE_SHOCKS)[number];
      crudeShock += s.min + (s.max - s.min) * shockSize;
      event = s.label;
    }
    if (fxRoll < FX_SHOCK_CHANCE) {
      fxShock += 0.8 + 0.8 * fxSize;
      event ??= "Peso weakens";
    }
    crude = clamp(crudeBase + crudeShock, CRUDE_MIN, CRUDE_MAX);
    fx = clamp(fxBase + fxShock, FX_MIN, FX_MAX);

    weeks.push({
      week,
      crudeUsd: round2(crude),
      phpPerUsd: round2(fx),
      pumpPhp: pump,
      changePhp: round2(delta),
      event,
    });
  }
  return weeks;
}
