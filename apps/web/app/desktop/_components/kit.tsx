"use client";

// Desktop page frames and the ruled table. Everything inside them is the app's own component kit.
import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { Dashboard } from "@tapat/shared";
import type { FeedItem } from "@/lib/feed";
import { dateTime, explorerUrl } from "@/lib/format";
import type { useDashboard } from "@/lib/use-dashboard";
import { OfficerOnly } from "@/app/(app)/_components/Auth";
import { Icon, type IconName } from "@/app/(app)/_components/Icon";
import { Chip, EmptyState, ErrorBlock, KeyValues, LinkButton, NoProgram, Sheet, Skeleton } from "@/app/(app)/_components/ui";

function PageHeader({ title, back, chip, actions }: { title: ReactNode; back?: string; chip?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-6 border-b-[1.5px] border-text pb-4">
      <div className="flex min-w-0 items-center gap-2">
        {back !== undefined ? (
          <Link href={back} aria-label="Back" className="-ml-2 flex size-11 shrink-0 items-center justify-center">
            <Icon name="back" />
          </Link>
        ) : null}
        <h1 className="min-w-0 text-h1">{title}</h1>
        {chip}
      </div>
      {actions}
    </header>
  );
}

export function Page({ title, back, chip, actions, children }: { title: ReactNode; back?: string; chip?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-10 py-8">
      <PageHeader title={title} back={back} chip={chip} actions={actions} />
      <main className="fade-in flex flex-col gap-6">{children}</main>
    </div>
  );
}

/** The quiet index frame: a large title, one sentence of purpose, then content. Hierarchy comes from size and space, not rules. */
export function QuietPage({ title, lead, meta, actions, children }: { title: ReactNode; lead: ReactNode; meta?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-10 px-10 py-12">
      <header className="flex items-end justify-between gap-8">
        <div className="flex min-w-0 flex-col gap-3">
          <h1 className="min-w-0 text-[48px] leading-[1.1] font-semibold">{title}</h1>
          <p className="max-w-[60ch] text-small">{lead}</p>
          {meta}
        </div>
        {actions}
      </header>
      <main className="fade-in flex flex-col gap-12">{children}</main>
    </div>
  );
}

const DOT: Record<"mint" | "danger" | "frozen" | "ink" | "outline", string> = {
  mint: "bg-primary",
  danger: "bg-danger",
  frozen: "bg-frozen border border-text",
  ink: "bg-text",
  outline: "border border-muted",
};

