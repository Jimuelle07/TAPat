// Pure .env text helpers for bootstrap-accounts.ts (setup.md stage 2); no file I/O here.

/** Value after `NAME=` on the first line starting with `NAME=`, or undefined. */
export function readEnvValue(text: string, name: string): string | undefined {
  return text
    .split(/\r?\n/)
    .find((line) => line.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

/**
 * Replace the first `NAME=...` line of each update in place (an empty `NAME=` line is filled), append missing names in
 * `updates` order, keep every other line and comment; keep CRLF if `text` contains "\r\n", else LF; always end with a
 * line ending.
 */
export function upsertEnv(text: string, updates: Readonly<Record<string, string>>): string {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();

  for (const [name, value] of Object.entries(updates)) {
    const index = lines.findIndex((line) => line.startsWith(`${name}=`));
    if (index === -1) lines.push(`${name}=${value}`);
    else lines[index] = `${name}=${value}`;
  }

  return lines.join(eol) + eol;
}
