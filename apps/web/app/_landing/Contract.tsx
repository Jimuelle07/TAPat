"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { useReducedMotion } from "../(app)/_components/motion";
import "./contract.css";

export type ContractTone = "mint" | "declined" | "frozen" | "accent";

export type Decision = {
  name: string;
  /** One line under the row once it is selected. */
  gist: string;
  tone: ContractTone;
  verdict: string;
  /** Who decides, and where or on what. */
  who: string;
  where: string;
  what: string;
  amount: string;
  call: string;
  mark: string;
  result: string;
  note: string;
};

const PAGE_WIDTH = "mx-auto w-full max-w-[1440px] px-[clamp(20px,5vw,72px)]";
/** How long each decision stays on stage while the section plays by itself. */
const CYCLE_MS = 6000;
/** The call types in after the proposal reaches the contract, and is done before the result lands at 2s (contract.css). */
const TYPE_START_MS = 1050;
const TYPE_MS = 850;

/**
 * "The agent decides. The contract has the last word." Four decisions down the left; a console on the right plays the
 * selected one: the agent's slip drops in, a pulse runs down to the contract, the call types out, the result and the
 * verdict seal land. It plays by itself while on screen (the active row's line is the timer) and pauses on hover; a
 * click or the arrow keys take over. The server renders the first decision complete, so nothing waits on JavaScript,
 * and under reduced motion it never moves on its own.
 */
