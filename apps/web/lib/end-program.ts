// What /demo/end shows for a program end (api-and-data.md §5.2 #5). A failed card leaves the program `ending`; a
// retry answers with only the retried cards; the closing `PROGRAM_ENDED` decision lists every swept card.
import type { CardSummary, Dashboard, EndProgramResponse } from "@tapat/shared";

export type CardOutcome = EndProgramResponse["cards"][number];

/** `confirm`: nothing ended yet. `partial`: the program is `ending` with cards still unswept. `ended`: final. */
export type EndStage = "confirm" | "partial" | "ended";

export interface EndView {
  stage: EndStage;
  outcomes: CardOutcome[];
  failures: CardOutcome[];
  totalReturnedStroops: string;
}

export const NOT_SWEPT_YET = "Not swept yet";

/**
 * A retry returns only the cards it retried; the server total is already cumulative. `shown` is what the page lists
 * before the retry — the previous response, or the dashboard-derived rows after a reload — so no card drops off.
 */
export function mergeEndResult(shown: CardOutcome[], next: EndProgramResponse): EndProgramResponse {
  if (shown.length === 0) return next;
  const merged = shown.map((card) => next.cards.find((n) => n.cardId === card.cardId) ?? card);
  const added = next.cards.filter((n) => !shown.some((card) => card.cardId === n.cardId));
  return { ...next, cards: [...merged, ...added] };
}

/**
 * A reload while the program is `ending` has no response in hand and no closing decision yet, so the per-card rows
 * come from the dashboard's cards: swept ones with what they returned, active ones as not swept yet.
 */
function fromCards(cards: CardSummary[]): CardOutcome[] {
  return cards.flatMap((card): CardOutcome[] => {
    if (card.status !== "swept" && card.status !== "active") return [];
    const swept = card.status === "swept";
    return [
      {
        cardId: card.id,
        beneficiaryId: card.beneficiaryId,
        returnedStroops: card.returnedStroops,
        revokeTxId: null,
        sweepTxId: null,
        status: card.status,
        reason: swept ? (card.returnedStroops === "0" ? "EMPTY_ESCROW" : null) : NOT_SWEPT_YET,
      },
    ];
  });
}

/**
 * The closing decision stores only `{cardId, returnedStroops, status, reason}` per card (no beneficiary or tx ids), so
 * each row is narrowed field by field and the missing ids are explicit nulls.
 */
function closingCards(raw: unknown): CardOutcome[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((row: unknown): CardOutcome[] => {
    if (typeof row !== "object" || row === null) return [];
    const { cardId, returnedStroops, status, reason } = row as Record<string, unknown>;
    if (typeof cardId !== "string" || typeof returnedStroops !== "string" || typeof status !== "string") return [];
    return [
      {
        cardId,
        beneficiaryId: "",
        returnedStroops,
        revokeTxId: null,
        sweepTxId: null,
        status: status as CardOutcome["status"],
        reason: typeof reason === "string" ? reason : null,
      },
    ];
  });
}

export function endView(dashboard: Dashboard, result: EndProgramResponse | null): EndView {
  // The dashboard saying `ended` wins over an older partial response (another device, or a later call, finished it).
  const finalResult = result?.program.status === "ended" ? result : null;
  const status = dashboard.program.status === "ended" ? "ended" : (result?.program.status ?? dashboard.program.status);
  let stage: EndStage;
  let outcomes: CardOutcome[];
  let total = result?.totalReturnedStroops ?? dashboard.returnedStroops;
  if (status === "ended") {
    stage = "ended";
    const closing = dashboard.recentDecisions.find((d) => d.agent === "sweep" && d.decision === "PROGRAM_ENDED");
    outcomes = finalResult?.cards ?? closingCards(closing?.outputs.cards);
    total = finalResult?.totalReturnedStroops ?? dashboard.returnedStroops;
  } else if (status === "ending") {
    stage = "partial";
    outcomes = result?.cards ?? fromCards(dashboard.cards);
  } else {
    stage = "confirm";
    outcomes = [];
  }
  return {
    stage,
    outcomes,
    failures: outcomes.filter((card) => card.status !== "swept" && card.status !== "revoked"),
    totalReturnedStroops: total,
  };
}
