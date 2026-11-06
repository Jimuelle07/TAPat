"use client";

// Staged "loading, then done" feedback for the simulated NFC flows (enroll, station). The real API call still runs;
// these helpers only keep the progress visible long enough to read and step through honest phase labels.
import { useEffect, useState } from "react";

/** While `active`, steps through `labels` every `stepMs` and stays on the last one; inactive returns `labels[0]`. */
export function useStagedLabel(active: boolean, labels: readonly string[], stepMs = 1500): string {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setStep((current) => Math.min(current + 1, labels.length - 1)), stepMs);
    return () => {
      clearInterval(timer);
      setStep(0);
    };
  }, [active, labels.length, stepMs]);
  return labels[active ? step : 0] ?? "";
}

/** Settles with `work`'s outcome (value or rejection), but never before `ms` has elapsed. */
export async function withMinDuration<T>(work: Promise<T>, ms: number): Promise<T> {
  const floor = new Promise<void>((resolve) => setTimeout(resolve, ms));
  const [outcome] = await Promise.allSettled([work, floor]);
  if (outcome.status === "rejected") throw outcome.reason;
  return outcome.value;
}
