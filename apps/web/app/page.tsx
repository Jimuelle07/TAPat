import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { Fragment, type CSSProperties } from "react";
import { DEFAULT_PHP_PER_XLM, phpToStroops } from "@tapat/shared";
import { php } from "@/lib/format";
import { Agents } from "./_landing/Agents";
import { CountUp } from "./_landing/CountUp";
import { DieselSim } from "./_landing/DieselSim";
import { NavTricycle } from "./_landing/NavTricycle";
import { ScenarioPlayer } from "./_landing/ScenarioPlayer";
import cover from "./_landing/cover-tricycle-negros.jpg";
import logo from "./_landing/logo-tricycle.png";
import { HeroFilm } from "./_landing/HeroFilm";
import { ProblemFilm } from "./_landing/ProblemFilm";
import { BuildFlowFilm } from "./_landing/BuildFlowFilm";
import { CoverMotion, Reveal } from "./_landing/Reveal";
import { ButtonLink, SectionHeading } from "./_landing/kit";

const plexSans = IBM_Plex_Sans({ variable: "--font-plex-sans", subsets: ["latin", "latin-ext"], weight: ["400", "500", "600"], display: "swap" });
// The peso sign (U+20B1) is in both families' latin-ext range.
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin", "latin-ext"], weight: ["400", "500"], display: "swap" });

export const metadata: Metadata = {
  title: "TAPat",
  description: "TAPat releases, caps and returns fuel aid for tricycle drivers. A Noir contract on Stellar enforces every per-tap limit.",
};

const PAGE = "mx-auto w-full max-w-[1200px] px-[clamp(20px,4vw,48px)]";

/** Sample pesos as "₱1,234.00", through the same stroop formatter as the dashboard. */
const money = (pesos: number) => php(phpToStroops(pesos), DEFAULT_PHP_PER_XLM).replace("PHP ", "₱");

const CONTENTS = [
  { id: "problem", title: "The problem" },
  { id: "how", title: "How it works" },
  { id: "simulation", title: "Diesel simulation" },
];

// Cited figures from docs/PRD.md §1; these are cited text, not computed.
const METRICS = [
  { figure: <CountUp value={723000} />, what: "tricycle drivers slated for the ₱5,000 fuel subsidy", source: "PNA" },
  { figure: <CountUp prefix="₱" value={2.7} decimals={1} suffix="B" />, what: "nearly lost to ghost and duplicate beneficiaries", source: "DSWD, via Daily Tribune" },
  { figure: <CountUp prefix="₱" value={709.88} decimals={2} suffix="M" />, what: "in DOTr subsidies unpaid or expired, returned to the treasury after two years", source: "COA, via Astig.ph and NET25" },
  { figure: "In person", what: "payouts kept face to face to stop ghosts, and drivers fainted in heat-exposed queues", source: "As cited in the TAPat build plan" },
];

const MATRIX: Array<[string, string]> = [
  ["Lump sum with no rules", "Each card carries an on-chain spending policy (cap, expiry)."],
  ["Can't be recovered until an audit", "Unspent aid returns to the LGU wallet the day the program ends."],
  ["Manual verification", "Ghosts and duplicates are screened before enrollment."],
  ["Aid arrives late", "The Tranche Agent releases on the price shock itself."],
];

type Source = { label: string; href?: string };
// The Tranche and Freeze agents are illustrated in <Agents />; these are the other two parts of the system.
const OTHER_PARTS: Array<{ name: string; decides: string; method: string; research: Source[]; settings: string }> = [
  {
    name: "Masterlist check",
    decides: "Screens ghosts and duplicates before enrollment.",
    method: "Jaro-Winkler name matching and Conformal Risk Control",
    research: [
      { label: "Winkler (1990)" },
      { label: "Angelopoulos et al., \u201CConformal Risk Control\u201D, ICLR 2024", href: "https://arxiv.org/abs/2208.02814" },
    ],
    settings: "At most 5% wrongful denials and at most 2% ghost admissions.",
  },
  {
    name: "Noir payment contract",
    decides: "Has the last word on every payment.",
    method: "`payment_escrow` on Stellar Testnet, called through `@noirx402/agent-sdk`",
    research: [],
    settings: "`fund_escrow()`, `authorize()` (cap, expiry, nonce), `claim()` and `sweep_on_revoke()`. A refused tap writes no transaction.",
  },
];

