import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { DEFAULT_PHP_PER_XLM, phpToStroops, TAP_REASON_LABELS } from "@tapat/shared";
import { php } from "@/lib/format";
import { Icon, type IconName } from "./(app)/_components/Icon";
import { Specimen, type SpecimenId } from "./_landing/Specimens";
import { LazyBandMotion, SpecimenReel } from "./_landing/Reel";
import { TapDemo, type TapChoice } from "./_landing/TapDemo";
import { Cta, Stamp, TearEdge, type ChipTone } from "./_landing/kit";

export const metadata: Metadata = {
  title: "TAPat: fuel aid that can say no",
  description: "An AI agent funds, caps, and returns fuel aid for tricycle drivers, with the limits enforced on-chain.",
};

const PAGE_WIDTH = "mx-auto w-full max-w-[1440px] px-[clamp(20px,5vw,72px)]";

/** Sample pesos in the app's "PHP 1,234.00" form, through the same stroop formatter as the dashboard. */
const money = (pesos: number) => php(phpToStroops(pesos), DEFAULT_PHP_PER_XLM);

/** Azeret Mono has no ₱ glyph, so mono text spells it out. */
const azeret = (label: string) => label.replace("₱", "PHP ");

const TAP_CHOICES: TapChoice[] = [
  {
    id: "ok",
    button: money(300),
    amount: money(300),
    card: "Ana V. …A1B2",
    last4: "A1B2",
    verdict: "approved",
    reason: null,
    note: "Authorized by the Noir contract.",
  },
  {
    id: "over",
    button: money(800),
    amount: money(800),
    card: "Juan D. …9C7E",
    last4: "9C7E",
    verdict: "declined",
    reason: azeret(TAP_REASON_LABELS.OVER_CAP),
    note: "Rejected by the Noir contract. No tx submitted.",
  },
  {
    id: "expired",
    button: "Expired card",
    amount: money(200),
    card: "Pedro R. …3A54",
    last4: "3A54",
    verdict: "declined",
    reason: azeret(TAP_REASON_LABELS.EXPIRED),
    note: "Rejected by the Noir contract. No tx submitted.",
  },
];

/** The sample program the receipt follows. */
const LEDGER = { funded: 4500, spent: 350, held: 960, pending: 0, escrow: 0, returned: 3190 };
const balanced = LEDGER.spent + LEDGER.held + LEDGER.pending + LEDGER.escrow + LEDGER.returned === LEDGER.funded;

const STEPS = [
  {
    id: "list",
    chip: ["outline", "CLEANED"],
    title: "A clean list goes in.",
    body: "Ghost and duplicate drivers come off the masterlist. Only the uncertain ones get one Telegram message asking for evidence.",
    facts: [
      ["5%", "max wrongful denials"],
      ["2%", "max ghost admissions"],
    ],
  },
  {
    id: "enroll",
    chip: ["outline", "ENROLLED"],
    title: "Enrolled in a minute.",
    body: "A TODA officer taps one NFC card and its spending policy goes on-chain. The driver needs no app and no data plan.",
    facts: [
      ["1 card", "is all a driver carries"],
      ["Telegram", "delivers the receipts"],
    ],
  },
  {
    id: "fund",
    chip: ["mint", "FUNDED"],
    title: "Fund, when the shift is real.",
    body: "The agent releases aid only when the diesel price stays above the threshold, inside a budget Velo has verified. A one-day spike releases nothing.",
    facts: [
      ["PHP 65", "per litre threshold"],
      ["PHP 1,500", "per card"],
    ],
  },
  {
    id: "refuse",
    chip: ["danger", "DECLINED"],
    title: "Refuse, before money moves.",
    body: "Over the cap or past its expiry, a tap gets a no from the contract. A refused tap writes nothing to the chain.",
    facts: [
      ["PHP 500", "per-tap cap"],
      ["0 tx", "on a refusal"],
    ],
  },
  {
    id: "freeze",
    chip: ["frozen", "FROZEN"],
    title: "Freeze the station, not the program.",
    body: "When a tap pattern looks wrong, only that station stops. New taps are refused and its settlement is held until the LGU unfreezes it.",
    facts: [
      ["MIDAS-F", "scores every tap"],
      ["1 station", "paused, the rest keep pumping"],
    ],
  },
  {
    id: "return",
    chip: ["accent", "RETURNED"],
    title: "Return what's left, the same day.",
    body: "When the program ends, every card is revoked and its unspent aid goes back to the LGU wallet.",
    facts: [
      ["Same day", "not a year later at audit"],
      ["1 CSV", "with a tx hash for the COA"],
    ],
  },
] satisfies Array<{ id: SpecimenId; chip: [ChipTone, string]; title: string; body: string; facts: Array<[string, string]> }>;

