"use client";

import { useState } from "react";
import { buildFeed, type FeedItem } from "@/lib/feed";
import { useDashboard } from "@/lib/use-dashboard";
import { FeedDetail } from "../_components/FeedDetail";
import { Body, DemoRate, EmptyState, ErrorBlock, ListCard, NoProgram, Sheet, Skeleton, TopBar } from "../_components/ui";

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
        {selected !== null ? <FeedDetail item={selected} /> : null}
      </Sheet>
    </>
  );
}
