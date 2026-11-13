// The body of an activity sheet, the same on the phone and the laptop: the status in plain words, one sentence on
// what happened, the details the event recorded, then whether it touched the chain.
import type { FeedItem } from "@/lib/feed";
import { dateTime, explorerUrl, shortHash } from "@/lib/format";
import { Chip, KeyValues, LinkButton } from "./ui";

export function FeedDetail({ item }: { item: FeedItem }) {
  const { detail } = item;
  const rows: Array<[string, string]> = [["When", dateTime(item.createdAt)], ...(detail.agent !== undefined ? [["Agent", detail.agent] as [string, string]] : []), ...detail.rows];
  return (
    <>
      <Chip tone={detail.tone}>{detail.chip}</Chip>
      <p className="text-small text-[#3d4f48]">{detail.summary}</p>
      <section aria-label="Details" className="ql-ev-sec flex flex-col gap-1.5 border-t pt-3">
        <h3 className="ql-ev-k">Details</h3>
        <KeyValues rows={rows} />
      </section>
      <section aria-label="On-chain" className="ql-ev-sec flex flex-col gap-1.5 border-t pt-3">
        <h3 className="ql-ev-k">On-chain</h3>
        {detail.hash !== null ? (
          <KeyValues
            rows={[
              ["Tx", shortHash(detail.hash)],
              ["Network", "Stellar Testnet"],
            ]}
          />
        ) : (
          <p className="text-small text-muted">{detail.chainNote ?? "No transaction. Nothing was sent to the chain."}</p>
        )}
      </section>
      {detail.label !== undefined ? <Chip>{detail.label}</Chip> : null}
      {detail.hash !== null ? (
        <LinkButton look="secondary" external href={explorerUrl(detail.hash)}>
          View on Stellar Expert
        </LinkButton>
      ) : null}
    </>
  );
}
