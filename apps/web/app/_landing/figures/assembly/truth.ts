import { DEFAULT_PHP_PER_XLM, phpToStroops } from "@tapat/shared";
import { php } from "@/lib/format";
import scenarios from "@/app/_landing/scenarios.json";

/* Server-only truth for the figure: the numbers and sentences the readout speaks. Everything comes from the
   precomputed scenario file (the real Tranche Agent's decisions) and the program defaults in docs/PRD.md §3. */

const money = (pesos: number) => php(phpToStroops(pesos), DEFAULT_PHP_PER_XLM).replace("PHP ", "₱");
const perLitre = (n: number) => `₱${n.toFixed(2)}`;

const scenario = scenarios.scenarios.find((entry) => entry.id === "crude-rally");
if (!scenario) throw new Error("scenarios.json has no crude-rally scenario");

const DAYS_BEFORE = 5;
const days = scenario.points.filter((point) => point.idx >= scenario.fireIdx - DAYS_BEFORE && point.idx <= scenario.fireIdx);
const reason = /changepoint (\d+) points ago; segment mean ([\d.]+) >= ([\d.]+)/.exec(scenario.reason);
if (!reason) throw new Error(`unexpected agent reason: ${scenario.reason}`);

/* Per-tap cap, docs/PRD.md §3. The tranche per card comes from the scenario file. */
const CAP_PHP = 500;
const TRANCHE_PHP = scenarios.tranchePhp;
const LEFT_PHP = TRANCHE_PHP - CAP_PHP;

export interface Truth {
  days: Array<{ day: number; price: number }>;
  trigger: number;
  say: {
    sensor: string;
    think: string;
    fire: string;
    fund: string;
    tap: string;
    check: string[];
    watch: string;
    frozen: string;
    claim: string;
    held: string;
    sweep: string;
    sweepHeld: string;
  };
}

export const TRUTH: Truth = {
  days: days.map((point) => ({ day: point.idx, price: point.pricePhp })),
  trigger: scenarios.thresholdPhp,
  say: {
    sensor: "01 · price sensor · day {day} · ₱{price}/L · simulated feed",
    think: `02 · Tranche Agent · is the shift real? · trigger ${perLitre(scenarios.thresholdPhp)}/L`,
    fire: `02 · Tranche Agent · changepoint ${reason[1]} days ago · mean ${perLitre(Number(reason[2]))}/L ≥ ${perLitre(Number(reason[3]))} · fire`,
    fund: `03 · fund_escrow() · ${money(TRANCHE_PHP)} into the card's escrow`,
    tap: "04 · card reader · Ana V. …4821 taps",
    check: [
      "05 · authorize() · checking cap, expiry, nonce",
      `05 · authorize() · cap ${money(CAP_PHP)} ✓`,
      `05 · authorize() · cap ${money(CAP_PHP)} ✓ · expiry ✓`,
      `05 · authorize() · cap ${money(CAP_PHP)} ✓ · expiry ✓ · nonce ✓ · gate turns`,
    ],
    watch: "06 · Freeze Agent · watching every tap",
    frozen: "06 · Freeze Agent · card frozen · signal to the latch",
    claim: `07 · claim() · ${money(CAP_PHP)} settles to the station`,
    held: "07 · claim() withheld · the latch holds the payment",
    sweep: `08 · sweep_on_revoke() · ${money(LEFT_PHP)} back to the LGU lockbox`,
    sweepHeld: `08 · sweep_on_revoke() · ${money(TRANCHE_PHP)} back to the LGU lockbox`,
  },
};
