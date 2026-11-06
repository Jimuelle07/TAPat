import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Rings } from "./(app)/_components/ui";
import { Phone, PinnedPhone, type Step } from "./_landing/Phone";
import { EnrollScreen, FrozenScreen, HomeScreen, IntakeScreen, RefusedScreen, ReturnedScreen, TrancheScreen } from "./_landing/screens";

export const metadata: Metadata = {
  title: "TAPat: fuel aid that can say no",
  description:
    "An AI agent releases, caps, and returns fuel aid for tricycle drivers, inside limits the LGU signs and Noir enforces on Stellar. Hackathon prototype on Testnet.",
};

const PAGE_WIDTH = "mx-auto w-full max-w-[1440px] px-[clamp(20px,5vw,72px)]";

function Cta({ href, look, compact = false, children }: { href: string; look: "accent" | "primary" | "outline"; compact?: boolean; children: ReactNode }) {
  const style = {
    accent: "border-text bg-accent text-text shadow-button hover:bg-accent-tint",
    primary: "border-primary bg-primary text-surface shadow-button hover:bg-pressed",
    outline: "border-current hover:bg-surface hover:text-text",
  }[look];
  return (
    <Link href={href} className={`inline-flex items-center justify-center rounded-md border-[1.5px] text-label transition-colors ${compact ? "min-h-11 px-4" : "min-h-[54px] px-6"} ${style}`}>
      {children}
    </Link>
  );
}

function Actions() {
  return (
    <div className="flex flex-wrap gap-3">
      <Cta href="/dashboard" look="accent">
        Open the app
      </Cta>
      <Cta href="/demo" look="outline">
        Run the agent demo
      </Cta>
    </div>
  );
}

