"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { CardSummary, Dashboard, Station } from "@tapat/shared";
import { buildFeed, cardLabel } from "@/lib/feed";
import { php } from "@/lib/format";
import { useDashboard } from "@/lib/use-dashboard";
import { BudgetSheet } from "../(app)/BudgetSheet";
import { ExportSheet } from "../(app)/ExportSheet";
import { EmptyState, Toast } from "../(app)/_components/ui";
import { DataTable, FeedTable, Gate, QuietPage, StatusText } from "./_components/kit";

const STATUS: Record<Dashboard["program"]["status"], { label: string; tone: "mint" | "outline" }> = {
  draft: { label: "Draft", tone: "outline" },
  active: { label: "Active", tone: "mint" },
  ending: { label: "Ending", tone: "outline" },
  ended: { label: "Ended", tone: "outline" },
};

const PRIMARY_BUTTON = "inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 text-label text-surface hover:bg-pressed";
const SECONDARY_BUTTON = "inline-flex min-h-11 items-center justify-center rounded-md border border-primary px-5 text-label text-primary hover:bg-mint";
const TEXT_LINK = "text-small text-primary underline underline-offset-4";
const CARD_PREVIEW = 8;

/** One group of the index. The heading column names the part of the invariant the group answers for. */
function Section({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  return (
    <section className="grid gap-6 border-t border-ring-surface pt-8 xl:grid-cols-[240px_minmax(0,1fr)] xl:gap-10">
      <div className="flex flex-col gap-2">
        <h2 className="text-h2">{title}</h2>
        <p className="text-small text-muted">{lead}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  );
}

function Counts({ rows }: { rows: Array<[string, number]> }) {
  return (
    <dl className="flex flex-wrap gap-x-10 gap-y-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex flex-row-reverse items-baseline justify-end gap-2">
          <dt className="text-small text-muted">{label}</dt>
          <dd className="text-label tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Well({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="overflow-hidden rounded-md border border-ring-surface bg-sunken">
      {rows.map(([label, value], index) => (
        <div key={label} className={`flex items-baseline justify-between gap-4 px-4 py-3 ${index === 0 ? "" : "border-t border-ring-surface"}`}>
          <dt className="text-small">{label}</dt>
          <dd className="text-label tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The program's money invariant as one strip: funded on the left, the five parts it must equal on the right. */
function Ledger({ dashboard }: { dashboard: Dashboard }) {
  const rate = dashboard.phpPerXlm;
  const parts: Array<{ key: string; label: string; note: string; stroops: string; swatch: string; operator: string }> = [
    { key: "spent", label: "Spent", note: "Claimed by stations", stroops: dashboard.spentStroops, swatch: "bg-primary", operator: "" },
    { key: "held", label: "Held", note: "At frozen stations", stroops: dashboard.heldStroops, swatch: "bg-frozen", operator: "+" },
    { key: "pending", label: "Pending", note: "Awaiting settlement", stroops: dashboard.pendingStroops, swatch: "bg-accent", operator: "+" },
    { key: "escrow", label: "Escrow", note: "Still on cards", stroops: dashboard.escrowRemainingStroops, swatch: "bg-primary/40", operator: "+" },
    { key: "returned", label: "Returned", note: "Swept back to the budget", stroops: dashboard.returnedStroops, swatch: "bg-muted", operator: "+" },
  ];
  const sum = parts.reduce((total, part) => total + BigInt(part.stroops), BigInt(0));
  const gap = BigInt(dashboard.fundedStroops) - sum;
  const difference = php(gap < BigInt(0) ? -gap : gap, rate);

  return (
    <section aria-labelledby="ledger-title" className="flex flex-col gap-6 rounded-md border border-ring-surface bg-raised p-6">
      <h2 id="ledger-title" className="sr-only">
        Where the funded money is
      </h2>
      <dl className="grid grid-cols-3 gap-x-4 gap-y-8 min-[1400px]:grid-cols-[1.5fr_repeat(5,minmax(0,1fr))]">
        <div className="col-span-3 flex flex-col gap-1 min-[1400px]:col-span-1">
          <dt className="text-caption text-muted">Funded =</dt>
          <dd className="text-amount-md whitespace-nowrap tabular-nums">{php(dashboard.fundedStroops, rate)}</dd>
          <dd className="text-caption text-muted">Released to cards</dd>
        </div>
        {parts.map((part) => (
          <div key={part.key} className="flex min-w-0 flex-col gap-1">
            <dt className="flex items-center gap-2 text-caption text-muted">
              <span aria-hidden="true" className={`size-2 shrink-0 rounded-sm outline outline-1 outline-ring-surface ${part.swatch}`} />
              {part.operator !== "" ? <span aria-hidden="true">{part.operator}</span> : null}
              {part.label}
            </dt>
            <dd className="text-h2 whitespace-nowrap tabular-nums">{php(part.stroops, rate)}</dd>
            <dd className="text-caption text-muted">{part.note}</dd>
          </div>
        ))}
      </dl>
      <div aria-hidden="true" className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-sunken">
        {parts.map((part) =>
          BigInt(part.stroops) > BigInt(0) ? <span key={part.key} className={part.swatch} style={{ flexGrow: Number(part.stroops), flexBasis: 0 }} /> : null,
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-ring-surface pt-4">
        <p role="status" className="text-small">
          {dashboard.invariantOk ? (
            <StatusText tone="mint">Invariant holds: funded equals spent + held + pending + escrow + returned.</StatusText>
          ) : (
            <StatusText tone="danger">
              <strong className="font-semibold">Invariant broken:</strong> the five parts differ from funded by {difference}.
            </StatusText>
          )}
        </p>
        <p className="text-caption text-muted">Testnet demo rate</p>
      </div>
    </section>
  );
}

function BudgetSection({ dashboard, onOpen }: { dashboard: Dashboard; onOpen: () => void }) {
  const { budget, phpPerXlm } = dashboard;
  const status =
    budget.state === "none"
      ? { tone: "outline" as const, title: "No budget yet", note: "Fund it before a tranche can release.", action: <button type="button" className={PRIMARY_BUTTON} onClick={onOpen}>Fund budget</button> }
      : budget.state === "waiting"
        ? { tone: "outline" as const, title: "Waiting for Velo…", note: "Open checkout to finish paying.", action: <button type="button" className={PRIMARY_BUTTON} onClick={onOpen}>Open checkout</button> }
        : { tone: "mint" as const, title: "Verified by Velo", note: `${php(budget.remainingStroops, phpPerXlm)} left to fund.`, action: <button type="button" className={SECONDARY_BUTTON} onClick={onOpen}>Budget details</button> };
  return (
    <Section title="Budget" lead="What Velo has verified, and how much of it is already released to cards.">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <StatusText tone={status.tone}>
            <span className="text-label">{status.title}</span>
          </StatusText>
          <p className="text-small text-muted">{status.note}</p>
        </div>
        {status.action}
      </div>
      {budget.state === "verified" ? (
        <Well
          rows={[
            ["Verified by Velo", php(budget.verifiedStroops, phpPerXlm)],
            ["Released to cards", php(budget.fundedStroops, phpPerXlm)],
            ["Left to fund", php(budget.remainingStroops, phpPerXlm)],
          ]}
        />
      ) : null}
    </Section>
  );
}

function StationsSection({ dashboard }: { dashboard: Dashboard }) {
  const rate = dashboard.phpPerXlm;
  // Pending at a frozen station is what the dashboard calls held (§5.2 #18).
  const held = (station: Station) => (station.status === "frozen" ? station.pendingStroops : "0");
  const pending = (station: Station) => (station.status === "frozen" ? "0" : station.pendingStroops);
  return (
    <Section title="Stations" lead="Spent, pending and held per station. Open one for its taps.">
      {dashboard.stations.length === 0 ? (
        <EmptyState icon="pulse" title="No stations" body="Stations appear once the program is running." />
      ) : (
        <DataTable
          quiet
          label="Stations and their money"
          rows={dashboard.stations}
          rowKey={(station) => station.id}
          href={(station) => `/desktop/stations/${station.id}`}
          columns={[
            {
              header: "Station",
              cell: (station) => (
                <span className="flex flex-col gap-1">
                  <span className="text-label">{station.name}</span>
                  {station.status === "frozen" && station.frozenReason !== null ? <span className="text-caption break-words text-muted">{station.frozenReason}</span> : null}
                </span>
              ),
            },
            { header: "Status", cell: (station) => <StatusText tone={station.status === "frozen" ? "frozen" : "mint"}>{station.status === "frozen" ? "Frozen" : "Active"}</StatusText> },
            { header: "Spent", right: true, mono: true, cell: (station) => php(station.spentStroops, rate) },
            { header: "Pending", right: true, mono: true, cell: (station) => php(pending(station), rate) },
            { header: "Held", right: true, mono: true, cell: (station) => php(held(station), rate) },
          ]}
        />
      )}
    </Section>
  );
}

function cardStatus(card: CardSummary): { tone: "mint" | "danger" | "outline"; label: string } {
  switch (card.status) {
    case "swept":
      return { tone: "outline", label: "Swept" };
    case "pending":
      return { tone: "outline", label: "Pending" };
    case "failed":
      return { tone: "danger", label: "Failed" };
    case "revoked":
      return { tone: "outline", label: "Revoked" };
    case "active":
      return card.expired ? { tone: "outline", label: "Expired" } : { tone: "mint", label: "Active" };
  }
}

function CardsSection({ dashboard }: { dashboard: Dashboard }) {
  const rate = dashboard.phpPerXlm;
  const { counts, cards } = dashboard;
  return (
    <Section title="Cards" lead="Escrow still on each card, and what was swept back when a card ended.">
      <Counts
        rows={[
          ["beneficiaries", counts.beneficiaries],
          ["awaiting review", counts.uncertain],
          ["enrolled", counts.enrolled],
          ["cards active", counts.cardsActive],
        ]}
      />
      {cards.length === 0 ? (
        <EmptyState icon="idcard" title="No cards yet" body="Enrolled cards appear here, in enrollment order." action={{ label: "Enroll a driver", href: "/desktop/enroll" }} />
      ) : (
        <>
          <DataTable
            quiet
            label="Enrolled cards, in enrollment order"
            rows={cards.slice(0, CARD_PREVIEW)}
            rowKey={(card) => card.id}
            columns={[
              {
                header: "Card",
                cell: (card) => (
                  <span className="flex flex-col gap-1">
                    <span className="text-label">{cardLabel(card)}</span>
                    {card.virtual ? <span className="text-caption text-muted">simulated card</span> : null}
                  </span>
                ),
              },
              { header: "Status", cell: (card) => <StatusText tone={cardStatus(card).tone}>{cardStatus(card).label}</StatusText> },
              { header: "Escrow", right: true, mono: true, cell: (card) => (card.status === "active" ? php(card.escrowStroops, rate) : "—") },
              { header: "Returned", right: true, mono: true, cell: (card) => (card.status === "swept" ? php(card.returnedStroops, rate) : "—") },
            ]}
          />
          <Link href="/desktop/cards" className={`${TEXT_LINK} w-fit`}>
            {cards.length > CARD_PREVIEW ? `All ${cards.length} cards` : "Open cards"}
          </Link>
        </>
      )}
    </Section>
  );
}

function ActivitySection({ dashboard }: { dashboard: Dashboard }) {
  const feed = buildFeed(dashboard).slice(0, 8);
  const { counts } = dashboard;
  return (
    <Section title="Recent activity" lead="Taps and agent decisions, newest first. Open a row for its transaction.">
      <Counts
        rows={[
          ["taps paid", counts.tapsAuthorized],
          ["declined", counts.tapsRejected],
          ["refused", counts.tapsRefused],
        ]}
      />
      {feed.length === 0 ? <EmptyState icon="pulse" title="No activity yet" body="Taps and agent decisions appear here as they happen, newest first." /> : <FeedTable quiet items={feed} />}
      <Link href="/desktop/activity" className={`${TEXT_LINK} w-fit`}>
        View all activity
      </Link>
    </Section>
  );
}

export default function Overview() {
  const state = useDashboard();
  const search = useSearchParams();
  const [budgetOpen, setBudgetOpen] = useState(search.get("sheet") === "budget");
  const [exportOpen, setExportOpen] = useState(false);
  const budgetReturn = search.get("budget");
  const dashboard = state.status === "ready" ? state.dashboard : null;
  const program = dashboard === null ? null : STATUS[dashboard.program.status];

  return (
    <QuietPage
      title={dashboard?.program.name ?? "Overview"}
      lead="Every funded peso, and where it is now: spent, held, pending, in escrow or returned."
      meta={program !== null ? <StatusText tone={program.tone}>{program.label}</StatusText> : undefined}
      actions={
        dashboard !== null ? (
          <button type="button" className={`${SECONDARY_BUTTON} shrink-0`} onClick={() => setExportOpen(true)}>
            Export for COA
          </button>
        ) : undefined
      }
    >
      <Gate state={state} what="the dashboard" empty="Create a program to set the cap, tranche and expiry.">
        {(data) => (
          <>
            <Ledger dashboard={data} />
            <div className="flex flex-col gap-12">
              <BudgetSection dashboard={data} onOpen={() => setBudgetOpen(true)} />
              <StationsSection dashboard={data} />
              <CardsSection dashboard={data} />
              <ActivitySection dashboard={data} />
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
