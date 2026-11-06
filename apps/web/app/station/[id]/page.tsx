"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { TAP_REASON_LABELS } from "@tapat/shared";
import type { CardSummary, Dashboard, Tap, TapReasonCode } from "@tapat/shared";
import { ApiClientError, postTap, type TapRequest } from "@/lib/api";
import { cardLabel, txLookup } from "@/lib/feed";
import { parseAmount, php, shortHash } from "@/lib/format";
import { NfcReadError, readUid } from "@/lib/nfc";
import { errorMessage, useDashboard } from "@/lib/use-dashboard";
import { BalanceCard, Receipt } from "../../_components/money";
import { Actions, Body, Button, Card, Chip, DemoRate, EmptyState, ErrorBlock, FilterChip, KeyValues, ListCard, NoProgram, Notice, Sheet, Skeleton, TopBar, type ListRow } from "../../_components/ui";

type SelectedCard = { kind: "read"; uid: string } | { kind: "simulated"; card: CardSummary };

/** One finished charge: a tap the API answered, or a tap it refused with an error status. */
type Outcome =
  | { kind: "tap"; tap: Tap; balanceStroops: string | null; message: string }
  | { kind: "refused"; amountPhp: number; reasonCode: "STATION_FROZEN" | "CARD_NOT_ENROLLED"; message: string }
  | { kind: "failed"; amountPhp: number; message: string };

const REASON_CHIP: Record<TapReasonCode, string> = {
  OVER_CAP: "Over cap",
  EXPIRED: "Expired",
  POLICY_DENIED: "Denied",
  INSUFFICIENT_ESCROW: "No credit",
  STATION_FROZEN: "Refused",
  CARD_NOT_ENROLLED: "Refused",
  SIMULATED_EDGE: "Simulated",
};

function recentRow(tap: Tap, dashboard: Dashboard): ListRow {
  const card = dashboard.cards.find((c) => c.id === tap.cardId);
  const title = `${card === undefined ? "Not read" : `…${card.uidLast4}`} ${php(tap.amountStroops, dashboard.phpPerXlm)}`;
  if (tap.status === "authorized") return { id: tap.id, title, chip: "Paid", tone: "mint" };
  if (tap.status === "failed") return { id: tap.id, title, chip: "Failed", tone: "danger" };
  return { id: tap.id, title, chip: tap.reasonCode === null ? "Declined" : REASON_CHIP[tap.reasonCode], tone: "danger" };
}