/** The limits and contract calls behind a step, on the same ruled lines as the app's receipts. */
function Rules({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="max-w-md font-mono text-[14px] leading-[1.4] tabular-nums">
      {rows.map(([key, value]) => (
        <div key={key} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t-[1.5px] border-current py-2.5">
          <dt className="shrink-0">{key}</dt>
          <dd className="ml-auto text-right">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A band is the kit's stat card at page scale: a ground, its large arc, and rings in the corner. */
const BANDS = {
  forest: { ground: "bg-primary-deep text-surface", arc: "bg-primary", rings: "text-pressed" },
  green: { ground: "bg-primary text-surface", arc: "bg-primary-deep", rings: "text-pressed" },
  cream: { ground: "bg-surface text-text", arc: "bg-sunken", rings: "text-ring-surface" },
  mint: { ground: "bg-mint text-text", arc: "bg-surface", rings: "text-raised" },
  declined: { ground: "bg-declined-tint text-text", arc: "bg-declined", rings: "text-declined" },
  frozen: { ground: "bg-frozen text-text", arc: "bg-surface", rings: "text-raised" },
  mustard: { ground: "bg-accent text-text", arc: "bg-accent-tint", rings: "text-ring-accent" },
};

function Band({ id, band, label, screen, children }: { id: string; band: keyof typeof BANDS; label: string; screen: ReactNode; children: ReactNode }) {
  const tone = BANDS[band];
  return (
    <section id={id} className={`relative scroll-mt-16 overflow-clip border-t-[1.5px] border-text ${tone.ground}`}>
      <span aria-hidden="true" className={`band-arc ${tone.arc}`} />
      <Rings size={240} step={30} count={8} className={`${tone.rings} origin-top-right max-lg:scale-50`} />
      <div className={`${PAGE_WIDTH} relative flex flex-col gap-12 py-16 lg:min-h-[calc(100dvh-4rem)] lg:justify-center lg:py-20`}>
        <div className="flex max-w-xl flex-col gap-5 lg:w-[46%]">{children}</div>
        <div className="flex justify-center pb-3 lg:hidden">
          <Phone label={label}>
            <div className="phone-layer" data-on="true">
              {screen}
            </div>
          </Phone>
        </div>
      </div>
    </section>
  );
}

const HERO = {
  id: "top",
  band: "forest",
  label: "The TAPat dashboard: PHP 4,500 funded, PHP 350 spent, PHP 960 held, and the budget verified by Velo.",
  screen: <HomeScreen />,
} satisfies Step & { band: keyof typeof BANDS };

const STEPS = [
  {
    id: "list",
    band: "cream",
    label: "Intake results: 12 masterlist rows checked, 2 rejected including a ghost with a duplicate plate.",
    screen: <IntakeScreen />,
    title: "A clean list goes in.",
    body: "An LGU officer uploads the masterlist they already have. Matching and conformal risk control remove the ghosts, and only the genuinely uncertain drivers get one Telegram message asking for evidence.",
    rules: [
      ["Max wrongful denial", "α 0.05"],
      ["Max ghost admission", "β 0.02"],
      ["OCR in this demo", "precomputed"],
    ],
  },
  {
    id: "enroll",
    band: "mint",
    label: "Enrollment finished for Ana V.: card active, PHP 500 per-tap cap, device and policy registered on-chain.",
    screen: <EnrollScreen />,
    title: "A driver is enrolled in a minute.",
    body: "A TODA officer verifies the driver and taps an NFC card. The card's spending policy goes on-chain, and the driver walks away with a card. No app, no data plan.",
    rules: [
      ["Per-tap cap", "PHP 500.00"],
      ["Policy expires", "Nov 30, 2026"],
      ["Registered in", "agent_registry"],
    ],
  },
  {
    id: "fund",
    band: "green",
    label: "The Tranche Agent: diesel holds above the PHP 65 threshold, so it funds PHP 1,500 per card. The price series is simulated.",
    screen: <TrancheScreen />,
    title: "Fund, when the shift is real.",
    body: "The Tranche Agent watches the DOE diesel price. A one-day spike is not a shift. It releases a tranche per card only when a change is sustained, above the threshold, and inside a budget Velo has verified.",
    rules: [
      ["Threshold", "PHP 65.00 per litre"],
      ["Tranche per card", "PHP 1,500.00"],
      ["Call", "payment_escrow.fund_escrow()"],
    ],
  },
  {
    id: "refuse",
    band: "declined",
    label: "A declined tap: PHP 800 is over the PHP 500 cap, rejected by the Noir contract, no transaction submitted.",
    screen: <RefusedScreen />,
    title: "Refuse, before money moves.",
    body: "Every tap is simulated against the card's own policy first. Over the cap, expired, or not permitted, and the contract says no. A refused tap writes nothing to the chain.",
    rules: [
      ["Per-tap cap", "PHP 500.00"],
      ["Decided by", "payment_escrow.authorize()"],
      ["Tx on refusal", "None submitted"],
    ],
  },
  {
    id: "freeze",
    band: "frozen",
    label: "The Freeze Agent has frozen Rotonda Fuels after a MIDAS score of 2.31 crossed the 1.78 line, holding PHP 960.",
    screen: <FrozenScreen />,
    title: "Freeze the station, not the program.",
    body: "The Freeze Agent scores card-to-station taps as they arrive. When a pattern looks wrong, that one station stops: new taps are refused and its settlement is held. Every other station keeps pumping.",
    rules: [
      ["Scoring", "MIDAS-F"],
      ["Settlement", "claim() skipped"],
      ["Burst in this demo", "simulated"],
    ],
  },
  {
    id: "return",
    band: "mustard",
    label: "The program has ended: PHP 3,190 returned to the LGU wallet, with a transaction for each swept card.",
    screen: <ReturnedScreen />,
    title: "Return what's left, the same day.",
    body: "At program end every card is revoked and its unspent escrow goes back to the LGU wallet. One CSV gives the COA a tx hash behind every number.",
    rules: [
      ["Revoke", "agent_registry.revoke_agent()"],
      ["Sweep", "payment_escrow.sweep_on_revoke()"],
      ["Audit", "COA CSV export"],
    ],
  },
] satisfies Array<Step & { band: keyof typeof BANDS; title: string; body: string; rules: Array<[string, string]> }>;

const STAKES = [
  {
    figure: "2.7B",
    peso: true,
    what: "nearly lost to duplicate and ghost beneficiaries.",
    source: "DSWD, via Daily Tribune",
    answer: "Ghosts are matched out before anyone is enrolled.",
  },
  {
    figure: "709.88M",
    peso: true,
    what: "in DOTr subsidies unpaid or expired, with leftovers returned to the treasury after two years.",
    source: "COA, via Astig.ph and NET25",
    answer: "Unspent escrow comes back the same day.",
  },
  {
    figure: "723,000",
    peso: false,
    what: "tricycle drivers slated for PHP 5,000 each. Payouts stayed in person to stop ghosts, and drivers fainted in heat-exposed queues.",
    source: "PNA; DSWD",
    answer: "One minute to enroll, then a tap at the pump.",
  },
];

const ENFORCEMENT = [
  ["Fund", "Tranche Agent", "payment_escrow.fund_escrow(), per card, signed by the Program Wallet"],
  ["Refuse", "Card agent", "agent_registry policy, enforced inside payment_escrow.authorize()"],
  ["Freeze", "Freeze Agent", "The API refuses new taps before signing and skips payment_escrow.claim() for that station"],
  ["Return", "Sweep runner", "agent_registry.revoke_agent(), then payment_escrow.sweep_on_revoke()"],
];

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b-[1.5px] border-text bg-surface text-text">
      <div className={`${PAGE_WIDTH} flex h-16 items-center justify-between gap-4`}>
        <Link href="/" aria-label="TAPat" className="block h-14 w-28 shrink-0 overflow-hidden">
          {/* The icon file is square with wide margins; this slot shows its middle band, as in the app's top bar. */}
          <Image src="/tapat-app-icon-1024.png" alt="" width={112} height={112} className="-mt-7 max-w-none mix-blend-darken" priority />
        </Link>
        <nav aria-label="Page" className="ml-auto hidden items-center gap-8 text-label md:flex">
          <a href="#list" className="underline-offset-4 hover:underline">
            How it works
          </a>
          <a href="#stakes" className="underline-offset-4 hover:underline">
            Why it matters
          </a>
          <a href="#enforcement" className="underline-offset-4 hover:underline">
            What enforces it
          </a>
        </nav>
        <Cta href="/dashboard" look="primary" compact>
          Open the app
        </Cta>
      </div>
    </header>
  );
}

export default function Landing() {
  return (
    <div className="landing">
      <Header />
      <main>
        <div className="relative">
          <div className="pointer-events-none absolute inset-0 z-20 hidden lg:block">
            <div className={`${PAGE_WIDTH} sticky top-16 flex h-[calc(100dvh-4rem)] items-center justify-end lg:pr-[clamp(0px,7vw,120px)]`}>
              <PinnedPhone steps={[HERO, ...STEPS].map(({ id, label, screen }) => ({ id, label, screen }))} />
            </div>
          </div>

          <Band {...HERO}>
            <h1 className="text-[clamp(52px,7vw,96px)] leading-[1.02] font-semibold tracking-[-0.03em] text-balance">Fuel aid that can say no.</h1>
            <p className="landing-lead">
              An AI agent releases, caps, and returns fuel aid for tricycle drivers, inside limits the LGU signs and Noir enforces on Stellar.
            </p>
            <Actions />
            <p className="text-small">Hackathon prototype on Stellar Testnet.</p>
          </Band>

          {STEPS.map((step) => (
            <Band key={step.id} id={step.id} band={step.band} label={step.label} screen={step.screen}>
              <h2 className="landing-h2">{step.title}</h2>
              <p className="landing-lead">{step.body}</p>
              <Rules rows={step.rules} />
            </Band>
          ))}
        </div>

        <section id="stakes" className="relative scroll-mt-16 overflow-clip border-t-[1.5px] border-text bg-text py-20 text-surface lg:py-28">
          <span aria-hidden="true" className="band-arc bg-pressed" />
          <Rings size={240} step={30} count={8} className="origin-top-right text-primary max-lg:scale-50" />
          <div className={`${PAGE_WIDTH} relative`}>
            <h2 className="landing-h2 max-w-3xl">Safe and slow, or fast and leaky. Both cost real money.</h2>
            <ul className="mt-12 lg:mt-16">
              {STAKES.map((row) => (
                <li key={row.figure} className="grid gap-4 border-t-[1.5px] border-current py-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)_minmax(0,3fr)] lg:gap-10">
                  <p className="text-[clamp(48px,6.4vw,92px)] leading-none font-semibold tracking-[-0.03em] whitespace-nowrap">
                    {row.peso ? <span className="mr-2 font-mono text-[0.3em] font-medium tracking-normal">PHP</span> : null}
                    {row.figure}
                  </p>
                  <p className="text-[17px] leading-normal">
                    {row.what} <span className="block pt-2 text-small text-mint">{row.source}, as cited in our PRD.</span>
                  </p>
                  <p className="text-[17px] leading-normal font-medium text-accent">{row.answer}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="enforcement" className="scroll-mt-16 border-t-[1.5px] border-text bg-sunken py-20 text-text lg:py-28">
          <div className={PAGE_WIDTH}>
            <div className="mx-auto max-w-5xl">
              <div className="border-[1.5px] border-b-0 border-text bg-raised p-[clamp(20px,4vw,56px)]">
                <h2 className="landing-h2 max-w-3xl">The agent decides. The contract has the last word.</h2>
                <div className="mt-10">
                  <div className="hidden grid-cols-[1fr_1.2fr_3fr] gap-6 pb-3 text-caption md:grid" aria-hidden="true">
                    <span>Decision</span>
                    <span>Made by</span>
                    <span>Enforced by</span>
                  </div>
                  <ul>
                    {ENFORCEMENT.map(([decision, agent, call]) => (
                      <li key={decision} className="grid gap-1 border-t-[1.5px] border-dashed border-text py-4 md:grid-cols-[1fr_1.2fr_3fr] md:gap-6">
                        <span className="text-h2">{decision}</span>
                        <span className="text-label md:pt-1.5">{agent}</span>
                        <span className="font-mono text-mono [overflow-wrap:anywhere] md:pt-1.5">{call}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="landing-lead mt-8 max-w-[62ch] border-t-[1.5px] border-dashed border-text pt-8">
                  Before any tranche is funded, the LGU Budget Office pays one Velo checkout and a signed webhook credits the budget exactly once. Velo also sponsors the fee
                  on every Noir call. Per-tap enforcement is Noir&apos;s alone.
                </p>
              </div>
              <svg aria-hidden="true" viewBox="0 0 100 7" preserveAspectRatio="none" className="block h-[10px] w-full overflow-visible">
                <polyline
                  points={Array.from({ length: 81 }, (_, i) => `${i * 1.25},${i % 2 === 0 ? 0 : 7}`).join(" ")}
                  className="fill-raised stroke-text"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>
          </div>
        </section>

        <section className="relative overflow-clip border-t-[1.5px] border-text bg-primary-deep py-20 text-surface lg:py-28">
          <span aria-hidden="true" className="band-arc bg-primary" />
          <Rings size={240} step={30} count={8} className="origin-top-right text-pressed max-lg:scale-50" />
          <div className={`${PAGE_WIDTH} relative flex flex-col gap-8`}>
            <h2 className="landing-h2 max-w-4xl">Every peso has somewhere it has to be.</h2>
            <p className="font-mono text-[clamp(18px,2.1vw,30px)] leading-[1.35] font-medium text-balance">Funded = spent + held + pending + escrow + returned</p>
            <p className="landing-lead max-w-[56ch]">The dashboard keeps this line in view and flags a mismatch. Open it, or run the agents through the whole loop yourself.</p>
            <Actions />
          </div>
        </section>
      </main>

      <footer className="border-t-[1.5px] border-text bg-raised py-8 text-text">
        <p className={`${PAGE_WIDTH} text-caption`}>
          TAPat, built for the Velo x Noir Agentic Payment Hackathon. A prototype on Stellar Testnet at a demo rate of PHP 10 per XLM. Phone screens show sample data from the
          app&apos;s design file; price and burst data are simulated.
        </p>
      </footer>
    </div>
  );
}
