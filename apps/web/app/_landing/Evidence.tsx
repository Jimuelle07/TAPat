import type { CSSProperties } from "react";
import { CountUp } from "./CountUp";
import { PlayOnce } from "./PlayOnce";
import "./evidence.css";

const PAGE_WIDTH = "mx-auto w-full max-w-[1440px] px-[clamp(20px,5vw,72px)]";

export type StakeRow = { label: string; figure: string; peso: boolean; what: string; source: string; answer: string };

/** Each clipping hangs a little differently from its pin: width, drop, tilt, and how it leans in 3D. */
const CLIPPING = [
  { basis: "lg:flex-[0_1_400px]", drop: "lg:mt-0", tilt: "-1.4deg", rx: "6deg", ry: "-5deg", note: "1.8deg" },
  { basis: "lg:flex-[0_1_360px]", drop: "lg:mt-[84px]", tilt: "1deg", rx: "7deg", ry: "2deg", note: "-2deg" },
  { basis: "lg:flex-[0_1_296px]", drop: "lg:mt-6", tilt: "-0.6deg", rx: "10deg", ry: "8deg", note: "1.4deg" },
];

export function StakesSection({ rows }: { rows: StakeRow[] }) {
  return (
    <section id="stakes" className="overflow-x-clip bg-[#14231d] text-cream">
      <div className={`${PAGE_WIDTH} flex flex-col gap-16 py-20 lg:py-28`}>
        <div className="landing-reveal flex flex-wrap items-end justify-between gap-6">
          <h2 className="landing-h2 max-w-3xl">
            Safe and slow, or fast and <span className="text-accent">leaky.</span>
          </h2>
          <p className="max-w-[34ch] text-[18px] leading-normal text-cream/85">
            Every aid program picks one. These are the leaks on record, and the rule TAPat puts against each.
          </p>
        </div>
        <PlayOnce className="stake-board">
          <ul className="flex flex-col items-center gap-16 lg:flex-row lg:items-start lg:gap-10">
            {rows.map((row, i) => {
              const slot = CLIPPING[i % CLIPPING.length];
              return (
                <li
                  key={row.figure}
                  className={`w-full max-w-[420px] lg:max-w-none ${slot.basis} ${slot.drop}`}
                  style={{ rotate: slot.tilt, "--n": i } as CSSProperties}
                >
                  <div className="stake-clip" style={{ "--rx": slot.rx, "--ry": slot.ry } as CSSProperties}>
                    <span aria-hidden="true" className="stake-pin" />
                    <div className="stake-paper">
                      <p className="stake-label">{row.label}</p>
                      <p className="stake-figure">
                        {row.peso ? <span className="peso">₱</span> : null}
                        <CountUp final={row.figure} />
                      </p>
                      <p className="mt-3.5 text-[17px] leading-normal">{row.what}</p>
                      <p className="mt-4 w-fit max-w-full border-[1.5px] border-dashed border-text px-2 py-1 font-mono text-caption [overflow-wrap:anywhere]">
                        <span className="sr-only">Source: </span>
                        {row.source}
                      </p>
                    </div>
                  </div>
                  <p className="stake-note" style={{ rotate: slot.note }}>
                    <span className="mr-1.5 font-mono text-caption font-semibold">TAPat:</span>
                    <span className="font-medium">{row.answer}</span>
                  </p>
                </li>
              );
            })}
          </ul>
        </PlayOnce>
      </div>
    </section>
  );
}