const STAKES = [
  { figure: "2.7B", peso: true, what: "nearly lost to ghost beneficiaries", source: "DSWD, via Daily Tribune", answer: "Ghosts come off before anyone enrolls." },
  { figure: "709.88M", peso: true, what: "in subsidies unpaid or expired", source: "COA, via Astig.ph and NET25", answer: "Unspent aid returns the same day." },
  { figure: "723,000", peso: false, what: "tricycle drivers slated for aid", source: "PNA", answer: "One minute to enroll, then a tap at the pump." },
];

const ENFORCEMENT: Array<[string, string, IconName]> = [
  ["Fund", "payment_escrow.fund_escrow()", "wallet"],
  ["Refuse", "payment_escrow.authorize()", "close"],
  ["Freeze", "API skips payment_escrow.claim()", "pause"],
  ["Return", "payment_escrow.sweep_on_revoke()", "refresh"],
];

/** One line per event in the sample program; `step` ties the line to the loop step that prints it. */
const RECEIPT_LINES: Array<{ step: 1 | 2 | 3 | 4 | 5 | 6; code: string; what: string; amount: string; stamp?: [ChipTone, string] }> = [
  { step: 1, code: "01 INTAKE", what: "12 rows checked · 2 ghosts out", amount: "—" },
  { step: 2, code: "02 ENROLL", what: "Ana V. …A1B2 · policy on-chain", amount: "—" },
  { step: 3, code: "03 FUND", what: `3 cards × ${money(1500)}`, amount: `+${money(4500)}`, stamp: ["mint", "FUNDED"] },
  { step: 4, code: "04 TAP", what: "Station A · Ana V. …A1B2", amount: `−${money(350)}`, stamp: ["accent", "PAID"] },
  { step: 4, code: "04 TAP", what: "Station A · Juan D. …9C7E · over cap · 0 tx", amount: money(800), stamp: ["danger", "DECLINED"] },
  { step: 5, code: "05 FREEZE", what: "Rotonda Fuels · MIDAS 2.31 ≥ 1.78", amount: money(960), stamp: ["frozen", "HELD"] },
  { step: 6, code: "06 RETURN", what: "3 cards revoked · swept to LGU", amount: money(3190), stamp: ["accent", "RETURNED"] },
];

const TOTALS: Array<[string, number]> = [
  ["Funded", LEDGER.funded],
  ["Spent", LEDGER.spent],
  ["Held", LEDGER.held],
  ["Pending", LEDGER.pending],
  ["Escrow", LEDGER.escrow],
  ["Returned", LEDGER.returned],
];

const EQUATION = ["Funded", "=", "spent", "+", "held", "+", "pending", "+", "escrow", "+", "returned"];

function Logo({ priority = false }: { priority?: boolean }) {
  return (
    <span className="block h-11 w-[88px] shrink-0 overflow-hidden">
      {/* The icon file is square with wide margins; this slot shows its middle band, as in the app's top bar. */}
      <Image src="/tapat-app-icon-1024.png" alt="" width={88} height={88} className="-mt-[22px] max-w-none mix-blend-darken" priority={priority} />
    </span>
  );
}

function Actions() {
  return (
    <div className="flex flex-wrap gap-3">
      <Cta href="/login" look="accent">
        Open the app
      </Cta>
      <Cta href="/demo" look="outline">
        Run the agent demo
      </Cta>
    </div>
  );
}

