"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Dashboard, EndProgramResponse } from "@tapat/shared";
import { postProgramEnd } from "@/lib/api";
import { cardLabel, txLookup } from "@/lib/feed";
import { php, phpTile, shortHash } from "@/lib/format";
import { errorMessage, useDashboard } from "@/lib/use-dashboard";
import { OfficerNotice, useAuth } from "../../_components/Auth";
import { CoinFlow } from "../../_components/motion";
import { Actions, Body, Button, Chip, ConfirmSheet, DemoRate, ErrorBlock, LinkButton, ListCard, NoProgram, Notice, Skeleton, StatCard, TopBar, type ListRow } from "../../_components/ui";

type CardOutcome = EndProgramResponse["cards"][number];

function outcomeRow(outcome: CardOutcome, dashboard: Dashboard): ListRow {
  const card = dashboard.cards.find((c) => c.id === outcome.cardId);
  const title = card === undefined ? outcome.cardId : cardLabel(card);
  const hash = txLookup(dashboard)(outcome.sweepTxId ?? outcome.revokeTxId);
  const value = php(outcome.returnedStroops, dashboard.phpPerXlm);
  if (outcome.status !== "swept" && outcome.status !== "revoked") {
    return { id: outcome.cardId, title, meta: outcome.reason ?? "CHAIN_ERROR", chip: "Failed", tone: "danger" };
  }
  if (outcome.reason === "EMPTY_ESCROW") return { id: outcome.cardId, title, meta: "Empty escrow, no sweep", value };
  return { id: outcome.cardId, title, meta: hash === null ? "Revoked" : `Revoked, tx ${shortHash(hash)}`, value };
}

export default function EndProgram() {
  const router = useRouter();
  const state = useDashboard();
  const { isOfficer, loading: authLoading } = useAuth();
  const [confirmed, setConfirmed] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EndProgramResponse | null>(null);

  const end = async () => {
    if (!isOfficer) return;
    setConfirmed(true);
    setSweeping(true);
    setError(null);
    try {
      setResult(await postProgramEnd());
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSweeping(false);
      void state.reload();
    }
  };

  const dashboard = state.status === "ready" ? state.dashboard : null;
  const rate = dashboard?.phpPerXlm ?? 10;
  const ended = dashboard?.program.status === "ended" || result !== null;
  // A reload after the sweep has no response in hand; the closing decision carries the same per-card rows.
  const closing = dashboard?.recentDecisions.find((d) => d.agent === "sweep" && d.decision === "PROGRAM_ENDED");
  const outcomes: CardOutcome[] = result?.cards ?? (Array.isArray(closing?.outputs.cards) ? (closing.outputs.cards as CardOutcome[]) : []);
  const failures = outcomes.filter((c) => c.status !== "swept" && c.status !== "revoked");
  const total = result?.totalReturnedStroops ?? dashboard?.returnedStroops ?? "0";
  const unspent = dashboard === null ? "" : php(dashboard.escrowRemainingStroops, rate);
  const activeCards = dashboard?.cards.filter((c) => c.status === "active") ?? [];

  return (
    <>
      <TopBar title="End program" back="/demo" />
      <Body>
        {state.status === "loading" ? <Skeleton kinds={["card", "row", "row"]} /> : null}
        {state.status === "no-program" ? <NoProgram icon="pulse" body="Agents start working once a program is running." /> : null}
        {state.status === "error" ? <ErrorBlock title="Could not load the program" message={state.message} onRetry={() => void state.reload()} /> : null}
        {dashboard !== null ? (
          <>
            {error !== null ? (
              <Notice tone="error" title="The program did not end">
                {error}
              </Notice>
            ) : null}
            {failures.length > 0 ? (
              <Notice tone="error" title={`${failures.length === 1 ? "One sweep" : `${failures.length} sweeps`} did not go through`}>
                The program still ended. These cards stay unchanged, and re-running skips cards already swept.
              </Notice>
            ) : null}
            {sweeping ? (
              <>
                <Chip>Ending</Chip>
                {/* The sweep is one long request with no per-card progress events, so every card reads as pending until it answers. */}
                <ListCard heading="Returning credit" rows={activeCards.map((card) => ({ id: card.id, title: cardLabel(card), meta: "Waiting", chip: "Pending" }))} />
              </>
            ) : null}
            {ended && !sweeping ? (
              <>
                <div className="relative">
                  <StatCard
                    tone="forest"
                    full
                    label="Returned to the LGU wallet"
                    value={phpTile(total, rate)}
                    live={{ to: Number(total), format: (n) => phpTile(String(Math.round(n)), rate) }}
                  />
                  <CoinFlow key={ended ? outcomes.length : 0} />
                </div>
                {outcomes.length > 0 ? <ListCard heading="Per card" rows={outcomes.map((o) => outcomeRow(o, dashboard))} /> : null}
                <DemoRate />
              </>
            ) : null}
            {!authLoading && !isOfficer ? <OfficerNotice /> : null}
          </>
        ) : null}
      </Body>
      {dashboard !== null && sweeping ? (
        <Actions>
          <Button loading>Sweeping cards</Button>
        </Actions>
      ) : null}
      {dashboard !== null && !sweeping && ended ? (
        <Actions>
          {isOfficer && failures.length > 0 ? (
            <Button look="secondary" onClick={() => void end()}>
              Run again
            </Button>
          ) : null}
          <LinkButton href="/">View final totals</LinkButton>
        </Actions>
      ) : null}
      {dashboard !== null && !sweeping && !ended && confirmed ? (
        <Actions>
          <LinkButton look="secondary" href="/demo">
            Back to agents
          </LinkButton>
        </Actions>
      ) : null}
      {dashboard !== null && isOfficer ? (
        <ConfirmSheet
          open={!confirmed && !ended}
          title="End this program?"
          body={`Every active card is revoked, and the ${unspent} unspent returns to the LGU wallet. This cannot be undone.`}
          confirm="End program"
          cancel="Keep running"
          onConfirm={() => void end()}
          onCancel={() => router.push("/demo")}
        />
      ) : null}
    </>
  );
}
