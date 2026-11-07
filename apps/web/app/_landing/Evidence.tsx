import type { CSSProperties } from "react";
import { Icon, type IconName } from "../(app)/_components/Icon";
import { CountUp } from "./CountUp";
import { Stamp, type ChipTone } from "./kit";
import "./evidence.css";

const PAGE_WIDTH = "mx-auto w-full max-w-[1440px] px-[clamp(20px,5vw,72px)]";

export type StakeRow = { figure: string; peso: boolean; what: string; source: string; answer: string };

/** Each clipping sits a little differently on the board: width, drop, tilt. */
const CLIPPING = [
  { span: "lg:col-span-5 lg:col-start-1", drop: "lg:mt-0", tilt: "-1.4deg", note: "1.8deg" },
  { span: "lg:col-span-4 lg:col-start-6", drop: "lg:mt-20", tilt: "1deg", note: "-2deg" },
  { span: "lg:col-span-3 lg:col-start-10", drop: "lg:mt-6", tilt: "-0.6deg", note: "1.4deg" },
];

export function StakesSection({ rows }: { rows: StakeRow[] }) {
  return (
    <section id="stakes" className="overflow-x-clip bg-text text-surface">
      <div className={`${PAGE_WIDTH} flex flex-col gap-14 py-20 lg:py-28`}>
        <h2 className="landing-h2 landing-reveal max-w-3xl">Safe and slow, or fast and leaky.</h2>
        <ul className="grid gap-14 lg:grid-cols-12 lg:items-start lg:gap-x-8 lg:gap-y-0">
          {rows.map((row, i) => {
            const slot = CLIPPING[i % CLIPPING.length];
            return (
              <li key={row.figure} className={`landing-reveal relative ${slot.span} ${slot.drop}`}>
                <div className="clipping-wrap" style={{ "--tilt": slot.tilt } as CSSProperties}>
                  <span aria-hidden="true" className="clipping-pin" />
                  <div className="clipping bg-raised px-6 pt-9 pb-10 text-text">
                    <p className="landing-figure clipping-figure">
                      {row.peso ? <span className="mr-2 font-mono text-[0.3em] font-medium tracking-normal">PHP</span> : null}
                      <CountUp final={row.figure} />
                    </p>
                    <p className="mt-4 text-[17px] leading-normal">{row.what}</p>
                    <p className="mt-5 w-fit max-w-full border-[1.5px] border-dashed border-text px-2 py-1 font-mono text-caption [overflow-wrap:anywhere]">
                      <span className="sr-only">Source: </span>
                      {row.source}
                    </p>
                  </div>
                </div>
                <p className="stakes-note ml-auto -mt-5 w-[88%] bg-accent px-4 py-3 text-[17px] leading-normal text-text" style={{ "--tilt": slot.note } as CSSProperties}>
                  <span className="mr-2 font-mono text-caption font-medium">TAPat:</span>
                  <span className="font-medium">{row.answer}</span>
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/** Stamp that lands on a row when it is hovered or focused: the contract overruling (or holding) the agent. */
const VERDICT: Record<string, { tone: ChipTone; word: string }> = {
  Fund: { tone: "mint", word: "ENFORCED" },
  Refuse: { tone: "danger", word: "ENFORCED" },
  Freeze: { tone: "frozen", word: "HELD" },
  Return: { tone: "accent", word: "ENFORCED" },
};

export function ContractSection({ rows }: { rows: Array<[string, string, IconName]> }) {
  return (
    <section id="contract" className="border-t-[1.5px] border-text bg-surface">
      <div className={`${PAGE_WIDTH} flex flex-col gap-12 py-20 lg:py-28`}>
        <h2 className="landing-h2 landing-reveal max-w-4xl">The agent decides. The contract has the last word.</h2>
        <ul className="border-b-[1.5px] border-text">
          {rows.map(([decision, call, icon], i) => {
            const verdict = VERDICT[decision] ?? { tone: "outline" as ChipTone, word: "ENFORCED" };
            return (
              <li
                key={decision}
                className="duel landing-reveal relative grid items-center gap-4 border-t-[1.5px] border-text py-8 md:grid-cols-[5fr_auto_7fr] md:gap-0"
              >
                <h3 className="duel-slip w-fit bg-accent-tint px-5 text-h2" style={{ "--tilt": i % 2 ? "1.2deg" : "-1.2deg" } as CSSProperties}>
                  {decision}
                </h3>
                <span aria-hidden="true" className="duel-rule hidden h-[1.5px] w-16 bg-text md:block lg:w-28" />
                <p className="duel-call bg-text px-5 py-4 font-mono text-mono text-surface [overflow-wrap:anywhere]">
                  <span aria-hidden="true" className="mr-2 text-accent">
                    &gt;
                  </span>
                  {call}
                </p>
                <span className="duel-stamp pointer-events-none justify-self-end pr-1 pb-1 md:absolute md:right-6 md:-bottom-4 md:justify-self-auto md:p-0">
                  <Stamp tone={verdict.tone}>
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden="true">
                        <Icon name={icon} />
                      </span>
                      {verdict.word}
                    </span>
                  </Stamp>
                </span>
              </li>
            );
          })}
        </ul>
        <p className="landing-reveal text-small">Velo verifies the budget and sponsors the fees. Per-tap limits are Noir&apos;s.</p>
      </div>
    </section>
  );
}