const FLOW = [
  "Diesel price (simulated)",
  "Tranche Agent decides",
  "`fund_escrow()` puts aid into each card's escrow",
  "A driver taps a card at a station",
  "`authorize()` checks cap, expiry and nonce",
  "Freeze Agent watches every tap",
  "`claim()` settles to the station, or it is held if frozen",
  "`sweep_on_revoke()` returns what is left to the LGU",
];

const LAYERS = [
  "Agents are TypeScript: pure functions, no network.",
  "Contract calls go through `@noirx402/agent-sdk`.",
  "Velo verifies the budget checkout and sponsors every Noir call's network fee. It does not verify individual taps.",
  "Receipts arrive by Telegram.",
];

const NOTES = [
  `Stellar Testnet only; no real pesos move. Amounts use a demo rate of ${money(DEFAULT_PHP_PER_XLM)} per XLM.`,
  "The scenarios and the diesel year are simulated.",
  "The scenario release decisions are precomputed by the real Tranche Agent code.",
  "In the app, OCR results are precomputed, and the price feed and the suspicious-tap burst are simulated.",
  "Velo verifies the budget checkout and sponsors network fees. It does not verify individual taps.",
  "The cover is a stock photo.",
];

const ACTIONS = (
  <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
    <ButtonLink href="/login" arrow>
      Open the app
    </ButtonLink>
    <Link href="/demo" prefetch={false} className="doc-link inline-flex min-h-11 items-center gap-1.5">
      Run the agent demo
      <span aria-hidden="true" className="doc-nudge">
        →
      </span>
    </Link>
  </div>
);

// The h1's exact text, one rising line per phrase (joined by spaces, so it still reads as one sentence).
const HERO_LINES = ["Fuel aid for tricycle", "drivers, paid by card", "and held to limits", "on-chain."];

// Bento placement of the four figure tiles: 723,000 leads and spans two rows, "In person" spans two columns.
const TILE_SHAPE = ["tile-ink lg:row-span-2", "", "", "lg:col-span-2"];
// The film in each tile's art area, in the order of METRICS.
const TILE_FILM = ["drivers", "leak", "unpaid", "queue"] as const;

// "The demo program" under the hero film: the demo defaults from docs/PRD.md §3.
const GLANCE: Array<[string, string]> = [
  ["Diesel trigger", `${money(65)}/L, held 4+ days`],
  ["Aid per card", money(1500)],
  ["Per-tap cap", money(500)],
  ["Unspent aid", "Returned to the LGU when the program ends"],
  ["Network", `Stellar Testnet · demo rate ${money(DEFAULT_PHP_PER_XLM)}/XLM`],
];

const SECTION = "border-t border-text py-16 lg:py-20";
const FOOTER_LINK = "doc-link inline-flex min-h-11 items-center";

const heading = (id: string) => {
  const c = CONTENTS.find((item) => item.id === id)!;
  return <SectionHeading id={c.id} title={c.title} />;
};

