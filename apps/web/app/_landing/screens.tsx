"use client";

// The simulated app in the phone mockups: Remotion scenes built from the app's own components, with the Figma file's
// sample data (design/figma-plugin/code.js). Each scene plays one step of the money loop, driven by the current frame.
import type { ComponentType, CSSProperties, ReactNode } from "react";
import { DEFAULT_PHP_PER_XLM, TAP_REASON_LABELS, type ChainTx, type Dashboard, type PricePoint, type Station, type TrancheState } from "@tapat/shared";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { php, phpTile } from "@/lib/format";
import { EdgeChart, PriceChart } from "../(app)/_components/charts";
import { Receipt, StationRow } from "../(app)/_components/money";
import { TabBar } from "../(app)/_components/TabBar";
import { TapScene, type TapPhase } from "../(app)/_components/TapScene";
import { TrancheReleasing, TrancheStatusCard } from "../(app)/_components/TrancheStatus";
import { Actions, Card, Chip, DemoRate, KeyValues, LinkButton, ListCard, Notice, StatCard, StatRow, TopBar } from "../(app)/_components/ui";

export const SCREEN_WIDTH = 390;
export const SCREEN_HEIGHT = 853;

const STROOPS_PER_PHP = 1_000_000;
const stroops = (pesos: number) => BigInt(Math.round(pesos) * STROOPS_PER_PHP);
const money = (pesos: number) => php(stroops(pesos), DEFAULT_PHP_PER_XLM);
const tile = (pesos: number) => phpTile(stroops(pesos), DEFAULT_PHP_PER_XLM);

const REASON = "MIDAS 2.31 >= 1.78 (NEAR_CAP_STREAK)";
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const OUT = Easing.bezier(0.16, 1, 0.3, 1);

/** 0 before frame `at`, easing to 1 over `frames`. */
function useProgress(at: number, frames: number): number {
  return interpolate(useCurrentFrame(), [at, at + frames], [0, 1], { ...CLAMP, easing: OUT });
}

/** Holds its place in the layout and rises in at frame `at`, so nothing shifts as a scene fills up. */
function Reveal({ at, children }: { at: number; children: ReactNode }) {
  const progress = useProgress(at, 14);
  return <div style={{ opacity: progress, translate: `0 ${(1 - progress) * 12}px` }}>{children}</div>;
}

function CountedNumber({ label, value, at }: { label: string; value: number; at: number }) {
  const progress = useProgress(at, 24);
  return <StatCard label={label} value={String(Math.round(value * progress))} />;
}

/** The card glides onto the reader, then the reader answers at frame `at`. */
function Tap({ at, result, last4, reading, answer }: { at: number; result: TapPhase; last4: string; reading: string; answer: string }) {
  const frame = useCurrentFrame();
  const arrived = useProgress(4, 20);
  const answered = frame >= at;
  // A short head shake when the reader refuses the card.
  const shake = result === "error" && answered ? Math.sin((frame - at) * 1.4) * interpolate(frame, [at, at + 16], [6, 0], CLAMP) : 0;
  return (
    <div style={{ "--glide": 1 - arrived, translate: `${shake}px 0` } as CSSProperties}>
      <TapScene phase={answered ? result : "reading"} last4={last4} label={answered ? answer : reading} />
    </div>
  );
}

function Screen({ tab, children }: { tab: string; children: ReactNode }) {
  return (
    // The transform pins the app's `position: fixed` TabBar to this screen.
    <AbsoluteFill className="overflow-hidden bg-surface text-text" style={{ transform: "translateZ(0)" }}>
      <div className="relative flex min-h-full flex-col pb-14">
        {/* The Figma frames' status bar, which also keeps the top bar clear of the camera. */}
        <p className="px-7 pt-3.5 font-mono text-mono">9:41</p>
        {children}
        <TabBar path={tab} />
      </div>
    </AbsoluteFill>
  );
}

