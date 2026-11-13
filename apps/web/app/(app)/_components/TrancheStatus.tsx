"use client";

import type { CSSProperties } from "react";
import type { ChainTxStatus, Dashboard, TrancheState } from "@tapat/shared";
import { perLitre } from "@/lib/feed";
import { php, shortHash } from "@/lib/format";
import { Icon } from "./Icon";
import { Card, Chip } from "./ui";

const TX_DOT: Record<ChainTxStatus, string> = {
  succeeded: "bg-primary",
  pending: "bg-accent motion-safe:animate-pulse",
  submission_unknown: "bg-accent",
  failed: "bg-danger",
};

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-sm border-[1.5px] border-ring-surface bg-sunken px-2 py-1.5">
      <span className="text-caption text-muted">{label}</span>
      <span className="whitespace-nowrap font-mono text-mono tabular-nums">{value}</span>
    </div>
  );
}

/** A labelled track; `tick` marks a trigger level (0-1) on it. */
function Meter({ label, valueText, fraction, fill, tick }: { label: string; valueText: string; fraction: number; fill: string; tick?: number }) {
  const pct = Math.min(Math.max(fraction, 0), 1) * 100;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 text-caption">
        <span>{label}</span>
        <span className="font-mono text-mono">{valueText}</span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-valuetext={valueText}
        className="relative h-2.5 overflow-hidden rounded-full border-[1.5px] border-text bg-sunken"
      >
        <div className={`h-full rounded-full ${fill} transition-[width] duration-500 ease-out motion-reduce:transition-none`} style={{ width: `${pct}%` }} />
        {tick === undefined ? null : <span aria-hidden="true" className="absolute inset-y-0 w-0.5 bg-text" style={{ left: `${tick * 100}%` }} />}
      </div>
    </div>
  );
}

interface TrancheProps {
  dashboard: Dashboard;
  tranche: TrancheState;
}

/** Budget verification, cards, price and changepoint progress of the Tranche Agent. */
export function TrancheStatusCard({ dashboard, tranche }: TrancheProps) {
  const budgetVerified = dashboard.budget.state === "verified";
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-label">Tranche status</h3>
        <Chip tone={budgetVerified ? "accent" : "danger"}>
          {budgetVerified ? `Velo verified ${php(dashboard.budget.verifiedStroops, dashboard.phpPerXlm)}` : "Budget not verified"}
        </Chip>
      </div>
      <div className="grid grid-cols-2 gap-2 [&>*:last-child:nth-child(odd)]:col-span-2">
        <Tile label="Active cards" value={String(dashboard.counts.cardsActive)} />
        <Tile label="Per card" value={php(dashboard.program.trancheStroops, dashboard.phpPerXlm)} />
        <Tile label="Latest price" value={tranche.lastPricePhp === null ? "None yet" : perLitre(tranche.lastPricePhp)} />
      </div>
      <Meter
        label="Point"
        valueText={`${tranche.idx}/${tranche.total}`}
        fraction={tranche.total === 0 ? 0 : tranche.idx / tranche.total}
        fill="bg-primary"
      />
      <Meter
        label="Changepoint p"
        valueText={tranche.cpRecent === null ? "Not yet" : `${tranche.cpRecent.toFixed(2)} of 0.90 to fire`}
        fraction={tranche.cpRecent ?? 0}
        fill="bg-accent"
        tick={0.9}
      />
      <p className="font-mono text-mono text-muted">Run length {tranche.mapR === null ? "not yet" : tranche.mapR}</p>
    </Card>
  );
}

/** Fund-tx timeline, shown once the tranche has fired (the price feed may already have stopped). */
export function TrancheReleasing({ dashboard, tranche }: TrancheProps) {
  if (!tranche.fired) return null;
  const fundTxs = dashboard.recentChainTxs.filter((tx) => tx.kind === "fund");
  // The feed stops at the firing tick, before any fund tx exists, so `running` cannot tell "none funded" from "not yet funded":
  // only the tranche decision (written once funding finishes) can. Zero txs without it means still releasing.
  const decided = (dashboard.recentDecisions ?? []).some((d) => d.agent === "tranche");
  const noneFunded = fundTxs.length === 0 && decided;
  const allFailed = fundTxs.length > 0 && fundTxs.every((tx) => tx.status === "failed");
  const inFlight = !noneFunded && (fundTxs.length === 0 || fundTxs.some((tx) => tx.status === "pending" || tx.status === "submission_unknown"));
  const amount = php(dashboard.program.trancheStroops, dashboard.phpPerXlm);
  return (
    // Same markup as `Notice`, but the body is a div: `Notice` wraps children in a <p>, which cannot hold an <ol>.
    <div role="status" className="notice-in flex items-start gap-3 rounded-md border-[1.5px] border-text bg-raised p-3">
      <Icon name="info" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-label">
          {noneFunded ? "No cards funded" : inFlight ? `Releasing ${amount} per card on-chain` : allFailed ? "Funding failed" : `Released ${amount} per card`}
        </p>
        <div className="break-words text-small">
      {fundTxs.length === 0 ? (
        noneFunded ? "No funding transaction was submitted: every card was skipped or failed. See the activity feed for each card's reason." : "Waiting for the first funding tx."
      ) : (
        <ol className="relative mt-1 flex flex-col gap-2 border-l-[1.5px] border-ring-surface pl-4">
          {fundTxs.map((tx, i) => {
            const hash = tx.outerHash ?? tx.innerHash;
            return (
              <li key={tx.id} style={{ "--i": Math.min(i, 8) } as CSSProperties} className="rise relative flex items-center justify-between gap-2 font-mono text-mono">
                <span
                  aria-hidden="true"
                  className={`absolute top-1/2 -left-[22px] size-3 -translate-y-1/2 rounded-full border-[1.5px] border-text ${TX_DOT[tx.status]}`}
                />
                <span>{tx.status}</span>
                <span>tx {hash === null ? "pending" : shortHash(hash)}</span>
              </li>
            );
          })}
        </ol>
      )}
        </div>
      </div>
    </div>
  );
}