/** Text with `code` spans set in Plex Mono. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("`").map((part, i) =>
        i % 2 ? (
          <code key={i} className="doc-mono">
            {part}
          </code>
        ) : (
          part
        ),
      )}
    </>
  );
}

export default function Landing() {
  return (
    <div className={`landing ${plexSans.variable} ${plexMono.variable}`}>
      {/* Floating pill nav, detached from the page edge: one row at every size. It clips to its rounded outline so the logo tricycle drives in from behind its edge, and (NavTricycle) out past it when "Open the app" is clicked. */}
      <header className="pointer-events-none fixed inset-x-0 top-3 z-40 flex justify-center px-3">
        <nav aria-label="Main" className="landing-pill pointer-events-auto isolate flex h-14 items-center gap-2 overflow-clip rounded-full border border-text bg-surface py-1.5 pr-1.5 pl-3 sm:gap-4 lg:gap-3">
          <NavTricycle />
          {CONTENTS.map((c) => (
            <a key={c.id} href={`#${c.id}`} className="hidden min-h-11 items-center px-2 text-text underline-offset-4 hover:underline lg:inline-flex">
              {c.title}
            </a>
          ))}
          <Link href="/demo" prefetch={false} className="doc-link hidden min-h-11 items-center px-2 sm:inline-flex">
            Agent demo
          </Link>
          <ButtonLink href="/login">Open the app</ButtonLink>
        </nav>
      </header>

      <main>
        <div className="relative h-[clamp(200px,34vw,440px)] w-full overflow-hidden border-b border-text">
          <CoverMotion>
            <Image src={cover} alt="A red motorized tricycle on a sunlit street" fill priority placeholder="blur" sizes="100vw" className="object-cover" style={{ objectPosition: "50% 20%" }} />
          </CoverMotion>
        </div>

        <div className={`${PAGE} grid gap-10 pb-16 lg:grid-cols-12 lg:gap-x-8`}>
          <div className="relative z-10 flex flex-col gap-7 self-start border border-text bg-raised p-6 sm:p-10 lg:col-span-7 lg:-mt-72">
            <h1 className="doc-h1 doc-hero-h1">
              {HERO_LINES.map((line, i) => (
                <Fragment key={line}>
                  <span className="hl">
                    <span style={{ "--i": i } as CSSProperties}>{line}</span>
                  </span>{" "}
                </Fragment>
              ))}
            </h1>
            <p className="doc-lead">Released when diesel really moves. Capped per tap by a Noir contract on Stellar. Returned to the LGU when the program ends.</p>
            {ACTIONS}
          </div>
          <div className="relative z-10 flex min-w-0 flex-col gap-5 self-start lg:col-span-5 lg:-mt-72">
            <HeroFilm />
            <Reveal as="section" className="glance">
              <h3 className="glance-h">The demo program</h3>
              <dl className="glance-list">
                {GLANCE.map(([label, value]) => (
                  <div key={label} className="glance-row">
                    <dt className="doc-small">{label}</dt>
                    <dd className="doc-mono">{value}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>
        </div>

        <section aria-labelledby="problem" className={SECTION}>
          <div className={`${PAGE} flex flex-col gap-10`}>
            <div className="text-center">{heading("problem")}</div>
            <p className="doc-lead mx-auto text-center">Fuel aid moves as one lump sum with no rules attached, and nobody can recover it until an audit a year later.</p>
            <dl className="grid gap-4 lg:grid-cols-[1.25fr_1fr_1fr]">
              {METRICS.map((m, i) => (
                <Reveal key={m.source} delay={i * 70} className={`tile flex flex-col gap-3 ${TILE_SHAPE[i]}`}>
                  <dt className="flex flex-col gap-3">
                    <span className="tile-art">
                      <ProblemFilm kind={TILE_FILM[i]} />
                    </span>
                    <span className={`font-mono leading-[1.05] font-medium tabular-nums ${i === 0 ? "text-[clamp(40px,22cqw,108px)]" : "text-[clamp(32px,3.2vw,44px)]"}`}>{m.figure}</span>
                  </dt>
                  <dd className={i === 0 ? "doc-lead" : undefined}>{m.what}</dd>
                  <dd className="doc-small mt-auto">Source: {m.source}</dd>
                </Reveal>
              ))}
            </dl>
            <div className="mx-auto w-full max-w-[960px]">
              <div aria-hidden="true" className="matrix-row hidden border-b border-text text-[14px] font-semibold md:grid">
                <span>What goes wrong</span>
                <span />
                <span>What TAPat does</span>
              </div>
              <ul aria-label="What goes wrong, and what TAPat does">
                {MATRIX.map(([wrong, fix], i) => (
                  <Reveal as="li" key={wrong} delay={i * 70} className="matrix-row">
                    <span>
                      <span className="doc-small block font-semibold md:hidden">What goes wrong</span>
                      {wrong}
                    </span>
                    <span aria-hidden="true" className="matrix-arrow">
                      →
                    </span>
                    <span>
                      <span className="doc-small block font-semibold md:hidden">What TAPat does</span>
                      {fix}
                    </span>
                  </Reveal>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section aria-labelledby="how" className="band py-16 lg:py-24">
          <div className={`${PAGE} flex flex-col gap-14`}>
            <div className="flex flex-col items-center gap-4 text-center">
              {heading("how")}
              <p className="doc-lead">Watch the Tranche Agent decide. Each visit plays one of five diesel scenarios.</p>
            </div>

            <Reveal as="div">
              <figure className="band-card p-3 sm:p-6">
                <ScenarioPlayer />
              </figure>
            </Reveal>

            <div className="flex flex-col gap-8">
              <h3 className="doc-h3 text-center">The agents</h3>
              <Reveal>
                <div className="band-card p-4 sm:p-6">
                  <Agents />
                </div>
              </Reveal>
              <div className="grid gap-4 md:grid-cols-2">
                {OTHER_PARTS.map((a, i) => (
                  <Reveal as="article" key={a.name} delay={i * 80} className="band-card flex min-w-0 flex-col gap-2 p-6">
                    <h4 className="doc-h3">{a.name}</h4>
                    <p>{a.decides}</p>
                    <dl className="doc-small grid gap-x-4 gap-y-1 sm:grid-cols-[6rem_1fr]">
                      <dt className="font-semibold">Method</dt>
                      <dd>
                        <Rich text={a.method} />
                      </dd>
                      {a.research.length ? (
                        <>
                          <dt className="font-semibold">Research</dt>
                          <dd className="flex flex-col gap-1">
                            {a.research.map((r) =>
                              r.href ? (
                                <a key={r.label} className="doc-link" href={r.href}>
                                  {r.label}
                                </a>
                              ) : (
                                <span key={r.label}>{r.label}</span>
                              ),
                            )}
                          </dd>
                        </>
                      ) : null}
                      <dt className="font-semibold">Settings</dt>
                      <dd>
                        <Rich text={a.settings} />
                      </dd>
                    </dl>
                  </Reveal>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <h3 className="doc-h3 text-center">How it&apos;s built</h3>
              <Reveal as="div">
                <div className="band-card overflow-hidden">
                  <BuildFlowFilm />
                </div>
              </Reveal>
              <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {FLOW.map((step, i) => (
                  <Reveal as="li" key={step} delay={(i % 4) * 70} className="flow-step band-card flex flex-col gap-2 p-4">
                    <span className="doc-mono font-medium">{String(i + 1).padStart(2, "0")}</span>
                    <span className="doc-small">
                      <Rich text={step} />
                    </span>
                  </Reveal>
                ))}
              </ol>
              <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {LAYERS.map((l, i) => (
                  <Reveal as="li" key={l} delay={i * 70} className="band-outline doc-small">
                    <Rich text={l} />
                  </Reveal>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section aria-labelledby="simulation" className="py-16 lg:py-24">
          <div className={`${PAGE} flex flex-col gap-10`}>
            <div className="flex flex-col items-center gap-4 text-center">
              {heading("simulation")}
              <p className="doc-lead">A simulated year of Philippine diesel, looping: crude oil, the peso, excise tax and VAT feed the price that moves every Tuesday.</p>
            </div>
            <Reveal as="div">
              <figure>
                <DieselSim />
              </figure>
            </Reveal>
          </div>
        </section>

        <section aria-labelledby="notes" className={SECTION}>
          <div className={`${PAGE} flex flex-col gap-8`}>
            <h2 id="notes" className="doc-h3">
              Prototype notes
            </h2>
            <ul className="doc-small grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {NOTES.map((n, i) => (
                <Reveal as="li" key={n} delay={(i % 3) * 70} className={`tile ${i === 0 ? "lg:col-span-2" : ""}`}>
                  {n}
                </Reveal>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer id="footer" className="overflow-hidden border-t border-text pt-12">
        <div className={`${PAGE} flex flex-col gap-10`}>
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-3">
              <Image src={logo} alt="TAPat" height={44} className="h-11 w-auto self-start" />
              <p className="doc-small max-w-[28ch]">Fuel aid for tricycle drivers, held to limits on-chain.</p>
            </div>
            <nav aria-label="On this page" className="flex flex-col">
              <p className="font-semibold">On this page</p>
              <a className={FOOTER_LINK} href="#problem">The problem</a>
              <a className={FOOTER_LINK} href="#how">How it works</a>
              <a className={FOOTER_LINK} href="#simulation">Diesel simulation</a>
              <a className={FOOTER_LINK} href="#notes">Prototype notes</a>
            </nav>
            <nav aria-label="App" className="flex flex-col">
              <p className="font-semibold">App</p>
              <Link className={FOOTER_LINK} href="/login" prefetch={false}>Open the app</Link>
              <Link className={FOOTER_LINK} href="/demo" prefetch={false}>Agent demo</Link>
            </nav>
            <div className="flex flex-col">
              <p className="font-semibold">Credits</p>
              <a className={FOOTER_LINK} href="https://www.pexels.com/photo/old-tricycle-on-street-in-philippines-4330929/">
                Cover photo: Denniz Futalan / Pexels
              </a>
              <p className="doc-small min-h-11 py-2.5">Velo × Noir Agentic Payment Hackathon 2026</p>
            </div>
          </div>
          <p className="doc-small border-t border-ring-surface pt-6">© 2026 TAPat · Prototype on Stellar Testnet</p>
        </div>
        <p aria-hidden="true" className="footer-wordmark mt-6">
          TAPat
        </p>
      </footer>
    </div>
  );
}
