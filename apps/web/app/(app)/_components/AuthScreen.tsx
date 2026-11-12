"use client";

// The shared shell of /login and /signup ("The Officer Pass"): the moving logo drives along a ruled line above an open
// passbook. The form is the left page; the right page is the officer pass, which fills in as the officer types. On a
// phone the pass folds to a strip above the form; a container query opens the book when there is room.
import { Suspense, useState, type ComponentProps, type CSSProperties, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ApiClientError } from "@/lib/api";
import { errorMessage } from "@/lib/use-dashboard";
import { safeNextPath } from "@/lib/next-path";
import { useAuth } from "./Auth";
import { Icon } from "./Icon";
import { Button, LinkButton, Notice } from "./ui";

export interface AuthFailure {
  field: string | null;
  message: string;
}

/** A VALIDATION_ERROR message reads "<path>: <reason>" (§5.3), which is how it lands on its input. */
export function toAuthFailure(cause: unknown): AuthFailure {
  const message = errorMessage(cause);
  const separator = message.indexOf(": ");
  if (cause instanceof ApiClientError && cause.code === "VALIDATION_ERROR" && separator > 0) {
    return { field: message.slice(0, separator), message: message.slice(separator + 2) };
  }
  return { field: null, message };
}

/** Post-login target from `?next=`, passed through `safeNextPath` (same-origin only, never protocol-relative). */
export function nextPath(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  return safeNextPath(next, window.location.origin);
}

const TABS = [
  { href: "/login", label: "Log in" },
  { href: "/signup", label: "Sign up" },
];

