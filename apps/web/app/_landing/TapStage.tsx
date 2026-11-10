"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PumpScene, SceneChoice } from "./pumpScene";

/** One sample tap. Every string comes from the server page, so this island ships no money or label code. */
export type StageChoice = {
  id: "ok" | "over" | "expired";
  button: string;
  amount: string;
  card: string;
  last4: string;
  approved: boolean;
  /** Short reason for the reader glass, e.g. "over cap". */
  short: string;
  reason: string;
  tx: string;
  note: string;
  note2: string;
};

const READ_MS = 1100;
const AUTOPLAY_MS = 900;

const reducedNow = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const toScene = (c: StageChoice): SceneChoice => ({ id: c.id, amount: c.amount, last4: c.last4, approved: c.approved, short: c.short });

/** The font stack next/font gave a CSS variable, so the 3D textures draw in the page's own faces. */
const fontOf = (el: Element, name: string, fallback: string) => getComputedStyle(el).getPropertyValue(name).trim() || fallback;

/**
 * The hero's sample station: a 3D pump panel (three.js, loaded after first paint), the three tap keys, and the receipt the
 * pump prints. Nothing leaves the browser.
 */
export function TapStage({ choices, autoplay, cap }: { choices: StageChoice[]; autoplay: StageChoice["id"]; cap: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<PumpScene | null>(null);
  // The last tap, so a scene that finishes loading mid-tap picks it up at the right moment.
  const lastTap = useRef<{ choice: StageChoice; at: number; instant: boolean } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const [active, setActive] = useState<StageChoice | null>(null);
  const [phase, setPhase] = useState<"idle" | "reading" | "done">("idle");
  // Flipped on user interaction, so the autoplayed decline is not announced to screen readers.
  const [touched, setTouched] = useState(false);
  // Bumped on every tap so the receipt re-mounts and prints again.
  const [shot, setShot] = useState(0);

  const run = useCallback((choice: StageChoice, instant: boolean) => {
    window.clearTimeout(timer.current);
    const at = performance.now();
    lastTap.current = { choice, at, instant };
    scene.current?.tap(toScene(choice), instant, at);
    setActive(choice);
    setShot((n) => n + 1);
    if (instant) {
      setPhase("done");
      return;
    }
    setPhase("reading");
    timer.current = window.setTimeout(() => setPhase("done"), READ_MS);
  }, []);

  useEffect(() => {
    const choice = choices.find((c) => c.id === autoplay);
    if (choice === undefined) return;
    const reduced = reducedNow();
    timer.current = window.setTimeout(() => run(choice, reduced), reduced ? 0 : AUTOPLAY_MS);
    return () => window.clearTimeout(timer.current);
  }, [autoplay, choices, run]);

  // three.js is fetched once the browser is idle after first paint, so it never competes with the headline.
  useEffect(() => {
    const el = canvas.current;
    if (el === null) return;
    let cancelled = false;
    let made: PumpScene | null = null;
    const start = () => {
      import("./pumpScene")
        .then(({ createPumpScene }) => {
          if (cancelled) return;
          const fonts = {
            serif: fontOf(el, "--font-serif", "Georgia, serif"),
            sans: fontOf(el, "--font-inter", "system-ui, sans-serif"),
            mono: fontOf(el, "--font-plex", "ui-monospace, monospace"),
          };
          const first = toScene(lastTap.current?.choice ?? choices.find((c) => c.id === autoplay) ?? choices[0]);
          made = createPumpScene(el, first, fonts, reducedNow());
          if (made === null) return;
          scene.current = made;
          el.dataset.ready = "true";
          const tap = lastTap.current;
          if (tap !== null) made.tap(toScene(tap.choice), tap.instant, tap.at);
        })
        .catch(() => undefined); // The keys and receipt still work without the 3D panel.
    };
    // Safari has no requestIdleCallback.
    const hasIdle = typeof window.requestIdleCallback === "function";
    const idle = hasIdle ? window.requestIdleCallback(start, { timeout: 1200 }) : window.setTimeout(start, 200);
    return () => {
      cancelled = true;
      if (hasIdle) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      made?.dispose();
      scene.current = null;
    };
  }, [autoplay, choices]);

  const status = phase === "reading" && active ? `Reading card …${active.last4}` : phase === "done" ? "Contract answered." : "Pick a tap to see the contract answer.";

  return (
    <div className="flex flex-wrap items-start justify-center gap-4">
      <div className="flex min-w-0 max-w-[480px] flex-[1_1_340px] flex-col">
        <canvas ref={canvas} aria-hidden="true" className="pump-canvas block h-[clamp(300px,48vh,460px)] w-full" />
        <div className="flex flex-col gap-3 px-2">
          <p>
            <span className="inline-flex items-center rounded-[4px] border-[1.5px] border-forest px-2.5 py-1 text-[11px] font-bold tracking-[0.16em] uppercase">
              Simulated
            </span>
          </p>
          <div role="group" aria-label="Try a tap" onPointerDown={() => setTouched(true)} onFocus={() => setTouched(true)} className="flex gap-2">
            {choices.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={active?.id === c.id}
                onClick={() => {
                  setTouched(true);
                  run(c, reducedNow());
                }}
                className="pump-key min-h-12 flex-1 rounded-[10px] border-[1.5px] border-forest px-2.5 text-[14px] font-semibold whitespace-nowrap"
              >
                {c.button}
              </button>
            ))}
          </div>
          <p className="flex items-center gap-2 text-[14px] text-forest/80">
            <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true" className={phase === "reading" ? "pump-blink" : undefined}>
              <circle cx="4" cy="4" r="4" className="fill-forest" />
            </svg>
            {status}
          </p>
        </div>
      </div>

      <div className="mt-7 flex w-[290px] max-w-full flex-none flex-col">
        <div aria-hidden="true" className="pump-slot relative z-[1] h-3.5 w-full rounded-[7px]" />
        <div aria-live={touched ? "polite" : "off"} className="relative -mt-[7px] h-[414px] overflow-hidden px-4 pb-[26px]">
          {phase === "done" && active ? (
            <div key={shot} className="pump-receipt">
              <div className="flex flex-col gap-2 bg-[linear-gradient(#D9CFB8_0,#FFFCF4_18px)] px-[18px] pt-[22px] pb-3 font-mono text-[11.5px] leading-[1.45] text-forest">
                <div className="flex flex-col text-center">
                  <span className="font-serif-soft text-[26px] leading-[1.15] font-extrabold italic">TAPat</span>
                  <span>FUEL AID · TODA SAN ROQUE</span>
                  <span>STATION A</span>
                  <span>*** SAMPLE DATA ***</span>
                </div>
                <hr className="border-0 border-t-[1.5px] border-dashed border-forest" />
                <dl className="flex flex-col gap-[3px]">
                  <Row label="CARD" value={active.card} />
                  <Row label="AMOUNT" value={active.amount} strong />
                  <Row label="CAP PER TAP" value={cap} />
                </dl>
                <hr className="border-0 border-t-[1.5px] border-dashed border-forest" />
                <dl className="flex flex-col gap-[3px]">
                  <Row label="RESULT" value={active.approved ? "PAID" : "DECLINED"} strong />
                  <Row label="REASON" value={active.reason} />
                  <Row label="TX" value={active.tx} />
                </dl>
                <hr className="border-0 border-t-4 border-double border-forest" />
                <span aria-hidden="true" className="pump-stamp self-center rounded-md border-[3px] border-double border-forest px-3.5 py-1.5 font-sans text-[19px] font-extrabold tracking-[0.16em]">
                  {active.approved ? "PAID" : "DECLINED"}
                </span>
                <p className="text-center">
                  {active.note}
                  <br />
                  {active.note2}
                </p>
              </div>
              <svg aria-hidden="true" viewBox="0 0 48 4" preserveAspectRatio="none" className="block h-2.5 w-full">
                <polygon points={TEETH} fill="#FFFCF4" />
              </svg>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** The torn bottom edge: 24 teeth across the slip. */
const TEETH = Array.from({ length: 49 }, (_, i) => `${i},${i % 2 === 0 ? 0 : 4}`).join(" ");

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt>{label}</dt>
      <dd className={`text-right ${strong ? "font-bold" : ""}`}>{value}</dd>
    </div>
  );
}
