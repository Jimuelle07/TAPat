"use client";

import { useCallback, useEffect, useState } from "react";
import type { HealthResponse } from "@tapat/shared";
import { getHealth } from "@/lib/api";
import { errorMessage } from "@/lib/use-dashboard";
import { Card, Chip, ErrorBlock, Notice, Skeleton } from "../../(app)/_components/ui";
import { Page } from "../_components/kit";

function Service({ title, value }: { title: string; value: "ok" | "down" }) {
  return (
    <Card>
      <h2 className="text-label">{title}</h2>
      {value === "ok" ? <Chip tone="mint">OK</Chip> : <Chip tone="ink">Down</Chip>}
    </Card>
  );
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
    <Page title="System health">
      {health === null && error === null ? <Skeleton kinds={["row", "row"]} /> : null}
      {error !== null ? (
        <div className="flex max-w-xl flex-col gap-4">
          <ErrorBlock title="Could not check the system" message={error} onRetry={load} />
        </div>
      ) : null}
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
          <div className="grid grid-cols-4 gap-4">
            <Service title="Stellar RPC" value={health.rpc} />
            <Service title="Velo" value={health.velo} />
            <Service title="Telegram" value={health.telegram} />
            <Card>
              <h2 className="text-label">Gas mode</h2>
              <p className="font-mono text-mono">{health.gasMode}</p>
              <p className="text-caption">{health.gasMode === "velo" ? "Fees are sponsored through the Gas Station" : "Submitting directly"}</p>
            </Card>
          </div>
        </>
      ) : null}
    </Page>
  );
}
