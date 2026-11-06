"use client";

// The client-side account state: one provider in the (app) layout, `useAuth` everywhere, and the officer gate.
// Officer gating is UI-only by decision (§5.2 #22–#25): the API endpoints stay open behind Caddy basic auth.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AuthUser } from "@tapat/shared";
import { getMe, postLogout } from "@/lib/api";
import { Notice } from "./ui";

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  isOfficer: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  /** Re-reads `GET /api/auth/me`. An unreachable API reads as logged out rather than crashing the app. */
  const refresh = useCallback(async () => {
    try {
      const current = await getMe();
      setUser(current.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let live = true;
    getMe().then(
      (current) => { if (live) { setUser(current.user); setLoading(false); } },
      () => { if (live) { setUser(null); setLoading(false); } },
    );
    return () => { live = false; };
  }, []);

  /** Deletes the session server-side, then locally; a session that is already gone is still logged out. */
  const logout = useCallback(async () => {
    try {
      await postLogout();
    } catch {
      // The cookie may already be gone; clearing the local user is what the UI needs.
    }
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, isOfficer: user?.role === "officer", refresh, logout }),
    [user, loading, refresh, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (context === null) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}

/** Renders `children` for the officer; nothing while the session loads; `fallback` (or the notice) otherwise. */
export function OfficerOnly({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const { loading, isOfficer } = useAuth();
  if (loading) return null;
  if (isOfficer) return <>{children}</>;
  return <>{fallback ?? <OfficerNotice />}</>;
}

/** The logged-out explanation shown in place of an officer-only action. */
export function OfficerNotice() {
  const pathname = usePathname();
  const next = pathname === "/dashboard" ? "" : `?next=${encodeURIComponent(pathname)}`;
  return (
    <Notice tone="info" title="Officer login required">
      Log in with the officer account to use this action.{" "}
      <Link href={`/login${next}`} className="text-primary underline">
        Log in
      </Link>
    </Notice>
  );
}
