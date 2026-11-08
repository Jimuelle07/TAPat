// Pure GO/NO-GO checks behind `demo-preflight.ts`. No I/O and no server imports (config, db, services), so the script
// runs on a laptop that has no server `.env`.
import type { Dashboard, HealthResponse, TrancheState } from '@tapat/shared';
import { checkSeededCards } from './e2e';

/** `--base-url=<http(s) origin>` is required; anything else throws so a typo never probes the wrong host. */
export function parsePreflightArgs(argv: readonly string[]): { baseUrl: string } {
  let baseUrl: string | null = null;
  for (const arg of argv) {
    const match = /^--([a-z0-9-]+)(?:=(.*))?$/i.exec(arg);
    if (match === null) throw new Error(`unrecognised argument "${arg}"; flags look like --name=value`);
    const name = (match[1] as string).toLowerCase();
    const value = match[2];
    if (name !== 'base-url') throw new Error(`unknown flag --${name}`);
    if (value === undefined) throw new Error('--base-url needs a value, like --base-url=https://host');
    let url: URL | null = null;
    try {
      url = new URL(value);
    } catch {
      url = null;
    }
    if (url === null || (url.protocol !== 'http:' && url.protocol !== 'https:')) {
      throw new Error(`--base-url must be an absolute http(s) URL, got "${value}"`);
    }
    baseUrl = url.origin;
  }
  if (baseUrl === null) throw new Error('--base-url=<http(s) origin> is required');
  return { baseUrl };
}

/** `null` means the fetch failed (network error or non-2xx). */
export interface PreflightInput {
  health: HealthResponse | null;
  dashboard: Dashboard | null;
  tranche: TrancheState | null;
}

const ZERO_TOTALS = [
  'fundedStroops',
  'spentStroops',
  'heldStroops',
  'pendingStroops',
  'escrowRemainingStroops',
  'returnedStroops',
] as const;

/**
 * Velo down is only a warning once the budget is verified: no beat after the seed calls the Velo payment-intent API.
 * RPC (every beat) and Telegram (beat 3's receipt) stay hard failures.
 */
function checkHealth(health: HealthResponse | null, budgetVerified: boolean, failures: string[], warnings: string[]): void {
  if (health === null) {
    failures.push('health unavailable');
    return;
  }
  if (!health.ok) failures.push('health.ok is false');
  for (const key of ['rpc', 'velo', 'telegram'] as const) {
    if (health[key] === 'ok') continue;
    if (key === 'velo' && budgetVerified) {
      warnings.push(
        `health.velo is "${health.velo}": the budget is already verified, so no beat needs the Velo API (the replay does — wait for "ok" before replaying)`,
      );
    } else {
      failures.push(`health.${key} is "${health[key]}", expected "ok"`);
    }
  }
}

function checkDashboard(dashboard: Dashboard | null, failures: string[]): void {
  if (dashboard === null) {
    failures.push('dashboard unavailable');
    return;
  }
  const { program, budget } = dashboard;
  if (program === null) failures.push('no program — seed the demo');
  else {
    if (program.status !== 'active') failures.push(`program.status is "${program.status}", expected "active"`);
    if (program.trancheFired) failures.push('tranche already fired');
  }
  if (budget.state !== 'verified') failures.push('budget not verified — press Fund budget on /desktop');
  if (budget.remainingStroops !== budget.verifiedStroops) {
    failures.push(
      `budget partly used: remaining ${budget.remainingStroops} of ${budget.verifiedStroops} stroops`,
    );
  }
  failures.push(...checkSeededCards(dashboard.cards));
  for (const card of dashboard.cards) {
    if (card.beneficiaryId === 'ben_D3') {
      if (!card.expired) {
        failures.push(
          `D3 policy not expired yet — the tranche would fund D3; wait until ${new Date(card.expiresAtS * 1000).toISOString()}`,
        );
      }
    } else if (['ben_D1', 'ben_D2', 'ben_D5'].includes(card.beneficiaryId) && card.expired) {
      failures.push(`${card.beneficiaryId.slice(4)} policy already expired`);
    }
  }
  for (const key of ZERO_TOTALS) {
    if (dashboard[key] !== '0') failures.push(`${key} is ${dashboard[key]}, expected 0`);
  }
  if (!dashboard.invariantOk) failures.push('invariantOk is false');
  for (const id of ['A', 'B']) {
    const station = dashboard.stations.find((s) => s.id === id);
    if (station === undefined) {
      failures.push(`station ${id} missing`);
      continue;
    }
    if (station.status !== 'active') failures.push(`station ${id} is ${station.status}, expected active`);
    if (station.pendingStroops !== '0') failures.push(`station ${id} pendingStroops is ${station.pendingStroops}`);
    if (station.spentStroops !== '0') failures.push(`station ${id} spentStroops is ${station.spentStroops}`);
  }
  if (dashboard.recentTaps.length > 0) failures.push(`${dashboard.recentTaps.length} taps already recorded`);
}

function checkTranche(tranche: TrancheState | null, failures: string[]): void {
  if (tranche === null) {
    failures.push('tranche state unavailable');
    return;
  }
  if (tranche.running) failures.push('price feed is running');
  if (tranche.fired) failures.push('tranche state fired');
  if (tranche.funds.length > 0) failures.push(`tranche already funded ${tranche.funds.length} cards`);
}

/** A fresh seeded demo: nothing spent, nothing fired, every dependency up. Warnings never block GO. */
export function checkFreshDemo(input: PreflightInput): { failures: string[]; warnings: string[] } {
  const failures: string[] = [];
  const warnings: string[] = [];
  checkHealth(input.health, input.dashboard?.budget.state === 'verified', failures, warnings);
  checkDashboard(input.dashboard, failures);
  checkTranche(input.tranche, failures);
  if (input.health !== null && input.health.gasMode !== 'velo') {
    warnings.push(`gasMode is "${input.health.gasMode}": Noir writes are not Velo-sponsored on this run`);
  }
  return { failures, warnings };
}
