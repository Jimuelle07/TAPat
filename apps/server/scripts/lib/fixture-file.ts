// Shared I/O for the fixture generators (docs/algorithms.md §9).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The repository root. `--out` paths are resolved against it, so `--out fixtures/...` works from any cwd. */
export const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

/** The exact bytes written for a fixture: 2-space JSON, LF, trailing newline. */
export function fixtureJson(data: unknown): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}

/** Writes `data` to `outPath` (relative to the repo root) and returns the absolute path. */
export function writeFixture(outPath: string, data: unknown): string {
  const target = resolve(REPO_ROOT, outPath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, fixtureJson(data));
  return target;
}

/** The value of a required `--name` flag; throws when it is missing. */
export function requiredFlag(name: string, value: string | undefined): string {
  if (value === undefined) throw new Error(`--${name} is required`);
  return value;
}

/** Parses a required `--seed` style integer flag, failing loudly on a missing value or garbage. */
export function intFlag(name: string, value: string | undefined): number {
  const parsed = Number(requiredFlag(name, value));
  if (!Number.isInteger(parsed)) throw new Error(`--${name} must be an integer, got "${value}"`);
  return parsed;
}
