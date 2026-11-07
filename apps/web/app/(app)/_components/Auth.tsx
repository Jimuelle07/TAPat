"use client";

// The client-side account state: one provider per app layout, `useAuth` everywhere, and the officer gate.
// The API guard enforces officer writes (§5.2 #22–#25); `RequireLogin` additionally sends logged-out visitors to /login.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { AuthUser } from "@tapat/shared";
import { ApiClientError, getMe, postLogout } from "@/lib/api";
import { checkSession } from "@/lib/auth-retry";
import { Notice } from "./ui";

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  isOfficer: boolean;
  /** True when the last session check could not reach the API; nobody is treated as logged out because of it. */
  unreachable: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreachable, setUnreachable] = useState(false);
  const latest = useRef(0);
  const loggingOut = useRef(false);

  /**
   * Re-reads `GET /api/auth/me` with retry. Only an authoritative answer changes who is logged in; when the API
   * cannot be reached the current user is kept and `unreachable` is raised instead of logging anyone out.
   * A newer check (or unmount) discards an older one.
   */
  const refresh = useCallback(async () => {
    loggingOut.current = false; // an explicit re-read (e.g. right after a login) supersedes a pending logout
    latest.current += 1;
    const id = latest.current;
    const result = await checkSession(getMe, { cancelled: () => id !== latest.current });
    if (id !== latest.current) return;
    if (result.kind === "user") setUser(result.user);
    else if (result.kind === "anonymous") setUser(null);
    setUnreachable(result.kind === "unreachable");
    setLoading(false);
  }, []);

  /**
   * Tab-visible / bfcache re-check. While a logout the server never received is pending it retries that logout
   * instead of restoring the user.
   */
  const recheckInBackground = useCallback(async () => {
    if (!loggingOut.current) return refresh();
    try {
      await postLogout();
      loggingOut.current = false;
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) loggingOut.current = false;
    }
    setUser(null);
  }, [refresh]);

  useEffect(() => {
    void refresh();
    const recheck = () => { if (document.visibilityState === "visible") void recheckInBackground(); };
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) void recheckInBackground(); };
    document.addEventListener("visibilitychange", recheck);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      latest.current += 1;
      document.removeEventListener("visibilitychange", recheck);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [refresh, recheckInBackground]);

  /** Deletes the session server-side, then locally. A 401 means it is already gone; any other failure leaves the logout pending. */
  const logout = useCallback(async () => {
    try {
      await postLogout();
      loggingOut.current = false;
    } catch (error) {
      loggingOut.current = !(error instanceof ApiClientError && error.status === 401);
    }
    latest.current += 1;
    setUser(null);
    setUnreachable(false);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, unreachable, isOfficer: user?.role === "officer", refresh, logout }),
    [user, loading, unreachable, refresh, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (context === null) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}

export const PUBLIC_PATHS = ["/login", "/signup", "/desktop/login", "/desktop/signup"];

/** Where a logged-out visitor on `pathname` is sent: the matching login screen, carrying `?next=` unless at the root. */
function loginTarget(pathname: string, search: string): string {
  const desktop = pathname === "/desktop" || pathname.startsWith("/desktop/");
  const login = desktop ? "/desktop/login" : "/login";
  if (pathname === "/dashboard" || pathname === "/desktop") return login;
  return `${login}?next=${encodeURIComponent(pathname + search)}`;
}

/**
 * Sends a logged-out visitor to the login screen (`/login`, or `/desktop/login` under /desktop) on every route
 * except the login and signup pages. While the session loads, `children` still render, invisible and inert, so the
 * page segment is present during prerender.
 */
export function RequireLogin({ children }: { children: ReactNode }) {
  const { user, loading, unreachable, refresh } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.includes(pathname);
  const cannotVerify = !loading && user === null && unreachable && !isPublic;
  const blocked = !loading && user === null && !unreachable && !isPublic;

  useEffect(() => {
    if (!blocked) return;
    router.replace(loginTarget(pathname, window.location.search));
  }, [blocked, pathname, router]);

  // The API could not be reached, so nobody is known to be logged out: keep re-checking every 5 s until it answers.
  const retrying = !loading && unreachable && !isPublic;
  useEffect(() => {
    if (!retrying) return;
    const timer = setInterval(() => { void refresh(); }, 5000);
    return () => clearInterval(timer);
  }, [retrying, refresh]);

  if (blocked) return null;
  if (loading && !isPublic) {
    return (
      <div className="invisible" inert aria-hidden>
        {children}
      </div>
    );
  }
  if (cannotVerify) {
    return (
      <div className="p-4">
        <Notice tone="error" title="Can't reach the server — retrying">
          Your session could not be checked. You are not logged out.{" "}
          <button type="button" onClick={() => void refresh()} className="text-primary underline">
            Retry
          </button>
        </Notice>
      </div>
    );
  }
  if (retrying && user !== null) {
    return (
      <>
        <div className="p-4 pb-0">
          <Notice tone="error" title="Can't reach the server — retrying">
            <button type="button" onClick={() => void refresh()} className="text-primary underline">
              Retry
            </button>
          </Notice>
        </div>
        {children}
      </>
    );
  }
  return <>{children}</>;
}

/** Renders `children` only while someone is logged in. */
export function SignedIn({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return user === null ? null : <>{children}</>;
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
