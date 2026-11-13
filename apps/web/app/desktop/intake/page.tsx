"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { IntakeResponse } from "@tapat/shared";
import { ApiClientError, getProgram, uploadIntake } from "@/lib/api";
import { fullName } from "@/lib/format";
import { errorMessage, useDashboard } from "@/lib/use-dashboard";
import { OfficerNotice, useAuth } from "@/app/(app)/_components/Auth";
import { Icon } from "@/app/(app)/_components/Icon";
import { Button, Chip, ErrorBlock, KeyValues, LinkButton, NoProgram, Notice, Skeleton } from "@/app/(app)/_components/ui";
import { LedgerCard, Page, SectionTitle } from "../_components/kit";

const ERROR_TITLE: Record<string, string> = {
  VALIDATION_ERROR: "Check the file",
  OCR_UNAVAILABLE: "This image cannot be read",
  NOT_FOUND: "No active program",
};

function Results({ response, onBack }: { response: IntakeResponse; onBack: () => void }) {
  const { rows, summary, calibration } = response;
  const rejected = rows.filter((row) => row.status === "rejected");
  const tally = [
    { key: "approved", label: "Approved", value: summary.approved },
    { key: "enrolled", label: "Already enrolled", value: summary.enrolled },
    { key: "uncertain", label: "Uncertain", value: summary.uncertain },
    { key: "rejected", label: "Rejected", value: summary.rejected },
  ];
  return (
    <Page title="Intake results">
      <div className="grid grid-cols-12 items-start gap-x-6 gap-y-[18px]">
        <header className="col-span-12 flex flex-col gap-2.5">
          <h2 className="ql-display">{summary.total} rows checked</h2>
          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-small text-[#3d4f48]">
            {rows.some((row) => row.source === "ocr_precomputed") ? <Chip>precomputed OCR</Chip> : null}
            The matcher scored each row against the calibration limits.
          </p>
        </header>
        {!calibration.feasible ? (
          <div className="col-span-12">
            <Notice title="Calibration is not feasible">The two limits overlap on the grid, so the thresholds were clamped. Review results with care.</Notice>
          </div>
        ) : null}
        <div className="col-span-12 flex min-w-0 flex-col gap-3.5 xl:col-span-8">
          <LedgerCard>
            <section aria-label="Results" className="flex flex-col gap-4 py-0.5">
              <div aria-hidden="true" className="ql-tally-bar">
                {tally.map((item) => (item.value > 0 ? <span key={item.key} className={`ql-tb-${item.key}`} style={{ flexGrow: item.value }} /> : null))}
              </div>
              <dl className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
                {tally.map((item) => (
                  <div key={item.key}>
                    <dt className="flex items-center gap-2 text-[13.5px] text-[#3d4f48]">
                      <span aria-hidden="true" className={`ql-sw ql-tb-${item.key}`} />
                      {item.label}
                    </dt>
                    <dd className="ql-tally-v">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </LedgerCard>
          <SectionTitle>Rejected</SectionTitle>
          <LedgerCard flush>
            {rejected.length === 0 ? (
              <p className="px-[18px] py-4 text-small">No row was rejected.</p>
            ) : (
              <ul aria-label="Rejected rows" className="px-[18px]">
                {rejected.map((row, index) => (
                  <li key={row.id}>
                    <Link href={`/desktop/intake/beneficiaries/${row.id}`} className={`ql-list-row ${index === 0 ? "" : "border-t"}`}>
                      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                        <span className="ql-list-title">{fullName(row)}</span>
                        <span className="text-[13px] break-words text-muted">{row.decisionReason ?? row.ruleCode ?? "Rejected by the matcher"}</span>
                      </span>
                      <Chip tone="danger">Rejected</Chip>
                      <Icon name="chevron" size={20} className="ql-nudge text-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </LedgerCard>
        </div>
        <div className="col-span-12 flex min-w-0 flex-col gap-3.5 xl:col-span-4">
          <LedgerCard title="Calibration">
            <KeyValues
              rows={[
                ["Approve at or above λ", calibration.lambdaHi.toFixed(2)],
                ["Reject below λ", calibration.lambdaLo.toFixed(2)],
                ["Max wrongful denial α", String(calibration.alpha)],
                ["Max ghost admission β", String(calibration.beta)],
                ["Measured wrongful denial", calibration.wrongfulDenialRate.toFixed(3)],
                ["Measured ghost admission", calibration.ghostAdmissionRate.toFixed(3)],
                ["Calibration set", String(calibration.n)],
              ]}
            />
          </LedgerCard>
          <LinkButton href="/desktop/intake/beneficiaries">Review beneficiaries</LinkButton>
          <Button look="secondary" onClick={onBack}>
            Upload another
          </Button>
        </div>
      </div>
    </Page>
  );
}

export default function Intake() {
  const { isOfficer, loading } = useAuth();
  const [program, setProgram] = useState<"loading" | "none" | "ok">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ title: string; body: string } | null>(null);
  const [response, setResponse] = useState<IntakeResponse | null>(null);
  const dashboard = useDashboard();
  const beneficiaries = dashboard.status === "ready" ? dashboard.dashboard.counts.beneficiaries : null;

  const load = useCallback(() => {
    getProgram()
      .then((result) => {
        setProgram(result.program === null ? "none" : "ok");
        setLoadError(null);
      })
      .catch((cause: unknown) => setLoadError(errorMessage(cause)));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  if (response !== null) return <Results response={response} onBack={() => setResponse(null)} />;

  const upload = async () => {
    // Uploading a masterlist is officer-only; a stale render must not reach the POST either.
    if (!isOfficer || file === null) return;
    setBusy(true);
    setError(null);
    try {
      setResponse(await uploadIntake(file));
    } catch (cause) {
      const code = cause instanceof ApiClientError ? cause.code : "";
      setError({
        title: ERROR_TITLE[code] ?? "Could not check this list",
        // OCR_UNAVAILABLE already reads as a full sentence the server wrote for this screen.
        body: code === "OCR_UNAVAILABLE" ? errorMessage(cause) : `${code === "" ? "" : `${code}: `}${errorMessage(cause)}`,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title="Masterlist">
      {loadError !== null ? (
        <div className="flex max-w-xl flex-col gap-4">
          <ErrorBlock title="Could not load the program" message={loadError} onRetry={load} />
        </div>
      ) : null}
      {loadError === null && program === "loading" ? <Skeleton kinds={["line", "card", "card", "row"]} /> : null}
      {loadError === null && program === "none" ? (
        <div className="mx-auto w-full max-w-md">
          <NoProgram icon="upload" body="Create a program before uploading a masterlist." />
        </div>
      ) : null}
      {loadError === null && program === "ok" ? (
        <>
          <div className="grid grid-cols-12 items-start gap-x-6 gap-y-[18px]">
            <header className="col-span-12 flex flex-col gap-2.5">
              <h2 className="ql-display">Upload the masterlist</h2>
              <p className="text-small text-[#3d4f48]">Every row is checked for duplicates and ghosts before anyone can enroll.</p>
            </header>
            {error !== null ? (
              <div className="col-span-12">
                <Notice tone="error" title={error.title}>
                  {error.body}
                </Notice>
              </div>
            ) : null}
            {isOfficer ? (
              <div className="ql-upload col-span-12 flex flex-col gap-3.5 lg:col-span-7">
                <label
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
                  }}
                  onDragEnd={() => setDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    const dropped = event.dataTransfer.files[0];
                    if (dropped === undefined) return;
                    // Dropping bypasses the picker's accept filter, so hold the same set of types here.
                    if (!/\.(csv|png|jpe?g)$/i.test(dropped.name) && !/^(text\/csv|image\/(png|jpeg))$/.test(dropped.type)) {
                      setError({ title: "Check the file", body: "Use a CSV, PNG or JPG." });
                      return;
                    }
                    setFile(dropped);
                    setError(null);
                  }}
                  data-active={dragging || busy || undefined}
                  className={`ql-drop ${dragging || busy ? "pulse" : ""}`}
                >
                  <span aria-hidden="true" className="ql-drop-ic">
                    <Icon name="upload" size={26} />
                  </span>
                  {file !== null ? <span className="ql-drop-file">{file.name}</span> : <span className="ql-drop-t">Drop a CSV or a scanned list here</span>}
                  <span className="text-[13px] text-muted">CSV up to 1 MB. PNG or JPG up to 5 MB.</span>
                  <span className="ql-drop-pick">{file !== null ? "Choose another file" : "or choose a file"}</span>
                  <input
                    type="file"
                    accept=".csv,text/csv,image/png,image/jpeg"
                    className="sr-only"
                    onChange={(event) => {
                      setFile(event.target.files?.[0] ?? null);
                      setError(null);
                    }}
                  />
                </label>
                <Button loading={busy} disabled={file === null} onClick={() => void upload()}>
                  {busy ? "Checking rows" : "Upload masterlist"}
                </Button>
              </div>
            ) : loading ? null : (
              <div className="col-span-12 lg:col-span-7">
                <OfficerNotice />
              </div>
            )}
            <div className="col-span-12 flex flex-col gap-3.5 lg:col-span-5">
              <LedgerCard title="CSV columns, in this order">
                <p className="ql-code">last_name, first_name, middle_name, suffix, birthdate, plate, toda, barangay</p>
                <p className="text-[13px] text-muted">Birthdate as YYYY-MM-DD. Middle name and suffix may be empty.</p>
              </LedgerCard>
              <LedgerCard flush>
                <div className="px-[18px]">
                  <Link href="/desktop/intake/beneficiaries" className="ql-list-row">
                    <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                      <span className="ql-list-title">View beneficiaries</span>
                      <span className="text-[13px] text-muted">{beneficiaries === null ? "Everyone on the current masterlist" : `${beneficiaries} on the current masterlist`}</span>
                    </span>
                    <Icon name="chevron" size={20} className="ql-nudge text-muted" />
                  </Link>
                </div>
              </LedgerCard>
            </div>
          </div>
        </>
      ) : null}
    </Page>
  );
}
