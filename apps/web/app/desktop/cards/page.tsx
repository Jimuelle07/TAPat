"use client";

import type { CardSummary } from "@tapat/shared";
import { cardLabel } from "@/lib/feed";
import { dateTime, php } from "@/lib/format";
import { useDashboard } from "@/lib/use-dashboard";
import { Chip, DemoRate, EmptyState, type ChipTone } from "../../(app)/_components/ui";
import { DataTable, Gate, Page } from "../_components/kit";

function status(card: CardSummary): { chip: string; tone?: ChipTone; note?: string } {
  switch (card.status) {
    case "swept":
      return { chip: "Swept" };
    case "pending":
      return { chip: "Pending", note: "Waiting for the chain" };
    case "failed":
      return { chip: "Failed", tone: "danger", note: "Enrollment failed on-chain. Retrying the same card resumes it." };
    case "revoked":
      return { chip: "Revoked", note: "Policy revoked" };
    case "active":
      return card.expired ? { chip: "Expired" } : { chip: "Active", tone: "mint" };
  }
}

export default function Cards() {
  const state = useDashboard();
  return (
    <Page title="Cards">
      <Gate state={state} what="cards" empty="Cards appear once a program is running." icon="idcard">
        {(dashboard) =>
          dashboard.cards.length === 0 ? (
            <div className="mx-auto w-full max-w-md">
              <EmptyState icon="idcard" title="No cards yet" body="Enrolled cards appear here, in enrollment order." action={{ label: "Enroll a driver", href: "/desktop/enroll" }} />
            </div>
          ) : (
            <>
              <DataTable
                label="Enrolled cards, in enrollment order"
                rows={dashboard.cards}
                rowKey={(card) => card.id}
                columns={[
                  {
                    header: "Driver",
                    cell: (card) => (
                      <span className="flex flex-col gap-1">
                        <span className="text-label">{cardLabel(card)}</span>
                        {status(card).note !== undefined ? <span className="text-caption">{status(card).note}</span> : null}
                      </span>
                    ),
                  },
                  { header: "Device hash", mono: true, cell: (card) => `${card.deviceHashPrefix}${card.virtual ? " · virtual" : ""}` },
                  { header: "Policy expires", mono: true, cell: (card) => dateTime(card.expiresAtS * 1000) },
                  { header: "Escrow", mono: true, right: true, cell: (card) => (card.status === "active" ? php(card.escrowStroops, dashboard.phpPerXlm) : "") },
                  { header: "Returned", mono: true, right: true, cell: (card) => (card.status === "swept" ? php(card.returnedStroops, dashboard.phpPerXlm) : "") },
                  { header: "Status", cell: (card) => <Chip tone={status(card).tone}>{status(card).chip}</Chip> },
                ]}
              />
              <DemoRate />
            </>
          )
        }
      </Gate>
    </Page>
  );
}