const stagger = (i: number) => ({ "--i": i }) as CSSProperties;

const TICKER: Array<{ text: string; stamp: [ChipTone, string] }> = [
  { text: `Station A · Ana V. …A1B2 · ${money(300)}`, stamp: ["accent", "PAID"] },
  { text: `Station A · Juan D. …9C7E · ${money(800)} · 0 tx`, stamp: ["danger", "DECLINED"] },
  { text: "Station A · Pedro R. …3A54 · card expired", stamp: ["danger", "DECLINED"] },
  { text: `Rotonda Fuels · ${money(960)}`, stamp: ["frozen", "HELD"] },
  { text: `LGU wallet · ${money(3190)}`, stamp: ["accent", "RETURNED"] },
];

/** One pass of the sample feed. The marquee shows two; the second is hidden from assistive tech. */
function TickerCopy({ hidden = false }: { hidden?: boolean }) {
  return (
    <ul aria-hidden={hidden || undefined} className="ticker-copy">
      {TICKER.map((e) => (
        <li key={e.text} className="flex items-center gap-3 py-3 font-mono text-mono whitespace-nowrap">
          <span>{e.text}</span>
          <Stamp tone={e.stamp[0]}>{e.stamp[1]}</Stamp>
        </li>
      ))}
    </ul>
  );
}

