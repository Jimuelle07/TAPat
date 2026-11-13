"use client";

// Desktop page frames and the ruled table. Everything inside them is the app's own component kit.
import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { Dashboard } from "@tapat/shared";
import type { FeedItem } from "@/lib/feed";
import { dateTime } from "@/lib/format";
import { useDashboard } from "@/lib/use-dashboard";
import { OfficerOnly, useAuth } from "@/app/(app)/_components/Auth";
import { Icon, type IconName } from "@/app/(app)/_components/Icon";
import { Chip, EmptyState, ErrorBlock, NoProgram, Sheet, Skeleton, type ChipTone } from "@/app/(app)/_components/ui";
import { FeedDetail } from "@/app/(app)/_components/FeedDetail";
import { initials } from "./Sidebar";

export const PROGRAM_STATUS: Record<Dashboard["program"]["status"], { label: string; tone: ChipTone }> = {
  draft: { label: "Draft", tone: "outline" },
  active: { label: "Active", tone: "mint" },
  ending: { label: "Ending", tone: "outline" },
  ended: { label: "Ended", tone: "outline" },
};

/**
 * The laptop top bar: the page title, the running program, and who is logged in. It stays put while the page scrolls.
 * `heading` is false where the page body carries the h1 (the Overview names the program there).
 */
function TopBar({ title, back, chip, heading = true }: { title: ReactNode; back?: string; chip?: ReactNode; heading?: boolean }) {
  const { user, logout } = useAuth();
  const state = useDashboard();
  const program = state.status === "ready" ? state.dashboard.program : null;
  const Title = heading ? "h1" : "p";
  return (
    <header className="ql-dtop sticky top-0 z-20 flex h-[70px] items-center gap-3.5 border-b border-text bg-surface px-8">
      {back !== undefined ? (
        <Link href={back} className="ql-crumb">
          <Icon name="back" size={18} />
          Back
        </Link>
      ) : null}
      <Title className="ql-dtop-title min-w-0 truncate">{title}</Title>
      {chip}
      <span className="flex-1" />
      {program !== null ? (
        <span className="ql-dtop-prog">
          <Chip tone={PROGRAM_STATUS[program.status].tone}>{PROGRAM_STATUS[program.status].label}</Chip>
          <span className="truncate text-muted">{program.name}</span>
        </span>
      ) : null}
      {user !== null ? (
        <>
          <span className="ql-dtop-user">
            <span aria-hidden="true" className="ql-dtop-avatar">
              {initials(user.displayName)}
            </span>
            <span>
              {user.displayName}
              <small>{user.role}</small>
            </span>
          </span>
          <button type="button" className="ql-icon-btn" aria-label={`Log out ${user.displayName}`} onClick={() => void logout()}>
            <Icon name="logout" />
          </button>
        </>
      ) : null}
    </header>
  );
}

/** Page actions sit at the top right of the body, under the bar. */
function PageActions({ actions }: { actions?: ReactNode }) {
  return actions !== undefined ? <div className="flex justify-end">{actions}</div> : null;
}

export function Page({ title, back, chip, actions, children }: { title: ReactNode; back?: string; chip?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <>
      <TopBar title={title} back={back} chip={chip} />
      <main className="fade-in mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-9 pt-7 pb-12">
        <PageActions actions={actions} />
        {children}
      </main>
    </>
  );
}

/** The Overview frame: "Overview" in the bar, then the program's name as a display title with its one sentence of purpose. */
export function QuietPage({ title, lead, meta, actions, children }: { title: ReactNode; lead: ReactNode; meta?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <>
      <TopBar title="Overview" heading={false} />
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-[26px] px-9 pt-7 pb-12">
        <header className="flex items-start justify-between gap-8">
          <div className="flex min-w-0 flex-col gap-2.5">
            <h1 className="ql-display min-w-0">{title}</h1>
            <p className="flex max-w-[62ch] flex-wrap items-center gap-x-2.5 gap-y-1.5 text-small text-[#3d4f48]">
              {meta}
              {lead}
            </p>
          </div>
          {actions}
        </header>
        <main className="fade-in flex flex-col gap-[26px]">{children}</main>
      </div>
    </>
  );
}

/** A section heading with an optional link on the right. */
export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="-mb-1 flex items-center justify-between gap-3">
      <h2 className="ql-sec-title">{children}</h2>
      {aside}
    </div>
  );
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="ql-tlink">
      {children}
      <Icon name="chevron" size={16} className="ql-nudge" />
    </Link>
  );
}

/** A Ledger card: paper, a 1px ink outline and an optional title row. `flush` drops the padding for tables and lists. */
export function LedgerCard({ title, aside, flush = false, className = "", children }: { title?: ReactNode; aside?: ReactNode; flush?: boolean; className?: string; children: ReactNode }) {
  return (
    <section className={`ql-card flex min-w-0 flex-col gap-3 border ${flush ? "overflow-hidden" : "px-[18px] py-4"} ${className}`}>
      {title !== undefined ? (
        <header className={`flex items-center justify-between gap-2.5 ${flush ? "px-[18px] pt-3.5" : ""}`}>
          <h3 className="text-[15px] leading-[1.3] font-semibold">{title}</h3>
          {aside}
        </header>
      ) : null}
      {children}
    </section>
  );
}

const DOT: Record<"mint" | "accent" | "danger" | "frozen" | "ink" | "outline", string> = {
  mint: "bg-primary",
  accent: "bg-accent",
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
    <>
    {title !== undefined ? <TopBar title={title} /> : null}
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-10 py-8">
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
    </>
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
      <FeedSheet item={selected} onClose={() => setSelected(null)} />
    </>
  );
}

/** The detail of one tap or agent decision, with its transaction. */
function FeedSheet({ item, onClose }: { item: FeedItem | null; onClose: () => void }) {
  return (
    <Sheet title={item?.detail.title ?? "Activity"} open={item !== null} onClose={onClose}>
      {item !== null ? <FeedDetail item={item} /> : null}
    </Sheet>
  );
}

/** The same feed as rows for a narrow column: title and time on the left, amount and status on the right. */
export function FeedList({ items }: { items: FeedItem[] }) {
  const [selected, setSelected] = useState<FeedItem | null>(null);
  return (
    <>
      <ul aria-label="Activity, newest first" className="px-[18px]">
        {items.map((item, index) => (
          <li key={item.id}>
            <button type="button" onClick={() => setSelected(item)} className={`ql-list-row ${index === 0 ? "" : "border-t"}`}>
              <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <span className="ql-list-title">{item.title}</span>
                <span className="text-[13px] break-words text-muted">
                  {dateTime(item.createdAt)}
                  {item.meta !== "" ? ` · ${item.meta}` : ""}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                {item.value !== undefined ? <span className="font-mono text-[14px] font-medium whitespace-nowrap">{item.value}</span> : null}
                <Chip tone={item.tone ?? item.detail.tone}>{item.chip ?? item.detail.chip}</Chip>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <FeedSheet item={selected} onClose={() => setSelected(null)} />
    </>
  );
}
