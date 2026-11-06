"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postSettlementRun } from "@/lib/api";
import { errorMessage, useDashboard } from "@/lib/use-dashboard";
import { StationRow } from "../_components/money";
import { UnfreezeSheet } from "../_components/Unfreeze";
import { Body, Button, DemoRate, ErrorBlock, LinkButton, NoProgram, Notice, SectionTitle, Skeleton, TopBar } from "../_components/ui";

function Disabled({ children }: { children: string }) {
  return (
    <Button look="secondary" disabled>
      {children}
    </Button>
  );
}

export default function Agents() {
  const router = useRouter();
  const state = useDashboard();
  const [settling, setSettling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unfreezing, setUnfreezing] = useState(false);

  return (
    <>
      <TopBar />
      <Body>
        {state.status === "loading" ? <Skeleton kinds={["row", "row", "row", "row", "card", "card"]} /> : null}
        {state.status === "no-program" ? <NoProgram icon="pulse" body="Agents start working once a program is running." /> : null}
        {state.status === "error" ? <ErrorBlock title="Could not load agents" message={state.message} onRetry={() => void state.reload()} /> : null}
        {state.status === "ready"
          ? (() => {
              const { dashboard } = state;
              const ended = dashboard.program.status === "ended";
              const fired = dashboard.program.trancheFired;
              const frozen = dashboard.stations.find((s) => s.status === "frozen");
              const settle = async () => {
                setSettling(true);
                setError(null);
                try {
                  await postSettlementRun();
                  router.push("/demo/settlement");
                } catch (cause) {
                  setError(errorMessage(cause));
                  void state.reload();
                } finally {
                  setSettling(false);
                }
              };
              return (
                <>
                  {error !== null ? (
                    <Notice tone="error" title="Settlement did not finish">
                      {error}
                    </Notice>
                  ) : null}
                  {fired || ended ? (
                    <Button disabled>Start price feed</Button>
                  ) : (
                    <LinkButton href="/demo/tranche">Start price feed</LinkButton>
                  )}
                  {frozen !== undefined || ended ? <Disabled>Run burst</Disabled> : <LinkButton look="secondary" href="/demo/freeze">Run burst</LinkButton>}
                  <Button look="secondary" loading={settling} disabled={ended} onClick={() => void settle()}>
                    {settling ? "Settling" : "Run settlement"}
                  </Button>
                  {frozen === undefined || ended ? (
                    <Disabled>Unfreeze Station B</Disabled>
                  ) : (
                    <Button look="secondary" onClick={() => setUnfreezing(true)}>
                      Unfreeze {`Station ${frozen.id}`}
                    </Button>
                  )}
                  {ended ? <Disabled>End program</Disabled> : <LinkButton look="secondary" href="/demo/end">End program</LinkButton>}
                  {fired || frozen !== undefined ? (
                    <div className="flex gap-2">
                      {fired ? <LinkButton look="tertiary" href="/demo/tranche">Tranche Agent</LinkButton> : null}
                      {frozen !== undefined ? <LinkButton look="tertiary" href="/demo/freeze">Freeze Agent</LinkButton> : null}
                    </div>
                  ) : null}
                  <SectionTitle>Stations</SectionTitle>
                  {dashboard.stations.map((station) => (
                    <StationRow key={station.id} station={station} phpPerXlm={dashboard.phpPerXlm} href={`/stations/${station.id}`} />
                  ))}
                  <DemoRate />
                  {frozen !== undefined ? (
                    <UnfreezeSheet
                      station={frozen}
                      phpPerXlm={dashboard.phpPerXlm}
                      open={unfreezing}
                      onClose={() => setUnfreezing(false)}
                      onDone={() => {
                        setUnfreezing(false);
                        void state.reload();
                      }}
                    />
                  ) : null}
                </>
              );
            })()
          : null}
      </Body>
    </>
  );
}
