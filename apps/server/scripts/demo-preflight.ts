/**
 * Read-only GO/NO-GO for a live demo: GETs /api/health, /api/dashboard and /api/agents/tranche/state and checks the
 * deployment is freshly seeded. Needs no secrets and no server `.env`.
 *
 * Run:  pnpm --filter server tsx scripts/demo-preflight.ts --base-url=https://tapat.tail1b0e59.ts.net
 */
import { formatPhp, type Dashboard, type HealthResponse, type TrancheState } from '@tapat/shared';
import { checkFreshDemo, parsePreflightArgs } from './lib/preflight';

async function get<T>(baseUrl: string, path: string): Promise<T | null> {
  try {
    const response = await fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      console.log(`FAIL ${path}: HTTP ${response.status}`);
      return null;
    }
    return (await response.json()) as T;
  } catch (error) {
    console.log(`FAIL ${path}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

async function main(): Promise<void> {
  const { baseUrl } = parsePreflightArgs(process.argv.slice(2));
  const [health, dashboard, tranche] = await Promise.all([
    get<HealthResponse>(baseUrl, '/api/health'),
    get<Dashboard>(baseUrl, '/api/dashboard'),
    get<TrancheState>(baseUrl, '/api/agents/tranche/state'),
  ]);
  const { failures, warnings } = checkFreshDemo({ health, dashboard, tranche });
  for (const failure of failures) console.log(`FAIL ${failure}`);
  for (const warning of warnings) console.log(`WARN ${warning}`);
  if (dashboard !== null) {
    const d3 = dashboard.cards.find((card) => card.beneficiaryId === 'ben_D3');
    const d3At = d3 === undefined ? 'n/a' : new Date(d3.expiresAtS * 1000).toISOString();
    console.log(
      `budget ${formatPhp(dashboard.budget.verifiedStroops)} verified · cards ${dashboard.cards.length} · D3 expired at ${d3At}`,
    );
  }
  if (failures.length === 0) {
    console.log('GO');
    return;
  }
  console.log(`NO-GO (${failures.length} failures)`);
  process.exit(1);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
