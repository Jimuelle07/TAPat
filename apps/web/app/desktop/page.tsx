"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Dashboard } from "@tapat/shared";
import { buildFeed } from "@/lib/feed";
import { php, phpTile } from "@/lib/format";
import { useDashboard } from "@/lib/use-dashboard";
import { BudgetSheet } from "../(app)/BudgetSheet";
import { ExportSheet } from "../(app)/ExportSheet";
import { Invariant, StationRow } from "../(app)/_components/money";
import { Button, Card, Chip, DemoRate, EmptyState, KeyValues, ListCard, StatCard, Toast, type ChipTone, type ListRow } from "../(app)/_components/ui";
import { ActionRow, FeedTable, Gate, Page } from "./_components/kit";

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

function Figures({ dashboard }: { dashboard: Dashboard }) {
  const rate = dashboard.phpPerXlm;
  const tile = (label: string, stroops: string, tone?: "forest") => (
    <StatCard tone={tone} label={label} value={phpTile(stroops, rate)} live={{ to: Number(stroops), format: (n) => phpTile(String(Math.round(n)), rate) }} />
  );
  return (
    <div className="grid grid-cols-5 gap-3">
      {tile("Funded", dashboard.fundedStroops, "forest")}
      {tile("Spent", dashboard.spentStroops)}
      {tile("Held", dashboard.heldStroops)}
      {tile("Pending", dashboard.pendingStroops)}
      {tile("Returned", dashboard.returnedStroops)}
    </div>
  );
}

export default function Overview() {
  const state = useDashboard();
  const search = useSearchParams();
  const [budgetOpen, setBudgetOpen] = useState(search.get("sheet") === "budget");
  const [exportOpen, setExportOpen] = useState(false);
  const budgetReturn = search.get("budget");
  const dashboard = state.status === "ready" ? state.dashboard : null;

  return (
    <Page
      title={dashboard?.program.name ?? "Overview"}
      chip={dashboard !== null ? <Chip tone={STATUS[dashboard.program.status].tone}>{STATUS[dashboard.program.status].label}</Chip> : undefined}
      actions={
        dashboard !== null ? (
          <ActionRow>
            <Button look="secondary" onClick={() => setExportOpen(true)}>
              Export for COA
            </Button>
          </ActionRow>
        ) : undefined
      }
    >
      <Gate state={state} what="the dashboard" empty="Create a program to set the cap, tranche and expiry.">
        {(data) => {
          const feed = buildFeed(data).slice(0, 8);
          return (
            <>
              <Figures dashboard={data} />
              <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] items-start gap-6">
                <section className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-h2">Recent activity</h2>
                    <Link href="/desktop/activity" className="text-label text-primary underline-offset-4 hover:underline">
                      View all
                    </Link>
                  </div>
                  {feed.length === 0 ? (
                    <EmptyState icon="pulse" title="No activity yet" body="Taps and agent decisions appear here as they happen, newest first." />
                  ) : (
                    <FeedTable items={feed} />
                  )}
                </section>
                <aside className="flex flex-col gap-4">
                  <ListCard rows={[budgetRow(data, () => setBudgetOpen(true))]} />
                  <Invariant ok={data.invariantOk} escrow={php(data.escrowRemainingStroops, data.phpPerXlm)} />
                  {data.stations.map((station) => (
                    <StationRow key={station.id} station={station} phpPerXlm={data.phpPerXlm} href={`/desktop/stations/${station.id}`} />
                  ))}
                  <Card>
                    <h3 className="text-label">Program counts</h3>
                    <KeyValues
                      rows={[
                        ["Beneficiaries", data.counts.beneficiaries],
                        ["Awaiting review", data.counts.uncertain],
                        ["Enrolled", data.counts.enrolled],
                        ["Taps paid", data.counts.tapsAuthorized],
                        ["Taps declined", data.counts.tapsRejected],
                        ["Taps refused", data.counts.tapsRefused],
                      ]}
                    />
                  </Card>
                  <DemoRate />
                </aside>
              </div>
              <BudgetSheet dashboard={data} open={budgetOpen} onClose={() => setBudgetOpen(false)} onChanged={() => void state.reload()} />
              <ExportSheet programId={data.program.id} open={exportOpen} onClose={() => setExportOpen(false)} />
            </>
          );
        }}
      </Gate>
      {budgetReturn === "success" ? <Toast>Payment sent — waiting for Velo verification</Toast> : null}
      {budgetReturn === "cancel" ? <Toast tone="info">Checkout cancelled</Toast> : null}
    </Page>
  );
}
