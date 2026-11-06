"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { dateTime } from "@/lib/format";
import { OfficerNotice, OfficerOnly } from "../../_components/Auth";
import { useDashboard } from "@/lib/use-dashboard";
import { StationRow } from "../../_components/money";
import { UnfreezeSheet } from "../../_components/Unfreeze";
import { Actions, Body, Button, Card, DemoRate, EmptyState, ErrorBlock, KeyValues, NoProgram, Notice, Skeleton, TopBar } from "../../_components/ui";

export default function StationDetail() {
  const { id } = useParams<{ id: string }>();
  const state = useDashboard();
  const [confirming, setConfirming] = useState(false);
  const station = state.status === "ready" ? state.dashboard.stations.find((s) => s.id === id) : undefined;
  const frozen = station?.status === "frozen";
  const shortKey = station === undefined ? "" : `${station.publicKey.slice(0, 4)}…${station.publicKey.slice(-4)}`;

  return (
    <>
      <TopBar title={`Station ${id}`} back="/stations" chip={station === undefined ? undefined : frozen ? "Frozen" : "Active"} tone={frozen ? "frozen" : "mint"} />
      <Body>
        {state.status === "loading" ? <Skeleton kinds={["card", "card"]} /> : null}
        {state.status === "no-program" ? <NoProgram body="Stations appear once a program is running." icon="pump" /> : null}
        {state.status === "error" ? <ErrorBlock title="Could not load this station" message={state.message} onRetry={() => void state.reload()} /> : null}
        {state.status === "ready" && station === undefined ? <EmptyState icon="pump" title="Station not found" body={`There is no station ${id} in this program.`} /> : null}
        {state.status === "ready" && station !== undefined ? (
          <>
            {frozen ? (
              <div className="shiver ice-sheen">
                <Notice tone="frozen" title="Frozen by the Freeze Agent">
                  New taps are refused before signing, and this station is not settled until you unfreeze it.
                </Notice>
              </div>
            ) : null}
            <StationRow station={station} phpPerXlm={state.dashboard.phpPerXlm} />
            <Card>
              <KeyValues
                rows={[
                  ["Station ID", station.id],
                  ["Public key", shortKey],
                  ...(station.frozenAt !== null ? ([["Frozen at", dateTime(station.frozenAt)]] as Array<[string, string]>) : []),
                ]}
              />
            </Card>
            <DemoRate />
            <UnfreezeSheet
              station={station}
              phpPerXlm={state.dashboard.phpPerXlm}
              open={confirming}
              onClose={() => setConfirming(false)}
              onDone={() => {
                setConfirming(false);
                void state.reload();
              }}
            />
          </>
        ) : null}
      </Body>
      {frozen ? (
        <Actions>
          <OfficerOnly fallback={<OfficerNotice />}>
            <Button onClick={() => setConfirming(true)}>Unfreeze station</Button>
          </OfficerOnly>
        </Actions>
      ) : null}
    </>
  );
}
