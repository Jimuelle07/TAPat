import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { DEFAULT_PHP_PER_XLM, phpToStroops, TAP_REASON_LABELS } from "@tapat/shared";
import { php } from "@/lib/format";
import cover from "./_landing/cover-tricycle-negros.jpg";
import { TapDemo, type TapChoice } from "./_landing/TapDemo";
import { ButtonLink, SectionHeading, Status, type StatusTone } from "./_landing/kit";

const plexSans = IBM_Plex_Sans({ variable: "--font-plex-sans", subsets: ["latin", "latin-ext"], weight: ["400", "500", "600"], display: "swap" });
// The peso sign (U+20B1) is in both families' latin-ext range.
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin", "latin-ext"], weight: ["400", "500"], display: "swap" });

export const metadata: Metadata = {
  title: "TAPat — fuel aid for tricycle drivers, held to limits on-chain",
  description: "TAPat releases, caps and returns fuel aid for tricycle drivers. A Noir contract on Stellar enforces every per-tap limit.",
};

const PAGE = "mx-auto w-full max-w-[1200px] px-[clamp(20px,4vw,48px)]";

/** Sample pesos as "₱1,234.00", through the same stroop formatter as the dashboard. */
const money = (pesos: number) => php(phpToStroops(pesos), DEFAULT_PHP_PER_XLM).replace("PHP ", "₱");

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
    reason: TAP_REASON_LABELS.OVER_CAP,
    note: "Rejected by the Noir contract. No tx submitted.",
  },
  {
    id: "expired",
    button: "Expired card",
    amount: money(200),
    card: "Pedro R. …3A54",
    last4: "3A54",
    verdict: "declined",
    reason: TAP_REASON_LABELS.EXPIRED,
    note: "Rejected by the Noir contract. No tx submitted.",
  },
];

/** The sample program the receipt follows. */
const LEDGER = { funded: 4500, spent: 350, held: 960, pending: 0, escrow: 0, returned: 3190 };
const balanced = LEDGER.spent + LEDGER.held + LEDGER.pending + LEDGER.escrow + LEDGER.returned === LEDGER.funded;

const CONTENTS = [
  { id: "brief", num: "", fil: "Sa madaling salita", en: "In brief" },
  { id: "problem", num: "1", fil: "Ang suliranin", en: "The problem" },
  { id: "how", num: "2", fil: "Paano ito gumagana", en: "How it works" },
  { id: "enforcement", num: "3", fil: "Ano ang nagpapatupad sa bawat patakaran", en: "What enforces each rule" },
  { id: "ledger", num: "4", fil: "Halimbawang talaan", en: "Sample ledger" },
  { id: "limits", num: "5", fil: "Mga limitasyon ng prototype", en: "Limits of this prototype" },
  { id: "try", num: "", fil: "Subukan", en: "Try it" },
];
const LIMITS: Array<[string, string]> = [
  ["Per-tap cap", money(500)],
  ["Fuel aid per card (one tranche)", money(1500)],
  ["Program budget deposit", money(10000)],
  ["Diesel price that triggers funding", `${money(65)} per litre`],
  ["Demo exchange rate", `${money(DEFAULT_PHP_PER_XLM)} per XLM`],
];
const STAKES = [ // cited figures from docs/PRD.md; text, not computed money
  { figure: "₱2.7B", what: "nearly lost to ghost and duplicate beneficiaries", source: "DSWD, via Daily Tribune", answer: "Ghosts and duplicates come off the masterlist before anyone enrolls." },
  { figure: "₱709.88M", what: "in DOTr subsidies unpaid or expired", source: "COA, via Astig.ph and NET25", answer: "Unspent aid returns to the LGU wallet the day the program ends." },
  { figure: "723,000", what: "tricycle drivers slated for aid", source: "PNA", answer: "Enrollment takes one card tap; the driver needs no app or data plan." },
];
const STEPS = [
  { num: "2.1", title: "Clean the masterlist", body: "Ghost and duplicate drivers come off the masterlist. Only the uncertain records get one Telegram message asking for evidence.", facts: [["5%", "maximum wrongful denials"], ["2%", "maximum ghost admissions"]] },
  { num: "2.2", title: "Enroll a card", body: "A TODA officer taps one NFC card, and its spending policy goes on-chain. The driver needs no app and no data plan.", facts: [["1 card", "is all a driver carries"], ["Telegram", "delivers the receipts"]] },
  { num: "2.3", title: "Fund when the price shift is real", body: "The Tranche Agent releases aid only when the diesel price stays above the threshold, inside a budget Velo has verified. A one-day spike releases nothing. The price series in this prototype is simulated.", facts: [[`${money(65)}`, "per litre threshold"], [money(1500), "per card"]] },
  { num: "2.4", title: "Refuse taps outside the policy", body: "A tap over the cap or past the card's expiry is refused by the contract. A refused tap writes nothing to the chain.", facts: [[money(500), "per-tap cap"], ["0 tx", "on a refusal"]] },
  { num: "2.5", title: "Freeze a suspicious station", body: "When a station's tap pattern looks wrong, only that station stops. New taps there are refused, and its settlement is held until the LGU unfreezes it.", facts: [["MIDAS-F", "scores every tap"], ["1 station", "paused; the others keep serving"]] },
  { num: "2.6", title: "Return what is left", body: "When the program ends, every card is revoked and its unspent aid goes back to the LGU wallet.", facts: [["Same day", "not a year later at audit"], ["1 CSV", "with a tx hash behind every number, for the COA"]] },
] as const;
const ENFORCEMENT = [
  { decision: "Fund", who: "Tranche Agent, on the diesel price", call: "payment_escrow.fund_escrow()" },
  { decision: "Refuse", who: "Each card's policy: cap, expiry, nonce", call: "payment_escrow.authorize()" },
  { decision: "Freeze", who: "Freeze Agent (MIDAS-F score) or an LGU rule", call: "API skips payment_escrow.claim()" },
  { decision: "Return", who: "LGU officer ends the program", call: "payment_escrow.sweep_on_revoke()" },
];
const LEDGER_ROWS: Array<{ step: string; event: string; amount: string; status?: [StatusTone, string] }> = [
  { step: "2.1 Intake", event: "12 rows checked; 2 ghosts removed", amount: "—" },
  { step: "2.2 Enroll", event: "Ana V. …A1B2; policy on-chain", amount: "—" },
  { step: "2.3 Fund", event: `3 cards × ${money(1500)}`, amount: `+${money(4500)}`, status: ["ok", "FUNDED"] },
  { step: "2.4 Tap", event: "Station A; Ana V. …A1B2", amount: `−${money(350)}`, status: ["ok", "PAID"] },
  { step: "2.4 Tap", event: "Station A; Juan D. …9C7E; over cap; no tx", amount: money(800), status: ["refused", "DECLINED"] },
  { step: "2.5 Freeze", event: "Rotonda Fuels; MIDAS-F 2.31 ≥ 1.78", amount: money(960), status: ["held", "HELD"] },
  { step: "2.6 Return", event: "3 cards revoked; swept to the LGU wallet", amount: money(3190), status: ["neutral", "RETURNED"] },
];

