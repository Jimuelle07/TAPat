"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { VIRTUAL_UID_PREFIX, type Beneficiary, type Dashboard, type EnrollResponse } from "@tapat/shared";
import { ApiClientError, getBeneficiaries, getDashboard, getProgram, postEnroll } from "@/lib/api";
import { dateTime, fullName, php, shortHash, shortName } from "@/lib/format";
import { txLookup } from "@/lib/feed";
import { NfcReadError, readUid, type NfcErrorCode } from "@/lib/nfc";
import { errorMessage } from "@/lib/use-dashboard";
import { useStagedLabel, withMinDuration } from "@/lib/staged";
import { Icon } from "../_components/Icon";
import { Actions, Body, Button, Card, Chip, DemoRate, EmptyState, ErrorBlock, KeyValues, ListCard, NoProgram, Notice, SectionTitle, Skeleton, Stepper, TopBar } from "../_components/ui";
import { OfficerNotice, useAuth } from "../_components/Auth";
import { Confetti } from "../_components/motion";
import { TapScene, type TapPhase } from "../_components/TapScene";

const ENROLL_STEPS = ["Checking the photo", "Registering the card on-chain", "Setting the spending policy", "Almost done"] as const;
const UID_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const subscribeNever = () => () => {};

/** `length` characters from [0-9A-Z], drawn with crypto.getRandomValues (modulo bias is irrelevant for a demo UID). */
function randomSuffix(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => UID_CHARS[byte % UID_CHARS.length]).join("");
}

const SAMPLE_PHOTO = "d4-photo.jpg";

const NFC_HELP: Record<NfcErrorCode, { title: string; hint: string }> = {
  NFC_UNSUPPORTED: { title: "This browser cannot read cards", hint: "Card reading needs Chrome on an Android phone." },
  NFC_PERMISSION: { title: "NFC permission is off", hint: "Turn on NFC, then allow it for this site." },
  NFC_TIMEOUT: { title: "No card found", hint: "Hold the card flat against the back of the phone." },
  NFC_READ_ERROR: { title: "Could not read this card", hint: "Lift the card and try once more." },
};

function DriverCard({ driver }: { driver: Beneficiary }) {
  return (
    <Card>
      <KeyValues
        rows={[
          ["Driver", shortName(driver)],
          ["Plate", driver.plate],
          ["TODA", driver.toda],
        ]}
      />
    </Card>
  );
}

function Pick({ onPick }: { onPick: (driver: Beneficiary) => void }) {
  const [state, setState] = useState<{ status: "loading" } | { status: "no-program" } | { status: "error"; message: string } | { status: "ready"; drivers: Beneficiary[] }>({ status: "loading" });
  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const { program } = await getProgram();
      if (program === null) {
        setState({ status: "no-program" });
        return;
      }
      setState({ status: "ready", drivers: await getBeneficiaries({ status: "approved", limit: 500 }) });
    } catch (cause) {
      setState({ status: "error", message: errorMessage(cause) });
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load of the approved drivers
    void load();
  }, [load]);

  return (
    <>
      <TopBar />
      <Body>
        {state.status === "loading" ? <Skeleton kinds={["line", "line", "row", "row", "row"]} /> : null}
        {state.status === "no-program" ? <NoProgram icon="idcard" body="Create a program before enrolling drivers." /> : null}
        {state.status === "error" ? <ErrorBlock title="Could not load approved drivers" message={state.message} onRetry={() => void load()} /> : null}
        {state.status === "ready" && state.drivers.length === 0 ? (
          <EmptyState icon="idcard" title="No approved drivers" body="A driver can enroll once the masterlist check approves them." action={{ label: "Open masterlist", href: "/intake" }} />
        ) : null}
        {state.status === "ready" && state.drivers.length > 0 ? (
          <>
            <Stepper step={1} />
            <SectionTitle>Who are you enrolling?</SectionTitle>
            <ListCard rows={state.drivers.map((driver) => ({ id: driver.id, title: fullName(driver), meta: `${driver.plate} · ${driver.toda}`, onClick: () => onPick(driver) }))} />
          </>
        ) : null}
      </Body>
    </>
  );
}

