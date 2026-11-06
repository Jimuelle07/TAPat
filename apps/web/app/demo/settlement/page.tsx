"use client";

import { useState } from "react";
import type { AgentDecision, Dashboard } from "@tapat/shared";
import { postSettlementRun } from "@/lib/api";
import { txLookup } from "@/lib/feed";
import { php, shortHash } from "@/lib/format";
import { errorMessage, useDashboard } from "@/lib/use-dashboard";
import { OfficerOnly, OfficerNotice, useAuth } from "../../_components/Auth";
import { Actions, Body, Button, DemoRate, EmptyState, ErrorBlock, LinkButton, ListCard, NoProgram, Notice, Skeleton, TopBar, type ListRow } from "../../_components/ui";

/** A failed run answers 502 with no per-station body, but every station still writes its decision, so the list reads those. */
function lastRun(dashboard: Dashboard): AgentDecision[] {
  const byStation = new Map<string, AgentDecision>();
  for (const decision of dashboard.recentDecisions) {
    const stationId = decision.outputs.stationId;
    if (decision.agent === "settlement" && typeof stationId === "string" && !byStation.has(stationId)) byStation.set(stationId, decision);
  }
  return [...byStation.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, decision]) => decision);
}

function runRow(decision: AgentDecision, dashboard: Dashboard): ListRow {
  const rate = dashboard.phpPerXlm;
  const stationId = String(decision.outputs.stationId);
  const amount = php(String(decision.outputs.amountStroops ?? decision.inputs.pendingStroops ?? "0"), rate);
  const base = { id: decision.id };
  if (decision.decision === "HELD") {
    return { ...base, title: `${stationId} — HELD ${amount}`, meta: "Station frozen, no tx", chip: "Held", tone: "ink" };
  }
  if (decision.decision === "NOTHING_PENDING") {
    return { ...base, title: `${stationId} — nothing pending`, meta: "No claim needed", chip: "None" };
  }
  if (decision.outputs.claimed === false) {
    return { ...base, title: `${stationId} — claim failed`, meta: `${amount} stays pending`, chip: "Failed", tone: "danger" };
  }
  const hash = txLookup(dashboard)(decision.txIds[0]);
  return { ...base, title: `${stationId} — claimed ${amount}`, meta: hash === null ? "Waiting for the chain" : `tx ${shortHash(hash)}`, chip: "Claimed", tone: "mint" };
}

export default function Settlement() {
  const state = useDashboard();
  const { isOfficer } = useAuth();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!isOfficer) return;
    setRunning(true);
    setError(null);
    try {
      await postSettlementRun();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setRunning(false);
      void state.reload();
    }
  };

  const dashboard = state.status === "ready" ? state.dashboard : null;
  const rows = dashboard === null ? [] : lastRun(dashboard);
  const anyHeld = rows.some((d) => d.decision === "HELD");

  return (
    <>
      <TopBar title="Settlement" back="/demo" />
      <Body>
        {state.status === "loading" ? <Skeleton kinds={["row", "row"]} /> : null}
        {state.status === "no-program" ? <NoProgram icon="pulse" body="Agents start working once a program is running." /> : null}
        {state.status === "error" ? <ErrorBlock title="Could not load settlement" message={state.message} onRetry={() => void state.reload()} /> : null}
        {dashboard !== null ? (
          <>
            {error !== null ? (
              <Notice tone="error" title="A claim did not go through">
                {error}. Any other station still ran.
              </Notice>
            ) : null}
            {rows.length === 0 ? (
              <EmptyState icon="receipt" title="No settlement yet" body="Run settlement to claim what stations are owed." />
            ) : (
              <ListCard heading="Last run" rows={rows.map((decision) => runRow(decision, dashboard))} />
            )}
            {anyHeld ? <Notice title="Held money stays in escrow">It is released only when the LGU unfreezes the station and settlement runs again.</Notice> : null}
            <DemoRate />
          </>
        ) : null}
      </Body>
      {dashboard !== null ? (
        <Actions>
          <OfficerOnly fallback={<OfficerNotice />}>
            <Button loading={running} disabled={dashboard.program.status === "ended"} onClick={() => void run()}>
              {running ? "Settling" : "Run settlement"}
            </Button>
          </OfficerOnly>
          <LinkButton look="secondary" href="/demo">
            Back to agents
          </LinkButton>
        </Actions>
      ) : null}
    </>
  );
}
