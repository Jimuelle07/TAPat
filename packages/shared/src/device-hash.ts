// docs/system-design.md §2.3 and api-and-data.md §2.1. Web Crypto only, so the package stays browser-safe.

/** Web NFC serialNumber -> normalized UID: colons removed, uppercased ("04:a2:1f" -> "04A21F"). Idempotent. */
export function normalizeUid(raw: string): string {
  return raw.replace(/:/g, '').toUpperCase();
}

/** SHA-256(utf8("${salt}:${UID}")) as 64 lowercase hex chars, with the UID normalized first. */
export async function deviceHash(salt: string, uid: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}:${normalizeUid(uid)}`);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
