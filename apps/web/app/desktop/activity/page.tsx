"use client";

import { buildFeed } from "@/lib/feed";
import { useDashboard } from "@/lib/use-dashboard";
import { DemoRate, EmptyState } from "../../(app)/_components/ui";
import { FeedTable, Gate, Page } from "../_components/kit";

export default function Activity() {
  const state = useDashboard();
  return (
    <Page title="Activity">
      <Gate state={state} what="activity" empty="Activity appears once a program is running." icon="pulse">
        {(dashboard) => {
          const feed = buildFeed(dashboard);
          return feed.length === 0 ? (
            <EmptyState icon="pulse" title="No activity yet" body="Taps and agent decisions appear here as they happen, newest first." />
          ) : (
            <>
              <FeedTable items={feed} />
              <DemoRate />
            </>
          );
        }}
      </Gate>
    </Page>
  );
}
