"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { postSignup } from "@/lib/api";
import { errorMessage } from "@/lib/use-dashboard";
import { useAuth } from "../_components/Auth";
import { Stagger } from "../_components/motion";
import { Actions, Body, Button, Field, Notice, TopBar } from "../_components/ui";

/** `message` names the failing field as "<path>: <reason>" (§5.3), which is how an error lands on its input. */
function fieldOf(error: string | null): string | null {
  return error?.split(":", 1)[0] ?? null;
}

/** Same-origin guard: resolve against our origin and keep only the path, so `/\\evil.com`, `//evil.com` and `https://evil.com` all collapse to `/`. */
function nextPath(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  if (next === null || next === "") return "/";
  try {
    const url = new URL(next, window.location.origin);
    if (url.origin !== window.location.origin) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

export default function Signup() {
  const router = useRouter();
  const { user, refresh, logout } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errorFor = (field: string): string | undefined => (fieldOf(error) === field ? (error ?? undefined) : undefined);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await postSignup({ displayName, email, password });
      await refresh();
      router.push(nextPath());
    } catch (cause) {
      setError(errorMessage(cause));
      setBusy(false);
    }
  };

  if (user !== null) {
    return (
      <>
        <TopBar title="Create account" back="/" />
        <Body>
          <Notice tone="info" title="You are logged in">
            {`${user.displayName} · ${user.email} · ${user.role}`}
          </Notice>
          <Button look="secondary" onClick={() => void logout()}>
            Log out
          </Button>
        </Body>
      </>
    );
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-1 flex-col">
      <TopBar title="Create account" back="/" />
      <Body>
        {error !== null && !["displayName", "email", "password"].includes(fieldOf(error) ?? "") ? (
          <Notice tone="error" title="Could not create the account">
            {error}
          </Notice>
        ) : null}
        <div>
          <div className={error === null ? undefined : "shake"}>
            <Stagger className="flex flex-col gap-4">
              <Field
                label="Name"
                autoComplete="name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                error={errorFor("displayName")}
                required
              />
              <Field
                label="Email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                error={errorFor("email")}
                required
              />
              <Field
                label="Password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                helper="At least 8 characters"
                error={errorFor("password")}
                required
              />
              <p className="text-small">New accounts are viewers. Officer actions need the officer account.</p>
              <p className="text-small">
                Already have an account?{" "}
                <Link href="/login" className="text-primary underline">
                  Log in
                </Link>
              </p>
            </Stagger>
          </div>
        </div>
      </Body>
      <Actions>
        <Button type="submit" loading={busy}>
          {busy ? "Creating" : "Create account"}
        </Button>
      </Actions>
    </form>
  );
}