function Content({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-col gap-4 px-5 pt-2 pb-6">{children}</div>;
}

// The dashboard's sample money. Funded = spent + held + pending + escrow + returned.
const LEDGER = [
  { label: "Spent", pesos: 350, swatch: "bg-primary", at: 24 },
  { label: "Held", pesos: 960, swatch: "bg-frozen ring-1 ring-inset ring-text/15", at: 32 },
  { label: "Pending", pesos: 0, swatch: "bg-accent", at: 40 },
  { label: "Escrow remaining", pesos: 3_190, swatch: "bg-primary/40", at: 48 },
  { label: "Returned", pesos: 0, swatch: "bg-muted", at: 56 },
];
const FUNDED = 4_500;
const RULE = "border-b border-ring-surface last:border-b-0";

function LedgerRow({ label, pesos, swatch, at }: (typeof LEDGER)[number]) {
  const progress = useProgress(at, 30);
  return (
    <div className={`flex items-center gap-3 py-2 ${RULE}`}>
      <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-sm ${swatch}`} />
      <dt className="flex-1 text-small">{label}</dt>
      <dd className="text-small tabular-nums">{money(pesos * progress)}</dd>
    </div>
  );
}

function LedgerBar() {
  const progress = useProgress(24, 40);
  return (
    <div aria-hidden="true" className="flex h-2 gap-px overflow-hidden rounded-sm bg-sunken">
      {LEDGER.filter((part) => part.pesos > 0).map((part) => (
        <span key={part.label} className={part.swatch} style={{ width: `${(part.pesos / FUNDED) * 100 * progress}%` }} />
      ))}
    </div>
  );
}

function FundedValue() {
  return <span className="text-h2 tabular-nums">{money(FUNDED * useProgress(10, 36))}</span>;
}

function StationLine({ name, line, status, spent, frozen, reason }: { name: string; line: string; status: string; spent: string; frozen?: boolean; reason?: string }) {
  return (
    <li className={`flex min-h-14 items-center gap-3 py-3 ${RULE}`}>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-small">{name}</span>
        <span className="text-caption text-muted tabular-nums">{line}</span>
        {reason !== undefined ? <span className="text-caption break-words">{reason}</span> : null}
      </span>
      <span className="flex flex-col items-end gap-1">
        <span className={`text-label ${frozen ? "text-declined" : "text-primary"}`}>{status}</span>
        <span className="text-caption text-muted tabular-nums">Spent {spent}</span>
      </span>
    </li>
  );
}

/** The dashboard as the app draws it (app/(app)/dashboard/page.tsx), with its money counted up by the frame. */
function HomeScene() {
  return (
    <Screen tab="/dashboard">
      <TopBar account={false} />
      <Content>
        <div className="flex flex-col gap-6">
          <header className="flex flex-col gap-2">
            <p className="text-h1">TODA Fuel Aid — San Roque</p>
            <p className="text-small">
              <span className="font-medium text-primary">Active</span> · Every peso funded is spent, held, pending, in escrow or returned.
            </p>
          </header>
          <Reveal at={4}>
            <div className="flex items-center gap-3 rounded-md bg-sunken px-4 py-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-caption text-muted">
                  Budget · <span className="text-primary">Velo verified</span>
                </span>
                <span className="text-h2 tabular-nums">{money(10_000)}</span>
                <span className="text-caption text-muted tabular-nums">{money(5_500)} left to fund</span>
              </div>
              <span className="flex min-h-11 shrink-0 items-center rounded-md border border-ring-surface bg-raised px-4 text-label">Manage</span>
            </div>
          </Reveal>
          <Reveal at={10}>
            <div className="flex flex-col gap-4 rounded-md border border-ring-surface bg-raised p-4">
              <div className="flex items-end justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-caption text-muted">Funded</span>
                  <FundedValue />
                </div>
                <Reveal at={70}>
                  <span className="text-label text-primary">Balanced</span>
                </Reveal>
              </div>
              <LedgerBar />
              <dl>
                {LEDGER.map((part) => (
                  <LedgerRow key={part.label} {...part} />
                ))}
              </dl>
            </div>
          </Reveal>
          <Reveal at={84}>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-3">
                <p className="text-label font-semibold">Stations</p>
                <span className="flex min-h-11 items-center text-caption text-primary">1 frozen · View all</span>
              </div>
              <ul>
                <StationLine name="Petron San Roque" line={`Pending ${money(0)}`} status="Active" spent={money(350)} />
                <StationLine name="Rotonda Fuels" line={`Held ${money(960)}`} status="Frozen" spent={money(0)} frozen reason={REASON} />
              </ul>
            </div>
          </Reveal>
        </div>
      </Content>
    </Screen>
  );
}

function IntakeScene() {
  const rows = Math.round(useProgress(6, 34) * 12);
  return (
    <Screen tab="/intake">
      <TopBar account={false} title="Intake results" back="/intake" />
      <Content>
        <p className="text-h2">{rows} rows checked</p>
        <Chip>precomputed OCR</Chip>
        <StatRow>
          <CountedNumber label="Approved" value={4} at={36} />
          <CountedNumber label="Already enrolled" value={4} at={44} />
        </StatRow>
        <StatRow>
          <CountedNumber label="Rejected" value={2} at={52} />
          <CountedNumber label="Uncertain" value={2} at={60} />
        </StatRow>
        <Reveal at={86}>
          <ListCard
            heading="Rejected"
            rows={[
              { title: "Rodel Cruz", meta: "Ghost, duplicate plate", chip: "Rejected" },
              { title: "Mark Salazar", meta: "Underage", chip: "Rejected" },
            ]}
          />
        </Reveal>
        <Reveal at={108}>
          <Card>
            <KeyValues
              rows={[
                ["Max wrongful denial α", "0.05"],
                ["Max ghost admission β", "0.02"],
              ]}
            />
          </Card>
        </Reveal>
      </Content>
    </Screen>
  );
}

function EnrollScene() {
  const frame = useCurrentFrame();
  const chip = (at: number) => (frame >= at ? { chip: "Succeeded", tone: "mint" as const } : { chip: "Pending" });
  return (
    <Screen tab="/enroll">
      <TopBar account={false} title="Enroll" back="/enroll" />
      <Content>
        <Tap at={40} result="done" last4="A1B2" reading="Hold the card to the phone" answer="Card read" />
        <Reveal at={52}>
          <Card>
            <KeyValues
              rows={[
                ["Driver", "Ana V."],
                ["Card", "…A1B2"],
                ["Per-tap cap", money(500)],
              ]}
            />
          </Card>
        </Reveal>
        <Reveal at={78}>
          <ListCard
            heading="On-chain"
            rows={[
              { title: "Device registered", meta: "tx 4c1d…0a9f", ...chip(100) },
              { title: "Policy registered", meta: "tx b82e…77c3", ...chip(126) },
            ]}
          />
        </Reveal>
      </Content>
    </Screen>
  );
}

// 44 quiet days, the one-day spike at point 15 that the agent ignores, then a sustained shift from point 41.
const DIESEL = [
  62.1, 62.3, 62.0, 62.4, 62.2, 62.5, 62.3, 62.1, 62.4, 62.6, 62.3, 62.5, 62.2, 62.4, 66.0, 62.6, 62.4, 62.5, 62.3, 62.7, 62.5, 62.4, 62.8,
  62.6, 62.5, 62.9, 62.7, 62.6, 62.8, 63.0, 62.8, 62.9, 62.7, 63.0, 62.9, 63.1, 62.9, 63.0, 63.2, 63.0, 70.9, 71.0, 70.9, 70.95, 70.85,
];
const PRICE_POINTS: PricePoint[] = DIESEL.map((pricePhp, index) => ({
  programId: "sample",
  idx: index + 1,
  pricePhp,
  simulated: true,
  cpRecent: null,
  mapR: null,
}));
const FEED_END = 130;
const FUNDS = [
  { id: "1", at: FEED_END + 10, outerHash: "a1c9000000003e70" },
  { id: "2", at: FEED_END + 26, outerHash: "6d4200000000b018" },
  { id: "3", at: FEED_END + 42, outerHash: "0ef70000000094a2" },
];

function FundScene() {
  const frame = useCurrentFrame();
  const idx = Math.round(interpolate(frame, [6, FEED_END], [1, DIESEL.length], CLAMP));
  const tranche = {
    fired: idx === DIESEL.length,
    idx,
    total: DIESEL.length,
    lastPricePhp: DIESEL[idx - 1],
    cpRecent: idx > 40 ? 0.5 + (idx - 41) * 0.11 : 0.04,
    mapR: idx > 40 ? idx - 40 : idx,
    points: PRICE_POINTS.slice(0, idx),
  } as TrancheState;
  const dashboard = {
    phpPerXlm: DEFAULT_PHP_PER_XLM,
    budget: { state: "verified", verifiedStroops: stroops(10_000).toString() },
    program: { trancheStroops: stroops(1_500).toString() },
    counts: { cardsActive: 4 },
    recentChainTxs: FUNDS.filter((fund) => frame >= fund.at).map((fund) => ({
      id: fund.id,
      kind: "fund",
      status: frame >= fund.at + 12 ? "succeeded" : "pending",
      outerHash: fund.outerHash,
    })) as ChainTx[],
    recentDecisions: frame >= FUNDS[2].at + 12 ? [{ agent: "tranche" }] : [],
  } as unknown as Dashboard;
  return (
    <Screen tab="/demo">
      <TopBar account={false} title="Tranche Agent" back="/demo" />
      <Content>
        <TrancheStatusCard dashboard={dashboard} tranche={tranche} />
        <PriceChart points={tranche.points} total={DIESEL.length} thresholdPhp={65} fired={tranche.fired} simulated />
        <TrancheReleasing dashboard={dashboard} tranche={tranche} />
      </Content>
    </Screen>
  );
}

const TAP_ANSWER = 62;

function RefuseScene() {
  const frame = useCurrentFrame();
  const typed = useProgress(4, 26);
  const answered = frame >= TAP_ANSWER + 8;
  return (
    <Screen tab="/station/A">
      <TopBar account={false} chip="Station A" />
      <Content>
        <Tap at={TAP_ANSWER} result="error" last4="9C7E" reading="Reading the card" answer="Tap declined" />
        {answered ? (
          <Reveal at={TAP_ANSWER + 8}>
            <Receipt
              stationLabel="Station A"
              status="DECLINED"
              tone="danger"
              amount={money(800)}
              rows={[
                ["Card", "Juan D. …9C7E"],
                // Azeret Mono has no ₱ glyph, so the mockup spells it the way the design labels every other amount.
                ["Reason", TAP_REASON_LABELS.OVER_CAP.replace("₱", "PHP ")],
                ["Tx", "None submitted"],
              ]}
              note="Rejected by the Noir contract. No tx submitted."
            />
          </Reveal>
        ) : (
          <Card>
            <div className="flex items-center justify-between">
              <span className="text-label">Amount</span>
              <span className="font-mono text-mono">Cap {money(500)}</span>
            </div>
            <p className="font-mono text-amount-lg">{money(800 * typed)}</p>
          </Card>
        )}
      </Content>
    </Screen>
  );
}

const SCORES = [0.42, 0.51, 0.47, 0.63, 0.58, 0.74, 0.88, 1.02, 1.21, 1.44, 1.63, 2.31];
const THRESHOLD = 1.78;

function FreezeScene() {
  const frame = useCurrentFrame();
  const shown = Math.round(interpolate(frame, [8, 100], [1, SCORES.length], CLAMP));
  const frozen = shown === SCORES.length;
  const station = {
    id: "B",
    name: "Rotonda Fuels",
    status: frozen ? "frozen" : "active",
    frozenReason: frozen ? REASON : null,
    pendingStroops: stroops(960).toString(),
    spentStroops: "0",
  } as Station;
  return (
    <Screen tab="/demo">
      <TopBar account={false} title="Freeze Agent" back="/demo" />
      <Content>
        <EdgeChart scores={SCORES.slice(0, shown)} threshold={THRESHOLD} frozenScore={frozen ? SCORES[shown - 1] : null} />
        <StationRow station={station} phpPerXlm={DEFAULT_PHP_PER_XLM} />
        <Reveal at={104}>
          <Notice tone="frozen" title="Rotonda Fuels frozen">
            New taps refused. Settlement held.
          </Notice>
        </Reveal>
      </Content>
      <Reveal at={130}>
        <Actions>
          <LinkButton href="/demo">Run settlement</LinkButton>
        </Actions>
      </Reveal>
    </Screen>
  );
}

const SWEEPS = [
  { title: "Juan D. …9C7E", meta: "Revoked, tx 8a01…cc42", pesos: 1_150, at: 18 },
  { title: "Pedro R. …3A54", meta: "Revoked, tx 3fd9…10be", pesos: 540, at: 44 },
  { title: "Lito G. …AL05", meta: "Revoked, tx e770…5b2d", pesos: 1_500, at: 70 },
];

function ReturnScene() {
  const frame = useCurrentFrame();
  const returned = SWEEPS.reduce((sum, sweep) => sum + sweep.pesos * interpolate(frame, [sweep.at, sweep.at + 20], [0, 1], { ...CLAMP, easing: OUT }), 0);
  return (
    <Screen tab="/demo">
      <TopBar account={false} title="End program" back="/demo" />
      <Content>
        <StatCard tone="forest" full label="Returned to the LGU wallet" value={tile(returned)} />
        <div className="flex flex-col gap-3">
          {SWEEPS.map((sweep) => (
            <Reveal key={sweep.title} at={sweep.at}>
              <ListCard rows={[{ title: sweep.title, meta: sweep.meta, value: money(sweep.pesos) }]} />
            </Reveal>
          ))}
        </div>
        <Reveal at={100}>
          <DemoRate />
        </Reveal>
      </Content>
      <Reveal at={112}>
        <Actions>
          <LinkButton href="/demo">View final totals</LinkButton>
        </Actions>
      </Reveal>
    </Screen>
  );
}

export const SCENES = {
  top: { component: HomeScene, frames: 120 },
  list: { component: IntakeScene, frames: 135 },
  enroll: { component: EnrollScene, frames: 150 },
  fund: { component: FundScene, frames: 200 },
  refuse: { component: RefuseScene, frames: 125 },
  freeze: { component: FreezeScene, frames: 150 },
  return: { component: ReturnScene, frames: 130 },
} satisfies Record<string, { component: ComponentType; frames: number }>;

export type SceneId = keyof typeof SCENES;
