"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { useReducedMotion } from "../(app)/_components/motion";
import "./ledger.css";

export type LedgerPart = {
  name: string;
  pesos: number;
  /** The amount as the site formats it, e.g. "₱3,190.00": what the server renders and the count-up ends on. */
  label: string;
  why: string;
  color: string;
};

const PAGE_WIDTH = "mx-auto w-full max-w-[1440px] px-[clamp(20px,5vw,72px)]";
const pesoDigits = (n: number) => n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * "Every peso has somewhere it has to be." The demo program's funded total and the five places it can be, on a dark
 * slab with depth. The server renders the finished ledger (bar full, figures final, Balanced shown), so nothing waits
 * on JavaScript. On first sight the slab stands up, the bar fills, the figures count up and the equation lights in
 * turn; afterwards it tilts a few degrees toward a mouse. Hovering or focusing a place lights it in the bar, the list
 * and the equation together. Under reduced motion, and on touch, it stays flat and finished.
 */
export function LedgerSection({
  funded,
  fundedLabel,
  caption,
  parts,
}: {
  funded: number;
  fundedLabel: string;
  /** What was funded, e.g. "Demo program funded, 3 cards × ₱1,500.00". */
  caption: string;
  parts: LedgerPart[];
}) {
  const reduce = useReducedMotion();
  const book = useRef<HTMLDivElement>(null);
  const figures = useRef<Array<HTMLSpanElement | null>>([]);
  // "done": the finished ledger (server render, reduced motion). "start": emptied, about to play. "play": playing.
  const [phase, setPhase] = useState<"done" | "start" | "play">("done");
  const [focus, setFocus] = useState<number | null>(null);
  const [tracking, setTracking] = useState(false);
  const played = useRef(false);
  const settle = useRef(0);

  const play = useCallback(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    window.clearTimeout(settle.current);
    setPhase("start");
    // Two frames in the emptied state, so the fill and the stand-up run as transitions.
    requestAnimationFrame(() => requestAnimationFrame(() => setPhase("play")));
    // Once the last term and Balanced have landed (ledger.css: 1850ms + 6 × 180ms + 600ms), drop back to "done", so the
    // entrance delays never slow down hovering afterwards.
    settle.current = window.setTimeout(() => setPhase("done"), 3600);
    const values = [funded, ...parts.map((p) => p.pesos)];
    figures.current.forEach((el, i) => {
      if (el === null) return;
      const to = values[i], ms = i === 0 ? 1400 : 1200 + i * 220, t0 = performance.now();
      requestAnimationFrame(function tick(now) {
        const t = Math.min(1, (now - t0) / ms), eased = 1 - Math.pow(1 - t, 4);
        el.textContent = pesoDigits(Math.round(to * eased * 100) / 100);
        if (t < 1) requestAnimationFrame(tick);
      });
    });
  }, [funded, parts]);

  useEffect(() => {
    const el = book.current;
    if (el === null) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || played.current) return;
        played.current = true;
        observer.disconnect();
        play();
      },
      { threshold: 0.25 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      window.clearTimeout(settle.current);
    };
  }, [play]);

  const onPointerMove = (e: PointerEvent) => {
    const el = book.current;
    if (el === null || reduce || e.pointerType !== "mouse" || phase === "start") return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--ry", `${((x - 0.5) * 7).toFixed(2)}deg`);
    el.style.setProperty("--rx", `${((0.5 - y) * 5).toFixed(2)}deg`);
    el.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
    el.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
    if (!tracking) setTracking(true);
  };
  const onPointerLeave = () => {
    book.current?.style.setProperty("--rx", "0deg");
    book.current?.style.setProperty("--ry", "0deg");
    setTracking(false);
  };

  const lit = (i: number) => (focus === null ? undefined : focus === i ? "on" : "off");
  const terms = parts.length + 1;

  return (
    <section id="ledger" className="ldg" aria-labelledby="ledger-h">
      <div className={`${PAGE_WIDTH} py-24 lg:pt-[104px] lg:pb-12`}>
        <div className="ldg-head">
          <h2 id="ledger-h" className="ldg-h font-serif-soft">
            Every peso has somewhere it has to be.
          </h2>
          <p className="ldg-lead">
            Every peso funded is spent, held, pending, in escrow or returned. The dashboard checks that sum from the database and chain reads, and the COA
            export puts a tx hash behind every line.
          </p>
        </div>

        <div className="ldg-stage" onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
          <div ref={book} className="ldg-book" data-phase={phase} data-tracking={tracking ? "" : undefined} data-focus={focus === null ? undefined : ""}>
            <div className="ldg-top">
              <div>
                <p className="ldg-k">{caption}</p>
                <p className="ldg-funded font-serif-soft">
                  ₱
                  <span
                    ref={(el) => {
                      figures.current[0] = el;
                    }}
                  >
                    {fundedLabel.replace("₱", "")}
                  </span>
                </p>
              </div>
              <button type="button" className="ldg-replay" onClick={play}>
                <span aria-hidden="true">↻</span> Replay
              </button>
            </div>

            <div
              className="ldg-bar"
              role="img"
              aria-label={`Funded ${fundedLabel} split into ${parts.map((p) => `${p.name.toLowerCase()} ${p.label}`).join(", ")}.`}
            >
              {parts.map((p, i) =>
                p.pesos === 0 ? null : (
                  <i
                    key={p.name}
                    className="ldg-seg"
                    data-lit={lit(i)}
                    style={{ "--w": (p.pesos / funded) * 100, "--i": i, "--c": p.color } as CSSProperties}
                    onMouseEnter={() => setFocus(i)}
                    onMouseLeave={() => setFocus(null)}
                  />
                ),
              )}
            </div>

            <ul className="ldg-items">
              {parts.map((p, i) => (
                <li
                  key={p.name}
                  tabIndex={0}
                  className="ldg-item"
                  data-lit={lit(i)}
                  data-zero={p.pesos === 0 ? "" : undefined}
                  style={{ "--c": p.color } as CSSProperties}
                  onMouseEnter={() => setFocus(i)}
                  onMouseLeave={() => setFocus(null)}
                  onFocus={() => setFocus(i)}
                  onBlur={() => setFocus(null)}
                >
                  <p className="ldg-name">
                    <i aria-hidden="true" />
                    {p.name}
                  </p>
                  <p className="ldg-val font-serif-soft">
                    ₱
                    <span
                      ref={(el) => {
                        figures.current[i + 1] = el;
                      }}
                    >
                      {p.label.replace("₱", "")}
                    </span>
                  </p>
                  <p className="ldg-why">{p.why}</p>
                </li>
              ))}
            </ul>

            <p className="ldg-eq" aria-label="Funded equals spent plus held plus pending plus escrow plus returned. Balanced.">
              <span className="ldg-term" style={{ "--n": 0 } as CSSProperties} aria-hidden="true">
                Funded
              </span>
              <span className="ldg-op" aria-hidden="true">
                =
              </span>
              {parts.map((p, i) => (
                <span key={p.name} className="contents" aria-hidden="true">
                  {i > 0 ? <span className="ldg-op">+</span> : null}
                  <span
                    className="ldg-term"
                    data-lit={lit(i)}
                    style={{ "--n": i + 1, "--c": p.color } as CSSProperties}
                    onMouseEnter={() => setFocus(i)}
                    onMouseLeave={() => setFocus(null)}
                  >
                    {p.name.toLowerCase()}
                  </span>
                </span>
              ))}
              <span className="ldg-ok" style={{ "--n": terms } as CSSProperties} aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="10" cy="10" r="8.5" />
                  <path d="M6 10.4l2.6 2.6L14 7.6" />
                </svg>
                Balanced
              </span>
            </p>
          </div>
        </div>

        <div className="ldg-close">
          <p>Run the whole loop yourself on a laptop or a phone. No NFC card needed: Simulate tap stands in for the tap.</p>
          <div className="ldg-actions">
            <Link href="/login" prefetch={false} className="ldg-btn">
              Open the app <span aria-hidden="true">→</span>
            </Link>
            <Link href="/demo" prefetch={false} className="ldg-link">
              Run the agent demo <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
