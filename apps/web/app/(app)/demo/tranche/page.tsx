"use client";

import { useCallback, useEffect, useState } from "react";
import type { TrancheState } from "@tapat/shared";
import { ApiClientError, getTrancheState, postTrancheStart } from "@/lib/api";
import { cardLabel, perLitre, txLookup } from "@/lib/feed";
import { php, shortHash } from "@/lib/format";
import { ignoredSpike } from "@/lib/tranche";
import { errorMessage, useDashboard } from "@/lib/use-dashboard";
import { OfficerOnly, OfficerNotice, useAuth } from "../../_components/Auth";
import { PriceChart } from "../../_components/charts";
import { CoinFlow, useValueChange } from "../../_components/motion";
import { TrancheReleasing, TrancheStatusCard } from "../../_components/TrancheStatus";
import { Actions, Body, Button, Card, DemoRate, ErrorBlock, KeyValues, LinkButton, ListCard, NoProgram, Notice, Skeleton, TopBar, type ListRow } from "../../_components/ui";

const POLL_MS = 700;

export default function TrancheAgent() {
  const state = useDashboard();
  const { isOfficer } = useAuth();
  const [tranche, setTranche] = useState<TrancheState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<{ code: string; message: string } | null>(null);
  // Fired state as of the first successful load; null until then.
  const [firedOnLoad, setFiredOnLoad] = useState<boolean | null>(null);
  // 0 on mount, then one bump per flip: coins play only when the tranche fires while this screen is open.
  const firedChange = useValueChange(tranche?.fired === true);

  const refresh = useCallback(async () => {
    try {
      const next = await getTrancheState();
      setTranche(next);
      setFiredOnLoad((first) => (first === null ? next.fired : first));
      setLoadError(null);
    } catch (cause) {
      setLoadError(errorMessage(cause));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the feed's state; a reload redraws the chart
    void refresh();
  }, [refresh]);

  const running = tranche?.running === true;
  // §5.2 #12: polled until `running === false`.
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [running, refresh]);

  const start = async () => {
    if (!isOfficer) return;
    setStarting(true);
    setStartError(null);
    try {
      await postTrancheStart();
      await refresh();
    } catch (cause) {
      setStartError({ code: cause instanceof ApiClientError ? cause.code : "", message: errorMessage(cause) });
    } finally {
      setStarting(false);
    }
  };

  const ready = state.status === "ready" && tranche !== null ? { dashboard: state.dashboard, tranche } : null;
  const decision = ready?.dashboard.recentDecisions.find((d) => d.agent === "tranche");
  const spike = ready === null ? null : ignoredSpike(ready.tranche.points, ready.tranche.thresholdPhp, ready.tranche.fired);

  const fundingRows = (): ListRow[] => {
    if (ready === null) return [];
    const { dashboard } = ready;
    const hashOf = txLookup(dashboard);
    return ready.tranche.funds.map((fund) => {
      const card = dashboard.cards.find((c) => c.id === fund.cardId);
      const title = card === undefined ? fund.cardId : cardLabel(card);
      if (fund.status === "skipped") return { id: fund.cardId, title, meta: `Skipped, ${fund.reason ?? "no reason recorded"}`, chip: "Skipped" };
      if (fund.status === "failed") return { id: fund.cardId, title, meta: fund.reason ?? "The funding tx failed", chip: "Failed", tone: "danger" };
      const hash = hashOf(fund.txId);
      return {
        id: fund.cardId,
        title,
        meta: hash === null ? "Waiting for the chain" : `tx ${shortHash(hash)}`,
        value: php(fund.amountStroops, dashboard.phpPerXlm),
      };
    });
  };

  return (
    <>
      <TopBar title="Tranche Agent" back="/demo" />
      <Body>
        {state.status === "no-program" ? <NoProgram icon="pulse" body="Agents start working once a program is running." /> : null}
        {state.status === "error" ? <ErrorBlock title="Could not load the Tranche Agent" message={state.message} onRetry={() => void state.reload()} /> : null}
        {loadError !== null && tranche === null ? <ErrorBlock title="Could not load the price feed" message={loadError} onRetry={() => void refresh()} /> : null}
        {state.status === "loading" || (state.status === "ready" && tranche === null && loadError === null) ? <Skeleton kinds={["card", "row", "row"]} /> : null}
        {ready !== null ? (
          <>
            {startError !== null ? (
              <Notice tone="error" title="Feed did not start">
                {startError.code === "" ? "" : `${startError.code}: `}
                {startError.message}
              </Notice>
            ) : null}
            <TrancheStatusCard dashboard={ready.dashboard} tranche={ready.tranche} />
            <PriceChart
              points={ready.tranche.points}
              total={ready.tranche.total}
              thresholdPhp={ready.tranche.thresholdPhp}
              fired={ready.tranche.fired}
              simulated={ready.tranche.points.every((p) => p.simulated)}
            />
            <TrancheReleasing dashboard={ready.dashboard} tranche={ready.tranche} />
            {decision?.decision === "BUDGET_EXHAUSTED" ? (
              <Notice title="Budget ran out">
                BUDGET_EXHAUSTED: {php(String(decision.outputs.budgetAfterStroops ?? "0"), ready.dashboard.phpPerXlm)} left is below one{" "}
                {php(ready.dashboard.program.trancheStroops, ready.dashboard.phpPerXlm)} tranche, so funding stopped.
              </Notice>
            ) : null}
            {!ready.tranche.fired && spike !== null ? (
              <Notice title="One-day spike ignored">
                Point {spike.idx} reached {perLitre(spike.pricePhp)} and fell back. One day is not a shift, so nothing was funded.
              </Notice>
            ) : null}
            {!ready.tranche.fired && spike === null ? (
              <Notice title="Watching the price">Funds only when a shift is sustained, above the threshold, and inside verified budget.</Notice>
            ) : null}
            {decision !== undefined && ready.tranche.fired ? (
              <Card>
                <h3 className="text-label">Tranche decision</h3>
                <KeyValues
                  rows={[
                    ["Price", perLitre(decision.inputs.pricePhp)],
                    ["Segment mean", perLitre(decision.inputs.segmentMeanPhp)],
                    ["Threshold", perLitre(decision.inputs.thresholdPhp)],
                    ["Changepoint probability", typeof decision.inputs.cpRecent === "number" ? decision.inputs.cpRecent.toFixed(2) : "Not recorded"],
                    ["Run length", String(decision.inputs.mapR ?? "Not recorded")],
                    ["Budget before", php(String(decision.inputs.budgetBeforeStroops ?? "0"), ready.dashboard.phpPerXlm)],
                    ["Budget after", php(String(decision.outputs.budgetAfterStroops ?? "0"), ready.dashboard.phpPerXlm)],
                  ]}
                />
              </Card>
            ) : null}
            {ready.tranche.funds.length > 0 ? (
              <div className="relative">
                <ListCard heading="Funding" rows={fundingRows()} />
                {ready.tranche.fired && firedOnLoad === false && firedChange > 0 ? <CoinFlow key={firedChange} /> : null}
              </div>
            ) : null}
            {ready.tranche.fired ? <DemoRate /> : null}
            {/* Keeps the last rows clear of the floating action bar and the tab bar. */}
            <div aria-hidden="true" className="h-20 shrink-0" />
          </>
        ) : null}
      </Body>
      {ready !== null ? (
        <Actions>
          {ready.tranche.fired ? (
            <LinkButton look="secondary" href="/demo">
              Back to agents
            </LinkButton>
          ) : startError?.message.includes("no verified budget") ? (
            <LinkButton href="/?sheet=budget">Fund the budget</LinkButton>
          ) : (
            <OfficerOnly fallback={<OfficerNotice />}>
              <Button loading={running || starting} onClick={() => void start()}>
                {running || starting ? "Feed running" : "Start price feed"}
              </Button>
            </OfficerOnly>
          )}
        </Actions>
      ) : null}
    </>
  );
}
