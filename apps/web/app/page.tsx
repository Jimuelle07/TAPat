"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Dashboard } from "@tapat/shared";
import { php, phpTile } from "@/lib/format";
import { useDashboard } from "@/lib/use-dashboard";
import { Invariant } from "./_components/money";
import {
  Body,
  Chip,
  DemoRate,
  ErrorBlock,
  ListCard,
  NoProgram,
  Skeleton,
  StatCard,
  StatRow,
  Toast,
  TopBar,
  type ChipTone,
  type ListRow,
} from "./_components/ui";
import { BudgetSheet } from "./BudgetSheet";
import { ExportSheet } from "./ExportSheet";

const STATUS: Record<Dashboard["program"]["status"], { label: string; tone: ChipTone }> = {
  draft: { label: "Draft", tone: "outline" },
  active: { label: "Active", tone: "mint" },
  ending: { label: "Ending", tone: "outline" },
  ended: { label: "Ended", tone: "outline" },
};

function budgetRow(dashboard: Dashboard, onClick: () => void): ListRow {
  const { budget, phpPerXlm } = dashboard;
  if (budget.state === "none") {
    return { title: "No budget yet", meta: "Fund it before a tranche can release", chip: "Fund budget", tone: "accent", onClick };
  }
  if (budget.state === "waiting") {
    return { title: "Budget payment started", meta: "Open checkout to finish paying", chip: "Waiting for Velo…", tone: "outline", onClick };
  }
  return {
    title: `${php(budget.verifiedStroops, phpPerXlm)} budget`,
    meta: `${php(budget.remainingStroops, phpPerXlm)} left to fund`,
    chip: "Velo verified",
    tone: "accent",
    onClick,
  };
}

export default function Home() {
  const state = useDashboard();
  const search = useSearchParams();
  const [budgetOpen, setBudgetOpen] = useState(search.get("sheet") === "budget");
  const [exportOpen, setExportOpen] = useState(false);
  const budgetReturn = search.get("budget");

  if (state.status === "loading") {
    return (
      <>
        <TopBar />
        <Body>
          <Skeleton kinds={["line", "row", "card", "card", "card", "row"]} />
        </Body>
      </>
    );
  }
  if (state.status === "no-program") {
    return (
      <>
        <TopBar />
        <Body>
          <NoProgram body="Create a program to set the cap, tranche and expiry." />
        </Body>
      </>
    );
  }
  if (state.status === "error") {
    return (
      <>
        <TopBar />
        <Body>
          <ErrorBlock title="Could not load the dashboard" message={state.message} onRetry={() => void state.reload()} />
        </Body>
      </>
    );
  }

  const { dashboard } = state;
  const rate = dashboard.phpPerXlm;
  const status = STATUS[dashboard.program.status];
  const frozen = dashboard.stations.filter((s) => s.status === "frozen");
  const stationsMeta =
    dashboard.stations.length === 0
      ? "Not set up yet"
      : frozen.length > 0
        ? `${frozen.map((s) => s.name).join(", ")} ${frozen.length === 1 ? "is" : "are"} frozen`
        : "All stations active";

  return (
    <>
      <TopBar />
      <Body>
        <div className="flex items-start justify-between gap-2">
          <h1 className="min-w-0 flex-1 text-h2">{dashboard.program.name}</h1>
          <Chip tone={status.tone}>{status.label}</Chip>
        </div>
        <ListCard rows={[budgetRow(dashboard, () => setBudgetOpen(true))]} />
        <StatCard tone="forest" full label="Funded" value={phpTile(dashboard.fundedStroops, rate)} />
        <StatRow>
          <StatCard label="Spent" value={phpTile(dashboard.spentStroops, rate)} />
          <StatCard label="Held" value={phpTile(dashboard.heldStroops, rate)} />
        </StatRow>
        <StatRow>
          <StatCard label="Pending" value={phpTile(dashboard.pendingStroops, rate)} />
          <StatCard label="Returned" value={phpTile(dashboard.returnedStroops, rate)} />
        </StatRow>
        <Invariant ok={dashboard.invariantOk} escrow={php(dashboard.escrowRemainingStroops, rate)} />
        <DemoRate />
        <ListCard
          rows={[
            { title: "Stations", meta: stationsMeta, href: "/stations" },
            { title: "Cards", meta: `${dashboard.counts.enrolled} enrolled`, href: "/cards" },
            { title: "Activity", meta: "Taps and agent decisions", href: "/activity" },
            { title: "Export for COA", meta: "Every money event with its tx hash", onClick: () => setExportOpen(true) },
            { title: "System health", meta: "RPC, Velo, Telegram, gas mode", href: "/health" },
          ]}
        />
      </Body>
      {budgetReturn === "success" ? <Toast>Payment sent — waiting for Velo verification</Toast> : null}
      {budgetReturn === "cancel" ? <Toast tone="info">Checkout cancelled</Toast> : null}
      <BudgetSheet dashboard={dashboard} open={budgetOpen} onClose={() => setBudgetOpen(false)} onChanged={() => void state.reload()} />
      <ExportSheet programId={dashboard.program.id} open={exportOpen} onClose={() => setExportOpen(false)} />
    </>
  );
}

