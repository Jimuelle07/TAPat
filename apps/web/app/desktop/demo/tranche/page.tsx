"use client";

import { useCallback, useEffect, useState } from "react";
import type { TrancheState } from "@tapat/shared";
import { ApiClientError, getTrancheState, postTrancheStart } from "@/lib/api";
import { cardLabel, perLitre, txLookup } from "@/lib/feed";
import { php, shortHash } from "@/lib/format";
import { ignoredSpike } from "@/lib/tranche";
import { errorMessage, useDashboard } from "@/lib/use-dashboard";
import { OfficerNotice, OfficerOnly, useAuth } from "../../../(app)/_components/Auth";
import { PriceChart } from "../../../(app)/_components/charts";
import { CoinFlow, useValueChange } from "../../../(app)/_components/motion";
import { TrancheReleasing, TrancheStatusCard } from "../../../(app)/_components/TrancheStatus";
import { Button, Card, DemoRate, ErrorBlock, KeyValues, LinkButton, ListCard, Notice, Skeleton, type ListRow } from "../../../(app)/_components/ui";
import { Gate, Page } from "../../_components/kit";

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

  return (
    <Page title="Tranche Agent" back="/desktop/demo">
      <Gate state={state} what="the Tranche Agent" empty="Agents start working once a program is running." icon="pulse">
        {(dashboard) => {
          if (tranche === null) {
            return loadError !== null ? (
              <div className="flex max-w-xl flex-col gap-4">
                <ErrorBlock title="Could not load the price feed" message={loadError} onRetry={() => void refresh()} />
              </div>
            ) : (
              <Skeleton kinds={["card", "row", "row"]} />
            );
          }
          const rate = dashboard.phpPerXlm;
          const decision = dashboard.recentDecisions.find((d) => d.agent === "tranche");
          const spike = ignoredSpike(tranche.points, tranche.thresholdPhp, tranche.fired);
          const hashOf = txLookup(dashboard);
          const fundingRows: ListRow[] = tranche.funds.map((fund) => {
            const card = dashboard.cards.find((c) => c.id === fund.cardId);
            const title = card === undefined ? fund.cardId : cardLabel(card);
            if (fund.status === "skipped") return { id: fund.cardId, title, meta: `Skipped, ${fund.reason ?? "no reason recorded"}`, chip: "Skipped" };
            if (fund.status === "failed") return { id: fund.cardId, title, meta: fund.reason ?? "The funding tx failed", chip: "Failed", tone: "danger" };
            const hash = hashOf(fund.txId);
            return { id: fund.cardId, title, meta: hash === null ? "Waiting for the chain" : `tx ${shortHash(hash)}`, value: php(fund.amountStroops, rate) };
          });
          return (
            <>
              {startError !== null ? (
                <Notice tone="error" title="Feed did not start">
                  {startError.code === "" ? "" : `${startError.code}: `}
                  {startError.message}
                </Notice>
              ) : null}
              <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start gap-6">
                <div className="flex min-w-0 flex-col gap-4">
                  <PriceChart points={tranche.points} total={tranche.total} thresholdPhp={tranche.thresholdPhp} fired={tranche.fired} simulated={tranche.points.every((p) => p.simulated)} />
                  <TrancheStatusCard dashboard={dashboard} tranche={tranche} />
                </div>
                <div className="flex flex-col gap-4">
                  {tranche.fired ? (
                    <LinkButton look="secondary" href="/desktop/demo">
                      Back to agents
                    </LinkButton>
                  ) : startError?.message.includes("no verified budget") ? (
                    <LinkButton href="/desktop?sheet=budget">Fund the budget</LinkButton>
                  ) : (
                    <OfficerOnly fallback={<OfficerNotice />}>
                      <Button loading={running || starting} onClick={() => void start()}>
                        {running || starting ? "Feed running" : "Start price feed"}
                      </Button>
                    </OfficerOnly>
                  )}
                  <TrancheReleasing dashboard={dashboard} tranche={tranche} />
                  {decision?.decision === "BUDGET_EXHAUSTED" ? (
                    <Notice title="Budget ran out">
                      BUDGET_EXHAUSTED: {php(String(decision.outputs.budgetAfterStroops ?? "0"), rate)} left is below one {php(dashboard.program.trancheStroops, rate)} tranche, so funding stopped.
                    </Notice>
                  ) : null}
                  {!tranche.fired && spike !== null ? (
                    <Notice title="One-day spike ignored">
                      Point {spike.idx} reached {perLitre(spike.pricePhp)} and fell back. One day is not a shift, so nothing was funded.
                    </Notice>
                  ) : null}
                  {!tranche.fired && spike === null ? <Notice title="Watching the price">Funds only when a shift is sustained, above the threshold, and inside verified budget.</Notice> : null}
                  {decision !== undefined && tranche.fired ? (
                    <Card>
                      <h2 className="text-label">Tranche decision</h2>
                      <KeyValues
                        rows={[
                          ["Price", perLitre(decision.inputs.pricePhp)],
                          ["Segment mean", perLitre(decision.inputs.segmentMeanPhp)],
                          ["Threshold", perLitre(decision.inputs.thresholdPhp)],
                          ["Changepoint probability", typeof decision.inputs.cpRecent === "number" ? decision.inputs.cpRecent.toFixed(2) : "Not recorded"],
                          ["Run length", String(decision.inputs.mapR ?? "Not recorded")],
                          ["Budget before", php(String(decision.inputs.budgetBeforeStroops ?? "0"), rate)],
                          ["Budget after", php(String(decision.outputs.budgetAfterStroops ?? "0"), rate)],
                        ]}
                      />
                    </Card>
                  ) : null}
                </div>
              </div>
              {tranche.funds.length > 0 ? (
                <div className="relative">
                  <ListCard heading="Funding" rows={fundingRows} />
                  {tranche.fired && firedOnLoad === false && firedChange > 0 ? <CoinFlow key={firedChange} /> : null}
                </div>
              ) : null}
              {tranche.fired ? <DemoRate /> : null}
            </>
          );
        }}
      </Gate>
    </Page>
  );
}
