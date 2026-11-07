import type { ReactNode } from "react";
import { SpecimenReel } from "./Reel";
import { Specimen, type SpecimenId } from "./Specimens";
import { Nums, Stamp, type ChipTone } from "./kit";
import "./steps.css";

export type LoopStep = { id: SpecimenId; chip: [ChipTone, string]; title: string; body: string; facts: Array<[string, string]> };

/** Facts keep their value/label pairs; each step dresses them as its own artifact. The value is shown first. */
function Facts({ facts }: { facts: Array<[string, string]> }) {
  return (
    <dl className="step-facts">
      {facts.map(([value, label]) => (
        <div key={value} className="step-fact">
          <dt>{label}</dt>
          <dd>
            <Nums>{value}</Nums>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Drawing({ id }: { id: SpecimenId }) {
  return (
    <SpecimenReel id={id}>
      <Specimen id={id} />
    </SpecimenReel>
  );
}

function PauseGlyph() {
  return (
    <svg aria-hidden="true" className="step-pause" viewBox="0 0 48 48" fill="none">
      <rect x="2" y="2" width="44" height="44" rx="10" stroke="currentColor" strokeWidth="1.5" />
      <rect x="15" y="13" width="6" height="22" rx="2" fill="currentColor" />
      <rect x="27" y="13" width="6" height="22" rx="2" fill="currentColor" />
    </svg>
  );
}

/** The step's artifact: the specimen plus its facts, built as the object the step is about. */
function Artifact({ step }: { step: LoopStep }): ReactNode {
  switch (step.id) {
    case "list":
      return (
        <div className="step-art step-ledger">
          <Drawing id="list" />
          <p className="step-ledger-note">precomputed</p>
          <Facts facts={step.facts} />
        </div>
      );
    case "enroll":
      return (
        <div className="step-art step-nfc">
          <div className="step-nfc-card">
            <Drawing id="enroll" />
          </div>
          <Facts facts={step.facts} />
        </div>
      );
    case "fund":
      return (
        <div className="step-art step-board">
          <div className="step-board-window">
            <Drawing id="fund" />
          </div>
          <Facts facts={step.facts} />
        </div>
      );
    case "refuse":
      return (
        <div className="step-art step-stub">
          <Drawing id="refuse" />
          <Facts facts={step.facts} />
          <span aria-hidden="true" className="step-rubber">
            {step.chip[1]}
          </span>
        </div>
      );
    case "freeze":
      return (
        <div className="step-art step-sign">
          <PauseGlyph />
          <div className="step-sign-window">
            <Drawing id="freeze" />
          </div>
          <Facts facts={step.facts} />
        </div>
      );
    case "return":
      return (
        <div className="step-art step-wallet">
          <div aria-hidden="true" className="step-coins">
            <i />
            <i />
            <i />
          </div>
          <div className="step-slip">
            <Drawing id="return" />
            <Facts facts={step.facts} />
          </div>
        </div>
      );
  }
}

export function LoopSteps({ steps }: { steps: LoopStep[] }) {
  return (
    <ol className="loop-steps lg:col-span-7">
      {steps.map((step, i) => (
        <li
          key={step.id}
          id={step.id}
          className={`loop-step step step-${step.id} ${i % 2 ? "step-flip" : ""} flex flex-col justify-center gap-7 py-14 lg:min-h-[85vh]`}
        >
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="step-no">
              {String(i + 1).padStart(2, "0")}
            </span>
            <Stamp tone={step.chip[0]}>{step.chip[1]}</Stamp>
          </div>
          <div className="step-text landing-reveal flex flex-col gap-5">
            <h3 className="landing-step">{step.title}</h3>
            <p className="landing-lead max-w-[52ch]">{step.body}</p>
          </div>
          <div className="step-visual landing-reveal">
            <Artifact step={step} />
          </div>
        </li>
      ))}
    </ol>
  );
}
