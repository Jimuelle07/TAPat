/**
 * Same-origin guard for the post-login `?next=` target: resolve against our origin and keep only the path,
 * so `/\evil.com`, `//evil.com`, `https://evil.com` collapse to the dashboard. URL parsing also normalizes `/.//evil.com`
 * to the pathname `//evil.com` (still our origin, but protocol-relative once pushed), so a result that starts
 * with `//` or `/\` is rejected too.
 */
export function safeNextPath(next: string | null, origin: string): string {
  if (next === null || next === "") return "/dashboard";
  try {
    const url = new URL(next, origin);
    if (url.origin !== origin) return "/dashboard";
    const path = `${url.pathname}${url.search}${url.hash}`;
    if (path.startsWith("//") || path.startsWith("/\\")) return "/dashboard";
    return path;
  } catch {
    return "/dashboard";
  }
}
