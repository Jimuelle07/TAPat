"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Dashboard, Station } from "@tapat/shared";
import { buildFeed } from "@/lib/feed";
import { php } from "@/lib/format";
import { useDashboard } from "@/lib/use-dashboard";
import { BudgetSheet } from "../(app)/BudgetSheet";
import { ExportSheet } from "../(app)/ExportSheet";
import { Icon } from "../(app)/_components/Icon";
import { Chip, EmptyState, Toast } from "../(app)/_components/ui";
import { DataTable, FeedList, Gate, LedgerCard, PROGRAM_STATUS, QuietPage, SectionTitle, StatusText, TextLink } from "./_components/kit";

const PRIMARY_BUTTON = "ql-btn ql-btn-primary inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 text-label text-surface hover:bg-pressed";
const SECONDARY_BUTTON = "ql-btn ql-btn-secondary inline-flex min-h-11 items-center justify-center rounded-md border border-primary px-5 text-label text-primary hover:bg-mint";
const FEED_PREVIEW = 6;

/** The program's money invariant: funded on top, then the five parts it must equal, as a livery bar and a legend. */
function Ledger({ dashboard }: { dashboard: Dashboard }) {
  const rate = dashboard.phpPerXlm;
  const parts: Array<{ key: string; label: string; note: string; stroops: string }> = [
    { key: "spent", label: "Spent", note: "Claimed by stations", stroops: dashboard.spentStroops },
    { key: "held", label: "Held", note: "At frozen stations", stroops: dashboard.heldStroops },
    { key: "pending", label: "Pending", note: "Awaiting settlement", stroops: dashboard.pendingStroops },
    { key: "escrow", label: "Escrow", note: "Still on cards", stroops: dashboard.escrowRemainingStroops },
    { key: "returned", label: "Returned", note: "Swept back to the budget", stroops: dashboard.returnedStroops },
  ];
  const sum = parts.reduce((total, part) => total + BigInt(part.stroops), BigInt(0));
  const gap = BigInt(dashboard.fundedStroops) - sum;
  const difference = php(gap < BigInt(0) ? -gap : gap, rate);

  return (
    <section aria-labelledby="ledger-title" className="ql-hero-ledger">
      <h2 id="ledger-title" className="sr-only">
        Where the funded money is
      </h2>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13.5px] font-medium text-muted">Funded</p>
          <p className="ql-hero-total">{php(dashboard.fundedStroops, rate)}</p>
        </div>
        <span aria-hidden="true" className={`ql-stamp stamp ${dashboard.invariantOk ? "" : "ql-stamp-bad"}`}>
          {dashboard.invariantOk ? "BALANCED" : "UNBALANCED"}
        </span>
      </div>
      <div aria-hidden="true" className="ql-livery-bar">
        {parts.map((part) =>
          BigInt(part.stroops) > BigInt(0) ? <span key={part.key} className={`ql-lb-${part.key}`} style={{ flexGrow: Number(part.stroops), flexBasis: 0 }} /> : null,
        )}
      </div>
      <dl className="grid grid-cols-5 gap-3.5">
        {parts.map((part) => (
          <div key={part.key} className="flex min-w-0 flex-col gap-1 border-t border-text/15 pt-3">
            <dt className="flex items-center gap-[9px] text-[14px]">
              <span aria-hidden="true" className={`ql-sw ql-lb-${part.key}`} />
              {part.label}
            </dt>
            <dd className="font-mono text-[15px] font-medium whitespace-nowrap tabular-nums">{php(part.stroops, rate)}</dd>
            <dd className="text-[12px] text-muted">{part.note}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p role="status" className="text-[12.5px]">
          {dashboard.invariantOk ? (
            <StatusText tone="mint">Funded = spent + held + pending + escrow + returned. Every row carries a tx hash.</StatusText>
          ) : (
            <StatusText tone="danger">
              <strong className="font-semibold">Invariant broken:</strong> the five parts differ from funded by {difference}.
            </StatusText>
          )}
        </p>
        <p className="font-mono text-[12px] text-muted">Testnet demo rate</p>
      </div>
    </section>
  );
}

function BudgetCard({ dashboard, onOpen }: { dashboard: Dashboard; onOpen: () => void }) {
  const { budget, phpPerXlm } = dashboard;
  const verified = BigInt(budget.verifiedStroops);
  const share = verified > BigInt(0) ? Number((BigInt(budget.fundedStroops) * BigInt(1000)) / verified) / 10 : 0;
  const status =
    budget.state === "none"
      ? { tone: "outline" as const, chip: "No budget yet", note: "Fund it before a tranche can release.", action: <button type="button" className={PRIMARY_BUTTON} onClick={onOpen}>Fund budget</button> }
      : budget.state === "waiting"
        ? { tone: "outline" as const, chip: "Waiting for Velo…", note: "Open checkout to finish paying.", action: <button type="button" className={PRIMARY_BUTTON} onClick={onOpen}>Open checkout</button> }
        : { tone: "accent" as const, chip: "Verified by Velo", note: "", action: <button type="button" className={SECONDARY_BUTTON} onClick={onOpen}>Budget details</button> };
  return (
    <LedgerCard title="Budget" aside={<Chip tone={status.tone}>{status.chip}</Chip>}>
      {budget.state === "verified" ? (
        <>
          <p className="ql-big-amt">{php(budget.verifiedStroops, phpPerXlm)}</p>
          <div role="meter" aria-label="Released to cards" aria-valuenow={share} aria-valuemin={0} aria-valuemax={100} className="ql-meter">
            <span style={{ width: `${Math.min(100, share)}%` }} />
          </div>
          <p className="text-[13px] text-muted">
            {php(budget.fundedStroops, phpPerXlm)} released to cards · {php(budget.remainingStroops, phpPerXlm)} left to fund
          </p>
        </>
      ) : (
        <p className="text-[13px] text-muted">{status.note}</p>
      )}
      {status.action}
    </LedgerCard>
  );
}

/** Links to the records behind the ledger, each with the counts that matter at a glance. */
function RecordsCard({ dashboard, onExport }: { dashboard: Dashboard; onExport: () => void }) {
  const { counts } = dashboard;
  const rows: Array<{ title: string; meta: string; href?: string; onClick?: () => void }> = [
    { title: "Masterlist", meta: `${counts.beneficiaries} beneficiaries · ${counts.uncertain} awaiting review`, href: "/desktop/intake" },
    { title: "Cards", meta: `${counts.enrolled} enrolled · ${counts.cardsActive} active`, href: "/desktop/cards" },
    { title: "Export for COA", meta: "Every money event with its tx hash", onClick: onExport },
    { title: "System health", meta: "RPC, Velo, Telegram, gas mode", href: "/desktop/health" },
  ];
  return (
    <LedgerCard title="Records" flush>
      <ul className="px-[18px] pb-0.5">
        {rows.map((row, index) => {
          const inner = (
            <>
              <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <span className="ql-list-title">{row.title}</span>
                <span className="text-[13px] text-muted">{row.meta}</span>
              </span>
              <Icon name="chevron" size={20} className="ql-nudge text-muted" />
            </>
          );
          const className = `ql-list-row ${index === 0 ? "" : "border-t"}`;
          return (
            <li key={row.title}>
              {row.href !== undefined ? (
                <Link href={row.href} className={className}>
                  {inner}
                </Link>
              ) : (
                <button type="button" onClick={row.onClick} className={className}>
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </LedgerCard>
  );
}

function StationsBlock({ dashboard }: { dashboard: Dashboard }) {
  const rate = dashboard.phpPerXlm;
  // Pending at a frozen station is what the dashboard calls held (§5.2 #18).
  const held = (station: Station) => (station.status === "frozen" ? station.pendingStroops : "0");
  const pending = (station: Station) => (station.status === "frozen" ? "0" : station.pendingStroops);
  const frozen = dashboard.stations.filter((station) => station.status === "frozen").length;
  return (
    <div className="flex min-w-0 flex-col gap-3.5">
      <SectionTitle aside={<TextLink href="/desktop/stations">{frozen > 0 ? `${frozen} frozen · View all` : "View all"}</TextLink>}>Stations</SectionTitle>
      {dashboard.stations.length === 0 ? (
        <EmptyState icon="pulse" title="No stations" body="Stations appear once the program is running." />
      ) : (
        <DataTable
          label="Stations and their money"
          rows={dashboard.stations}
          rowKey={(station) => station.id}
          href={(station) => `/desktop/stations/${station.id}`}
          columns={[
            {
              header: "Station",
              cell: (station) => (
                <span className="flex flex-col gap-1">
                  <span className="font-semibold">{station.name}</span>
                  {station.status === "frozen" && station.frozenReason !== null ? <span className="text-caption break-words text-muted">{station.frozenReason}</span> : null}
                </span>
              ),
            },
            { header: "Status", cell: (station) => <Chip tone={station.status === "frozen" ? "frozen" : "mint"}>{station.status === "frozen" ? "Frozen" : "Active"}</Chip> },
            { header: "Spent", right: true, mono: true, cell: (station) => php(station.spentStroops, rate) },
            { header: "Pending", right: true, mono: true, cell: (station) => php(pending(station), rate) },
            { header: "Held", right: true, mono: true, cell: (station) => php(held(station), rate) },
          ]}
        />
      )}
    </div>
  );
}

function ActivityBlock({ dashboard }: { dashboard: Dashboard }) {
  const feed = buildFeed(dashboard).slice(0, FEED_PREVIEW);
  const { counts } = dashboard;
  return (
    <div className="flex min-w-0 flex-col gap-3.5">
      <SectionTitle aside={<TextLink href="/desktop/activity">All activity</TextLink>}>Recent activity</SectionTitle>
      <LedgerCard flush>
        <p className="px-[18px] pt-3.5 text-[13px] text-muted">
          {counts.tapsAuthorized} paid · {counts.tapsRejected} declined · {counts.tapsRefused} refused
        </p>
        {feed.length === 0 ? (
          <div className="px-[18px] pb-4">
            <EmptyState icon="pulse" title="No activity yet" body="Taps and agent decisions appear here as they happen, newest first." />
          </div>
        ) : (
          <FeedList items={feed} />
        )}
      </LedgerCard>
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
  const program = dashboard === null ? null : PROGRAM_STATUS[dashboard.program.status];

  return (
    <QuietPage
      title={dashboard?.program.name ?? "Overview"}
      lead="Every funded peso, and where it is now: spent, held, pending, in escrow or returned."
      meta={program !== null ? <Chip tone={program.tone}>{program.label}</Chip> : undefined}
      actions={
        dashboard !== null ? (
          <button type="button" className={`${SECONDARY_BUTTON} shrink-0 gap-2`} onClick={() => setExportOpen(true)}>
            <Icon name="download" size={18} />
            Export for COA
          </button>
        ) : undefined
      }
    >
      <Gate state={state} what="the dashboard" empty="Create a program to set the cap, tranche and expiry.">
        {(data) => (
          <>
            <div className="grid grid-cols-12 items-start gap-x-6 gap-y-[26px]">
              <div className="col-span-12 xl:col-span-8">
                <Ledger dashboard={data} />
              </div>
              <div className="col-span-12 grid gap-3.5 md:grid-cols-2 xl:col-span-4 xl:grid-cols-1">
                <BudgetCard dashboard={data} onOpen={() => setBudgetOpen(true)} />
                <RecordsCard dashboard={data} onExport={() => setExportOpen(true)} />
              </div>
              <div className="col-span-12 xl:col-span-7">
                <StationsBlock dashboard={data} />
              </div>
              <div className="col-span-12 xl:col-span-5">
                <ActivityBlock dashboard={data} />
              </div>
            </div>
            <BudgetSheet dashboard={data} open={budgetOpen} onClose={() => setBudgetOpen(false)} onChanged={() => void state.reload()} />
            <ExportSheet programId={data.program.id} open={exportOpen} onClose={() => setExportOpen(false)} />
          </>
        )}
      </Gate>
      {budgetReturn === "success" ? <Toast>Payment sent — waiting for Velo verification</Toast> : null}
      {budgetReturn === "cancel" ? <Toast tone="info">Checkout cancelled</Toast> : null}
    </QuietPage>
  );
}