export default function StationTerminal() {
  const { id } = useParams<{ id: string }>();
  const state = useDashboard();
  const [amount, setAmount] = useState("");
  const [selected, setSelected] = useState<SelectedCard | null>(null);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<NfcReadError | null>(null);
  const [nfcGone, setNfcGone] = useState(false);
  const [picking, setPicking] = useState(false);
  const [charging, setCharging] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const tabTitle = `Station ${id}`;
  const switcher = (
    <div className="flex gap-2">
      {["A", "B"].map((station) => (
        <FilterChip key={station} grow selected={station === id} href={`/station/${station}`}>
          Station {station}
        </FilterChip>
      ))}
    </div>
  );

  if (state.status === "loading") {
    return (
      <>
        <TopBar chip={tabTitle} />
        <Body>
          <Skeleton kinds={["row", "card", "row", "row", "row"]} />
        </Body>
      </>
    );
  }
  if (state.status === "no-program") {
    return (
      <>
        <TopBar chip={tabTitle} />
        <Body>
          <NoProgram icon="pump" body="This terminal can take payments once a program is running." />
        </Body>
      </>
    );
  }
  if (state.status === "error") {
    return (
      <>
        <TopBar chip={tabTitle} />
        <Body>
          <ErrorBlock title="Could not load this station" message={state.message} onRetry={() => void state.reload()} />
        </Body>
      </>
    );
  }

  const { dashboard } = state;
  const rate = dashboard.phpPerXlm;
  const station = dashboard.stations.find((s) => s.id === id);
  if (station === undefined) {
    return (
      <>
        <TopBar chip={tabTitle} />
        <Body>
          {switcher}
          <EmptyState icon="pump" title="Station not set up" body={`There is no station ${id} in this program. Stations are created by seed-demo.ts.`} />
        </Body>
      </>
    );
  }

  const parsedAmount = parseAmount(amount);
  // The over-cap amount is deliberately allowed: the contract rejects it, and that rejection is the demo (§5.2 #13).
  const canCharge = selected !== null && parsedAmount !== null && !charging && !reading;
  const recent = dashboard.recentTaps.filter((t) => t.stationId === id && t.reasonCode !== "SIMULATED_EDGE").slice(0, 5);
  const pickable = dashboard.cards.filter((c) => c.status === "active");
  const hashOf = txLookup(dashboard);
  const capText = `Cap ${php(dashboard.program.perTapCapStroops, rate)}`;

  const readCard = async () => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setReading(true);
    setReadError(null);
    setFormError(null);
    try {
      setSelected({ kind: "read", uid: await readUid({ signal: controller.signal }) });
    } catch (cause) {
      if (cause instanceof NfcReadError) {
        setReadError(cause);
        setNfcGone(cause.code === "NFC_UNSUPPORTED");
        setPicking(true); // docs: the Simulate tap picker expands automatically on a read error
      }
    } finally {
      setReading(false);
    }
  };

  const charge = async () => {
    if (selected === null || parsedAmount === null) return;
    const body: TapRequest =
      selected.kind === "read"
        ? { stationId: id, amountPhp: parsedAmount, uid: selected.uid }
        : { stationId: id, amountPhp: parsedAmount, cardId: selected.card.id, simulated: true };
    setCharging(true);
    setFormError(null);
    try {
      const response = await postTap(body);
      setOutcome({ kind: "tap", ...response });
      void state.reload();
    } catch (cause) {
      if (cause instanceof ApiClientError && (cause.code === "STATION_FROZEN" || cause.code === "CARD_NOT_ENROLLED")) {
        setOutcome({ kind: "refused", amountPhp: parsedAmount, reasonCode: cause.code, message: cause.message });
        void state.reload();
      } else if (cause instanceof ApiClientError && cause.code === "CHAIN_ERROR") {
        setOutcome({ kind: "failed", amountPhp: parsedAmount, message: cause.message });
        void state.reload();
      } else {
        setFormError(errorMessage(cause));
      }
    } finally {
      setCharging(false);
    }
  };

  const clear = () => {
    setOutcome(null);
    setSelected(null);
    setAmount("");
    setReadError(null);
  };
  const nextCharge = () => {
    setOutcome(null);
    setAmount("");
  };

  // ---- Receipt ---------------------------------------------------------------------------------------------------
  if (outcome !== null) {
    const selectedCard =
      selected?.kind === "simulated"
        ? cardLabel(selected.card)
        : selected?.kind === "read"
          ? `…${selected.uid.slice(-4)}`
          : "Not read";
    if (outcome.kind === "failed") {
      return (
        <>
          <TopBar chip={tabTitle} />
          <Body>
            <Notice tone="error" title="The payment did not go through">
              CHAIN_ERROR: {outcome.message}. No decision was made on this tap.
            </Notice>
            <Card>
              <KeyValues rows={[["Card", selectedCard], ["Amount", `PHP ${outcome.amountPhp.toFixed(2)}`]]} />
            </Card>
            <DemoRate />
          </Body>
          <Actions solid>
            <Button look="secondary" onClick={clear}>
              Clear
            </Button>
          </Actions>
        </>
      );
    }
    if (outcome.kind === "refused") {
      return (
        <>
          <TopBar chip={tabTitle} />
          <Body>
            <Receipt
              stationLabel={tabTitle}
              status="REFUSED"
              tone="danger"
              amount={`PHP ${outcome.amountPhp.toFixed(2)}`}
              rows={[["Card", selectedCard], ["Reason", TAP_REASON_LABELS[outcome.reasonCode]], ["Tx", "None submitted"]]}
              note={outcome.reasonCode === "STATION_FROZEN" ? "Refused before signing. No chain call was made." : "Refused before signing. This card is not in the program."}
            />
            <DemoRate />
          </Body>
          <Actions solid>
            <Button look="secondary" onClick={clear}>
              Clear
            </Button>
          </Actions>
        </>
      );
    }
    const { tap, balanceStroops, message } = outcome;
    const card = dashboard.cards.find((c) => c.id === tap.cardId);
    const label = card === undefined ? selectedCard : cardLabel(card);
    const amountText = php(tap.amountStroops, rate);
    if (tap.status === "authorized") {
      const hash = hashOf(tap.chainTxId);
      return (
        <>
          <TopBar chip={tabTitle} />
          <Body>
            <Receipt
              stationLabel={tabTitle}
              status="PAID"
              tone="accent"
              amount={amountText}
              rows={[
                ["Card", label],
                ["Balance", balanceStroops === null ? "Not read" : php(balanceStroops, rate)],
                ["Tx", hash === null ? "Waiting for the chain" : shortHash(hash)],
              ]}
              note={`${message} A receipt goes to the driver on Telegram if linked.`}
            />
            {balanceStroops !== null && card !== undefined ? (
              <BalanceCard balance={php(balanceStroops, rate)} name={card.displayName} last4={card.uidLast4} />
            ) : null}
            <DemoRate />
          </Body>
          <Actions solid>
            <Button onClick={nextCharge}>Next charge</Button>
          </Actions>
        </>
      );
    }
    return (
      <>
        <TopBar chip={tabTitle} />
        <Body>
          <Receipt
            stationLabel={tabTitle}
            status={tap.status === "refused" ? "REFUSED" : "DECLINED"}
            tone="danger"
            amount={amountText}
            rows={[
              ["Card", label],
              ["Reason", tap.reasonCode === null ? "The chain call did not finish" : TAP_REASON_LABELS[tap.reasonCode]],
              ["Tx", "None submitted"],
            ]}
            note={message}
          />
          <DemoRate />
        </Body>
        <Actions solid>
          <Button look="secondary" onClick={clear}>
            Clear
          </Button>
        </Actions>
      </>
    );
  }

  // ---- Terminal --------------------------------------------------------------------------------------------------
  return (
    <>
      <TopBar chip={tabTitle} />
      <Body>
        {switcher}
        {station.status === "frozen" ? (
          <Notice tone="frozen" title="Station paused by the Freeze Agent">
            New taps are refused until the LGU unfreezes this station.
          </Notice>
        ) : null}
        {readError !== null ? (
          <Notice tone="error" title="Could not read the card">
            {readError.code}: {readError.message} Pick the card from the list instead.
          </Notice>
        ) : null}
        {formError !== null ? (
          <Notice tone="error" title="Check the charge">
            {formError}
          </Notice>
        ) : null}
        <label className="flex flex-col gap-2 rounded-md border-[1.5px] border-text bg-raised p-6 focus-within:border-[2.5px] focus-within:border-primary">
          <span className="flex items-center justify-between gap-2">
            <span className="text-label">Amount</span>
            <span className="font-mono text-mono">{capText}</span>
          </span>
          <span className="flex items-baseline gap-2 font-mono text-amount-lg">
            <span aria-hidden="true">PHP</span>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              aria-label="Amount in pesos"
              className="w-full min-w-0 bg-transparent outline-none placeholder:text-muted"
            />
          </span>
        </label>
        {reading ? (
          <Card className="!flex-row items-center gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="text-label">Hold the card to the phone</p>
              <p className="text-caption">Listening for up to 15 seconds</p>
            </div>
            <Chip>Reading</Chip>
          </Card>
        ) : selected !== null ? (
          <Card className="!flex-row items-center gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="text-label">{selected.kind === "read" ? `Card …${selected.uid.slice(-4)}` : cardLabel(selected.card)}</p>
              <p className="text-caption">
                {selected.kind === "read" ? "Stays selected until you read another or clear" : "Picked from the list, still a real on-chain payment"}
              </p>
            </div>
            {selected.kind === "read" ? <Chip tone="accent">Card read</Chip> : <Chip>simulated</Chip>}
          </Card>
        ) : null}
        {recent.length > 0 ? (
          <ListCard heading="Recent taps" rows={recent.map((tap) => recentRow(tap, dashboard))} />
        ) : (
          <EmptyState icon="receipt" title="No taps yet" body="Charges at this station appear here." />
        )}
        <DemoRate />
      </Body>
      <Actions>
        <Button loading={charging} disabled={!canCharge && !charging} onClick={() => void charge()}>
          {charging ? "Charging" : "Charge"}
        </Button>
        <div className="flex gap-2">
          <Button look="secondary" loading={reading} disabled={nfcGone || charging} onClick={() => void readCard()}>
            {reading ? "Reading" : "Read card"}
          </Button>
          {selected !== null ? (
            <Button look="secondary" disabled={charging} onClick={clear}>
              Clear
            </Button>
          ) : (
            <Button look="secondary" disabled={charging} onClick={() => setPicking(true)}>
              Simulate tap
            </Button>
          )}
        </div>
      </Actions>
      <Sheet title="Simulate tap" open={picking} onClose={() => setPicking(false)}>
        {pickable.length === 0 ? (
          <EmptyState icon="idcard" title="No active cards" body="Enroll a driver to tap at this station." />
        ) : (
          <>
            <ListCard
              rows={pickable.map((card) => ({
                id: card.id,
                title: cardLabel(card),
                meta: `${card.deviceHashPrefix}${card.virtual ? " · virtual" : ""}`,
                ...(card.expired ? { chip: "Expired" } : {}),
                onClick: () => {
                  setSelected({ kind: "simulated", card });
                  setReadError(null);
                  setPicking(false);
                },
              }))}
            />
            <p className="text-caption">Only the way the card is identified is simulated. The payment is still a real authorize on-chain.</p>
          </>
        )}
      </Sheet>
    </>
  );
}
