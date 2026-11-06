"use client";

import { useCallback, useEffect, useState } from "react";
import type { Beneficiary, BeneficiaryStatus } from "@tapat/shared";
import { getBeneficiaries } from "@/lib/api";
import { fullName, score } from "@/lib/format";
import { useStream } from "@/lib/sse";
import { errorMessage } from "@/lib/use-dashboard";
import { STATUS_CHIP } from "@/app/(app)/intake/beneficiaries/status";
import { OfficerNotice, useAuth } from "@/app/(app)/_components/Auth";
import { Chip, EmptyState, ErrorBlock, FilterChip, Skeleton } from "@/app/(app)/_components/ui";
import { DataTable, Page } from "../../_components/kit";

const FILTERS: Array<{ label: string; status?: BeneficiaryStatus; empty?: string }> = [
  { label: "All" },
  { label: "Approved", status: "approved", empty: "No beneficiary is approved and waiting to enroll." },
  { label: "Uncertain", status: "uncertain", empty: "No beneficiary needs review right now." },
  { label: "Evidence", status: "evidence_requested", empty: "No beneficiary is waiting on evidence right now." },
  { label: "Rejected", status: "rejected", empty: "No beneficiary was rejected." },
  { label: "Enrolled", status: "enrolled", empty: "No beneficiary is enrolled yet." },
];

export default function Beneficiaries() {
  const { loading, isOfficer } = useAuth();
  const [filter, setFilter] = useState(FILTERS[0]);
  const [rows, setRows] = useState<Beneficiary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await getBeneficiaries({ ...(filter.status === undefined ? {} : { status: filter.status }), limit: 500 });
      setRows(next);
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }, [filter]);

  useEffect(() => {
    // Beneficiary reads are officer-only: a viewer never reaches GET /api/beneficiaries.
    if (!isOfficer) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the list for the chosen filter
    void load();
  }, [isOfficer, load]);

  // A verified OR/CR file over Telegram moves a record while this page is open.
  useStream((event) => {
    if (!isOfficer) return;
    if (event.event === "intake" || event.event === "enroll") void load();
  });

  if (loading || !isOfficer) {
    return (
      <Page title="Beneficiaries" back="/desktop/intake">
        {loading ? <Skeleton kinds={["row", "row", "row", "row", "row"]} /> : <OfficerNotice />}
      </Page>
    );
  }

  return (
    <Page title="Beneficiaries" back="/desktop/intake">
      <div className="flex gap-2">
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
      {error !== null ? (
        <div className="flex max-w-xl flex-col gap-4">
          <ErrorBlock title="Could not load beneficiaries" message={error} onRetry={() => void load()} />
        </div>
      ) : null}
      {error === null && rows === null ? <Skeleton kinds={["row", "row", "row", "row", "row"]} /> : null}
      {error === null && rows !== null && rows.length === 0 ? (
        <div className="mx-auto w-full max-w-md">
          {filter.status === undefined ? (
            <EmptyState icon="upload" title="No beneficiaries yet" body="Upload a masterlist to check every row." action={{ label: "Upload masterlist", href: "/desktop/intake" }} />
          ) : (
            <EmptyState title="No one here" body={filter.empty ?? ""} />
          )}
        </div>
      ) : null}
      {error === null && rows !== null && rows.length > 0 ? (
        <DataTable
          key={filter.label}
          label={`Beneficiaries, ${filter.label}`}
          rows={rows}
          rowKey={(row) => row.id}
          href={(row) => `/desktop/intake/beneficiaries/${row.id}`}
          columns={[
            { header: "Name", cell: (row) => <span className="text-label">{fullName(row)}</span> },
            { header: "Plate", mono: true, cell: (row) => row.plate },
            { header: "TODA", cell: (row) => row.toda },
            { header: "Barangay", cell: (row) => row.barangay },
            { header: "Score or rule", mono: true, cell: (row) => row.ruleCode ?? score(row.score) },
            { header: "Status", cell: (row) => <Chip tone={STATUS_CHIP[row.status].tone}>{STATUS_CHIP[row.status].label}</Chip> },
          ]}
        />
      ) : null}
    </Page>
  );
}
