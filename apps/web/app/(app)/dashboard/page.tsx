"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Dashboard, Station, Tap } from "@tapat/shared";
import { dateTime, php } from "@/lib/format";
import { useDashboard } from "@/lib/use-dashboard";
import { Body, EmptyState, ErrorBlock, NoProgram, Skeleton, Toast, TopBar } from "../_components/ui";
import { Icon } from "../_components/Icon";
import { CountUp } from "../_components/motion";
import { OfficerOnly } from "../_components/Auth";
import { BudgetSheet } from "../BudgetSheet";
import { ExportSheet } from "../ExportSheet";

const STATUS: Record<Dashboard["program"]["status"], string> = {
  draft: "Draft",
  active: "Active",
  ending: "Ending",
  ended: "Ended",
};

const TAP_STATUS: Record<Tap["status"], { label: string; className: string }> = {
  authorized: { label: "Paid", className: "text-primary" },
  rejected: { label: "Declined", className: "text-declined" },
  refused: { label: "Refused", className: "text-declined" },
  failed: { label: "Failed", className: "text-danger" },
};

const RULE = "border-b border-ring-surface last:border-b-0";

/** Section heading with an optional link on the right. */
function Group({ title, href, linkLabel, children }: { title: string; href?: string; linkLabel?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-label font-semibold">{title}</h2>
        {href !== undefined ? (
          <Link href={href} className="flex min-h-11 items-center text-caption text-primary underline-offset-4 hover:underline">
            {linkLabel}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Money({ stroops, rate, className = "" }: { stroops: string; rate: number; className?: string }) {
  return (
    <>
      <span className="sr-only">{php(stroops, rate)}</span>
      <span aria-hidden="true">
        <CountUp to={Number(stroops)} format={(n) => php(String(Math.round(n)), rate)} className={`tabular-nums ${className}`} />
      </span>
    </>
  );
}

function BudgetWell({ dashboard, onOpen }: { dashboard: Dashboard; onOpen: () => void }) {
  const { budget, phpPerXlm } = dashboard;
  const view =
    budget.state === "none"
      ? { value: "No budget yet", note: "Fund it before a tranche can release.", status: null, action: "Fund budget", solid: true }
      : budget.state === "waiting"
        ? { value: "Payment started", note: "Open checkout to finish paying.", status: "Waiting for Velo", action: "Open checkout", solid: false }
        : {
            value: php(budget.verifiedStroops, phpPerXlm),
            note: `${php(budget.remainingStroops, phpPerXlm)} left to fund`,
            status: "Velo verified",
            action: "Manage",
            solid: false,
          };
  return (
    <section aria-label="Budget" className="flex items-center gap-3 rounded-md bg-sunken px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-caption text-muted">
          Budget
          {view.status !== null ? (
            <>
              {" · "}
              <span className={budget.state === "verified" ? "text-primary" : ""}>{view.status}</span>
            </>
          ) : null}
        </span>
        <span className="text-h2 tabular-nums">{view.value}</span>
        <span className="text-caption text-muted tabular-nums">{view.note}</span>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className={`min-h-11 shrink-0 rounded-md px-4 text-label ${
          view.solid ? "bg-primary text-surface hover:bg-pressed" : "border border-ring-surface bg-raised text-text hover:bg-mint"
        }`}
      >
        {view.action}
      </button>
    </section>
  );
}

/** The invariant as the spine: segments run in the order of the equation. */
function Ledger({ dashboard }: { dashboard: Dashboard }) {
  const rate = dashboard.phpPerXlm;
  const segments = [
    { key: "spent", label: "Spent", stroops: dashboard.spentStroops, swatch: "bg-primary" },
    { key: "held", label: "Held", stroops: dashboard.heldStroops, swatch: "bg-frozen ring-1 ring-inset ring-text/15" },
    { key: "pending", label: "Pending", stroops: dashboard.pendingStroops, swatch: "bg-accent" },
    { key: "escrow", label: "Escrow remaining", stroops: dashboard.escrowRemainingStroops, swatch: "bg-primary/40" },
    { key: "returned", label: "Returned", stroops: dashboard.returnedStroops, swatch: "bg-muted" },
  ];
  const parts = segments.map((s) => Number(s.stroops));
  const denominator = Math.max(
    Number(dashboard.fundedStroops),
    parts.reduce((a, b) => a + b, 0),
  );
  return (
    <section aria-label="Ledger" className="flex flex-col gap-4 rounded-md border border-ring-surface bg-raised p-4">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-caption text-muted">Funded</span>
          <Money stroops={dashboard.fundedStroops} rate={rate} className="text-h2" />
        </div>
        <span className={`text-label ${dashboard.invariantOk ? "text-primary" : "text-danger"}`}>
          {dashboard.invariantOk ? "Balanced" : "Mismatch"}
        </span>
      </div>
      <div
        role="img"
        aria-label="Funded split into spent, held, pending, escrow and returned"
        className="flex h-2 gap-px overflow-hidden rounded-sm bg-sunken"
      >
        {denominator > 0
          ? segments.map((s, i) =>
              parts[i] > 0 ? <span key={s.key} className={s.swatch} style={{ width: `${(parts[i] / denominator) * 100}%` }} /> : null,
            )
          : null}
      </div>
      <dl>
        {segments.map((s) => (
          <div key={s.key} className={`flex items-center gap-3 py-2 ${RULE}`}>
            <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-sm ${s.swatch}`} />
            <dt className="flex-1 text-small">{s.label}</dt>
            <dd className="text-small">
              <Money stroops={s.stroops} rate={rate} />
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-caption text-muted">Funded = spent + held + pending + escrow + returned. PHP at the testnet demo rate.</p>
    </section>
  );
}

function StationLine({ station, rate }: { station: Station; rate: number }) {
  const frozen = station.status === "frozen";
  return (
    <li className={RULE}>
      <Link href={`/stations/${station.id}`} className="flex min-h-14 items-center gap-3 py-3">
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-small">{station.name}</span>
          <span className="text-caption text-muted tabular-nums">
            {frozen ? "Held" : "Pending"} {php(station.pendingStroops, rate)}
          </span>
          {frozen && station.frozenReason !== null ? <span className="text-caption break-words">{station.frozenReason}</span> : null}
        </span>
        <span className="flex flex-col items-end gap-1">
          <span className={`text-label ${frozen ? "text-declined" : "text-primary"}`}>{frozen ? "Frozen" : "Active"}</span>
          <span className="text-caption text-muted tabular-nums">Spent {php(station.spentStroops, rate)}</span>
        </span>
      </Link>
    </li>
  );
}

function Row({ title, meta, href, onClick }: { title: string; meta: string; href?: string; onClick?: () => void }) {
  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-1 text-left">
        <span className="text-small">{title}</span>
        <span className="text-caption text-muted">{meta}</span>
      </span>
      <Icon name="chevron" />
    </>
  );
  const className = "flex min-h-14 w-full items-center gap-3 py-3";
  return (
    <li className={RULE}>
      {href !== undefined ? (
        <Link href={href} className={className}>
          {body}
        </Link>
      ) : (
        <button type="button" onClick={onClick} className={className}>
          {body}
        </button>
      )}
    </li>
  );
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
          {/* Only an officer can create the program, so a viewer gets the same message without the action. */}
          <OfficerOnly fallback={<EmptyState title="No active program" body="Create a program to set the cap, tranche and expiry." />}>
            <NoProgram body="Create a program to set the cap, tranche and expiry." />
          </OfficerOnly>
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
  const frozen = dashboard.stations.filter((s) => s.status === "frozen");
  const taps = dashboard.recentTaps.slice(0, 4);

  return (
    <>
      <TopBar />
      <Body>
        <div className="flex flex-col gap-8">
          <header className="flex flex-col gap-2">
            <h1 className="text-h1">{dashboard.program.name}</h1>
            <p className="text-small">
              <span className={dashboard.program.status === "active" ? "font-medium text-primary" : "font-medium"}>
                {STATUS[dashboard.program.status]}
              </span>
              {" · "}Every peso funded is spent, held, pending, in escrow or returned.
            </p>
          </header>

          <BudgetWell dashboard={dashboard} onOpen={() => setBudgetOpen(true)} />
          <Ledger dashboard={dashboard} />

          <Group title="Stations" href="/stations" linkLabel={frozen.length > 0 ? `${frozen.length} frozen · View all` : "View all"}>
            {dashboard.stations.length === 0 ? (
              <p className="py-3 text-small text-muted">Not set up yet.</p>
            ) : (
              <ul>
                {dashboard.stations.map((s) => (
                  <StationLine key={s.id} station={s} rate={rate} />
                ))}
              </ul>
            )}
          </Group>

          <Group title="Recent taps" href="/activity" linkLabel="All activity">
            {taps.length === 0 ? (
              <p className="py-3 text-small text-muted">No taps yet.</p>
            ) : (
              <ul>
                {taps.map((t) => (
                  <li key={t.id} className={`flex min-h-14 items-center gap-3 py-3 ${RULE}`}>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-small">Station {t.stationId}</span>
                      <span className="text-caption text-muted tabular-nums">
                        {dateTime(t.createdAt)}
                        {t.simulated ? " · Simulated" : ""}
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <span className="text-small tabular-nums">{php(t.amountStroops, rate)}</span>
                      <span className={`text-caption ${TAP_STATUS[t.status].className}`}>{TAP_STATUS[t.status].label}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Group>

          <Group title="Records">
            <ul>
              <Row title="Cards" meta={`${dashboard.counts.enrolled} enrolled`} href="/cards" />
              <Row title="Export for COA" meta="Every money event with its tx hash" onClick={() => setExportOpen(true)} />
              <Row title="System health" meta="RPC, Velo, Telegram, gas mode" href="/health" />
            </ul>
          </Group>
        </div>
      </Body>
      {budgetReturn === "success" ? <Toast>Payment sent — waiting for Velo verification</Toast> : null}
      {budgetReturn === "cancel" ? <Toast tone="info">Checkout cancelled</Toast> : null}
      <BudgetSheet dashboard={dashboard} open={budgetOpen} onClose={() => setBudgetOpen(false)} onChanged={() => void state.reload()} />
      <ExportSheet programId={dashboard.program.id} open={exportOpen} onClose={() => setExportOpen(false)} />
    </>
  );
}
