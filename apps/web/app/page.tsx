import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Inter } from "next/font/google";
import localFont from "next/font/local";
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { DEFAULT_PHP_PER_XLM, phpToStroops, TAP_REASON_LABELS } from "@tapat/shared";
import { php } from "@/lib/format";
import type { IconName } from "./(app)/_components/Icon";
import { ContractSection, StakesSection } from "./_landing/Evidence";
import { ScrollGauge, StepRail } from "./_landing/Navigator";
import { LazyBandMotion } from "./_landing/Reel";
import { LoopSteps, type LoopStep } from "./_landing/Steps";
import { TapStage, type StageChoice } from "./_landing/TapStage";
import { Cta, Nums, Stamp, TearEdge, type ChipTone } from "./_landing/kit";
import "./_landing/depth.css";
import "./_landing/first-screen.css";

// Landing only, so the app does not load them. The two local files are cut down to what the page uses: see _landing/fonts/README.md.
const bricolage = localFont({ src: "./_landing/fonts/bricolage-700.woff2", variable: "--font-bricolage", weight: "700", display: "swap" });
const fraunces = localFont({ src: "./_landing/fonts/fraunces-italic-500.woff2", variable: "--font-fraunces", weight: "500", style: "italic", display: "swap" });
// The peso sign lives in latin-ext.
const plex = IBM_Plex_Mono({ variable: "--font-plex", subsets: ["latin", "latin-ext"], weight: ["400", "500"] });
// The first screen's faces: Fraunces with its SOFT axis for display, Inter for text.
const serif = Fraunces({ variable: "--font-serif", subsets: ["latin", "latin-ext"], style: ["normal", "italic"], axes: ["SOFT"], display: "swap" });
const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext"], display: "swap" });

export const metadata: Metadata = {
  title: "TAPat: fuel aid that can say no",
  description: "An AI agent funds, caps, and returns fuel aid for tricycle drivers, with the limits enforced on-chain.",
};

const PAGE_WIDTH = "mx-auto w-full max-w-[1440px] px-[clamp(20px,5vw,72px)]";

/** Sample pesos as "₱1,234.00", through the same stroop formatter as the dashboard. */
const money = (pesos: number) => php(phpToStroops(pesos), DEFAULT_PHP_PER_XLM).replace("PHP ", "₱");