/** Log in and Sign up as a segmented control; the indicator slides on the spring. */
function Tabs({ active, next }: { active: string; next: string | null }) {
  const query = next === null ? "" : `?next=${encodeURIComponent(next)}`;
  const index = Math.max(0, TABS.findIndex((tab) => tab.href === active));
  return (
    <nav aria-label="Account" className="ql-auth-tabs" style={{ "--k": index } as CSSProperties}>
      <span className="ql-auth-tabs-ind" aria-hidden="true" />
      {TABS.map((tab) => (
        <Link key={tab.href} href={`${tab.href}${query}`} aria-current={tab.href === active ? "page" : undefined}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

function TabsKeepingNext({ active }: { active: string }) {
  return <Tabs active={active} next={useSearchParams().get("next")} />;
}

/** A spoked hub over one of the logo's wheels, so the wheel can turn. Centres measured from tapat-logo.png (826 × 494). */
function Wheel({ side }: { side: "rear" | "front" }) {
  return (
    <svg className={`trike-wheel trike-wheel-${side}`} viewBox="-50 -50 100 100" aria-hidden="true">
      <circle r="49" fill="#fef5e2" />
      {[0, 72, 144, 216, 288].map((deg) => (
        <line key={deg} x1="0" y1="-15" x2="0" y2="-47" stroke="#1b2b2b" strokeWidth="7" strokeLinecap="round" transform={`rotate(${deg})`} />
      ))}
      <circle r="20" fill="#1b2b2b" />
      <circle r="6" fill="#fef5e2" />
    </svg>
  );
}

/**
 * The README banner's moving logo: it drives in, then keeps rolling with spinning wheels, a light bob and pitch, speed
 * lines and dust, over the road strip that `AuthScreen` lays the width of the book. Every move is a transform or
 * opacity, so it runs on the compositor; reduced motion leaves the logo still.
 */
function MovingLogo() {
  return (
    <div className="trike" role="img" aria-label="TAPat">
      <span className="trike-lines" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="trike-dust" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <div className="trike-body">
        <Image src="/tapat-logo.png" alt="" width={826} height={494} sizes="(min-width: 900px) 320px, 240px" priority className="trike-img" />
        <Wheel side="rear" />
        <Wheel side="front" />
      </div>
    </div>
  );
}

/** What the officer has typed so far, mirrored onto the pass. */
export interface PassFill {
  email: string;
  /** Sign up only. */
  name?: string;
  busy?: boolean;
}

/** "Maria Santos" -> "Maria S.": the privacy-scoped display form the product uses for people. */
function shortName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
}

const PASS_CAN = ["Upload the masterlist", "Enroll drivers", "Take payments at stations"];

/** The right page of the book. It repeats what the form already holds, so screen readers skip it. */
function OfficerPass({ signup, fill }: { signup: boolean; fill: PassFill }) {
  const name = signup ? shortName(fill.name ?? "") : "";
  const session = fill.busy ? "Opening" : signup ? "New account" : "Not logged in";
  return (
    <div className="ql-pass" aria-hidden="true">
      <div className="ql-pass-top">
        <span className="ql-pass-k">OFFICER PASS</span>
        <span className="ql-pass-chip">Testnet</span>
      </div>
      <div className="ql-pass-who">
        <p className="ql-pass-label">{signup ? "Officer" : "Returning officer"}</p>
        <p className="ql-pass-name" data-empty={name === "" || undefined}>
          {signup ? name || "Your name" : "Your pass"}
        </p>
        <p className="ql-pass-line" data-empty={fill.email === "" || undefined}>
          {fill.email || "name@lgu.gov.ph"} · Officer
        </p>
      </div>
      <dl className="ql-pass-rows">
        <div>
          <dt>Email</dt>
          <dd data-empty={fill.email === "" || undefined}>{fill.email || "—"}</dd>
        </div>
        <div>
          <dt>Role</dt>
          <dd>Officer</dd>
        </div>
        <div>
          <dt>Network</dt>
          <dd>Stellar Testnet</dd>
        </div>
        <div>
          <dt>Session</dt>
          <dd data-empty={!fill.busy || undefined}>{session}</dd>
        </div>
      </dl>
      <div className="ql-pass-can">
        <p className="ql-pass-label">Officers can</p>
        <ul>
          {PASS_CAN.map((line) => (
            <li key={line}>
              <Icon name="check" size={18} />
              {line}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function LoggedIn() {
  const { user, logout } = useAuth();
  if (user === null) return null;
  return (
    <div className="flex flex-col gap-4">
      <Notice tone="info" title="You are logged in">
        {`${user.displayName} · ${user.email} · ${user.role}`}
      </Notice>
      <LinkButton href="/dashboard">Go to the dashboard</LinkButton>
      <Button look="secondary" onClick={() => void logout()}>
        Log out
      </Button>
    </div>
  );
}

const HEAD: Record<string, { title: string; lead: string }> = {
  "/login": { title: "Welcome back", lead: "Log in to run the program, the masterlist and the stations." },
  "/signup": { title: "Create an officer account", lead: "Officers upload the masterlist, enroll drivers and take payments at stations." },
};

export function AuthScreen({ active, title, pass, children }: { active: string; title: string; pass: PassFill; children: ReactNode }) {
  const { user } = useAuth();
  const head = HEAD[active] ?? { title, lead: "" };
  return (
    // The negative margin cancels the phone layout's room for the tab bar, which these screens do not show.
    <div className="ql-auth-wrap -mb-[calc(56px+env(safe-area-inset-bottom))]">
      <main className="ql-auth" aria-label={title}>
        <div className="ql-auth-road">
          <MovingLogo />
          <span className="ql-auth-dashes" aria-hidden="true">
            <span />
          </span>
        </div>
        <div className="ql-book">
          <div className="ql-book-page">
            <div className="ql-book-form">
              <Suspense fallback={<Tabs active={active} next={null} />}>
                <TabsKeepingNext active={active} />
              </Suspense>
              <div className="ql-auth-head" key={active}>
                <h1>{head.title}</h1>
                {head.lead !== "" ? <p>{head.lead}</p> : null}
              </div>
              {user === null ? children : <LoggedIn />}
            </div>
          </div>
          <OfficerPass signup={active === "/signup"} fill={pass} />
        </div>
      </main>
    </div>
  );
}

export function AuthAlert({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="ql-auth-alert flex gap-2 rounded-md border-[1.5px] border-danger px-3 py-2 text-danger">
      <Icon name="alert" className="shrink-0" />
      <div className="text-caption">
        <p className="font-medium">That did not work</p>
        <p>{children}</p>
      </div>
    </div>
  );
}

interface AuthFieldProps extends ComponentProps<"input"> {
  label: string;
  /** The message under the input; it also marks the input invalid. */
  error?: string;
  /** Marks the input invalid when the message lives elsewhere (a wrong login names no single field). */
  invalid?: boolean;
  trailing?: ReactNode;
}

export function AuthField({ label, error, invalid = false, trailing, id, ...rest }: AuthFieldProps) {
  const inputId = id ?? `auth-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const noteId = `${inputId}-note`;
  const bad = invalid || error !== undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-caption">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          aria-invalid={bad || undefined}
          aria-describedby={error !== undefined ? noteId : undefined}
          className={`ql-input min-h-11 w-full rounded-md border-[1.5px] px-3 text-amount-sm placeholder:font-normal placeholder:text-muted ${trailing === undefined ? "" : "pr-12"} ${
            bad ? "border-declined bg-declined-tint" : "border-text/60 bg-surface"
          }`}
          {...rest}
        />
        {trailing}
      </div>
      {error !== undefined ? (
        <p id={noteId} className="text-caption text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function PasswordField(props: Omit<AuthFieldProps, "type" | "trailing">) {
  const [shown, setShown] = useState(false);
  return (
    <AuthField
      {...props}
      type={shown ? "text" : "password"}
      trailing={
        <button
          type="button"
          aria-label={shown ? "Hide password" : "Show password"}
          onClick={() => setShown(!shown)}
          className="absolute top-1/2 right-1 flex size-11 -translate-y-1/2 items-center justify-center"
        >
          <Icon name={shown ? "eyeOff" : "eye"} />
        </button>
      }
    />
  );
}