function ReadCard({ driver, onBack, onRead }: { driver: Beneficiary; onBack: () => void; onRead: (uid: string) => void }) {
  const [reading, setReading] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [simReading, setSimReading] = useState(false);
  const [error, setError] = useState<NfcReadError | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const read = async () => {
    const controller = new AbortController();
    abort.current = controller;
    setReading(true);
    setUid(null);
    setError(null);
    try {
      setUid(await readUid({ signal: controller.signal }));
    } catch (cause) {
      if (cause instanceof NfcReadError) setError(cause);
    } finally {
      setReading(false);
    }
  };

  // Decided after mount so the server render and the first client render agree.
  const noNdef = useSyncExternalStore(subscribeNever, () => !("NDEFReader" in window), () => false);
  // No NFC hardware: the card read is simulated; enrollment itself still calls the real API.
  const simulate = async () => {
    setReading(true);
    setSimReading(true);
    setUid(null);
    setError(null);
    await withMinDuration(Promise.resolve(), 1200);
    setUid(VIRTUAL_UID_PREFIX + randomSuffix(6));
    setSimReading(false);
    setReading(false);
  };
  const isSim = uid?.startsWith(VIRTUAL_UID_PREFIX) === true;
  const nfcMissing = error?.code === "NFC_UNSUPPORTED" || noNdef;
  const help = error === null ? null : NFC_HELP[error.code];
  const panelTitle = reading ? "Hold the card still" : uid !== null ? `Card …${uid.slice(-4)}` : "Read the blank card";
  const panelBody = reading
    ? simReading
      ? "Simulating a card tap — no NFC hardware."
      : "Listening for up to 15 seconds."
    : uid !== null
      ? "Only the last four characters are ever shown."
      : (help?.hint ?? "Press Read card, then hold the card to the back of the phone.");
  const scenePhase: TapPhase = reading ? "reading" : uid !== null ? "done" : error !== null ? "error" : "idle";

  return (
    <>
      <EnrollTop onBack={onBack} />
      <Body>
        <Stepper step={2} />
        <DriverCard driver={driver} />
        {error !== null && help !== null ? (
          <Notice tone="error" title={help.title}>
            {error.code}: {error.message}
          </Notice>
        ) : null}
        <Card className={`relative items-center gap-3 py-6 text-center ${uid !== null ? "pop-in" : ""}`}>
          <TapScene phase={scenePhase} simulated={isSim} last4={uid?.slice(-4)} />
          <h2 className="text-h2">{panelTitle}</h2>
          {uid?.startsWith(VIRTUAL_UID_PREFIX) ? <Chip>simulated</Chip> : null}
          <p className="text-small">{panelBody}</p>
        </Card>
      </Body>
      <Actions>
        {uid !== null ? (
          <>
            <Button onClick={() => onRead(uid)}>Continue</Button>
            {nfcMissing ? null : (
              <Button look="secondary" onClick={() => void read()}>
                Read again
              </Button>
            )}
            <Button look="secondary" onClick={() => void simulate()}>
              {nfcMissing ? "Simulate again" : "Simulate card"}
            </Button>
          </>
        ) : (
          <>
            {!nfcMissing ? (
              <Button loading={reading} disabled={simReading} onClick={() => void read()}>
                {reading && !simReading ? "Reading" : "Read card"}
              </Button>
            ) : null}
            <Button look={nfcMissing ? "primary" : "secondary"} disabled={reading} loading={simReading} onClick={() => void simulate()}>
              {simReading ? "Reading" : "Simulate card"}
            </Button>
          </>
        )}
      </Actions>
    </>
  );
}

function EnrollTop({ onBack, title = "Enroll driver", chip }: { onBack: () => void; title?: string; chip?: string }) {
  return (
    <header className="flex h-14 items-center justify-between gap-1 pr-5 pl-1">
      <button type="button" onClick={onBack} aria-label="Back" className="flex size-11 shrink-0 items-center justify-center">
        <Icon name="back" />
      </button>
      <h1 className="min-w-0 flex-1 truncate text-h2">{title}</h1>
      {chip !== undefined ? (
        <span className="stamp">
          <Chip tone="mint">{chip}</Chip>
        </span>
      ) : null}
    </header>
  );
}

