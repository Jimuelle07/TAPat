import { NextResponse, type NextRequest } from "next/server";

// HTTP basic auth for the optional Vercel front end (docs/deployment.md §9). A no-op unless WEB_BASIC_AUTH
// ("user:password") is set; on the VM, Caddy does the same job. Changes need Jim's review (AGENTS.md §2).

/** Velo must reach the webhook, and uptime checks the health route, without a password. */
const EXEMPT_PATHS = new Set(["/api/webhooks/velo", "/api/health"]);

/** Compares two byte strings in time that depends only on their lengths, never on where they differ. */
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/** The decoded bytes of a `Basic <base64>` Authorization header, or null when absent or malformed. */
function basicCredentials(header: string | null): Uint8Array | null {
  const match = header?.match(/^Basic\s+([A-Za-z0-9+/]+={0,2})\s*$/i);
  if (!match) return null;
  try {
    return Uint8Array.from(atob(match[1]), (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest): NextResponse {
  const expected = process.env.WEB_BASIC_AUTH;
  if (!expected || EXEMPT_PATHS.has(request.nextUrl.pathname)) return NextResponse.next();

  const provided = basicCredentials(request.headers.get("authorization"));
  if (provided && constantTimeEqual(provided, new TextEncoder().encode(expected))) return NextResponse.next();

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="TAPat"' },
  });
}
