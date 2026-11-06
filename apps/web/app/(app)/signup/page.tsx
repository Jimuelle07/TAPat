"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiClientError, postSignup } from "@/lib/api";
import { AuthAlert, AuthField, AuthScreen, nextPath, PasswordField, toAuthFailure, type AuthFailure } from "../_components/AuthScreen";
import { useAuth } from "../_components/Auth";
import { Button } from "../_components/ui";

export default function Signup() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<AuthFailure | null>(null);

  const errorFor = (field: string) => (failure?.field === field ? failure.message : undefined);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    // Checked here rather than with `minLength` so the message shows under the field, as designed.
    if (password.length < 8) {
      setFailure({ field: "password", message: "Too short. Use at least 8 characters." });
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      await postSignup({ displayName, email, password });
      await refresh();
      router.push(nextPath());
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.code === "ACCOUNT_EXISTS") {
        setFailure({ field: "email", message: "This email already has an account." });
      } else {
        setFailure(toAuthFailure(cause));
      }
      setBusy(false);
    }
  };

  return (
    <AuthScreen active="/signup" title="Sign up">
      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-3">
        {failure !== null && failure.field === null ? <AuthAlert>{failure.message}</AuthAlert> : null}
        <AuthField
          label="Full name"
          autoComplete="name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          error={errorFor("displayName")}
          required
        />
        <AuthField
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="name@lgu.gov.ph"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errorFor("email")}
          required
        />
        <PasswordField
          label="Password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errorFor("password")}
          required
        />
        <Button type="submit" loading={busy}>
          {busy ? "Creating" : failure !== null ? "Try again" : "Create account"}
        </Button>
      </form>
    </AuthScreen>
  );
}
