// The phone mockups: the app's own components with the Figma file's sample data (design/figma-plugin/code.js).
import type { ReactNode } from "react";
import { DEFAULT_PHP_PER_XLM, TAP_REASON_LABELS, type PricePoint, type Station } from "@tapat/shared";
import { php, phpTile } from "@/lib/format";
import { EdgeChart, PriceChart } from "../(app)/_components/charts";
import { Invariant, Receipt, StationRow } from "../(app)/_components/money";
import { TabBar } from "../(app)/_components/TabBar";
import {
  Actions,
  Button,
  Card,
  Chip,
  DemoRate,
  KeyValues,
  LinkButton,
  ListCard,
  Notice,
  StatCard,
  StatRow,
  TopBar,
} from "../(app)/_components/ui";

const STROOPS_PER_PHP = 1_000_000n;
const stroops = (pesos: number) => BigInt(pesos) * STROOPS_PER_PHP;
const money = (pesos: number) => php(stroops(pesos), DEFAULT_PHP_PER_XLM);
const tile = (pesos: number) => phpTile(stroops(pesos), DEFAULT_PHP_PER_XLM);

function Screen({ tab, children }: { tab: string; children: ReactNode }) {
  return (
    <div className="relative flex min-h-full flex-col bg-surface pb-14 text-text">
      {/* The Figma frames' status bar, which also keeps the top bar clear of the camera. */}
      <p className="px-7 pt-3.5 font-mono text-mono">9:41</p>
      {children}
      <TabBar path={tab} />
    </div>
  );
}

