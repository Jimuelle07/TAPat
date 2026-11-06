"use client";

import { useCallback, useEffect, useState } from "react";
import type { Beneficiary, BeneficiaryStatus } from "@tapat/shared";
import { getBeneficiaries } from "@/lib/api";
import { fullName, score } from "@/lib/format";
import { useStream } from "@/lib/sse";
import { errorMessage } from "@/lib/use-dashboard";
import { Body, EmptyState, ErrorBlock, FilterChip, ListCard, Skeleton, TopBar, type ListRow } from "../../_components/ui";
import { STATUS_CHIP } from "./status";

const FILTERS: Array<{ label: string; status?: BeneficiaryStatus; empty?: string }> = [
  { label: "All" },
  { label: "Approved", status: "approved", empty: "No beneficiary is approved and waiting to enroll." },
  { label: "Uncertain", status: "uncertain", empty: "No beneficiary needs review right now." },
  { label: "Evidence", status: "evidence_requested", empty: "No beneficiary is waiting on evidence right now." },
  { label: "Rejected", status: "rejected", empty: "No beneficiary was rejected." },
  { label: "Enrolled", status: "enrolled", empty: "No beneficiary is enrolled yet." },
];

function row(b: Beneficiary): ListRow {
  const chip = STATUS_CHIP[b.status];
  return {
    id: b.id,
    title: fullName(b),
    meta: `${b.plate} · ${b.toda} · ${b.ruleCode ?? score(b.score)}`,
    chip: chip.label,
    tone: chip.tone,
    href: `/intake/beneficiaries/${b.id}`,
  };
}

export default function Beneficiaries() {
  const [filter, setFilter] = useState(FILTERS[0]);
  const [rows, setRows] = useState<Beneficiary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await getBeneficiaries({ ...(filter.status === undefined ? {} : { status: filter.status }), limit: 500 }));
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }, [filter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the list for the chosen filter
    void load();
  }, [load]);

  // A verified OR/CR file over Telegram moves a record while this page is open.
  useStream((event) => {
    if (event.event === "intake" || event.event === "enroll") void load();
  });

  return (
    <>
      <TopBar title="Beneficiaries" back="/intake" />
      <Body>
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
          {FILTERS.map((item) => (
            <FilterChip
              key={item.label}
              selected={item.label === filter.label}
              onClick={() => {
                setRows(null);
                setFilter(item);
              }}
            >
              {item.label}
            </FilterChip>
          ))}
        </div>
        {error !== null ? <ErrorBlock title="Could not load beneficiaries" message={error} onRetry={() => void load()} /> : null}
        {error === null && rows === null ? <Skeleton kinds={["row", "row", "row", "row", "row"]} /> : null}
        {error === null && rows !== null && rows.length === 0 && filter.status === undefined ? (
          <EmptyState icon="upload" title="No beneficiaries yet" body="Upload a masterlist to check every row." action={{ label: "Upload masterlist", href: "/intake" }} />
        ) : null}
        {error === null && rows !== null && rows.length === 0 && filter.status !== undefined ? (
          <EmptyState title="No one here" body={filter.empty ?? ""} />
        ) : null}
        {error === null && rows !== null && rows.length > 0 ? <ListCard key={filter.label} rows={rows.map(row)} /> : null}
      </Body>
    </>
  );
}