export default function Landing() {
  return (
    <div className="landing">
      <header className="sticky top-0 z-40 border-b-[1.5px] border-text bg-surface">
        <div className={`${PAGE_WIDTH} flex h-16 items-center justify-between gap-6`}>
          <Link href="/" aria-label="TAPat" className="block">
            <Logo />
          </Link>
          <nav aria-label="Sections" className="hidden items-center gap-6 md:flex">
            <a href="#loop" className="text-label underline-offset-4 hover:underline">
              How it works
            </a>
            <a href="#stakes" className="text-label underline-offset-4 hover:underline">
              Why
            </a>
            <a href="#contract" className="text-label underline-offset-4 hover:underline">
              Contract
            </a>
          </nav>
          <Cta href="/login" look="primary" size="sm">
            Open the app
          </Cta>
        </div>
      </header>

      <main>
        <section id="top" className="hero relative overflow-clip bg-primary-deep text-surface">
          <LazyBandMotion art="top" motif="text-pressed" />
          <div className={`${PAGE_WIDTH} relative grid items-center gap-12 py-16 lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-12 lg:py-20`}>
            <div className="hero-copy flex flex-col gap-7 lg:col-span-7">
              <h1 className="landing-display" style={stagger(1)}>
                Fuel aid that can say{" "}
                <span className="relative inline-block">
                  no.
                  <svg
                    aria-hidden="true"
                    className="hero-no-mark absolute bottom-[0.02em] left-0 h-[0.14em] w-full overflow-visible"
                    viewBox="0 0 100 12"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M2 8 C 30 2, 62 12, 98 4"
                      fill="none"
                      className="stroke-declined"
                      strokeWidth="5"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                </span>
              </h1>
              <p className="landing-lead max-w-[46ch]" style={stagger(2)}>
                An AI agent funds, caps, and returns fuel aid for tricycle drivers. The limits are enforced on-chain.
              </p>
              <div style={stagger(3)}>
                <Actions />
              </div>
              <p className="text-small" style={stagger(4)}>
                Log in or create an officer account to try it.
              </p>
            </div>
            <div className="lg:col-span-5">
              <TapDemo choices={TAP_CHOICES} autoplay="over" />
            </div>
          </div>
        </section>

        <section aria-label="Sample feed" className="ticker flex border-y-[1.5px] border-text bg-text text-surface">
          <p className="z-10 flex shrink-0 items-center border-r-[1.5px] border-surface/40 bg-text px-4 text-label whitespace-nowrap sm:px-6">SAMPLE FEED</p>
          <div className="ticker-track">
            <TickerCopy />
            <TickerCopy hidden />
          </div>
        </section>

        <section id="loop" className="loop relative border-t-[1.5px] border-text bg-sunken">
          <div className={`${PAGE_WIDTH} py-20 lg:py-28`}>
            <div className="landing-reveal flex max-w-3xl flex-col gap-5">
              <h2 className="landing-h2">Six steps. One receipt.</h2>
              <p className="landing-lead">Follow one sample program from the masterlist to the money coming back. The receipt on the right has to balance.</p>
            </div>

            <div className="mt-14 grid gap-12 lg:grid-cols-12 lg:items-start">
              <ol className="loop-steps lg:col-span-7">
                {STEPS.map((step, i) => (
                  <li
                    key={step.id}
                    id={step.id}
                    className="loop-step relative isolate flex flex-col justify-center gap-6 border-t-[1.5px] border-text py-14 lg:min-h-[85vh]"
                  >
                    <span aria-hidden="true" className="loop-numeral pointer-events-none absolute top-8 right-0 -z-10 font-semibold select-none">
                      {`0${i + 1}`}
                    </span>
                    <div className="flex items-center gap-3">
                      <Stamp tone={step.chip[0]}>{step.chip[1]}</Stamp>
                    </div>
                    <h3 className="landing-step landing-reveal">{step.title}</h3>
                    <p className="landing-lead landing-reveal max-w-[52ch]">{step.body}</p>
                    <div className="landing-reveal">
                      <SpecimenReel id={step.id}>
                        <Specimen id={step.id} />
                      </SpecimenReel>
                    </div>
                    <dl className="landing-reveal max-w-md font-mono text-[14px]">
                      {step.facts.map(([value, label]) => (
                        <div key={value} className="flex justify-between gap-4 border-b border-text/20 py-2">
                          <dt className="font-sans text-small">{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </li>
                ))}
              </ol>

              <aside aria-label="Sample program receipt" className="lg:sticky lg:top-24 lg:col-span-5">
                <div aria-hidden="true" className="mx-[-12px] h-3 rounded-full bg-text" />
                <div className="flex flex-col gap-3 border-[1.5px] border-t-0 border-b-0 border-text bg-raised p-4 font-mono text-mono">
                  <div className="flex items-center justify-between gap-3">
                    <Logo />
                    <div className="flex flex-col items-end gap-1 text-right">
                      <p className="flex items-center gap-2">
                        RECEIPT
                        <Stamp tone="outline">SAMPLE DATA</Stamp>
                      </p>
                      <p>TODA Fuel Aid — San Roque</p>
                    </div>
                  </div>
                  <hr className="border-t-[1.5px] border-dashed border-text" />
                  <ol className="flex flex-col">
                    {RECEIPT_LINES.map((line) => (
                      <li
                        key={`${line.code}-${line.what}`}
                        data-step={line.step}
                        data-tone={line.stamp?.[0] ?? "mint"}
                        className="receipt-line grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-1 border-b border-ring-surface px-2 py-1.5"
                      >
                        <span className="font-medium">{line.code}</span>
                        <span className="row-span-2 row-start-1 col-start-2">{line.what}</span>
                        <span className="col-start-3 row-start-1 text-right tabular-nums">{line.amount}</span>
                        {line.stamp === undefined ? null : (
                          <span className="col-start-3 row-start-2 justify-self-end">
                            <Stamp tone={line.stamp[0]}>{line.stamp[1]}</Stamp>
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                  <hr className="border-t-[1.5px] border-dashed border-text" />
                  <div className="receipt-total flex flex-col">
                    <dl className="flex flex-col">
                      {TOTALS.map(([label, pesos]) => (
                        <div key={label} className="flex justify-between py-0.5">
                          <dt>{label}</dt>
                          <dd className="tabular-nums">{money(pesos)}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="mt-2 flex items-center justify-between gap-4">
                      <span>Funded = spent + held + pending + escrow + returned</span>
                      <Stamp tone={balanced ? "mint" : "danger"}>{balanced ? "BALANCED" : "MISMATCH"}</Stamp>
                    </div>
                  </div>
                </div>
                <TearEdge />
              </aside>
            </div>
          </div>
        </section>

        <section id="stakes" className="bg-text text-surface">
          <div className={`${PAGE_WIDTH} flex flex-col gap-12 py-20 lg:py-28`}>
            <h2 className="landing-h2 landing-reveal max-w-3xl">Safe and slow, or fast and leaky.</h2>
            <ul>
              {STAKES.map((row) => (
                <li key={row.figure} className="landing-reveal grid gap-4 border-t-[1.5px] border-surface/40 py-10 lg:grid-cols-[5fr_4fr_3fr] lg:items-end">
                  <p className="landing-figure">
                    {row.peso ? <span className="mr-2 font-mono text-[0.3em] font-medium tracking-normal">PHP</span> : null}
                    {row.figure}
                  </p>
                  <p className="text-[17px] leading-normal">
                    {row.what} <span className="text-small text-mint">({row.source})</span>
                  </p>
                  <p className="text-[17px] leading-normal font-medium text-accent">{row.answer}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="contract" className="border-t-[1.5px] border-text bg-surface">
          <div className={`${PAGE_WIDTH} flex flex-col gap-12 py-20 lg:py-28`}>
            <h2 className="landing-h2 landing-reveal max-w-4xl">The agent decides. The contract has the last word.</h2>
            <ul className="border-b-[1.5px] border-text">
              {ENFORCEMENT.map(([decision, call, icon]) => (
                <li key={decision} className="landing-reveal grid gap-3 border-t-[1.5px] border-text py-7 md:grid-cols-[1fr_2fr] md:items-center md:gap-8">
                  <h3 className="flex items-center gap-3 text-h2">
                    <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-full bg-mint text-primary">
                      <Icon name={icon} />
                    </span>
                    <span className="relative">
                      {decision}
                      <span aria-hidden="true" className="contract-rule absolute -bottom-1 left-0 h-[3px] w-full origin-left bg-primary" />
                    </span>
                  </h3>
                  <p className="font-mono text-mono [overflow-wrap:anywhere]">{call}</p>
                </li>
              ))}
            </ul>
            <p className="landing-reveal text-small">Velo verifies the budget and sponsors the fees. Per-tap limits are Noir&apos;s.</p>
          </div>
        </section>

        <section className="close-band relative overflow-clip bg-primary-deep text-surface">
          <LazyBandMotion art="close" motif="text-pressed" />
          <div className={`${PAGE_WIDTH} relative flex flex-col gap-8 py-24 lg:py-32`}>
            <h2 className="landing-h2 landing-reveal max-w-4xl">Every peso has somewhere it has to be.</h2>
            <p className="landing-reveal flex flex-wrap items-center gap-2 font-mono text-[clamp(16px,1.8vw,24px)]">
              {EQUATION.map((term, i) =>
                term === "=" || term === "+" ? (
                  <span key={i}>{term}</span>
                ) : (
                  <span key={i} className="eq-term rounded-sm border-[1.5px] px-2 py-1" style={{ "--t": i / 2 } as CSSProperties}>
                    {term}
                  </span>
                ),
              )}
              <span className="eq-stamp" style={{ "--t": EQUATION.length / 2 } as CSSProperties}>
                <Stamp tone={balanced ? "mint" : "danger"}>{balanced ? "BALANCED" : "MISMATCH"}</Stamp>
              </span>
            </p>
            <p className="landing-lead landing-reveal max-w-[52ch]">
              Run the whole loop yourself on a laptop or a phone. No NFC card needed: Simulate card stands in for the tap.
            </p>
            <div className="landing-reveal">
              <Actions />
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-text py-8 text-surface">
        <p className={`${PAGE_WIDTH} text-caption`}>
          Prototype on Stellar Testnet at a demo rate. Limits shown are the demo program&apos;s. The tap terminal and receipt use sample data; price and MIDAS-F
          series are simulated; intake results are precomputed. Motion rendered with Remotion from sample data.
        </p>
      </footer>
    </div>
  );
}