function Photo({
  driver,
  uid,
  onBack,
  onDone,
  onAlreadyEnrolled,
}: {
  driver: Beneficiary;
  uid: string;
  onBack: () => void;
  onDone: (response: EnrollResponse) => void;
  onAlreadyEnrolled: () => void;
}) {
  const [useUpload, setUseUpload] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ title: string; body: string } | null>(null);
  const [mismatch, setMismatch] = useState(false);
  const [chainFailed, setChainFailed] = useState(false);
  const { isOfficer } = useAuth();
  const stagedLabel = useStagedLabel(busy, ENROLL_STEPS, 2500);

  const enroll = async () => {
    // Enrolling is officer-only; a stale render must not reach the POST either.
    if (!isOfficer) return;
    setBusy(true);
    setError(null);
    try {
      const response = await withMinDuration(
        postEnroll(
          useUpload && file !== null
            ? { beneficiaryId: driver.id, uid, photo: file, officerConfirmed: confirmed }
            : { beneficiaryId: driver.id, uid, samplePhoto: SAMPLE_PHOTO },
        ),
        1500,
      );
      onDone(response);
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.code === "CARD_ALREADY_ENROLLED") {
        onAlreadyEnrolled();
      } else if (cause instanceof ApiClientError && cause.code === "PHOTO_MISMATCH") {
        setMismatch(true);
        setError({ title: "Photo does not match", body: `PHOTO_MISMATCH: ${cause.message}` });
      } else if (cause instanceof ApiClientError && cause.code === "PHOTO_CONFIRMATION_REQUIRED") {
        setError({ title: "Confirm the photo first", body: `PHOTO_CONFIRMATION_REQUIRED: ${cause.message}` });
      } else if (cause instanceof ApiClientError && cause.code === "CHAIN_ERROR") {
        setChainFailed(true);
        setError({ title: "Enrollment did not finish", body: `CHAIN_ERROR: ${cause.message}. Retrying with the same card resumes where it stopped.` });
      } else {
        setError({ title: "Could not enroll this driver", body: errorMessage(cause) });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <EnrollTop onBack={onBack} />
      <Body>
        <Stepper step={3} />
        {error !== null ? (
          <Notice tone="error" title={error.title}>
            {error.body}
          </Notice>
        ) : null}
        {useUpload ? (
          <>
            <label className="flex h-37 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-[1.5px] border-text bg-sunken focus-within:border-[2.5px] focus-within:border-primary">
              <Icon name="camera" />
              <span className="font-mono text-mono">{file?.name ?? "Photo from camera"}</span>
              <input
                type="file"
                accept="image/jpeg,image/png"
                capture="environment"
                className="sr-only"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setMismatch(false);
                }}
              />
            </label>
            <Card className="!flex-row items-center gap-3">
              <input
                id="officer-confirmed"
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                className="size-11 shrink-0 accent-primary"
              />
              <label htmlFor="officer-confirmed" className="text-small">
                I checked that the plate and TODA on this photo match the record.
              </label>
            </Card>
          </>
        ) : (
          <>
            <div className="flex h-37 flex-col items-center justify-center gap-2 rounded-md border-[1.5px] border-text bg-sunken">
              <Icon name="camera" />
              <span className="font-mono text-mono">{SAMPLE_PHOTO}</span>
            </div>
            <Chip>precomputed vision</Chip>
            <Card>
              {/* The precomputed plate and TODA only come back after POST /api/enroll, so this is what it will be checked against. */}
              <KeyValues
                rows={[
                  ["Plate on record", driver.plate],
                  ["TODA on record", driver.toda],
                  ["Card", `…${uid.slice(-4)}`],
                ]}
              />
            </Card>
          </>
        )}
      </Body>
      <Actions>
        <Button loading={busy} disabled={mismatch || (useUpload && file === null)} onClick={() => void enroll()}>
          {busy ? stagedLabel : chainFailed ? "Retry enrollment" : "Enroll"}
        </Button>
        {!useUpload ? (
          <Button
            look="tertiary"
            disabled={busy}
            onClick={() => {
              setUseUpload(true);
              setError(null);
              setMismatch(false);
            }}
          >
            Upload a photo instead
          </Button>
        ) : null}
      </Actions>
    </>
  );
}

