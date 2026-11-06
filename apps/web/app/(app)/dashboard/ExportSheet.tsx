"use client";

import { useState } from "react";
import { getCoaCsv } from "@/lib/api";
import { errorMessage } from "@/lib/use-dashboard";
import { Button, KeyValues, Notice, Sheet } from "../_components/ui";

export function ExportSheet({ programId, open, onClose }: { programId: string; open: boolean; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileName = `tapat-coa-${programId}.csv`;

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      const url = URL.createObjectURL(new Blob([await getCoaCsv()], { type: "text/csv" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Export for COA" open={open} onClose={onClose}>
      {error !== null ? (
        <Notice tone="error" title="Could not prepare the file">
          {error}
        </Notice>
      ) : null}
      <KeyValues rows={[["File", fileName]]} />
      <p className="font-mono text-mono">timestamp, event, card_hash_prefix, station, amount_php, amount_xlm, tx_hash, agent_decision_id</p>
      <Button loading={busy} onClick={() => void download()}>
        {busy ? "Preparing file" : "Download CSV"}
      </Button>
    </Sheet>
  );
}
