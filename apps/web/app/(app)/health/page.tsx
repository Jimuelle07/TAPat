"use client";

import { useCallback, useEffect, useState } from "react";
import type { HealthResponse } from "@tapat/shared";
import { getHealth } from "@/lib/api";
import { errorMessage } from "@/lib/use-dashboard";
import { Body, ErrorBlock, ListCard, Notice, Skeleton, TopBar, type ListRow } from "../_components/ui";

function status(title: string, value: "ok" | "down"): ListRow {
  return value === "ok" ? { title, chip: "OK", tone: "mint" } : { title, chip: "Down", tone: "ink" };
}

export default function Health() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getHealth()
      .then((next) => {
        setHealth(next);
        setError(null);
      })
      .catch((cause: unknown) => setError(errorMessage(cause)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <TopBar title="System health" back="/dashboard" />
      <Body>
        {health === null && error === null ? <Skeleton kinds={["row", "row", "row", "row"]} /> : null}
        {error !== null ? <ErrorBlock title="Could not check the system" message={error} onRetry={load} /> : null}
        {health !== null && error === null ? (
          <>
            {health.rpc === "down" ? (
              <Notice tone="error" title="Stellar RPC is down">
                Payments cannot be authorized until the RPC is back.
              </Notice>
            ) : health.velo === "down" || health.telegram === "down" ? (
              <Notice title="Running in degraded mode">
                {health.velo === "down" ? "Velo is down. Taps still reach the chain if gas fallback is on." : "Telegram is down. Receipts and evidence requests will not be delivered."}
              </Notice>
            ) : null}
            <ListCard
              rows={[
                status("Stellar RPC", health.rpc),
                status("Velo", health.velo),
                status("Telegram", health.telegram),
                {
                  title: "Gas mode",
                  meta: health.gasMode === "velo" ? "Fees are sponsored through the Gas Station" : "Submitting directly",
                  value: health.gasMode,
                },
              ]}
            />
          </>
        ) : null}
      </Body>
    </>
  );
}
