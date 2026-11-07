import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "./(app)/_components/Icon";
import { BandMotion } from "./_landing/Motion";
import { InlinePhone, PinnedPhone } from "./_landing/Phone";
import type { SceneId } from "./_landing/screens";

export const metadata: Metadata = {
  title: "TAPat: fuel aid that can say no",
  description: "An AI agent funds, caps, and returns fuel aid for tricycle drivers, with the limits enforced on-chain.",
};

const PAGE_WIDTH = "mx-auto w-full max-w-[1440px] px-[clamp(20px,5vw,72px)]";

const SPRING = "transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]";

/** A pill with its arrow in a nested circle, which leans out on hover. */
function Cta({ href, look, children }: { href: string; look: "accent" | "primary" | "outline"; children: ReactNode }) {
  const style = {
    accent: { pill: "bg-accent text-text shadow-[0_12px_32px_rgb(27_46_40/0.22)] hover:bg-accent-tint", icon: "bg-text/10" },
    primary: { pill: "bg-primary text-surface hover:bg-pressed", icon: "bg-surface/15" },
    outline: { pill: "ring-1 ring-current/35 hover:bg-current/10", icon: "bg-current/10" },
  }[look];
  return (
    <Link href={href} className={`group inline-flex min-h-12 items-center gap-3 rounded-full py-1.5 pr-1.5 pl-5 text-label active:scale-[0.98] ${SPRING} ${style.pill}`}>
      {children}
      <span aria-hidden="true" className={`flex size-9 items-center justify-center rounded-full group-hover:translate-x-0.5 group-hover:-translate-y-px group-hover:scale-105 ${SPRING} ${style.icon}`}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4.5 11.5l7-7M5.5 4.5h6v6" />
        </svg>
      </span>
    </Link>
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

/** Double-bezel card: a thin tray around a raised plate, with concentric corners. */
function Plate({ tray, plate, children }: { tray: string; plate: string; children: ReactNode }) {
  return (
    <div className={`h-full rounded-[2rem] p-1.5 ring-1 ${tray}`}>
      <div className={`h-full rounded-[calc(2rem-0.375rem)] shadow-[inset_0_1px_1px_rgb(255_255_255/0.14)] ${plate}`}>{children}</div>
    </div>
  );
}

/** Each colour keeps its kit meaning. `motif` colours the band's corner art. */
const BANDS = {
  forest: { ground: "bg-primary-deep text-surface", motif: "text-pressed" },
  green: { ground: "bg-primary text-surface", motif: "text-pressed" },
  cream: { ground: "bg-surface text-text", motif: "text-ring-surface" },
  mint: { ground: "bg-mint text-text", motif: "text-raised" },
  declined: { ground: "bg-declined-tint text-text", motif: "text-declined" },
  frozen: { ground: "bg-frozen text-text", motif: "text-raised" },
  mustard: { ground: "bg-accent text-text", motif: "text-ring-accent" },
};

function Band({ id, band, label, sheet = true, children }: { id: SceneId; band: keyof typeof BANDS; label: string; sheet?: boolean; children: ReactNode }) {
  const tone = BANDS[band];
  return (
    <section id={id} className={`relative overflow-clip ${sheet ? "landing-sheet" : ""} ${tone.ground}`}>
      <BandMotion art={id} motif={tone.motif} />
      <div className={`${PAGE_WIDTH} relative flex flex-col gap-14 pt-28 pb-32 lg:min-h-dvh lg:justify-center`}>
        <div className="flex max-w-xl flex-col gap-6 lg:w-[46%]">{children}</div>
        <div className="phone-inline flex justify-center pb-3 lg:hidden">
          <InlinePhone scene={id} label={label} />
        </div>
      </div>
    </section>
  );
}

const HERO = {
  id: "top",
  band: "forest",
  label: "The TAPat dashboard: PHP 4,500 funded and balanced, split into PHP 350 spent, PHP 960 held and PHP 3,190 in escrow, with one station frozen.",
} satisfies { id: SceneId; band: keyof typeof BANDS; label: string };

const STEPS = [
  {
    id: "list",
    band: "cream",
    label: "Intake results: 12 masterlist rows checked, 2 rejected including a ghost with a duplicate plate.",
    title: "A clean list goes in.",
    body: "Ghost and duplicate drivers come off the masterlist. Only the uncertain ones get one Telegram message asking for evidence.",
    facts: [
      ["5%", "max wrongful denials"],
      ["2%", "max ghost admissions"],
    ],
  },
  {
    id: "enroll",
    band: "mint",
    label: "Enrolling Ana V.: the card is read, then its device and policy are registered on-chain.",
    title: "Enrolled in a minute.",
    body: "A TODA officer taps one NFC card and its spending policy goes on-chain. The driver needs no app and no data plan.",
    facts: [
      ["1 card", "is all a driver carries"],
      ["Telegram", "delivers the receipts"],
    ],
  },
  {
    id: "fund",
    band: "green",
    label: "The Tranche Agent: a simulated diesel price holds above PHP 65, so it releases PHP 1,500 per card.",
    title: "Fund, when the shift is real.",
    body: "The agent releases aid only when the diesel price stays above the threshold, inside a budget Velo has verified. A one-day spike releases nothing.",
    facts: [
      ["PHP 65", "per litre threshold"],
      ["PHP 1,500", "per card"],
    ],
  },
  {
    id: "refuse",
    band: "declined",
    label: "A declined tap: PHP 800 is over the PHP 500 cap, rejected by the Noir contract, no transaction submitted.",
    title: "Refuse, before money moves.",
    body: "Over the cap or past its expiry, a tap gets a no from the contract. A refused tap writes nothing to the chain.",
    facts: [
      ["PHP 500", "per-tap cap"],
      ["0 tx", "on a refusal"],
    ],
  },
  {
    id: "freeze",
    band: "frozen",
    label: "The Freeze Agent freezes Rotonda Fuels after a simulated MIDAS score of 2.31 crosses the 1.78 line.",
    title: "Freeze the station, not the program.",
    body: "When a tap pattern looks wrong, only that station stops. New taps are refused and its settlement is held until the LGU unfreezes it.",
    facts: [
      ["MIDAS-F", "scores every tap"],
      ["1 station", "paused, the rest keep pumping"],
    ],
  },
  {
    id: "return",
    band: "mustard",
    label: "The program ends: PHP 3,190 returns to the LGU wallet, with a transaction for each swept card.",
    title: "Return what's left, the same day.",
    body: "When the program ends, every card is revoked and its unspent aid goes back to the LGU wallet.",
    facts: [
      ["Same day", "not a year later at audit"],
      ["1 CSV", "with a tx hash for the COA"],
    ],
  },
] satisfies Array<{ id: SceneId; band: keyof typeof BANDS; label: string; title: string; body: string; facts: Array<[string, string]> }>;

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

export default function Landing() {
  return (
    <div className="landing">
      <header className="fixed top-4 left-1/2 z-50 flex w-max -translate-x-1/2 items-center gap-6 rounded-full bg-surface p-1.5 pl-3 text-text shadow-[0_16px_48px_rgb(27_46_40/0.18)] ring-1 ring-text/10">
        <Link href="/" aria-label="TAPat" className="block h-11 w-[88px] shrink-0 overflow-hidden">
          {/* The icon file is square with wide margins; this slot shows its middle band, as in the app's top bar. */}
          <Image src="/tapat-app-icon-1024.png" alt="" width={88} height={88} className="-mt-[22px] max-w-none mix-blend-darken" priority />
        </Link>
        <Cta href="/login" look="primary">
          Open the app
        </Cta>
      </header>
      <main>
        <div className="landing-walk relative">
          <Band {...HERO} sheet={false}>
            <div className="landing-hero flex flex-col gap-6">
              <h1 className="text-[clamp(56px,7.4vw,112px)] leading-[0.98] font-semibold tracking-[-0.04em] text-balance" style={{ "--i": 1 } as CSSProperties}>
                Fuel aid that can say no.
              </h1>
              <p className="landing-lead" style={{ "--i": 2 } as CSSProperties}>
                An AI agent funds, caps, and returns fuel aid for tricycle drivers. The limits are enforced on-chain.
              </p>
              <div style={{ "--i": 3 } as CSSProperties}>
                <Actions />
              </div>
              <p className="text-small" style={{ "--i": 4 } as CSSProperties}>
                Log in or create an officer account to try it.
              </p>
            </div>
          </Band>

          {STEPS.map((step) => (
            <Band key={step.id} id={step.id} band={step.band} label={step.label}>
              <h2 className="landing-h2 landing-reveal" style={{ "--i": 1 } as CSSProperties}>
                {step.title}
              </h2>
              <p className="landing-lead landing-reveal" style={{ "--i": 2 } as CSSProperties}>
                {step.body}
              </p>
              <dl className="landing-reveal grid grid-cols-2 gap-3" style={{ "--i": 3 } as CSSProperties}>
                {step.facts.map(([value, label]) => (
                  <Plate key={value} tray="bg-current/10 ring-current/15" plate="bg-raised text-text">
                    <div className="flex h-full flex-col-reverse justify-end gap-1.5 px-5 py-4">
                      <dt className="text-small">{label}</dt>
                      <dd className="text-[clamp(22px,2.2vw,30px)] leading-none font-semibold tracking-[-0.02em]">{value}</dd>
                    </div>
                  </Plate>
                ))}
              </dl>
            </Band>
          ))}

          {/* After the bands in the DOM so the hero heading comes first; absolute placement is unaffected. */}
          <div className="pointer-events-none absolute inset-0 z-20 hidden lg:block">
            <div className={`${PAGE_WIDTH} phone-stage sticky top-0 flex h-dvh items-center justify-end lg:pr-[clamp(0px,7vw,120px)]`}>
              <PinnedPhone steps={[HERO, ...STEPS].map(({ id, label }) => ({ id, label }))} />
            </div>
          </div>
        </div>

        <section className="landing-sheet relative z-30 bg-text text-surface">
          <div className={`${PAGE_WIDTH} flex flex-col gap-14 py-32 lg:py-40`}>
            <h2 className="landing-h2 landing-reveal max-w-3xl">Safe and slow, or fast and leaky.</h2>
            <ul className="grid gap-4 lg:grid-cols-12">
              {STAKES.map((row, index) => (
                <li key={row.figure} className={`landing-reveal ${index === 0 ? "lg:col-span-7 lg:row-span-2" : "lg:col-span-5"}`} style={{ "--i": index } as CSSProperties}>
                  <Plate tray="bg-surface/5 ring-surface/10" plate="bg-pressed/45">
                    <div className="flex h-full flex-col justify-between gap-10 p-7 lg:p-9">
                      <p className={`leading-none font-semibold tracking-[-0.04em] ${index === 0 ? "text-[clamp(64px,9vw,136px)]" : "text-[clamp(44px,4.6vw,68px)]"}`}>
                        {row.peso ? <span className="mr-2 font-mono text-[0.3em] font-medium tracking-normal">PHP</span> : null}
                        {row.figure}
                      </p>
                      <div className="flex flex-col gap-2">
                        <p className="text-[17px] leading-normal">
                          {row.what} <span className="text-small whitespace-nowrap text-mint">({row.source})</span>
                        </p>
                        <p className="text-[17px] leading-normal font-medium text-accent">{row.answer}</p>
                      </div>
                    </div>
                  </Plate>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="landing-sheet relative z-30 bg-sunken text-text">
          <div className={`${PAGE_WIDTH} flex flex-col gap-14 py-32 lg:py-40`}>
            <h2 className="landing-h2 landing-reveal max-w-4xl">The agent decides. The contract has the last word.</h2>
            <ul className="grid gap-4 md:grid-cols-12">
              {ENFORCEMENT.map(([decision, call, icon], index) => (
                <li key={decision} className={`landing-reveal ${index === 0 || index === 3 ? "md:col-span-5" : "md:col-span-7"}`} style={{ "--i": index % 2 } as CSSProperties}>
                  <Plate tray="bg-text/5 ring-text/10" plate="bg-raised">
                    <div className="flex h-full flex-col gap-10 p-7">
                      <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-full bg-mint text-primary">
                        <Icon name={icon} />
                      </span>
                      <div className="flex flex-col gap-2">
                        <h3 className="text-h2">{decision}</h3>
                        <p className="font-mono text-mono [overflow-wrap:anywhere] text-muted">{call}</p>
                      </div>
                    </div>
                  </Plate>
                </li>
              ))}
            </ul>
            <p className="landing-reveal text-small">Velo verifies the budget and sponsors the fees. Per-tap limits are Noir&apos;s.</p>
          </div>
        </section>

        <section className="landing-sheet relative z-30 overflow-clip bg-primary-deep text-surface">
          <BandMotion art="close" motif="text-pressed" />
          <div className={`${PAGE_WIDTH} relative flex flex-col gap-8 py-32 lg:py-40`}>
            <h2 className="landing-h2 landing-reveal max-w-4xl">Every peso has somewhere it has to be.</h2>
            <p className="landing-reveal font-mono text-[clamp(18px,2.1vw,30px)] leading-[1.35] font-medium text-balance" style={{ "--i": 1 } as CSSProperties}>
              Funded = spent + held + pending + escrow + returned
            </p>
            <p className="landing-lead landing-reveal max-w-[52ch]" style={{ "--i": 2 } as CSSProperties}>
              Run the whole loop yourself on a laptop or a phone. No NFC card needed: Simulate card stands in for the tap.
            </p>
            <div className="landing-reveal" style={{ "--i": 3 } as CSSProperties}>
              <Actions />
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-30 bg-text py-8 text-surface">
        <p className={`${PAGE_WIDTH} text-caption`}>Prototype on Stellar Testnet at a demo rate. Limits shown are the demo program&apos;s. Phone screens use sample data; price and burst data are simulated.</p>
      </footer>
    </div>
  );
}
