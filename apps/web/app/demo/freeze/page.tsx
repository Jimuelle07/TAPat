"use client";

import { useEffect, useRef, useState } from "react";
import { postFreezeBurst } from "@/lib/api";
import { errorMessage, useDashboard } from "@/lib/use-dashboard";
import { OfficerOnly, OfficerNotice, useAuth } from "../../_components/Auth";
import { EdgeChart } from "../../_components/charts";
import { StationRow } from "../../_components/money";
import { Actions, Body, Button, ErrorBlock, LinkButton, NoProgram, Notice, Skeleton, TopBar } from "../../_components/ui";

/** The burst replays at Station B by design (§5.2 #14). */
const BURST_STATION = "B";
/** The burst's last edge still has to be scored by the 1 s freeze ticker before the station can freeze. */
const SCORING_GRACE_MS = 4_000;

export default function FreezeAgent() {
  const state = useDashboard();
  const { isOfficer } = useAuth();
  const [burstRunning, setBurstRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const start = async () => {
    if (!isOfficer) return;
    setStarting(true);
    setError(null);
    try {
      const { edges, tickMs } = await postFreezeBurst();
      setBurstRunning(true);
      timer.current = setTimeout(() => setBurstRunning(false), edges * tickMs + SCORING_GRACE_MS);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setStarting(false);
    }
  };

  const dashboard = state.status === "ready" ? state.dashboard : null;
  const station = dashboard?.stations.find((s) => s.id === BURST_STATION);
  const frozen = station?.status === "frozen";
  // recentTaps is newest first; the chart reads left to right.
  const scores = (dashboard?.recentTaps ?? [])
    .filter((t) => t.stationId === BURST_STATION && t.midasScore !== null)
    .map((t) => t.midasScore as number)
    .reverse();
  const frozenDecision = dashboard?.recentDecisions.find((d) => d.agent === "freeze" && d.decision === "FROZEN");
  const frozenScore = frozen && typeof frozenDecision?.inputs.midasScore === "number" ? frozenDecision.inputs.midasScore : null;
  const needsTap = error !== null && error.includes("Station B first");

  return (
    <>
      <TopBar title="Freeze Agent" back="/demo" />
      <Body>
        {state.status === "loading" ? <Skeleton kinds={["card", "card"]} /> : null}
        {state.status === "no-program" ? <NoProgram icon="pulse" body="Agents start working once a program is running." /> : null}
        {state.status === "error" ? <ErrorBlock title="Could not load the Freeze Agent" message={state.message} onRetry={() => void state.reload()} /> : null}
        {dashboard !== null ? (
          <>
            {error !== null ? (
              <Notice tone="error" title="Burst did not start">
                {error}
              </Notice>
            ) : null}
            {frozen && station !== undefined ? (
              <Notice tone="frozen" title={`${station.name} frozen`}>
                {station.frozenReason ?? "Paused by the Freeze Agent."}
              </Notice>
            ) : null}
            <EdgeChart scores={scores} threshold={dashboard.midasThreshold} frozenScore={frozenScore} live={burstRunning || starting} />
            {station !== undefined ? <StationRow station={station} phpPerXlm={dashboard.phpPerXlm} /> : null}
          </>
        ) : null}
      </Body>
      {dashboard !== null ? (
        <Actions>
          {frozen ? (
            <LinkButton href="/demo/settlement">Run settlement</LinkButton>
          ) : needsTap ? (
            <LinkButton href={`/station/${BURST_STATION}`}>Go to Station {BURST_STATION}</LinkButton>
          ) : (
            <OfficerOnly fallback={<OfficerNotice />}>
              <Button loading={starting || burstRunning} onClick={() => void start()}>
                {starting || burstRunning ? "Burst running" : "Run burst"}
              </Button>
            </OfficerOnly>
          )}
        </Actions>
      ) : null}
    </>
  );
}
