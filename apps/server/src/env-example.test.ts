import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONFIG_VARIABLES } from './config';

const SERVER_EXAMPLE = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
const ROOT_EXAMPLE = readFileSync(new URL('../../../.env.example', import.meta.url), 'utf8');

/** A declaration line; comments, blanks and commented-out names are not declarations. */
const DECLARED = /^([A-Z][A-Z0-9_]*)=/;

describe('env examples', () => {
  it.each([
    ['apps/server/.env.example', SERVER_EXAMPLE],
    ['the root .env.example', ROOT_EXAMPLE],
  ])('%s documents every variable config.ts parses', (_label, text) => {
    const declared = new Set(text.split(/\r?\n/).map((line) => DECLARED.exec(line)?.[1]));
    expect(CONFIG_VARIABLES.filter((name) => !declared.has(name))).toEqual([]);
  });

  it('keeps the root file in step with apps/server/.env.example (same names, same placeholders)', () => {
    const rootLines = new Set(ROOT_EXAMPLE.split(/\r?\n/));
    const missing = SERVER_EXAMPLE.split(/\r?\n/).filter((line) => DECLARED.test(line) && !rootLines.has(line));
    expect(missing).toEqual([]);
  });
});
