"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiClientError, getProgram, postProgram } from "@/lib/api";
import { errorMessage } from "@/lib/use-dashboard";
import { Actions, Body, Button, Field, Notice, TopBar } from "../../_components/ui";
import { OfficerNotice, useAuth } from "../../_components/Auth";
import { Stagger } from "../../_components/motion";

/** `message` names the failing field as "<path>: <reason>" (§5.3), which is how an error lands on its input. */
function fieldOf(error: string | null): string | null {
  return error?.split(":", 1)[0] ?? null;
}

export default function CreateProgram() {
  const router = useRouter();
  const { isOfficer, loading } = useAuth();
  const [form, setForm] = useState({
    name: "TODA Fuel Aid — San Roque",
    perTapCapPhp: "500",
    tranchePhp: "1500",
    expiresAt: "2026-11-30T23:59",
    priceThresholdPhp: "65",
    alpha: "0.05",
    beta: "0.02",
  });
  const [exists, setExists] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProgram()
      .then(({ program }) => setExists(program !== null))
      .catch(() => setExists(false)); // the submit reports a real failure; the banner is only a courtesy
  }, []);

  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm({ ...form, [key]: event.target.value });
  const errorFor = (field: string): string | undefined => (fieldOf(error) === field ? (error ?? undefined) : undefined);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    // The form is officer-only, but a stale render must not reach the POST either.
    if (!isOfficer) return;
    setBusy(true);
    setError(null);
    try {
      await postProgram({
        name: form.name,
        perTapCapPhp: Number(form.perTapCapPhp),
        tranchePhp: Number(form.tranchePhp),
        // The input has no zone; the program runs on Philippine time.
        expiresAt: `${form.expiresAt}:59+08:00`,
        priceThresholdPhp: Number(form.priceThresholdPhp),
        alpha: Number(form.alpha),
        beta: Number(form.beta),
      });
      router.push("/dashboard");
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.code === "INVALID_STATE") setExists(true);
      else setError(errorMessage(cause));
      setBusy(false);
    }
  };

  if (!isOfficer) {
    return (
      <>
        <TopBar title="Create program" back="/dashboard" />
        <Body>{loading ? null : <OfficerNotice />}</Body>
      </>
    );
  }

  const known = ["name", "perTapCapPhp", "tranchePhp", "expiresAt", "priceThresholdPhp", "alpha", "beta"];
  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-1 flex-col">
      <TopBar title="Create program" back="/dashboard" />
      <Body>
        {exists ? <Notice tone="error" title="A program already exists">Only one program runs at a time. End it before creating another.</Notice> : null}
        {error !== null && !known.includes(fieldOf(error) ?? "") ? (
          <Notice tone="error" title="Could not create the program">
            {error}
          </Notice>
        ) : null}
        <div>
          <div className={error === null ? undefined : "shake"}>
            <Stagger className="flex flex-col gap-4">
              <Field label="Program name" value={form.name} onChange={set("name")} error={errorFor("name")} required />
              <Field label="Per-tap cap (PHP)" inputMode="decimal" value={form.perTapCapPhp} onChange={set("perTapCapPhp")} helper="Enforced on-chain for every card" error={errorFor("perTapCapPhp")} required />
              <Field label="Tranche per card (PHP)" inputMode="decimal" value={form.tranchePhp} onChange={set("tranchePhp")} error={errorFor("tranchePhp")} required />
              <Field label="Policy expiry" type="datetime-local" value={form.expiresAt} onChange={set("expiresAt")} helper="Philippine time" error={errorFor("expiresAt")} required />
              <Field label="Price threshold per litre (PHP)" inputMode="decimal" value={form.priceThresholdPhp} onChange={set("priceThresholdPhp")} error={errorFor("priceThresholdPhp")} required />
              <Field label="Max wrongful-denial rate α" inputMode="decimal" value={form.alpha} onChange={set("alpha")} error={errorFor("alpha")} required />
              <Field label="Max ghost-admission rate β" inputMode="decimal" value={form.beta} onChange={set("beta")} error={errorFor("beta")} required />
            </Stagger>
          </div>
        </div>
      </Body>
      <Actions>
        <Button type="submit" loading={busy} disabled={exists}>
          {busy ? "Creating" : "Create program"}
        </Button>
      </Actions>
    </form>
  );
}