export function ContractSection({ decisions }: { decisions: Decision[] }) {
  const reduce = useReducedMotion();
  const sealPath = useId();
  const stage = useRef<HTMLDivElement>(null);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const [current, setCurrent] = useState(0);
  const [auto, setAuto] = useState(true);
  const [onScreen, setOnScreen] = useState(false);
  const [hovered, setHovered] = useState(false);
  // 0 until the section is first seen: until then the console is drawn finished and nothing plays.
  const [run, setRun] = useState(0);
  const [typed, setTyped] = useState<number | null>(null);
  const d = decisions[current];

  useEffect(() => {
    const el = stage.current;
    if (el === null) return;
    let seen = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setOnScreen(entry.isIntersecting);
        if (!entry.isIntersecting || seen) return;
        seen = true;
        // First sight: play the decision on stage (typed from empty unless motion is reduced).
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) setTyped(0);
        setRun(1);
      },
      { threshold: 0.35 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Type the call, time-based so it always finishes before the result appears.
  useEffect(() => {
    if (run === 0 || reduce) return;
    const start = performance.now() + TYPE_START_MS;
    let raf = requestAnimationFrame(function tick(now) {
      const t = Math.max(0, Math.min(1, (now - start) / TYPE_MS));
      setTyped(Math.ceil(t * d.call.length));
      if (t < 1) raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [run, current, reduce, d.call.length]);

  const show = (i: number) => {
    setCurrent(i);
    setTyped(reduce ? null : 0);
    setRun((r) => r + 1);
  };
  const pick = (i: number) => {
    setAuto(false);
    show(i);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    const jump = { Home: 0, End: decisions.length - 1 }[e.key];
    if (step === undefined && jump === undefined) return;
    e.preventDefault();
    const next = jump ?? (current + (step ?? 0) + decisions.length) % decisions.length;
    pick(next);
    tabs.current[next]?.focus();
  };

  const autoplay = auto && !reduce;
  const running = autoplay && onScreen && !hovered && run > 0;
  const call = typed === null ? d.call : d.call.slice(0, typed);

  return (
    <section id="contract" className="ctr" aria-labelledby="contract-h">
      <div className={`${PAGE_WIDTH} py-20 lg:py-36`}>
        <div className="grid items-end gap-7 lg:grid-cols-[7fr_4fr]">
          <h2 id="contract-h" className="ctr-h font-serif-soft">
            The agent decides. <em>The contract has the last word.</em>
          </h2>
          <p className="ctr-lead">
            Agents make every money decision, inside limits the LGU signs. The Noir contracts on Stellar Testnet enforce them, and a refused tap writes no
            transaction.
          </p>
        </div>

        <div
          ref={stage}
          className="mt-12 grid gap-7 lg:mt-20 lg:grid-cols-[5fr_7fr] lg:gap-14"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <div>
            <div
              className="ctr-list"
              role="tablist"
              aria-label="Agent decisions"
              aria-orientation="vertical"
              data-auto={autoplay ? "" : undefined}
              data-running={running ? "" : undefined}
              onKeyDown={onKeyDown}
            >
              {decisions.map((row, i) => (
                <button
                  key={row.name}
                  ref={(el) => {
                    tabs.current[i] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`ctr-tab-${i}`}
                  aria-controls="ctr-console"
                  aria-selected={i === current}
                  tabIndex={i === current ? 0 : -1}
                  className="ctr-row"
                  onClick={() => pick(i)}
                >
                  <span className="ctr-num">{String(i + 1).padStart(2, "0")}</span>
                  <span className="ctr-name font-serif-soft">{row.name}</span>
                  <span className="ctr-arrow" aria-hidden="true">
                    →
                  </span>
                  <span className="ctr-gist">{row.gist}</span>
                  {/* The active row's line is the autoplay timer: when it fills, the next decision plays. */}
                  <i
                    className="ctr-prog"
                    aria-hidden="true"
                    style={{ "--cycle": `${CYCLE_MS}ms` } as CSSProperties}
                    onAnimationEnd={() => show((current + 1) % decisions.length)}
                  />
                </button>
              ))}
            </div>
            <p className="ctr-note">Velo verifies the budget and sponsors the fees. Per-tap limits are Noir&apos;s.</p>
          </div>

          <div
            id="ctr-console"
            className="ctr-console"
            role="tabpanel"
            aria-labelledby={`ctr-tab-${current}`}
            aria-live="polite"
            tabIndex={0}
            data-tone={d.tone}
          >
            <div className="ctr-bar">
              <span>payment_escrow · Stellar Testnet</span>
              <span className="ctr-live">demo program</span>
            </div>
            {/* Keyed by run, so every new decision remounts and replays the entrance. */}
            <div key={run} className={run > 0 ? "ctr-run" : undefined}>
              <p className="ctr-lane">The agent decides</p>
              <div className="ctr-slip">
                <div className="ctr-who">
                  <span>{d.who}</span>
                  <span>{d.where}</span>
                </div>
                <p className="ctr-what font-serif-soft">{d.what}</p>
                <p className="ctr-amount">{d.amount}</p>
              </div>
              <div className="ctr-wire" aria-hidden="true">
                <i />
                <span>calls the contract</span>
              </div>
              <p className="ctr-lane mt-0">The contract answers</p>
              <div className="ctr-term">
                <p className="ctr-call">
                  <span aria-hidden="true">&gt; </span>
                  {call}
                  <i className="ctr-caret" aria-hidden="true" />
                </p>
                <p className="ctr-result">
                  <span aria-hidden="true">{d.mark}</span>
                  <span>{d.result}</span>
                </p>
                <p className="ctr-tx">{d.note}</p>
              </div>
              <svg className="ctr-seal" viewBox="0 0 120 120" aria-hidden="true">
                <defs>
                  <path id={sealPath} d="M60,60 m-45,0 a45,45 0 1,1 90,0 a45,45 0 1,1 -90,0" />
                </defs>
                <circle cx="60" cy="60" r="57" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="60" cy="60" r="35" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" />
                <g className="ctr-ring">
                  <text fontSize="8.6" letterSpacing="2.1">
                    <textPath href={`#${sealPath}`} textLength="280">
                      ON-CHAIN · STELLAR TESTNET · TAPAT ·
                    </textPath>
                  </text>
                </g>
                <text x="60" y="64" textAnchor="middle" fontSize="11" fontWeight="500" letterSpacing="1.4">
                  {d.verdict}
                </text>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
