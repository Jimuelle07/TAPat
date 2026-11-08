"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TapScene, type TapPhase } from "../(app)/_components/TapScene";
import { Status } from "./kit";

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

const READ_MS = 700;
const START_MS = 600;

const reducedNow = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const SLIP = "border-t border-text pt-3 doc-mono";

const ROW = "flex justify-between gap-4 border-b border-ring-surface py-1.5 last:border-b-0";

/** The contract's answer printed on the slip. */
function Verdict({ choice }: { choice: TapChoice }) {
  const approved = choice.verdict === "approved";
  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <Status tone={approved ? "ok" : "refused"}>{approved ? "PAID" : "DECLINED"}</Status>
        <span className="text-right">{choice.amount}</span>
      </div>
      <dl className="pt-2">
        <div className={ROW}>
          <dt>Card</dt>
          <dd className="text-right">{choice.card}</dd>
        </div>
        {choice.reason === null ? null : (
          <div className={ROW}>
            <dt>Reason</dt>
            <dd className="text-right">{choice.reason}</dd>
          </div>
        )}
        <div className={ROW}>
          <dt>Tx</dt>
          <dd className="text-right">{approved ? "Submitted (sample)" : "None submitted"}</dd>
        </div>
      </dl>
      <p className="doc-small font-sans pt-2">{choice.note}</p>
    </>
  );
}

/** A sample station terminal: pick a tap and see the contract's answer. Nothing leaves the browser. */
export function TapDemo({ choices, autoplay }: { choices: TapChoice[]; autoplay: TapChoice["id"] }) {
  const [active, setActive] = useState<TapChoice | null>(null);
  // Flipped on user interaction (pointer, focus, or click as a fallback), so the autoplayed decline is not announced to screen readers.
  const [touched, setTouched] = useState(false);
  const [phase, setPhase] = useState<TapPhase>("idle");
  const timer = useRef<number | undefined>(undefined);
  // Pending autoplay start; a user tap clears it so the autoplay never overrides their pick.
  const loop = useRef<number | undefined>(undefined);
  // Bumped inside `run` (a callback), so every tap re-keys the result slip and replays its fade.
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
    // Plays once: no rescheduling after the verdict shows.
    loop.current = reducedNow() ? window.setTimeout(() => run(choice, true), 0) : window.setTimeout(() => run(choice, false), START_MS);
    return () => {
      window.clearTimeout(loop.current);
      window.clearTimeout(timer.current);
    };
  }, [autoplay, choices, run]);

  const verdict = active === null || phase === "reading" ? "pending" : active.verdict;
  const showing = active !== null && phase !== "reading";

  return (
    <div data-verdict={verdict} className="flex flex-col border border-text bg-raised text-text">
      <div className="flex items-center justify-between border-b border-text px-4 py-2.5">
        <span className="font-medium">Station A</span>
        <Status tone="neutral">SAMPLE</Status>
      </div>

      <div className="px-4 pt-4">
        <TapScene phase={phase} last4={active?.last4} simulated />
      </div>

      <div
        role="group"
        aria-label="Try a tap"
        onPointerDown={() => setTouched(true)}
        onFocus={() => setTouched(true)}
        className="grid grid-cols-1 gap-2 px-4 pt-4 min-[480px]:grid-cols-3"
      >
        {choices.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={active?.id === c.id}
            onClick={() => {
              setTouched(true);
              window.clearTimeout(loop.current);
              run(c, reducedNow());
            }}
            className="min-h-11 rounded-[2px] border border-text px-2 font-mono text-[14px] whitespace-nowrap transition-colors duration-[120ms] not-aria-pressed:hover:bg-sunken aria-pressed:bg-text aria-pressed:text-surface"
          >
            {c.button}
          </button>
        ))}
      </div>

      <div className="grid px-4 pt-4 pb-4">
        {/* Invisible copies of every slip hold the tallest one's height at any width, so nothing below shifts. */}
        {choices.map((c) => (
          <div key={c.id} aria-hidden="true" className={`invisible [grid-area:1/1] ${SLIP}`}>
            <Verdict choice={c} />
          </div>
        ))}
        <div aria-live={touched ? "polite" : "off"} className="self-start [grid-area:1/1]">
          <div key={`slip-${active?.id ?? "none"}-${shot}-${phase}`} className={`${SLIP} ${showing ? "tap-result" : ""}`}>
            {active === null ? (
              <p>Pick a tap to see the contract&apos;s answer.</p>
            ) : phase === "reading" ? (
              <p>Reading card …{active.last4}</p>
            ) : (
              <Verdict choice={active} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
