// Money-bearing components: the station strip, the invariant line, the receipt and the fuel credit card.
import Image from "next/image";
import type { Station, Stroops } from "@tapat/shared";
import Link from "next/link";
import { php } from "@/lib/format";
import { Chip, KeyValues, type ChipTone } from "./ui";

export function StationRow({ station, phpPerXlm, href }: { station: Station; phpPerXlm: number; href?: string }) {
  const frozen = station.status === "frozen";
  const figures: Array<[string, Stroops]> = [
    ["Spent", station.spentStroops],
    // Pending at a frozen station is what the dashboard calls held (§5.2 #18).
    ["Pending", frozen ? "0" : station.pendingStroops],
    ["Held", frozen ? station.pendingStroops : "0"],
  ];
  const content = (
    <>
      <div className="mx-4 flex items-center justify-between gap-2 border-b-[1.5px] border-text py-3">
        <h3 className="min-w-0 flex-1 text-label">{station.name}</h3>
        <Chip tone={frozen ? "frozen" : "mint"}>{frozen ? "Frozen" : "Active"}</Chip>
      </div>
      {frozen && station.frozenReason !== null ? (
        <p className="mx-4 border-b-[1.5px] border-text py-2 font-mono text-mono break-words">{station.frozenReason}</p>
      ) : null}
      <dl className="flex px-1">
        {figures.map(([key, value], index) => (
          <div key={key} className={`my-3 flex min-w-0 flex-1 flex-col gap-1 px-3 ${index < 2 ? "border-r-[1.5px] border-text" : ""}`}>
            <dt className="text-caption">{key}</dt>
            <dd className="font-mono text-mono break-words">{php(value, phpPerXlm)}</dd>
          </div>
        ))}
      </dl>
    </>
  );
  const className = "block overflow-hidden rounded-md border-[1.5px] border-text bg-raised";
  return href === undefined ? (
    <div className={className}>{content}</div>
  ) : (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}

export function Invariant({ ok, escrow }: { ok: boolean; escrow: string }) {
  const border = ok ? "border-[1.5px]" : "border-[2.5px]";
  return (
    <div className={`overflow-hidden rounded-md ${border} border-text bg-raised`}>
      <div className={`flex items-center justify-between gap-2 border-b-[1.5px] border-text px-3 py-2`}>
        <span className="text-caption">Escrow remaining</span>
        <span className="font-mono text-mono">{escrow}</span>
      </div>
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="flex-1 text-caption">Funded = spent + held + pending + escrow + returned</span>
        <Chip tone={ok ? "mint" : "ink"}>{ok ? "OK" : "MISMATCH"}</Chip>
      </div>
    </div>
  );
}

/** Declined and refused taps show the server message as is, and no balance, because the API returns null. */
export function Receipt({
  stationLabel,
  status,
  tone,
  amount,
  rows,
  note,
}: {
  stationLabel: string;
  status: string;
  tone: ChipTone;
  amount: string;
  rows: Array<[string, string]>;
  note: string;
}) {
  const teeth = 25;
  const points = Array.from({ length: teeth * 2 + 1 }, (_, i) => `${(i / (teeth * 2)) * 100},${i % 2 === 0 ? 0 : 7}`).join(" ");
  return (
    <div>
      <div className="flex flex-col gap-3 border-[1.5px] border-b-0 border-text bg-raised p-5">
        <div className="flex items-center justify-between">
          <span className="block h-11 w-[88px] overflow-hidden">
            <Image src="/tapat-app-icon-1024.png" alt="TAPat" width={88} height={88} className="-mt-[22px] max-w-none mix-blend-darken" />
          </span>
          <div className="text-right font-mono text-mono">
            <p>RECEIPT</p>
            <p>{stationLabel}</p>
          </div>
        </div>
        <hr className="border-t-[1.5px] border-dashed border-text" />
        <div className="flex items-center justify-between">
          <Chip tone={tone}>{status}</Chip>
          <span className="font-mono text-amount-sm">{amount}</span>
        </div>
        <KeyValues rows={rows} />
        <hr className="border-t-[1.5px] border-dashed border-text" />
        <p className="font-mono text-mono break-words">{note}</p>
      </div>
      <svg aria-hidden="true" viewBox="0 0 100 7" preserveAspectRatio="none" className="block h-[7px] w-full overflow-visible">
        <polyline points={points} className="fill-raised stroke-text" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

/** Kit fuel credit card, shown after a paid tap. */
export function BalanceCard({ balance, name, last4 }: { balance: string; name: string; last4: string }) {
  return (
    <div className="relative flex h-[220px] flex-col justify-between overflow-hidden rounded-md border-[1.5px] border-text bg-primary-deep p-6 text-surface">
      <span aria-hidden="true" className="absolute -right-[60px] top-[100px] size-[326px] rounded-full bg-primary" />
      <svg aria-hidden="true" width="90" height="90" viewBox="0 0 90 90" className="absolute top-0 right-0 text-primary">
        {[90, 74, 58, 42, 26, 10].map((r) => (
          <circle key={r} cx="90" cy="0" r={r} fill="none" stroke="currentColor" strokeWidth="1.5" />
        ))}
      </svg>
      <p className="relative text-caption tracking-[0.04em]">TODA FUEL AID</p>
      <div className="relative flex flex-col gap-2">
        <p className="text-small">Fuel credit left</p>
        <p className="font-mono text-amount-md">{balance}</p>
      </div>
      <div className="relative flex justify-between text-label">
        <span>{name}</span>
        <span>…{last4}</span>
      </div>
    </div>
  );
}
