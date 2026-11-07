"use client";

import { useState } from "react";
import { buildFeed, type FeedItem } from "@/lib/feed";
import { explorerUrl } from "@/lib/format";
import { useDashboard } from "@/lib/use-dashboard";
import { Body, Chip, DemoRate, EmptyState, ErrorBlock, KeyValues, LinkButton, ListCard, NoProgram, Sheet, Skeleton, TopBar } from "../_components/ui";

export default function Activity() {
  const state = useDashboard();
  const [selected, setSelected] = useState<FeedItem | null>(null);
  const feed = state.status === "ready" ? buildFeed(state.dashboard) : [];
  return (
    <>
      <TopBar title="Activity" back="/dashboard" />
      <Body>
        {state.status === "loading" ? <Skeleton kinds={["row", "row", "row", "row", "row", "row"]} /> : null}
        {state.status === "no-program" ? <NoProgram body="Activity appears once a program is running." icon="pulse" /> : null}
        {state.status === "error" ? <ErrorBlock title="Could not load activity" message={state.message} onRetry={() => void state.reload()} /> : null}
        {state.status === "ready" ? (
          feed.length === 0 ? (
            <EmptyState icon="pulse" title="No activity yet" body="Taps and agent decisions appear here as they happen, newest first." />
          ) : (
            <>
              <ListCard
                rows={feed.map((item) => ({
                  id: item.id,
                  title: item.title,
                  meta: item.meta,
                  value: item.value,
                  chip: item.chip,
                  tone: item.tone,
                  onClick: () => setSelected(item),
                }))}
              />
              <DemoRate />
            </>
          )
        ) : null}
      </Body>
      <Sheet title={selected?.detail.title ?? "Activity"} open={selected !== null} onClose={() => setSelected(null)}>
        {selected !== null ? (
          <>
            <Chip tone={selected.detail.tone}>{selected.detail.chip}</Chip>
            {selected.detail.rows.length > 0 ? <KeyValues rows={selected.detail.rows} /> : null}
            {selected.detail.label !== undefined ? <Chip>{selected.detail.label}</Chip> : null}
            {selected.detail.hash !== null ? (
              <LinkButton look="secondary" external href={explorerUrl(selected.detail.hash)}>
                View on Stellar Expert
              </LinkButton>
            ) : null}
          </>
        ) : null}
      </Sheet>
    </>
  );
}