function Content({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-col gap-4 px-5 pt-2 pb-6">{children}</div>;
}

export function HomeScreen() {
  return (
    <Screen tab="/dashboard">
      <TopBar account={false} />
      <Content>
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 flex-1 text-h2">TODA Fuel Aid — San Roque</p>
          <Chip tone="mint">Active</Chip>
        </div>
        <ListCard rows={[{ title: `${money(10_000)} budget`, meta: `${money(5_500)} left to fund`, chip: "Velo verified", tone: "accent" }]} />
        <StatCard tone="forest" full label="Funded" value={tile(4_500)} />
        <StatRow>
          <StatCard label="Spent" value={tile(350)} />
          <StatCard label="Held" value={tile(960)} />
        </StatRow>
        <StatRow>
          <StatCard label="Pending" value={tile(0)} />
          <StatCard label="Returned" value={tile(0)} />
        </StatRow>
        <Invariant ok escrow={money(3_190)} />
        <DemoRate />
      </Content>
    </Screen>
  );
}

export function IntakeScreen() {
  return (
    <Screen tab="/intake">
      <TopBar account={false} title="Intake results" back="/intake" />
      <Content>
        <p className="text-h2">12 rows checked</p>
        <Chip>precomputed OCR</Chip>
        <StatRow>
          <StatCard label="Approved" value="4" />
          <StatCard label="Already enrolled" value="4" />
        </StatRow>
        <StatRow>
          <StatCard label="Rejected" value="2" />
          <StatCard label="Uncertain" value="2" />
        </StatRow>
        <ListCard
          heading="Rejected"
          rows={[
            { title: "Rodel Cruz", meta: "Ghost, duplicate plate", chip: "Rejected" },
            { title: "Mark Salazar", meta: "Underage", chip: "Rejected" },
          ]}
        />
        <Card>
          <p className="text-label">Calibration</p>
          <KeyValues
            rows={[
              ["Approve at or above λ", "0.81"],
              ["Reject below λ", "0.62"],
              ["Max wrongful denial α", "0.05"],
              ["Max ghost admission β", "0.02"],
            ]}
          />
        </Card>
      </Content>
    </Screen>
  );
}

export function EnrollScreen() {
  return (
    <Screen tab="/enroll">
      <TopBar account={false} title="Enrolled" back="/enroll" chip="Active" tone="mint" />
      <Content>
        <Card>
          <KeyValues
            rows={[
              ["Driver", "Ana V."],
              ["Card", "…A1B2"],
              ["Hash prefix", "e4b81d90"],
              ["Per-tap cap", money(500)],
              ["Expires", "Nov 30, 2026 · 11:59 PM"],
            ]}
          />
        </Card>
        <Card>
          <p className="text-label">Photo check</p>
          <Chip tone="mint">precomputed vision · matched</Chip>
          <KeyValues
            rows={[
              ["Plate", "NAV 5512"],
              ["TODA", "San Roque TODA"],
            ]}
          />
        </Card>
        <ListCard
          heading="On-chain"
          rows={[
            { title: "Device registered", meta: "tx 4c1d…0a9f", chip: "Succeeded", tone: "mint" },
            { title: "Policy registered", meta: "tx b82e…77c3", chip: "Succeeded", tone: "mint" },
          ]}
        />
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

export function TrancheScreen() {
  return (
    <Screen tab="/demo">
      <TopBar account={false} title="Tranche Agent" back="/demo" />
      <Content>
        <PriceChart points={PRICE_POINTS} total={PRICE_POINTS.length} thresholdPhp={65} fired simulated />
        <Card>
          <p className="text-label">Tranche decision</p>
          <KeyValues
            rows={[
              ["Threshold", "PHP 65.00"],
              ["Segment mean", "PHP 70.90"],
              ["Changepoint probability", "0.94"],
              ["Budget after", money(5_500)],
            ]}
          />
        </Card>
        <ListCard
          heading="Funding"
          rows={[
            { title: "Juan D. …9C7E", meta: "tx a1c9…3e70", value: money(1_500) },
            { title: "Pedro R. …3A54", meta: "tx 6d42…b018", value: money(1_500) },
            { title: "Ramon B. …77B0", meta: "Skipped, EXPIRED", chip: "Skipped" },
          ]}
        />
      </Content>
    </Screen>
  );
}

export function RefusedScreen() {
  return (
    <Screen tab="/station/A">
      <TopBar account={false} chip="Station A" />
      <Content>
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
          note="Declined: PHP 800.00 is over the PHP 500.00 per-tap cap — rejected by the Noir contract (simulation of `authorize` returned Error #3); no tx submitted."
        />
        <DemoRate />
      </Content>
      <Actions solid>
        <Button look="secondary">Clear</Button>
      </Actions>
    </Screen>
  );
}

const REASON = "MIDAS 2.31 >= 1.78 (NEAR_CAP_STREAK)";
const ROTONDA = {
  id: "B",
  name: "Rotonda Fuels",
  status: "frozen",
  frozenReason: REASON,
  pendingStroops: stroops(960).toString(),
  spentStroops: "0",
} as Station;

export function FrozenScreen() {
  return (
    <Screen tab="/demo">
      <TopBar account={false} title="Freeze Agent" back="/demo" />
      <Content>
        <Notice tone="frozen" title="Rotonda Fuels frozen">
          {REASON}
        </Notice>
        <EdgeChart scores={[0.42, 0.51, 0.47, 0.63, 0.58, 0.74, 0.88, 1.02, 1.21, 1.44, 1.63, 2.31]} threshold={1.78} frozenScore={2.31} />
        <StationRow station={ROTONDA} phpPerXlm={DEFAULT_PHP_PER_XLM} />
      </Content>
      <Actions>
        <LinkButton href="/demo">Run settlement</LinkButton>
      </Actions>
    </Screen>
  );
}

export function ReturnedScreen() {
  return (
    <Screen tab="/demo">
      <TopBar account={false} title="End program" back="/demo" />
      <Content>
        <StatCard tone="forest" full label="Returned to the LGU wallet" value={tile(3_190)} />
        <ListCard
          heading="Per card"
          rows={[
            { title: "Juan D. …9C7E", meta: "Revoked, tx 8a01…cc42", value: money(1_150) },
            { title: "Pedro R. …3A54", meta: "Revoked, tx 3fd9…10be", value: money(540) },
            { title: "Ramon B. …77B0", meta: "Empty escrow, no sweep", value: money(0) },
            { title: "Ana V. …A1B2", meta: "Empty escrow, no sweep", value: money(0) },
            { title: "Lito G. …AL05", meta: "Revoked, tx e770…5b2d", value: money(1_500) },
          ]}
        />
        <DemoRate />
      </Content>
      <Actions>
        <LinkButton href="/demo">View final totals</LinkButton>
      </Actions>
    </Screen>
  );
}