const TOTALS: Array<[string, number]> = [
  ["Funded", LEDGER.funded],
  ["Spent", LEDGER.spent],
  ["Held", LEDGER.held],
  ["Pending", LEDGER.pending],
  ["Escrow", LEDGER.escrow],
  ["Returned", LEDGER.returned],
];

function Logo({ priority = false }: { priority?: boolean }) {
  return (
    <span className="block h-11 w-[88px] shrink-0 overflow-hidden">
      {/* The icon file is square with wide margins; this slot shows its middle band, as in the app's top bar. */}
      <Image src="/tapat-app-icon-1024.png" alt="" width={88} height={88} className="-mt-[22px] max-w-none mix-blend-darken" priority={priority} />
    </span>
  );
}

const ACTIONS = (
  <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
    <ButtonLink href="/login">Open the app</ButtonLink>
    <Link href="/demo" prefetch={false} className="doc-link inline-flex min-h-11 items-center">
      Run the agent demo
    </Link>
  </div>
);

const SECTION = "border-t border-text py-16 lg:py-20";
const SECTION_GRID = `${PAGE} grid gap-8 lg:grid-cols-12 lg:gap-x-8`;
// min-w-0 lets the overflow-x-auto wrappers, not the page, scroll the min-w-[560px] tables on narrow screens.
const SECTION_BODY = "flex min-w-0 flex-col gap-6 lg:col-span-8";

const heading = (id: string) => {
  const c = CONTENTS.find((item) => item.id === id)!;
  return <SectionHeading id={c.id} num={c.num || undefined} fil={c.fil} en={c.en} />;
};

