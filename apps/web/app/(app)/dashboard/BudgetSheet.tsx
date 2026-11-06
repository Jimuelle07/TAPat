"use client";

import { useState } from "react";
import type { Dashboard } from "@tapat/shared";
import { postBudgetCheckout } from "@/lib/api";
import { php } from "@/lib/format";
import { errorMessage } from "@/lib/use-dashboard";
import { Button, Chip, Field, KeyValues, Notice, Sheet } from "../_components/ui";
import { OfficerNotice, useAuth } from "../_components/Auth";

/** Budget deposit: one Velo checkout paid from the Budget Office wallet, verified on the ledger before any tranche. */
export function BudgetSheet({
  dashboard,
  open,
  onClose,
  onChanged,
}: {
  dashboard: Dashboard;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { budget, phpPerXlm } = dashboard;
  const { isOfficer, loading } = useAuth();
  const [amount, setAmount] = useState("10000");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fund = async () => {
    // The form is officer-only, but a stale render must not reach the checkout POST either.
    if (!isOfficer) return;
    const amountPhp = Number(amount);
    if (!Number.isInteger(amountPhp) || amountPhp <= 0) {
      setError("Enter a whole peso amount above zero.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { checkoutUrl } = await postBudgetCheckout({ amountPhp });
      onChanged();
      window.location.assign(checkoutUrl);
    } catch (cause) {
      setError(errorMessage(cause));
      setBusy(false);
    }
  };

  if (budget.state === "verified") {
    return (
      <Sheet title="Budget" open={open} onClose={onClose}>
        <Chip>Velo verified</Chip>
        <KeyValues
          rows={[
            ["Verified", php(budget.verifiedStroops, phpPerXlm)],
            ["Funded", php(budget.fundedStroops, phpPerXlm)],
            ["Remaining", php(budget.remainingStroops, phpPerXlm)],
            ["Payment intent", budget.paymentIntentId ?? "None"],
          ]}
        />
      </Sheet>
    );
  }
  if (budget.state === "waiting") {
    return (
      <Sheet title="Waiting for Velo" open={open} onClose={onClose}>
        <Notice title="Waiting for Velo…">A tranche can only be funded after the payment is verified on the ledger.</Notice>
        <KeyValues rows={[["Payment intent", budget.paymentIntentId ?? "None"]]} />
        {budget.checkoutUrl !== null ? (
          <a
            href={budget.checkoutUrl}
            className="flex min-h-[54px] w-full items-center justify-center rounded-md bg-primary px-4 text-label text-surface shadow-button hover:bg-pressed"
          >
            Open checkout
          </a>
        ) : null}
      </Sheet>
    );
  }
  return (
    <Sheet title="Fund the budget" open={open} onClose={onClose}>
      {loading ? null : !isOfficer ? (
        <OfficerNotice />
      ) : (
        <>
          {error !== null ? (
            <Notice tone="error" title="Could not open checkout">
              {error}
            </Notice>
          ) : null}
          <Field
            label="Budget amount (PHP)"
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            helper="Paid once through Velo checkout, from the Budget Office wallet."
          />
          <KeyValues rows={[["Display rate", `PHP ${phpPerXlm} per XLM, demo rate`]]} />
          <Button loading={busy} onClick={() => void fund()}>
            {error !== null ? "Try again" : "Fund budget"}
          </Button>
        </>
      )}
    </Sheet>
  );
}
