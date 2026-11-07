"use client";

// The shared shell of /login and /signup (Figma: TAPat Login and Signup): waves, logo, tabbed card and fields.
import { Suspense, useState, type ComponentProps, type ReactNode } from "react";
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

function Tabs({ active, next }: { active: string; next: string | null }) {
  const query = next === null ? "" : `?next=${encodeURIComponent(next)}`;
  return (
    <nav aria-label="Account" className="flex gap-6">
      {TABS.map((tab) => {
        const on = tab.href === active;
        return (
          <Link
            key={tab.href}
            href={`${tab.href}${query}`}
            aria-current={on ? "page" : undefined}
            className={`flex min-h-11 items-center border-b-2 text-[18px] leading-tight ${on ? "border-primary font-semibold" : "border-transparent text-muted"}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

function TabsKeepingNext({ active }: { active: string }) {
  return <Tabs active={active} next={useSearchParams().get("next")} />;
}

function Waves() {
  return (
    <svg aria-hidden="true" viewBox="0 0 390 844" preserveAspectRatio="none" className="absolute inset-0 size-full">
      <path className="fill-sunken" fillOpacity="0.45" d="M0 0H390V132C320 92 262 150 190 122C118 94 64 74 0 112Z" />
      <path className="fill-sunken" fillOpacity="0.7" d="M0 0H390V70C322 42 268 92 196 68C124 44 66 28 0 58Z" />
      <path className="fill-sunken" fillOpacity="0.45" d="M0 716C66 680 128 712 198 696C268 680 324 668 390 700V844H0Z" />
      <path className="fill-sunken" fillOpacity="0.7" d="M0 776C70 748 130 782 202 764C274 746 326 742 390 768V844H0Z" />
      <path className="fill-ring-surface" fillOpacity="0.55" d="M0 816C72 796 136 824 206 810C276 796 330 794 390 812V844H0Z" />
    </svg>
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

export function AuthScreen({ active, title, children }: { active: string; title: string; children: ReactNode }) {
  const { user } = useAuth();
  return (
    // The negative margin cancels the root layout's room for the tab bar, which these screens do not show.
    <main className="relative -mb-[calc(56px+env(safe-area-inset-bottom))] flex flex-1 flex-col justify-center overflow-hidden px-5 pt-[calc(16px+env(safe-area-inset-top))] pb-4">
      <Waves />
      <h1 className="sr-only">{title}</h1>
      {/* The icon file is square with wide margins; this slot shows its middle band. */}
      <div className="relative mx-auto h-[64px] w-[116px] shrink-0 overflow-hidden">
        <Image src="/tapat-app-icon-1024.png" alt="TAPat" width={116} height={116} className="-mt-[26px] max-w-none mix-blend-darken" priority />
      </div>
      <div className="relative mt-2 flex flex-col gap-3 rounded-lg bg-raised px-4 pt-2 pb-4 [&_button[type=submit]]:min-h-11 shadow-[0_8px_24px_rgb(27_46_40/0.12)]">
        <Suspense fallback={<Tabs active={active} next={null} />}>
          <TabsKeepingNext active={active} />
        </Suspense>
        {user === null ? children : <LoggedIn />}
      </div>
    </main>
  );
}

export function AuthAlert({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="flex gap-2 rounded-md border-[1.5px] border-danger px-3 py-2 text-danger">
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
    <div className="flex flex-col gap-0.5">
      <label htmlFor={inputId} className="text-caption">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          aria-invalid={bad || undefined}
          aria-describedby={error !== undefined ? noteId : undefined}
          className={`min-h-11 w-full rounded-md border-[1.5px] px-3 text-amount-sm placeholder:font-normal placeholder:text-muted ${trailing === undefined ? "" : "pr-12"} ${
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