export default function Landing() {
  return (
    <div className={`landing ${plexSans.variable} ${plexMono.variable}`}>
      <header className="sticky top-0 z-40 border-b border-text bg-surface">
        <div className={`${PAGE} flex h-14 items-center justify-between gap-6`}>
          <Link href="/" prefetch={false} aria-label="TAPat" className="block">
            <Logo priority />
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/demo" prefetch={false} className="doc-link hidden min-h-11 items-center sm:inline-flex">
              Run the agent demo
            </Link>
            <ButtonLink href="/login">Open the app</ButtonLink>
          </div>
        </div>
      </header>

      <main>
        <div className="relative h-[clamp(240px,52vw,640px)] w-full overflow-hidden border-b border-text">
          <Image src={cover} alt="A red motorized tricycle on a sunlit street" fill priority placeholder="blur" sizes="100vw" className="object-cover" style={{ objectPosition: "50% 55%" }} />
        </div>

        <div className={`${PAGE} grid gap-10 pb-16 lg:grid-cols-12 lg:gap-x-8`}>
          <div className="relative z-10 flex flex-col gap-6 border border-text bg-raised p-6 sm:p-10 lg:col-span-7 lg:-mt-32">
            <h1 className="doc-h1">Fuel aid for tricycle drivers, paid by card and held to limits on-chain.</h1>
            <p className="doc-lead">
              TAPat is a prototype aid program for TODA drivers. An agent releases each card&apos;s fuel aid when the diesel price has really moved. A Noir contract on Stellar refuses any tap over the cap or past its expiry. When the program ends, unspent aid goes back to the LGU wallet the same day.
            </p>
            {ACTIONS}
            <p className="doc-small">Officers log in or create an account to try it. Drivers never need the app.</p>
            <dl className="doc-small grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-t border-ring-surface pt-4">
              <dt className="font-semibold">Status</dt>
              <dd>Prototype on Stellar Testnet</dd>
              <dt className="font-semibold">Built for</dt>
              <dd>Velo × Noir Agentic Payment Hackathon, November 2026</dd>
            </dl>
          </div>

          <div className="flex flex-col gap-8 lg:col-span-4 lg:col-start-9 lg:pt-8">
            <p className="doc-mono text-[13px]">
              Cover: a motorized tricycle in Negros Island Region. Photo by{" "}
              <a className="doc-link" href="https://www.pexels.com/photo/old-tricycle-on-street-in-philippines-4330929/">
                Denniz Futalan, Pexels
              </a>
              . Stock photo; not a TAPat driver or station.
            </p>
            <nav aria-label="Contents">
              <p className="font-semibold">
                <span lang="fil">Nilalaman</span> / Contents
              </p>
              <ol className="mt-2">
                {CONTENTS.map((c) => (
                  <li key={c.id} className="border-b border-ring-surface">
                    <a href={`#${c.id}`} className="block min-h-11 py-2.5 hover:underline">
                      {c.num ? <span className="font-mono mr-3">{c.num}</span> : null}
                      <span lang="fil">{c.fil}</span> / {c.en}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </div>
        </div>

        <section aria-labelledby="brief" className={SECTION}>
          <div className={SECTION_GRID}>
            <div className="lg:col-span-4">{heading("brief")}</div>
            <div className={SECTION_BODY}>
              <div className="grid gap-8 lg:grid-cols-8">
                <div className="flex flex-col gap-4 lg:col-span-3">
                  <p>The demo program runs on these limits. The LGU signs them; the contract enforces them.</p>
                  <table className="doc-table">
                    <caption className="sr-only">Demo program limits</caption>
                    <thead>
                      <tr>
                        <th scope="col">Limit</th>
                        <th scope="col">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {LIMITS.map(([limit, value]) => (
                        <tr key={limit}>
                          <td>{limit}</td>
                          <td className="doc-mono text-right">{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <figure className="lg:col-span-5">
                  <TapDemo choices={TAP_CHOICES} autoplay="over" />
                  <figcaption className="doc-small pt-3">Fig. 1. A sample station terminal. Pick a tap to see the contract&apos;s answer. Sample data; nothing leaves your browser.</figcaption>
                </figure>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="problem" className={SECTION}>
          <div className={SECTION_GRID}>
            <div className="lg:col-span-4">{heading("problem")}</div>
            <div className={SECTION_BODY}>
              <p>Fuel aid programs usually pick one of two failures: checks so slow that aid arrives late, or payouts so loose that money leaks to ghost beneficiaries and goes unspent.</p>
              <div className="overflow-x-auto">
                <table className="doc-table min-w-[560px]">
                  <thead>
                    <tr>
                      <th scope="col">Figure</th>
                      <th scope="col">What it counts</th>
                      <th scope="col">Source</th>
                      <th scope="col">What TAPat changes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {STAKES.map((s) => (
                      <tr key={s.figure}>
                        <td className="doc-mono text-[20px] font-medium whitespace-nowrap">{s.figure}</td>
                        <td>{s.what}</td>
                        <td className="doc-small">{s.source}</td>
                        <td>{s.answer}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="how" className={SECTION}>
          <div className={SECTION_GRID}>
            <div className="lg:col-span-4">{heading("how")}</div>
            <div className={SECTION_BODY}>
              <p>One program, from the masterlist to its last day. Each step names the limit that applies.</p>
              <ol className="border-t border-text">
                {STEPS.map((s) => (
                  <li key={s.num} className="grid gap-3 border-b border-ring-surface py-6 sm:grid-cols-[4rem_1fr]">
                    <span className="doc-mono">{s.num}</span>
                    <div>
                      <h3 className="doc-h3">{s.title}</h3>
                      <p className="max-w-[62ch]">{s.body}</p>
                      <dl className="doc-small mt-2 flex flex-wrap gap-x-8 gap-y-1">
                        {s.facts.map(([v, label]) => (
                          <div key={v} className="flex gap-2">
                            <dt className="doc-mono font-medium">{v}</dt>
                            <dd>{label}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section aria-labelledby="enforcement" className={SECTION}>
          <div className={SECTION_GRID}>
            <div className="lg:col-span-4">{heading("enforcement")}</div>
            <div className={SECTION_BODY}>
              <p>The agents decide. The contract has the last word: a decision outside the signed limits does not execute.</p>
              <div className="overflow-x-auto">
                <table className="doc-table min-w-[560px]">
                  <thead>
                    <tr>
                      <th scope="col">Decision</th>
                      <th scope="col">Who decides</th>
                      <th scope="col">What enforces it</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ENFORCEMENT.map((e) => (
                      <tr key={e.decision}>
                        <td>{e.decision}</td>
                        <td>{e.who}</td>
                        <td className="doc-mono">{e.call}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="doc-small">Velo verifies the budget checkout and sponsors the network fee of every Noir call. Velo does not verify individual taps; the per-tap limits belong to the Noir contract.</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="ledger" className={SECTION}>
          <div className={SECTION_GRID}>
            <div className="lg:col-span-4">{heading("ledger")}</div>
            <div className={SECTION_BODY}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p>One sample program for one TODA, followed from intake to return. The totals must balance.</p>
                <Status tone="neutral">SAMPLE DATA</Status>
              </div>
              <div className="overflow-x-auto">
                <table className="doc-table min-w-[560px]">
                  <caption className="sr-only">Sample program ledger</caption>
                  <thead>
                    <tr>
                      <th scope="col">Step</th>
                      <th scope="col">Event</th>
                      <th scope="col" className="text-right">
                        Amount
                      </th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {LEDGER_ROWS.map((r, i) => (
                      <tr key={i}>
                        <td className="doc-mono whitespace-nowrap">{r.step}</td>
                        <td>{r.event}</td>
                        <td className="doc-mono text-right whitespace-nowrap">{r.amount}</td>
                        <td>{r.status ? <Status tone={r.status[0]}>{r.status[1]}</Status> : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="max-w-[420px]">
                <table className="doc-table">
                  <caption className="sr-only">Totals</caption>
                  <tbody>
                    {TOTALS.map(([label, pesos]) => (
                      <tr key={label}>
                        <td>{label}</td>
                        <td className="doc-mono text-right">{money(pesos)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="doc-mono flex flex-wrap items-center gap-3">
                Funded = spent + held + pending + escrow + returned <Status tone={balanced ? "ok" : "refused"}>{balanced ? "BALANCED" : "MISMATCH"}</Status>
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="limits" className={SECTION}>
          <div className={SECTION_GRID}>
            <div className="lg:col-span-4">{heading("limits")}</div>
            <div className="lg:col-span-8">
              <ul className="flex flex-col border-t border-text">
                <li className="border-b border-ring-surface py-3">Runs on Stellar Testnet. No real pesos move.</li>
                <li className="border-b border-ring-surface py-3">{`Amounts use a demo rate of ${money(DEFAULT_PHP_PER_XLM)} per XLM.`}</li>
                <li className="border-b border-ring-surface py-3">The limits shown are the demo program&apos;s defaults.</li>
                <li className="border-b border-ring-surface py-3">The sample terminal and the sample ledger on this page use sample data.</li>
                <li className="border-b border-ring-surface py-3">In the app, the diesel price series and the burst of suspicious taps are simulated, and the masterlist OCR results are precomputed. Each is labelled where it appears.</li>
                <li className="border-b border-ring-surface py-3">Velo verifies the budget checkout and sponsors network fees. It does not verify individual taps.</li>
                <li className="border-b border-ring-surface py-3">The cover photo is a stock photo, not a TAPat driver or station.</li>
              </ul>
            </div>
          </div>
        </section>

        <section aria-labelledby="try" className={SECTION}>
          <div className={SECTION_GRID}>
            <div className="lg:col-span-4">{heading("try")}</div>
            <div className={SECTION_BODY}>
              <p>Run the whole loop on a laptop or a phone. No NFC card is needed: Simulate card stands in for the tap.</p>
              {ACTIONS}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-text py-8">
        <div className={`${PAGE} doc-small flex flex-col gap-1`}>
          <p>TAPat — a prototype for the Velo × Noir Agentic Payment Hackathon, 2026.</p>
          <p>Cover photo: Denniz Futalan / Pexels, used under the Pexels License.</p>
        </div>
      </footer>
    </div>
  );
}
