"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { postLogin } from "@/lib/api";
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

export default function Login() {
  const router = useRouter();
  const { user, refresh, logout } = useAuth();
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
      await postLogin({ email, password });
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
        <TopBar title="Log in" back="/" />
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
      <TopBar title="Log in" back="/" />
      <Body>
        {error !== null && !["email", "password"].includes(fieldOf(error) ?? "") ? (
          <Notice tone="error" title="Could not log in">
            {error}
          </Notice>
        ) : null}
        <div className={error === null ? undefined : "shake"}>
          <Stagger className="flex flex-col gap-4">
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
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={errorFor("password")}
              required
            />
            <p className="text-small">
              No account?{" "}
              <Link href="/signup" className="text-primary underline">
                Create an account
              </Link>
            </p>
          </Stagger>
        </div>
      </Body>
      <Actions>
        <Button type="submit" loading={busy}>
          {busy ? "Logging in" : "Log in"}
        </Button>
      </Actions>
    </form>
  );
}
