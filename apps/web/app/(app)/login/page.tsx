"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiClientError, postLogin } from "@/lib/api";
import { AuthAlert, AuthField, AuthScreen, nextPath, PasswordField, toAuthFailure, type AuthFailure } from "../_components/AuthScreen";
import { useAuth } from "../_components/Auth";
import { Button } from "../_components/ui";

const WRONG_LOGIN = "Your email or password is wrong. Check them and try again.";

export default function Login() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [wrongLogin, setWrongLogin] = useState(false);
  const [failure, setFailure] = useState<AuthFailure | null>(null);

  const failed = wrongLogin || failure !== null;
  const errorFor = (field: string) => (failure?.field === field ? failure.message : undefined);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setWrongLogin(false);
    setFailure(null);
    try {
      await postLogin({ email, password });
      await refresh();
      router.push(nextPath());
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.code === "UNAUTHORIZED") setWrongLogin(true);
      else setFailure(toAuthFailure(cause));
      setBusy(false);
    }
  };

  return (
    <AuthScreen active="/login" title="Log in" pass={{ email, busy }}>
      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-3">
        {wrongLogin ? <AuthAlert>{WRONG_LOGIN}</AuthAlert> : null}
        {failure !== null && failure.field === null ? <AuthAlert>{failure.message}</AuthAlert> : null}
        <AuthField
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="name@lgu.gov.ph"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errorFor("email")}
          invalid={wrongLogin}
          required
        />
        <PasswordField
          label="Password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errorFor("password")}
          invalid={wrongLogin}
          required
        />
        <Button type="submit" loading={busy}>
          {busy ? "Logging in" : failed ? "Try again" : "Log in"}
        </Button>
      </form>
    </AuthScreen>
  );
}