function Result({ response, onNext }: { response: EnrollResponse; onNext: () => void }) {
  const { card, beneficiary, photoCheck } = response;
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  useEffect(() => {
    // Only for the hashes and the rate; the enrollment itself already succeeded, so a failed read just leaves them out.
    getDashboard().then(setDashboard).catch(() => setDashboard(null));
  }, []);
  const hashOf = dashboard === null ? () => null : txLookup(dashboard);
  const txs = new Map((dashboard?.recentChainTxs ?? []).map((tx) => [tx.id, tx]));

  return (
    <>
      <EnrollTop onBack={onNext} title="Enrolled" chip="Active" />
      <div className="relative flex flex-1 flex-col">
        <Confetti key={card.id} />
        <Body>
          <Card>
            <KeyValues
              rows={[
                ["Driver", shortName(beneficiary)],
                ["Card", `…${card.uidLast4}`],
                ["Hash prefix", response.deviceHashPrefix],
                ["Per-tap cap", dashboard === null ? "Loading" : php(card.maxAmountStroops, dashboard.phpPerXlm)],
                ["Expires", dateTime(card.expiresAtS * 1000)],
              ]}
            />
            {card.virtual ? <Chip>simulated</Chip> : null}
          </Card>
          <Card>
            <h2 className="text-label">Photo check</h2>
            <Chip tone="mint">{photoCheck.source === "precomputed" ? "precomputed vision · matched" : "officer confirmed"}</Chip>
            {photoCheck.source === "precomputed" ? (
              <KeyValues
                rows={[
                  ["Plate", photoCheck.plate ?? "None"],
                  ["TODA", photoCheck.toda ?? "None"],
                ]}
              />
            ) : null}
          </Card>
          <ListCard
            heading="On-chain"
            rows={response.chainTxIds.map((id) => {
              const hash = hashOf(id);
              return {
                id,
                title: txs.get(id)?.kind === "register_agent" ? "Policy registered" : "Device registered",
                meta: hash === null ? "Tx hash loading" : `tx ${shortHash(hash)}`,
                ...(txs.get(id)?.status === "succeeded" ? { chip: "Succeeded", tone: "mint" as const } : { chip: "Pending" }),
              };
            })}
          />
          <DemoRate />
        </Body>
      </div>
      <Actions>
        <Button onClick={onNext}>Enroll next driver</Button>
      </Actions>
    </>
  );
}

export default function Enroll() {
  const preselected = useSearchParams().get("beneficiary");
  const { isOfficer, loading } = useAuth();
  const [driver, setDriver] = useState<Beneficiary | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [response, setResponse] = useState<EnrollResponse | null>(null);
  const [alreadyEnrolled, setAlreadyEnrolled] = useState(false);

  // "Enroll this driver" on the beneficiary page lands here with the driver already chosen.
  useEffect(() => {
    if (preselected === null) return;
    getBeneficiaries({ status: "approved", limit: 500 })
      .then((drivers) => setDriver(drivers.find((d) => d.id === preselected) ?? null))
      .catch(() => setDriver(null));
  }, [preselected]);

  const restart = () => {
    setDriver(null);
    setUid(null);
    setResponse(null);
    setAlreadyEnrolled(false);
  };

  if (!isOfficer) {
    return (
      <>
        <TopBar />
        <Body>{loading ? null : <OfficerNotice />}</Body>
      </>
    );
  }
  if (response !== null) return <Result response={response} onNext={restart} />;
  if (driver === null) return <Pick onPick={setDriver} />;
  if (alreadyEnrolled) {
    return (
      <>
        <EnrollTop onBack={restart} />
        <Body>
          <Notice tone="error" title="This card is already enrolled">
            CARD_ALREADY_ENROLLED: use a different card for this driver.
          </Notice>
        </Body>
        <Actions>
          <Button
            onClick={() => {
              setUid(null);
              setAlreadyEnrolled(false);
            }}
          >
            Read another card
          </Button>
        </Actions>
      </>
    );
  }
  if (uid === null) return <ReadCard driver={driver} onBack={restart} onRead={setUid} />;
  return <Photo driver={driver} uid={uid} onBack={() => setUid(null)} onDone={setResponse} onAlreadyEnrolled={() => setAlreadyEnrolled(true)} />;
}

