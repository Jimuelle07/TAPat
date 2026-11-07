"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TapScene, type TapPhase } from "../(app)/_components/TapScene";
import { Stamp, TearEdge } from "./kit";

/** One sample tap. Every string comes from the server page, so this island ships no money or label code. */
export type TapChoice = {
  id: "ok" | "over" | "expired";
  button: string;
  amount: string;
  card: string;
  last4: string;
  verdict: "approved" | "declined";
  reason: string | null;
  note: string;
};

const READ_MS = 1100;
const AUTOPLAY_MS = 900;

const reducedNow = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A sample station terminal: pick a tap and see the contract's answer. Nothing leaves the browser. */
export function TapDemo({ choices, autoplay }: { choices: TapChoice[]; autoplay: TapChoice["id"] }) {
  const [active, setActive] = useState<TapChoice | null>(null);
  // Flipped on user interaction (pointer, focus, or click as a fallback), so the autoplayed decline is not announced to screen readers.
  const [touched, setTouched] = useState(false);
  const [phase, setPhase] = useState<TapPhase>("idle");
  const timer = useRef<number | undefined>(undefined);
  // Bumped inside `run` (a callback), so every tap re-keys the animated parts and replays their motion.
  const [shot, setShot] = useState(0);

  const run = useCallback((choice: TapChoice, instant: boolean) => {
    window.clearTimeout(timer.current);
    setActive(choice);
    setShot((n) => n + 1);
    const final: TapPhase = choice.verdict === "approved" ? "done" : "error";
    if (instant) {
      setPhase(final);
      return;
    }
    setPhase("reading");
    timer.current = window.setTimeout(() => setPhase(final), READ_MS);
  }, []);

  useEffect(() => {
    const choice = choices.find((c) => c.id === autoplay);
    if (choice === undefined) return;
    timer.current = window.setTimeout(() => run(choice, reducedNow()), reducedNow() ? 0 : AUTOPLAY_MS);
    return () => window.clearTimeout(timer.current);
  }, [autoplay, choices, run]);

  const verdict = active === null || phase === "reading" ? "pending" : active.verdict;
  const replay = `${active?.id ?? "none"}-${shot}-${phase}`;

  return (
    <div data-verdict={verdict} className="depth-dark flex flex-col overflow-hidden rounded-md border-[1.5px] border-text bg-raised text-text">
      <div key={`card-${replay}`} className={phase === "error" ? "shake" : undefined}>
        <div className="flex items-center justify-between border-b-[1.5px] border-text px-5 py-3">
          <span className="text-label">Station A</span>
          <Stamp tone="outline">SAMPLE</Stamp>
        </div>

        <div className="px-5 pt-4">
          <div className="tap-stage rounded-md">
            <TapScene phase={phase} last4={active?.last4} simulated />
          </div>
        </div>
      </div>

      <div
        role="group"
        aria-label="Try a tap"
        onPointerDown={() => setTouched(true)}
        onFocus={() => setTouched(true)}
        className="grid grid-cols-2 gap-2 px-5 pt-4 min-[440px]:grid-cols-3"
      >
        {choices.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={active?.id === c.id}
            onClick={() => {
              setTouched(true);
              run(c, reducedNow());
            }}
            className="tap-key min-h-11 rounded-md border-[1.5px] border-text px-1.5 text-label whitespace-nowrap text-text not-aria-pressed:hover:bg-mint aria-pressed:bg-text aria-pressed:text-surface max-[479px]:text-[13px] max-[439px]:last:col-span-2 min-[480px]:px-2"
          >
            {c.button}
          </button>
        ))}
      </div>

      <div aria-live={touched ? "polite" : "off"} className="slip-lift px-5 pt-4">
        <div
          key={`slip-${replay}`}
          className={`flex flex-col gap-2 border-[1.5px] border-b-0 border-text bg-surface p-4 font-mono text-mono ${active !== null && phase !== "reading" ? "receipt-in" : ""}`}
        >
          {active === null ? (
            <p>Pick a tap to see the contract answer.</p>
          ) : phase === "reading" ? (
            <p>Reading card …{active.last4}</p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <span key={`stamp-${replay}`} className="stamp inline-flex">
                  <Stamp tone={active.verdict === "approved" ? "accent" : "danger"}>{active.verdict === "approved" ? "PAID" : "DECLINED"}</Stamp>
                </span>
                <span className="text-amount-sm">{active.amount}</span>
              </div>
              <hr className="border-t-[1.5px] border-dashed border-text" />
              <dl>
                <div className="flex justify-between gap-4 border-b border-ring-surface py-1.5 last:border-b-0">
                  <dt>Card</dt>
                  <dd className="text-right">{active.card}</dd>
                </div>
                {active.reason === null ? null : (
                  <div className="flex justify-between gap-4 border-b border-ring-surface py-1.5 last:border-b-0">
                    <dt>Reason</dt>
                    <dd className="text-right">{active.reason}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-4 border-b border-ring-surface py-1.5 last:border-b-0">
                  <dt>Tx</dt>
                  <dd className="text-right">{active.verdict === "approved" ? "Submitted (sample)" : "None submitted"}</dd>
                </div>
              </dl>
              <p>{active.note}</p>
            </>
          )}
        </div>
        <TearEdge />
      </div>

      <p className="px-5 pt-3 pb-5 text-caption">Simulated tap on sample data. Nothing is sent to the chain.</p>
    </div>
  );
}
