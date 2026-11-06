"use client";

import { useCallback, useEffect, useState } from "react";
import type { IntakeResponse } from "@tapat/shared";
import { ApiClientError, getProgram, uploadIntake } from "@/lib/api";
import { fullName } from "@/lib/format";
import { errorMessage } from "@/lib/use-dashboard";
import { Icon } from "../_components/Icon";
import { Actions, Body, Button, Card, Chip, ErrorBlock, KeyValues, LinkButton, ListCard, ListItem, NoProgram, Notice, SectionTitle, Skeleton, StatCard, StatRow, TopBar } from "../_components/ui";
import { OfficerNotice, useAuth } from "../_components/Auth";

const ERROR_TITLE: Record<string, string> = {
  VALIDATION_ERROR: "Check the file",
  OCR_UNAVAILABLE: "This image cannot be read",
  NOT_FOUND: "No active program",
};

function Results({ response, onBack }: { response: IntakeResponse; onBack: () => void }) {
  const { rows, summary, calibration } = response;
  const rejected = rows.filter((row) => row.status === "rejected");
  const precomputed = rows.some((row) => row.source === "ocr_precomputed");
  return (
    <>
      <header className="flex h-14 items-center gap-1 pr-5 pl-1">
        <button type="button" onClick={onBack} aria-label="Back" className="flex size-11 shrink-0 items-center justify-center">
          <Icon name="back" />
        </button>
        <h1 className="text-h2">Intake results</h1>
      </header>
      <Body>
        <SectionTitle>{summary.total} rows checked</SectionTitle>
        {precomputed ? <Chip>precomputed OCR</Chip> : null}
        {!calibration.feasible ? (
          <Notice title="Calibration is not feasible">The two limits overlap on the grid, so the thresholds were clamped. Review results with care.</Notice>
        ) : null}
        <StatRow>
          <StatCard
            label="Approved"
            value={String(summary.approved)}
            live={{ to: summary.approved, format: (n) => String(Math.round(n)) }}
          />
          <StatCard
            label="Already enrolled"
            value={String(summary.enrolled)}
            live={{ to: summary.enrolled, format: (n) => String(Math.round(n)) }}
          />
        </StatRow>
        <StatRow>
          <StatCard
            label="Rejected"
            value={String(summary.rejected)}
            live={{ to: summary.rejected, format: (n) => String(Math.round(n)) }}
          />
          <StatCard
            label="Uncertain"
            value={String(summary.uncertain)}
            live={{ to: summary.uncertain, format: (n) => String(Math.round(n)) }}
          />
        </StatRow>
        {rejected.length > 0 ? (
          <ListCard
            heading="Rejected"
            rows={rejected.map((row) => ({
              id: row.id,
              title: fullName(row),
              meta: row.decisionReason ?? row.ruleCode ?? "Rejected by the matcher",
              chip: "Rejected",
              href: `/intake/beneficiaries/${row.id}`,
            }))}
          />
        ) : null}
        <Card>
          <h3 className="text-label">Calibration</h3>
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
        </Card>
      </Body>
      <Actions>
        <LinkButton href="/intake/beneficiaries">Review beneficiaries</LinkButton>
      </Actions>
    </>
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
    <>
      <TopBar />
      <Body>
        {loadError !== null ? <ErrorBlock title="Could not load the program" message={loadError} onRetry={load} /> : null}
        {loadError === null && program === "loading" ? <Skeleton kinds={["line", "card", "card", "row"]} /> : null}
        {loadError === null && program === "none" ? <NoProgram icon="upload" body="Create a program before uploading a masterlist." /> : null}
        {loadError === null && program === "ok" ? (
          <>
            <SectionTitle>Upload the masterlist</SectionTitle>
            {error !== null ? (
              <Notice tone="error" title={error.title}>
                {error.body}
              </Notice>
            ) : null}
            {isOfficer ? (
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
                  if (dropped !== undefined) {
                    setFile(dropped);
                    setError(null);
                  }
                }}
                className={`flex cursor-pointer flex-col items-center gap-2 rounded-md border-[1.5px] border-text bg-raised px-4 py-6 text-center focus-within:border-[2.5px] focus-within:border-primary ${
                  dragging || busy ? "pulse" : ""
                }`}
              >
                <Icon name="upload" />
                <span className="text-label">{file?.name ?? "Choose a CSV or a scanned list"}</span>
                <span className="text-caption">CSV up to 1 MB. PNG or JPG up to 5 MB.</span>
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
            ) : loading ? null : (
              <OfficerNotice />
            )}
            <Card>
              <h3 className="text-label">CSV columns, in this order</h3>
              <p className="font-mono text-mono">last_name, first_name, middle_name, suffix, birthdate, plate, toda, barangay</p>
              <p className="text-caption">Birthdate as YYYY-MM-DD. Middle name and suffix may be empty.</p>
            </Card>
            <ListItem row={{ title: "View beneficiaries", href: "/intake/beneficiaries" }} />
          </>
        ) : null}
      </Body>
      {loadError === null && program === "ok" && isOfficer ? (
        <Actions>
          <Button loading={busy} disabled={file === null} onClick={() => void upload()}>
            {busy ? "Checking rows" : "Upload masterlist"}
          </Button>
        </Actions>
      ) : null}
    </>
  );
}