const TAP_CHOICES: StageChoice[] = [
  {
    id: "ok",
    button: money(300),
    amount: money(300),
    card: "Ana V. …A1B2",
    last4: "A1B2",
    approved: true,
    short: "within cap",
    reason: "within the per-tap cap",
    tx: "Submitted (sample)",
    note: "Authorized by the Noir contract.",
    note2: "Salamat po. Drive safe.",
  },
  {
    id: "over",
    button: money(800),
    amount: money(800),
    card: "Juan D. …9C7E",
    last4: "9C7E",
    approved: false,
    short: "over cap",
    reason: TAP_REASON_LABELS.OVER_CAP,
    tx: "None submitted",
    note: "Rejected by the Noir contract.",
    note2: "No tx submitted.",
  },
  {
    id: "expired",
    button: "Expired card",
    amount: money(200),
    card: "Pedro R. …3A54",
    last4: "3A54",
    approved: false,
    short: "card expired",
    reason: TAP_REASON_LABELS.EXPIRED,
    tx: "None submitted",
    note: "Rejected by the Noir contract.",
    note2: "No tx submitted.",
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
      ["₱65", "per litre threshold"],
      ["₱1,500", "per card"],
    ],
  },
  {
    id: "refuse",
    chip: ["danger", "DECLINED"],
    title: "Refuse, before money moves.",
    body: "Over the cap or past its expiry, a tap gets a no from the contract. A refused tap writes nothing to the chain.",
    facts: [
      ["₱500", "per-tap cap"],
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
] satisfies LoopStep[];

/** Short step names for the navigator, taken from the step titles. */
const RAIL_LABELS = ["Clean list", "Enroll", "Fund", "Refuse", "Freeze", "Return"];
const RAIL = STEPS.map((step, i) => ({ id: step.id, num: `0${i + 1}`, label: RAIL_LABELS[i] }));

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

function Actions({ main = "accent" }: { main?: "accent" | "primary" }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap [&>a]:w-full sm:[&>a]:w-auto">
      <Cta href="/login" look={main}>
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
        <li key={e.text} className="flex items-center gap-2.5 py-[18px] text-[15px] whitespace-nowrap">
          <span>{e.text}</span>
          {/* Declines get the cream stamp, so a refusal stands out in the feed. */}
          <span className={`feed-stamp ${e.stamp[1] === "DECLINED" ? "feed-stamp-no" : ""}`}>{e.stamp[1]}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Landing() {
  return (
    <div className={`landing ${bricolage.variable} ${fraunces.variable} ${plex.variable} ${serif.variable} ${inter.variable}`}>
      <header className="landing-header first-screen sticky top-0 z-40">
        <div className={`${PAGE_WIDTH} flex min-h-[84px] items-center justify-between gap-x-8 gap-y-2`}>
          <Link href="/" prefetch={false} aria-label="TAPat home" className="flex items-center gap-2.5">
            <Logo priority />
            {/* The logo already spells TAPat, so narrow phones drop the wordmark to keep the button on one line. */}
            <span aria-hidden="true" className="font-serif-soft hidden text-[40px] leading-none font-extrabold tracking-[-0.02em] italic min-[440px]:inline">
              TAPat
            </span>
          </Link>
          <nav aria-label="Sections" className="hidden items-center gap-9 md:flex">
            <a href="#loop" className="inline-flex min-h-11 items-center text-[17px] font-medium underline-offset-4 hover:underline">
              How it works
            </a>
            <a href="#stakes" className="inline-flex min-h-11 items-center text-[17px] font-medium underline-offset-4 hover:underline">
              Why
            </a>
            <a href="#contract" className="inline-flex min-h-11 items-center text-[17px] font-medium underline-offset-4 hover:underline">
              Contract
            </a>
          </nav>
          <Cta href="/login" look="forest" size="sm">
            Open the app
          </Cta>
        </div>
        <ScrollGauge />
      </header>

      <main>
        <section id="top" className="first-screen relative z-[2]">
          {/* From lg the hero fills the window below the 84px header, so the feed band starts just past the fold. The content
              stays pinned to the top padding; any extra height goes underneath it. */}
          <div className={`${PAGE_WIDTH} flex flex-wrap content-start items-center gap-10 pt-12 pb-12 lg:min-h-[max(660px,calc(100svh-84px))] lg:pt-24`}>
            {/* 420 + 40 + 660 fits a 1280 window with a scrollbar on one row; on wider screens both columns grow. */}
            <div className="hero-copy flex min-w-0 flex-[1_1_420px] flex-col gap-[clamp(16px,2.6vh,26px)]">
              <p className="text-[13px] font-bold tracking-[0.2em] uppercase" style={stagger(0)}>
                Tricycle fuel aid · On-chain limits
              </p>
              <h1
                className="font-serif-soft text-[clamp(44px,min(6.6vw,11vh),104px)] leading-[0.92] font-bold tracking-[-0.025em] text-balance"
                style={stagger(1)}
              >
                Fuel aid that can say{" "}
                <span className="relative inline-block">
                  <em className="font-bold">no.</em>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 100 12"
                    preserveAspectRatio="none"
                    className="absolute bottom-[-0.04em] left-0 h-[0.16em] w-full overflow-visible"
                  >
                    <path className="no-line" pathLength={1} d="M2 8 C 30 2, 62 12, 98 4" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                  </svg>
                </span>
              </h1>
              <p className="max-w-[34ch] text-[19px] leading-normal" style={stagger(2)}>
                An AI agent funds, caps, and returns fuel aid for tricycle drivers. The limits are enforced on-chain.
              </p>
              <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:flex-wrap [&>a]:justify-center" style={stagger(3)}>
                <Cta href="/login" look="forest" size="xl">
                  Open the app
                </Cta>
                <Cta href="/demo" look="outline" size="xl">
                  Run the agent demo
                </Cta>
              </div>
              <p className="text-[15px] text-forest/80" style={stagger(4)}>
                Log in or create an officer account to try it.
              </p>
            </div>
            <div className="hero-copy min-w-0 max-w-[800px] flex-[1_1_660px]">
              <div style={stagger(2)}>
                <TapStage choices={TAP_CHOICES} autoplay="over" cap={money(500)} />
              </div>
            </div>
          </div>
        </section>

        <section aria-label="Sample feed" className="ticker ticker-slot relative z-10 flex bg-forest text-cream">
          <p className="z-10 flex shrink-0 items-center border-r-[1.5px] border-cream/40 bg-forest pr-[clamp(16px,2vw,24px)] pl-[clamp(20px,5vw,72px)] text-[12px] font-bold tracking-[0.16em] whitespace-nowrap uppercase">
            Sample feed
          </p>
          <div className="ticker-track">
            <TickerCopy />
            <TickerCopy hidden />
          </div>
        </section>

        <StepRail steps={RAIL} />
        <section id="loop" className="loop relative border-t-[1.5px] border-text bg-sunken max-lg:pb-24">
          <span aria-hidden="true" className="absolute top-0 right-0 size-30 lg:size-60">
            <svg viewBox="0 0 240 240" className="block h-full w-full">
              {Array.from({ length: 8 }, (_, i) => (
                <circle key={i} cx="240" cy="0" r={30 * (i + 1)} fill="none" strokeWidth="1.5" className="stroke-ring-surface" />
              ))}
            </svg>
          </span>
          <div className="loop-intro landing-reveal relative flex flex-col gap-5">
            <h2 className="landing-h2">Six steps. One receipt.</h2>
            <p className="landing-lead">Follow one sample program from the masterlist to the money coming back. The receipt on the right has to balance.</p>
          </div>

          <LoopSteps steps={STEPS} />

          <div className="loop-receipt">
            <aside aria-label="Sample program receipt" className="receipt-aside lg:sticky lg:top-24">
              <div aria-hidden="true" className="printer-slot mx-[-12px] h-3 rounded-full" />
              <div className="flex flex-col gap-3 border-[1.5px] border-t-0 border-b-0 border-text bg-raised p-4 font-mono text-mono">
                <div className="flex flex-col gap-2 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between min-[480px]:gap-3">
                  <Logo />
                  <div className="flex flex-col gap-1 min-[480px]:items-end min-[480px]:text-right">
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
                    <li key={`${line.code}-${line.what}`} className="receipt-slot">
                      <span aria-hidden="true" data-step={line.step} className="receipt-ghost">
                        <Nums>{`waiting for step 0${line.step}…`}</Nums>
                      </span>
                      <div
                        data-step={line.step}
                        data-tone={line.stamp?.[0] ?? "mint"}
                        className="receipt-line grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-1 border-b border-ring-surface px-2 py-1.5 max-sm:grid-cols-[1fr_auto]"
                      >
                        <span className="font-medium max-sm:col-start-1 max-sm:row-start-1">
                          <Nums>{line.code}</Nums>
                        </span>
                        <span className="row-span-2 row-start-1 col-start-2 max-sm:col-span-2 max-sm:col-start-1 max-sm:row-span-1 max-sm:row-start-2">
                          <Nums>{line.what}</Nums>
                        </span>
                        <span className="col-start-3 row-start-1 text-right tabular-nums max-sm:col-start-2">
                          <Nums>{line.amount}</Nums>
                        </span>
                        {line.stamp === undefined ? null : (
                          <span className="col-start-3 row-start-2 justify-self-end max-sm:col-span-2 max-sm:col-start-1 max-sm:row-start-3 max-sm:justify-self-start">
                            <Stamp tone={line.stamp[0]}>{line.stamp[1]}</Stamp>
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
                <hr className="border-t-[1.5px] border-dashed border-text" />
                <div className="relative">
                  <div aria-hidden="true" data-step="6" className="receipt-ghost receipt-ghost-total">
                    <Nums>waiting for step 06…</Nums>
                  </div>
                  <div className="receipt-total flex flex-col">
                    <dl className="flex flex-col">
                      {TOTALS.map(([label, pesos]) => (
                        <div key={label} className="flex justify-between py-0.5">
                          <dt>{label}</dt>
                          <dd className="tabular-nums">
                            <Nums>{money(pesos)}</Nums>
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <div className="mt-2 flex items-center justify-between gap-4">
                      <span>Funded = spent + held + pending + escrow + returned</span>
                      <Stamp tone={balanced ? "mint" : "danger"}>{balanced ? "BALANCED" : "MISMATCH"}</Stamp>
                    </div>
                  </div>
                </div>
              </div>
              <TearEdge />
            </aside>
          </div>
        </section>

        <StakesSection rows={STAKES} />

        <ContractSection rows={ENFORCEMENT} />

        <section className="close-band relative overflow-clip border-t-[1.5px] border-text bg-accent text-text">
          <span aria-hidden="true" className="close-arc" />
          <LazyBandMotion art="close" motif="text-ring-accent" />
          <div className={`${PAGE_WIDTH} relative flex flex-col gap-8 py-24 lg:py-32`}>
            <h2 className="landing-h2 landing-reveal max-w-4xl">Every peso has somewhere it has to be.</h2>
            <p className="landing-reveal flex flex-wrap items-center gap-2 font-mono text-[clamp(16px,1.8vw,24px)]">
              {EQUATION.map((term, i) =>
                term === "=" || term === "+" ? (
                  <span key={i}>{term}</span>
                ) : (
                  <span key={i} className="eq-term depth-1 rounded-sm border-[1.5px] px-2 py-1" style={{ "--t": i / 2 } as CSSProperties}>
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
              <Actions main="primary" />
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
