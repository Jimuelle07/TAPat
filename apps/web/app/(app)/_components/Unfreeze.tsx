"use client";

import { useState } from "react";
import type { Station } from "@tapat/shared";
import { postUnfreeze } from "@/lib/api";
import { php } from "@/lib/format";
import { errorMessage } from "@/lib/use-dashboard";
import { useAuth } from "./Auth";
import { ConfirmSheet } from "./ui";

/** The manual release (§5.2 #15). Held money stays in escrow until the next settlement run, so the sheet says so. */
export function UnfreezeSheet({
  station,
  phpPerXlm,
  open,
  onClose,
  onDone,
}: {
  station: Station;
  phpPerXlm: number;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { isOfficer } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirm = async () => {
    if (!isOfficer) return;
    setBusy(true);
    setError(null);
    try {
      await postUnfreeze(station.id);
      onDone();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <ConfirmSheet
      open={open && isOfficer}
      title="Unfreeze station?"
      body={`New taps are accepted again. The ${php(station.pendingStroops, phpPerXlm)} held stays in escrow until the next settlement run.`}
      confirm={`Unfreeze ${station.name}`}
      cancel="Keep frozen"
      busy={busy}
      error={error}
      onConfirm={() => void confirm()}
      onCancel={onClose}
    />
  );
}
