"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { Beneficiary } from "@tapat/shared";
import { getBeneficiaries, postRequestEvidence } from "@/lib/api";
import { fullName, score } from "@/lib/format";
import { errorMessage } from "@/lib/use-dashboard";
import { Actions, Body, Button, Card, Chip, EmptyState, ErrorBlock, KeyValues, LinkButton, Notice, Sheet, Skeleton, TopBar } from "../../../_components/ui";
import { OfficerNotice, OfficerOnly, useAuth } from "../../../_components/Auth";
import { STATUS_CHIP } from "../status";


export default function BeneficiaryDetail() {
  const { id } = useParams<{ id: string }>();
  const { loading, isOfficer } = useAuth();
  const [person, setPerson] = useState<Beneficiary | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);

  // There is no single-beneficiary endpoint (§5.2 #8), so the page reads the list and picks its row.
  const load = useCallback(async () => {
    try {
      const rows = await getBeneficiaries({ limit: 500 });
      setPerson(rows.find((row) => row.id === id) ?? null);
      setLoadError(null);
    } catch (cause) {
      setLoadError(errorMessage(cause));
    }
  }, [id]);

  useEffect(() => {
    // Beneficiary reads are officer-only: a viewer never reaches GET /api/beneficiaries.
    if (!isOfficer) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load of this record
    void load();
  }, [isOfficer, load]);

  const requestEvidence = async () => {
    // Requesting evidence is officer-only; a stale render must not reach the POST either.
    if (!isOfficer) return;
    setBusy(true);
    setActionError(null);
    try {
      const response = await postRequestEvidence(id);
      setPerson(response.beneficiary);
      // A failed Telegram send is still a 200: the officer shares the link by hand instead.
      if (!response.telegramSent) setDeepLink(response.deepLink ?? response.beneficiary.telegramDeepLink);
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <>
        <TopBar title="Beneficiary" back="/intake/beneficiaries" />
        <Body>
          <Skeleton kinds={["line", "card", "card"]} />
        </Body>
      </>
    );
  }

  if (!isOfficer) {
    return (
      <>
        <TopBar title="Beneficiary" back="/intake/beneficiaries" />
        <Body>
          <OfficerNotice />
        </Body>
      </>
    );
  }

  const chip = person === null || person === undefined ? null : STATUS_CHIP[person.status];
  return (
    <>
      <TopBar title="Beneficiary" back="/intake/beneficiaries" />
      <Body>
        {loadError !== null ? <ErrorBlock title="Could not load this record" message={loadError} onRetry={() => void load()} /> : null}
        {loadError === null && person === undefined ? <Skeleton kinds={["line", "card", "card"]} /> : null}
        {person === null ? <EmptyState title="Record not found" body="This beneficiary is not in the current masterlist." action={{ label: "View beneficiaries", href: "/intake/beneficiaries" }} /> : null}
        {person !== null && person !== undefined && chip !== null ? (
          <>
            {actionError !== null ? (
              <Notice tone="error" title="Could not send the request">
                {actionError}
              </Notice>
            ) : null}
            {person.status === "evidence_requested" ? (
              <Notice title="Waiting on the driver">
                {person.telegramLinked
                  ? "The OR/CR request went out on Telegram. A verified file moves this record to approved."
                  : "This driver has not linked Telegram, so the request has not reached them. Share the link below."}
              </Notice>
            ) : null}
            <div className="flex items-start justify-between gap-2">
              <h2 className="min-w-0 flex-1 text-h2">{fullName(person)}</h2>
              <span key={chip.label} className="stamp">
                <Chip tone={chip.tone}>{chip.label}</Chip>
              </span>
            </div>
            <Card>
              <KeyValues
                rows={[
                  ["Birthdate", person.birthdate],
                  ["Plate", person.plate],
                  ["TODA", person.toda],
                  ["Barangay", person.barangay],
                  ["Source", person.source === "ocr_precomputed" ? "precomputed OCR" : "CSV"],
                ]}
              />
            </Card>
            <Card>
              <h3 className="text-label">Decision</h3>
              <KeyValues
                rows={[
                  ["Score", score(person.score)],
                  ...(person.ruleCode !== null ? ([["Rule", person.ruleCode]] as Array<[string, string]>) : []),
                  ["Reason", person.decisionReason ?? "None recorded"],
                  ["Telegram", person.telegramLinked ? "Linked" : "Not linked"],
                ]}
              />
            </Card>
          </>
        ) : null}
      </Body>
      {person?.status === "uncertain" ? (
        <Actions>
          <OfficerOnly>
            <Button loading={busy} onClick={() => void requestEvidence()}>
              Request evidence
            </Button>
          </OfficerOnly>
        </Actions>
      ) : null}
      {person?.status === "rejected" ? (
        <Actions>
          <OfficerOnly>
            <Button loading={busy} onClick={() => void requestEvidence()}>
              Appeal with evidence
            </Button>
          </OfficerOnly>
        </Actions>
      ) : null}
      {person?.status === "evidence_requested" && !person.telegramLinked ? (
        <Actions>
          <Button look="secondary" onClick={() => setDeepLink(person.telegramDeepLink)}>
            Share Telegram link
          </Button>
        </Actions>
      ) : null}
      {person?.status === "approved" ? (
        <Actions>
          <OfficerOnly>
            <LinkButton href={`/enroll?beneficiary=${encodeURIComponent(person.id)}`}>Enroll this driver</LinkButton>
          </OfficerOnly>
        </Actions>
      ) : null}
      <Sheet title="Send the link by hand" open={deepLink !== null} onClose={() => setDeepLink(null)}>
        <Notice title="Telegram is not linked">The evidence request could not be delivered. Hand the phone over, or share this link with the driver.</Notice>
        <p className="font-mono text-mono break-all">{deepLink}</p>
        {deepLink !== null ? (
          <LinkButton external href={deepLink}>
            Open in Telegram
          </LinkButton>
        ) : null}
      </Sheet>
    </>
  );
}