/** A status as a coloured dot and its word, so colour is never the only signal and there is no pill to compete with the figures. */
export function StatusText({ tone = "outline", children }: { tone?: keyof typeof DOT; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-small">
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${DOT[tone]}`} />
      {children}
    </span>
  );
}

/**
 * A mobile screen on a desktop page. Single-task flows (log in, create program, enroll, the terminal) are form-sized on any
 * screen, and sharing the component keeps their money and validation logic in one place.
 */
export function Embedded({ title, notice, side, tall = false, children }: { title?: string; notice?: ReactNode; side?: ReactNode; tall?: boolean; children: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-10 py-8">
      {title !== undefined ? <PageHeader title={title} /> : null}
      {notice}
      {side !== undefined ? (
        <div className="grid grid-cols-[minmax(0,560px)_minmax(0,1fr)] items-start gap-6">
          <div className="desktop-column -ml-5 flex flex-col">{children}</div>
          <aside className="flex flex-col gap-4 pt-2">{side}</aside>
        </div>
      ) : (
        <div className={`desktop-column mx-auto flex w-full max-w-[520px] flex-col ${tall ? "min-h-[calc(100dvh-4rem)]" : ""}`}>{children}</div>
      )}
    </div>
  );
}

/** The kit's buttons are full width for a phone; here they size to their label. */
export function ActionRow({ children }: { children: ReactNode }) {
  return <div className="flex shrink-0 items-center gap-2 [&>*]:min-h-11 [&>*]:w-auto">{children}</div>;
}

/** The loading, no-program and error states every dashboard page shares. */
export function Gate({
  state,
  what,
  empty,
  icon,
  children,
}: {
  state: ReturnType<typeof useDashboard>;
  what: string;
  empty: string;
  icon?: IconName;
  children: (dashboard: Dashboard) => ReactNode;
}) {
  if (state.status === "loading") return <Skeleton kinds={["row", "card", "card", "row"]} />;
  if (state.status === "no-program") {
    return (
      <div className="mx-auto w-full max-w-md">
        {/* Only an officer can create the program, so a viewer gets the same message without the action. */}
        <OfficerOnly fallback={<EmptyState icon={icon} title="No active program" body={empty} />}>
          <NoProgram icon={icon} body={empty} />
        </OfficerOnly>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="flex max-w-xl flex-col gap-4">
        <ErrorBlock title={`Could not load ${what}`} message={state.message} onRetry={() => void state.reload()} />
      </div>
    );
  }
  return <>{children(state.dashboard)}</>;
}

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  /** Set in Azeret Mono: anything a reader might check. */
  mono?: boolean;
  right?: boolean;
}

/** A ruled table. With `href` or `onRow` the first cell holds the row's one link or button, stretched over the row. */
export function DataTable<T>({
  label,
  columns,
  rows,
  rowKey,
  href,
  onRow,
  quiet = false,
}: {
  label: string;
  columns: Array<Column<T>>;
  rows: T[];
  rowKey: (row: T) => string;
  href?: (row: T) => string;
  onRow?: (row: T) => void;
  /** Tone steps instead of heavy rules: a sunken well with hairline dividers and figures in the text face. */
  quiet?: boolean;
}) {
  const stretched = "text-left after:absolute after:inset-0";
  const frame = quiet ? "overflow-x-auto rounded-md border border-ring-surface bg-sunken" : "ql-table overflow-x-auto rounded-md border-[1.5px] border-text bg-raised";
  const rule = quiet ? "border-ring-surface" : "border-text";
  return (
    <div className={frame}>
      <table className="w-full border-collapse">
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.header} scope="col" className={`px-4 py-3 text-caption ${quiet ? "text-muted" : ""} ${column.right ? "text-right" : "text-left"}`}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className={`relative ${quiet ? "border-t" : "border-t-[1.5px]"} ${rule} ${href !== undefined || onRow !== undefined ? (quiet ? "hover:bg-raised" : "hover:bg-mint") : ""}`}>
              {columns.map((column, index) => {
                const content = column.cell(row);
                return (
                  <td key={column.header} className={`px-4 py-3 align-middle ${column.mono ? (quiet ? "text-small whitespace-nowrap" : "font-mono text-mono whitespace-nowrap") : "text-small"} ${quiet ? "tabular-nums" : ""} ${column.right ? "text-right" : "text-left"}`}>
                    {index === 0 && href !== undefined ? (
                      <Link href={href(row)} className={stretched}>
                        {content}
                      </Link>
                    ) : index === 0 && onRow !== undefined ? (
                      <button type="button" onClick={() => onRow(row)} className={stretched}>
                        {content}
                      </button>
                    ) : (
                      content
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Taps and agent decisions, opening the same detail the mobile activity sheet shows. */
export function FeedTable({ items, quiet = false }: { items: FeedItem[]; quiet?: boolean }) {
  const [selected, setSelected] = useState<FeedItem | null>(null);
  return (
    <>
      <DataTable
        label="Activity, newest first"
        rows={items}
        rowKey={(item) => item.id}
        onRow={setSelected}
        quiet={quiet}
        columns={[
          {
            header: "Event",
            cell: (item) => (
              <span className="flex flex-col gap-1">
                <span className="text-label">{item.title}</span>
                <span className="text-caption">{item.meta}</span>
              </span>
            ),
          },
          { header: "Time", mono: true, cell: (item) => dateTime(item.createdAt) },
          { header: "Amount", mono: true, right: true, cell: (item) => item.value ?? "" },
          {
            header: "Status",
            cell: (item) =>
              quiet ? (
                <StatusText tone={item.tone ?? item.detail.tone}>{item.chip ?? item.detail.chip}</StatusText>
              ) : (
                <Chip tone={item.tone ?? item.detail.tone}>{item.chip ?? item.detail.chip}</Chip>
              ),
          },
        ]}
      />
      <Sheet title={selected?.detail.title ?? "Activity"} open={selected !== null} onClose={() => setSelected(null)}>
        {selected !== null ? (
          <>
            <Chip tone={selected.detail.tone}>{selected.detail.chip}</Chip>
            {selected.detail.rows.length > 0 ? <KeyValues rows={selected.detail.rows} /> : null}
            {selected.detail.label !== undefined ? <Chip>{selected.detail.label}</Chip> : null}
            {selected.detail.hash !== null ? (
              <LinkButton look="secondary" external href={explorerUrl(selected.detail.hash)}>
                View on Stellar Expert
              </LinkButton>
            ) : null}
          </>
        ) : null}
      </Sheet>
    </>
  );
}
