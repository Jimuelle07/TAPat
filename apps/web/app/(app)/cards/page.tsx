"use client";

import type { CardSummary } from "@tapat/shared";
import { cardLabel } from "@/lib/feed";
import { php } from "@/lib/format";
import { useDashboard } from "@/lib/use-dashboard";
import { Body, DemoRate, EmptyState, ErrorBlock, ListCard, NoProgram, Skeleton, TopBar, type ListRow } from "../_components/ui";

function cardRow(card: CardSummary, rate: number): ListRow {
  const title = cardLabel(card);
  const prefix = `${card.deviceHashPrefix}${card.virtual ? " · virtual" : ""}`;
  switch (card.status) {
    case "swept":
      return { id: card.id, title, meta: `Swept · returned ${php(card.returnedStroops, rate)}`, chip: "Swept" };
    case "pending":
      return { id: card.id, title, meta: "Waiting for the chain", chip: "Pending" };
    case "failed":
      return { id: card.id, title, meta: "Enrollment failed on-chain. Retrying the same card resumes it.", chip: "Failed", tone: "danger" };
    case "revoked":
      return { id: card.id, title, meta: "Policy revoked", chip: "Revoked" };
    case "active":
      return {
        id: card.id,
        title,
        meta: `${prefix} · escrow ${php(card.escrowStroops, rate)}`,
        ...(card.expired ? { chip: "Expired" } : { chip: "Active", tone: "mint" as const }),
      };
  }
}

export default function Cards() {
  const state = useDashboard();
  return (
    <>
      <TopBar title="Cards" back="/" />
      <Body>
        {state.status === "loading" ? <Skeleton kinds={["row", "row", "row", "row", "row"]} /> : null}
        {state.status === "no-program" ? <NoProgram body="Cards appear once a program is running." icon="idcard" /> : null}
        {state.status === "error" ? <ErrorBlock title="Could not load cards" message={state.message} onRetry={() => void state.reload()} /> : null}
        {state.status === "ready" ? (
          state.dashboard.cards.length === 0 ? (
            <EmptyState icon="idcard" title="No cards yet" body="Enrolled cards appear here, in enrollment order." action={{ label: "Enroll a driver", href: "/enroll" }} />
          ) : (
            <>
              <ListCard rows={state.dashboard.cards.map((card) => cardRow(card, state.dashboard.phpPerXlm))} />
              <DemoRate />
            </>
          )
        ) : null}
      </Body>
    </>
  );
}
