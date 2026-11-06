"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { postSettlementRun } from "@/lib/api";
import { perLitre } from "@/lib/feed";
import { php } from "@/lib/format";
import { errorMessage, useDashboard } from "@/lib/use-dashboard";
import { OfficerNotice, OfficerOnly, useAuth } from "../../(app)/_components/Auth";
import { StationRow } from "../../(app)/_components/money";
import { UnfreezeSheet } from "../../(app)/_components/Unfreeze";
import { Button, Card, DemoRate, KeyValues, LinkButton, Notice } from "../../(app)/_components/ui";
import { Gate, Page } from "../_components/kit";

/** One money decision: the limit that binds it, then the controls that run it. */
function Decision({ title, rule, limits, children }: { title: string; rule: string; limits: Array<[string, string]>; children: ReactNode }) {
  return (
    <Card className="!gap-3">
      <h2 className="text-h2">{title}</h2>
      <p className="text-small">{rule}</p>
      <KeyValues rows={limits} />
      <OfficerOnly fallback={null}>
        <div className="flex flex-col gap-2">{children}</div>
      </OfficerOnly>
    </Card>
  );
}

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
  const { isOfficer, loading } = useAuth();
  const [settling, setSettling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unfreezing, setUnfreezing] = useState(false);

  return (
    <Page title="Agents">
      <Gate state={state} what="agents" empty="Agents start working once a program is running." icon="pulse">
        {(dashboard) => {
          const rate = dashboard.phpPerXlm;
          const { program } = dashboard;
          const ended = program.status === "ended";
          const fired = program.trancheFired;
          const frozen = dashboard.stations.find((s) => s.status === "frozen");
          const settle = async () => {
            if (!isOfficer) return;
            setSettling(true);
            setError(null);
            try {
              await postSettlementRun();
              router.push("/desktop/demo/settlement");
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
              {!loading && !isOfficer ? <OfficerNotice /> : null}
              <div className="grid grid-cols-3 gap-4">
                <Decision
                  title="Fund"
                  rule="Releases a tranche per card only when a price shift is real, above the threshold and inside the verified budget."
                  limits={[
                    ["Price threshold", perLitre(program.priceThresholdPhp)],
                    ["Tranche per card", php(program.trancheStroops, rate)],
                    ["Budget left", php(dashboard.budget.remainingStroops, rate)],
                  ]}
                >
                  {fired || ended ? <Button disabled>Start price feed</Button> : <LinkButton href="/desktop/demo/tranche">Start price feed</LinkButton>}
                  {fired ? (
                    <LinkButton look="tertiary" href="/desktop/demo/tranche">
                      Tranche Agent
                    </LinkButton>
                  ) : null}
                </Decision>
                <Decision
                  title="Refuse"
                  rule="Every tap is checked against the card's policy. A station with an anomalous tap pattern is frozen and its settlement held."
                  limits={[
                    ["Per-tap cap", php(program.perTapCapStroops, rate)],
                    ["Freeze line", String(dashboard.midasThreshold)],
                    ["Taps refused or declined", String(dashboard.counts.tapsRefused + dashboard.counts.tapsRejected)],
                  ]}
                >
                  {frozen !== undefined || ended ? (
                    <Disabled>Run burst</Disabled>
                  ) : (
                    <LinkButton look="secondary" href="/desktop/demo/freeze">
                      Run burst
                    </LinkButton>
                  )}
                  {frozen === undefined || ended ? (
                    <Disabled>Unfreeze Station B</Disabled>
                  ) : (
                    <Button look="secondary" onClick={() => setUnfreezing(true)}>
                      Unfreeze {`Station ${frozen.id}`}
                    </Button>
                  )}
                  {frozen !== undefined ? (
                    <LinkButton look="tertiary" href="/desktop/demo/freeze">
                      Freeze Agent
                    </LinkButton>
                  ) : null}
                </Decision>
                <Decision
                  title="Return"
                  rule="Settlement claims what active stations are owed. Ending the program sweeps unspent escrow back to the LGU wallet."
                  limits={[
                    ["Pending", php(dashboard.pendingStroops, rate)],
                    ["Escrow remaining", php(dashboard.escrowRemainingStroops, rate)],
                    ["Returned", php(dashboard.returnedStroops, rate)],
                  ]}
                >
                  <Button look="secondary" loading={settling} disabled={ended} onClick={() => void settle()}>
                    {settling ? "Settling" : "Run settlement"}
                  </Button>
                  {ended ? (
                    <Disabled>End program</Disabled>
                  ) : (
                    <LinkButton look="secondary" href="/desktop/demo/end">
                      End program
                    </LinkButton>
                  )}
                </Decision>
              </div>
              <section className="flex flex-col gap-3">
                <h2 className="text-h2">Stations</h2>
                <div className="grid grid-cols-2 items-start gap-4">
                  {dashboard.stations.map((station) => (
                    <StationRow key={station.id} station={station} phpPerXlm={rate} href={`/desktop/stations/${station.id}`} />
                  ))}
                </div>
              </section>
              <DemoRate />
              {frozen !== undefined ? (
                <UnfreezeSheet
                  station={frozen}
                  phpPerXlm={rate}
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
        }}
      </Gate>
    </Page>
  );
}
