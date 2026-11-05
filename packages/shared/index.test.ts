import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as entry from '@tapat/shared';
import { formatPhp, TAP_REASON_LABELS } from '@tapat/shared';
import type { CardSummary, Dashboard, Program, Tap } from '@tapat/shared';
import * as constants from './src/constants';
import * as deviceHash from './src/device-hash';
import * as money from './src/money';
import * as schemas from './src/schemas';

const root = dirname(fileURLToPath(import.meta.url));

/** Every import specifier reachable from `file`, following relative imports. */
function reachableSpecifiers(file: string, seen = new Set<string>()): string[] {
  if (seen.has(file)) return [];
  seen.add(file);
  const source = readFileSync(file, 'utf8');
  const specifiers = [...source.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
  return specifiers.flatMap((specifier) =>
    specifier.startsWith('.')
      ? [specifier, ...reachableSpecifiers(join(dirname(file), `${specifier}.ts`), seen)]
      : [specifier],
  );
}

describe('@tapat/shared package surface', () => {
  it('resolves by package name to the TS source entry, with no build step', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    expect(pkg.name).toBe('@tapat/shared');
    expect(pkg.main).toBe('./src/index.ts');
    expect(pkg.exports).toEqual({ '.': './src/index.ts' });
    expect(pkg.scripts.build).toBeUndefined();
    expect(formatPhp(350_000_000n)).toBe('₱350.00');
    expect(TAP_REASON_LABELS.OVER_CAP).toBe('over the ₱500.00 per-tap cap');
  });

  it('re-exports every runtime export of money, schemas, constants and device-hash', () => {
    for (const module of [money, schemas, constants, deviceHash]) {
      for (const [name, value] of Object.entries(module)) {
        expect(entry[name as keyof typeof entry], name).toBe(value);
      }
    }
  });

  it('re-exports the §3 types', () => {
    const tap: Tap['status'] = 'authorized';
    const card: Pick<CardSummary, 'deviceHashPrefix'> = { deviceHashPrefix: '3f9c1a0b' };
    const program: Pick<Program, 'trancheFired'> = { trancheFired: false };
    const phpPerXlm: Dashboard['phpPerXlm'] = 10;
    expect([tap, card.deviceHashPrefix, program.trancheFired, phpPerXlm]).toEqual(['authorized', '3f9c1a0b', false, 10]);
  });

  it('stays browser-safe: the entry reaches only relative modules and zod, never node:', () => {
    const external = reachableSpecifiers(join(root, 'src', 'index.ts')).filter((s) => !s.startsWith('.'));
    expect(new Set(external)).toEqual(new Set(['zod']));
  });
});
