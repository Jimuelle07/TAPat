"use client";

import { useDashboard } from "@/lib/use-dashboard";
import { StationRow } from "../_components/money";
import { Body, DemoRate, EmptyState, ErrorBlock, NoProgram, Skeleton, TopBar } from "../_components/ui";

export default function Stations() {
  const state = useDashboard();
  return (
    <>
      <TopBar title="Stations" back="/dashboard" />
      <Body>
        {state.status === "loading" ? <Skeleton kinds={["card", "card"]} /> : null}
        {state.status === "no-program" ? <NoProgram body="Stations appear once a program is running." icon="pump" /> : null}
        {state.status === "error" ? <ErrorBlock title="Could not load stations" message={state.message} onRetry={() => void state.reload()} /> : null}
        {state.status === "ready" ? (
          state.dashboard.stations.length === 0 ? (
            // POST /api/program does not create stations; only the demo seed does.
            <EmptyState icon="pump" title="No stations yet" body="Stations are created by seed-demo.ts." />
          ) : (
            <>
              {state.dashboard.stations.map((station) => (
                <StationRow key={station.id} station={station} phpPerXlm={state.dashboard.phpPerXlm} href={`/stations/${station.id}`} />
              ))}
              <DemoRate />
            </>
          )
        ) : null}
      </Body>
    </>
  );
}
