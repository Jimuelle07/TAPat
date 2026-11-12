"use client";

// The Figma component set: buttons, chips, cards, lists, inputs, notices and the loading/empty/error building blocks.
import Image from "next/image";
import Link from "next/link";
import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "./Icon";
import { useAuth } from "./Auth";
import { CountUp, useValueChange } from "./motion";

// ---- Button ----------------------------------------------------------------------------------------------------

export type ButtonStyle = "primary" | "secondary" | "tertiary";

const BUTTON: Record<ButtonStyle, string> = {
  primary: "bg-primary text-surface shadow-button hover:bg-pressed active:bg-pressed",
  secondary: "border-[1.5px] border-text bg-raised text-text hover:bg-mint active:bg-mint",
  tertiary: "text-primary hover:bg-mint active:bg-mint",
};
const BUTTON_BASE =
  "flex min-h-[54px] w-full items-center justify-center gap-2 rounded-md px-4 text-label transition-[transform,background-color,color] duration-[var(--motion-fast)] ease-[var(--ease-standard)] active:scale-[0.97] active:duration-75 disabled:active:scale-100";

function buttonClass(style: ButtonStyle, disabled: boolean): string {
  return `ql-btn ql-btn-${disabled ? "disabled" : style} ${BUTTON_BASE} ${disabled ? "cursor-not-allowed bg-sunken text-text" : BUTTON[style]}`;
}

interface ButtonProps extends Omit<ComponentProps<"button">, "style"> {
  look?: ButtonStyle;
  loading?: boolean;
}

export function Button({ look = "primary", loading = false, disabled, children, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(look, Boolean(disabled))}
      {...rest}
    >
      {loading ? <Icon name="refresh" className="spin" /> : null}
      {children}
    </button>
  );
}

export function LinkButton({
  look = "primary",
  href,
  children,
  external = false,
}: {
  look?: ButtonStyle;
  href: string;
  children: ReactNode;
  external?: boolean;
}) {
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={buttonClass(look, false)}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={buttonClass(look, false)}>
      {children}
    </Link>
  );
}

// ---- Chip ------------------------------------------------------------------------------------------------------

export type ChipTone = "outline" | "mint" | "accent" | "danger" | "frozen" | "ink";

const CHIP: Record<ChipTone, string> = {
  outline: "border-text bg-raised text-text",
  mint: "border-text bg-mint text-text",
  accent: "border-text bg-accent text-text",
  danger: "border-danger bg-danger text-surface",
  frozen: "border-text bg-frozen text-text",
  ink: "border-text bg-text text-surface",
};

/** Status is always written out, so colour is never the only signal. */
export function Chip({ tone = "outline", children }: { tone?: ChipTone; children: ReactNode }) {
  const n = useValueChange(tone);
  return (
    <span
      key={n}
      data-pop={n > 0 ? "true" : undefined}
      data-tone={tone}
      className={`chip inline-flex w-fit shrink-0 items-center rounded-sm border-[1.5px] px-2 py-1 text-caption ${CHIP[tone]}`}
    >
      {children}
    </span>
  );
}

export function DemoRate() {
  return <Chip>Testnet demo rate</Chip>;
}

export function FilterChip({
  selected,
  children,
  href,
  onClick,
  grow = false,
}: {
  selected: boolean;
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  grow?: boolean;
}) {
  const className = `ql-fchip flex min-h-11 shrink-0 items-center justify-center rounded-sm border-[1.5px] px-3 text-label transition-transform duration-[var(--motion-fast)] active:scale-[0.96] ${
    selected ? "border-primary bg-primary text-surface pop-in" : "border-text bg-raised text-text"
  } ${grow ? "flex-1" : ""}`;
  if (href !== undefined) {
    return (
      <Link href={href} aria-current={selected ? "page" : undefined} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" aria-pressed={selected} onClick={onClick} className={className}>
      {children}
    </button>
  );
}

// ---- Card, table, list -----------------------------------------------------------------------------------------

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`ql-card flex flex-col gap-2 rounded-md border-[1.5px] border-text bg-raised p-4 ${className}`}>{children}</div>;
}

/** Consecutive facts as one ruled table; amounts and ids stay in Azeret Mono. */
export function KeyValues({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="ql-kv flex flex-col font-mono text-mono">
      {rows.map(([key, value], index) => (
        <div key={key} className={`flex items-start justify-between gap-3 py-2 ${index === 0 ? "" : "border-t-[1.5px] border-text"}`}>
          <dt className="shrink-0">{key}</dt>
          <dd className="min-w-0 text-right break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export interface ListRow {
  id?: string;
  title: ReactNode;
  meta?: ReactNode;
  value?: ReactNode;
  chip?: ReactNode;
  tone?: ChipTone;
  href?: string;
  onClick?: () => void;
}

export function ListItem({ row, last = false }: { row: ListRow; last?: boolean }) {
  const interactive = row.href !== undefined || row.onClick !== undefined;
  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-1 text-left">
        <span className="break-words text-label">{row.title}</span>
        {row.meta !== undefined && row.meta !== null ? <span className="break-words text-caption">{row.meta}</span> : null}
      </span>
      {row.value !== undefined ? <span className="shrink-0 font-mono text-mono">{row.value}</span> : null}
      {row.chip !== undefined ? <Chip tone={row.tone}>{row.chip}</Chip> : null}
      {row.chip === undefined && row.value === undefined && interactive ? <Icon name="chevron" /> : null}
    </>
  );
  const className = `ql-row flex min-h-14 w-full items-center gap-3 py-3 ${
    interactive ? "transition-transform duration-[var(--motion-fast)] active:scale-[0.995]" : ""
  } ${last ? "" : "border-b-[1.5px] border-text"}`;
  if (row.href !== undefined) {
    return (
      <Link href={row.href} className={className}>
        {body}
      </Link>
    );
  }
  if (row.onClick !== undefined) {
    return (
      <button type="button" onClick={row.onClick} className={className}>
        {body}
      </button>
    );
  }
  return <div className={className}>{body}</div>;
}

export function ListCard({ heading, rows }: { heading?: string; rows: ListRow[] }) {
  return (
    <div className="ql-card ql-list flex flex-col overflow-hidden rounded-md border-[1.5px] border-text bg-raised px-4 py-1">
      {heading !== undefined ? <h3 className="pt-2 pb-1 text-label">{heading}</h3> : null}
      <ul className="stagger">
        {rows.map((row, index) => (
          <li key={row.id ?? index} style={{ "--i": Math.min(index, 8) } as CSSProperties}>
            <ListItem row={row} last={index === rows.length - 1} />
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---- Stat cards ------------------------------------------------------------------------------------------------

export function Rings({ size, step, count, className }: { size: number; step: number; count: number; className: string }) {
  return (
    <svg aria-hidden="true" width={size} height={size} className={`ql-rings absolute top-0 right-0 ${className}`} viewBox={`0 0 ${size} ${size}`}>
      {Array.from({ length: count }, (_, i) => (
        <circle key={i} cx={size} cy="0" r={size - i * step} fill="none" stroke="currentColor" strokeWidth="1.5" />
      ))}
    </svg>
  );
}

/** Kit card: value over caption, with the kit's large arc and corner rings. */
export function StatCard({
  tone = "cream",
  label,
  value,
  full = false,
  live,
}: {
  tone?: "cream" | "forest";
  label: string;
  value: string;
  full?: boolean;
  live?: { to: number; format: (n: number) => string };
}) {
  const forest = tone === "forest";
  return (
    <div
      data-tone={tone}
      className={`ql-stat relative flex flex-col justify-center gap-1 overflow-hidden rounded-md border-[1.5px] border-text ${
        full ? "h-28 px-6" : "h-22 min-w-0 flex-1 px-4"
      } ${forest ? "bg-primary-deep text-surface" : "bg-raised text-text"}`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-[2px] rounded-full ${forest ? "bg-primary" : "bg-sunken"} ${
          full ? "-right-[148px] size-[296px]" : "-right-[116px] size-[232px]"
        }`}
      />
      <Rings
        size={full ? 82 : 64}
        step={full ? 11 : 9}
        count={full ? 7 : 6}
        className={forest ? "text-pressed" : "text-ring-surface"}
      />
      {live !== undefined ? (
        <>
          <span className="sr-only">{value}</span>
          <span aria-hidden="true">
            <CountUp
              to={live.to}
              format={live.format}
              className={`relative tabular-nums ${full ? "text-card-value" : "text-card-value-sm"}`}
            />
          </span>
        </>
      ) : (
        <span className={`relative tabular-nums ${full ? "text-card-value" : "text-card-value-sm"}`}>{value}</span>
      )}
      <span className="relative text-small">{label}</span>
    </div>
  );
}

export function StatRow({ children }: { children: ReactNode }) {
  return <div className="flex items-start gap-3 stagger">{children}</div>;
}

// ---- Inputs ----------------------------------------------------------------------------------------------------

interface FieldProps extends ComponentProps<"input"> {
  label: string;
  helper?: string;
  error?: string;
}

export function Field({ label, helper, error, id, className = "", ...rest }: FieldProps) {
  const inputId = id ?? `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const noteId = `${inputId}-note`;
  const note = error ?? helper;
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={inputId}
        className={`ql-field flex flex-col gap-1 rounded-md border-[1.5px] px-4 py-3 focus-within:border-[2.5px] focus-within:border-primary ${
          error !== undefined ? "border-declined bg-declined-tint" : "border-text bg-raised"
        }`}
      >
        <span className="text-caption">{label}</span>
        <input
          id={inputId}
          aria-invalid={error !== undefined || undefined}
          aria-describedby={note !== undefined ? noteId : undefined}
          className={`w-full bg-transparent font-mono text-amount-sm outline-none ${className}`}
          {...rest}
        />
      </label>
      {note !== undefined ? (
        <p id={noteId} className="text-caption">
          {note}
        </p>
      ) : null}
    </div>
  );
}

// ---- Messages --------------------------------------------------------------------------------------------------

const NOTICE: Record<"info" | "frozen" | "error", { icon: IconName; box: string }> = {
  info: { icon: "info", box: "border-[1.5px] bg-raised" },
  frozen: { icon: "pause", box: "border-[1.5px] bg-frozen" },
  error: { icon: "alert", box: "border-2 bg-raised" },
};

export function Notice({ tone = "info", title, children }: { tone?: "info" | "frozen" | "error"; title: string; children?: ReactNode }) {
  const style = NOTICE[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} data-tone={tone} className={`ql-notice notice-in flex items-start gap-3 rounded-md border-text p-3 ${style.box}`}>
      <Icon name={style.icon} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-label">{title}</p>
        {children !== undefined ? <p className="break-words text-small">{children}</p> : null}
      </div>
    </div>
  );
}

export function Toast({ tone = "success", children }: { tone?: "success" | "info"; children: ReactNode }) {
  const on = tone === "success";
  return (
    <div
      role="status"
      className={`toast-in sticky bottom-[calc(72px+env(safe-area-inset-bottom))] z-10 mx-5 mb-4 flex items-center gap-2 rounded-md p-3 text-label text-surface ${
        on ? "bg-primary" : "bg-text"
      }`}
    >
      <Icon name={on ? "check" : "info"} />
      <span className="flex-1">{children}</span>
    </div>
  );
}

export function EmptyState({
  icon = "list",
  title,
  body,
  action,
}: {
  icon?: IconName;
  title: string;
  body: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <span className="float flex size-18 items-center justify-center rounded-full bg-sunken">
        <Icon name={icon} />
      </span>
      <h2 className="text-h2">{title}</h2>
      <p className="text-small">{body}</p>
      {action !== undefined ? <LinkButton href={action.href}>{action.label}</LinkButton> : null}
    </div>
  );
}

const SKELETON = { line: "h-4", row: "h-14", card: "h-24" } as const;

export function Skeleton({ kinds }: { kinds: Array<keyof typeof SKELETON> }) {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-4">
      {kinds.map((kind, index) => (
        <div key={index} style={{ "--i": index } as CSSProperties} className={`shimmer rounded-sm bg-sunken ${SKELETON[kind]}`} />
      ))}
    </div>
  );
}

export function ErrorBlock({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <>
      <Notice tone="error" title={title}>
        {message}
      </Notice>
      <Button look="secondary" onClick={onRetry}>
        Try again
      </Button>
    </>
  );
}

export function NoProgram({ body, icon }: { body: string; icon?: IconName }) {
  return (
    <EmptyState
      icon={icon}
      title="No active program"
      body={body}
      action={{ label: "Create program", href: "/program/new" }}
    />
  );
}

export function Stepper({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-caption">Step {step} of 3</p>
      <div className="flex gap-1" role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step} aria-label="Enrollment progress">
        {[1, 2, 3].map((i) => (
          <span key={i} className="relative h-1.5 flex-1 overflow-hidden rounded-[3px] bg-sunken">
            <span className="stepper-fill absolute inset-0 rounded-[3px] bg-primary" style={{ "--on": i <= step ? 1 : 0 } as CSSProperties} />
          </span>
        ))}
      </div>
    </div>
  );
}

// ---- Screen frame ----------------------------------------------------------------------------------------------

/** Root screens show the logo; detail screens show a back target and a title. `account={false}` is for the landing page mockups, which have no session. */
export function TopBar({ title, back, chip, tone, account = true }: { title?: string; back?: string; chip?: string; tone?: ChipTone; account?: boolean }) {
  return (
    <header className="drop-in flex h-14 items-center justify-between gap-1 pr-5 pl-1 pt-[env(safe-area-inset-top)]" data-root={back === undefined}>
      {back === undefined ? (
        <Link href="/dashboard" aria-label="TAPat home" className="fade-in ml-4 block h-11 w-[88px] overflow-hidden">
          {/* The icon file is square with wide margins; the top bar slot shows its middle band. */}
          <Image src="/tapat-app-icon-1024.png" alt="" width={88} height={88} className="-mt-[22px] max-w-none mix-blend-darken" priority />
        </Link>
      ) : (
        <>
          <Link href={back} aria-label="Back" className="fade-in flex size-11 shrink-0 items-center justify-center">
            <Icon name="back" />
          </Link>
          <h1 className="fade-in min-w-0 flex-1 truncate text-h2">{title}</h1>
        </>
      )}
      {chip !== undefined ? <Chip tone={tone}>{chip}</Chip> : null}
      {account ? <AccountControl /> : null}
    </header>
  );
}

/** Right-edge account control: a Log in link, or the first name plus role, which opens the account sheet. */
function AccountControl() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  if (user === null) {
    return (
      <Link href="/login" style={{ "--i": 1 } as CSSProperties} className="fade-in flex min-h-11 shrink-0 items-center px-2 text-caption underline">
        Log in
      </Link>
    );
  }
  const firstName = user.displayName.trim().split(/\s+/)[0] ?? user.displayName;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Account: ${user.displayName}`}
        aria-haspopup="dialog"
        style={{ "--i": 1 } as CSSProperties}
        className="fade-in flex min-h-11 shrink-0 items-center gap-1"
      >
        <span className="max-w-[72px] truncate text-caption">{firstName}</span>
        <Chip tone={user.role === "officer" ? "mint" : "outline"}>{user.role}</Chip>
      </button>
      <Sheet title="Account" open={open} onClose={() => setOpen(false)}>
        <KeyValues
          rows={[
            ["Name", user.displayName],
            ["Email", user.email],
            ["Role", user.role],
          ]}
        />
        <Button
          look="secondary"
          onClick={() => {
            setOpen(false);
            void logout();
          }}
        >
          Log out
        </Button>
      </Sheet>
    </>
  );
}

export function Body({ children }: { children: ReactNode }) {
  return <main className="fade-in stagger flex flex-1 flex-col gap-4 px-5 pt-2 pb-6">{children}</main>;
}

/** Floating actions: no band behind them, and the content scrolls underneath. `solid` keeps them in the flow. */
export function Actions({ children, solid = false }: { children: ReactNode; solid?: boolean }) {
  return (
    <div className={`${solid ? "" : "sticky bottom-[calc(76px+env(safe-area-inset-bottom))]"} fade-in z-10 flex flex-col gap-2 px-5 pb-5`}>
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-h2">{children}</h2>;
}

// ---- Sheets ----------------------------------------------------------------------------------------------------

/** A bottom sheet on the native <dialog>, which brings the focus trap, Escape and the inert page for free. */
export function Sheet({ title, open, onClose, children }: { title: string; open: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null || !open) return;
    dialog.showModal();
    // Cleanup also runs when Next hides this route: a modal left open there would make the visible page inert.
    return () => dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      // Not onClose: that also fires for a close from code, which would read as the user dismissing the sheet.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      aria-label={title}
      className="ql-sheet m-0 mx-auto mt-auto max-h-[85dvh] w-full max-w-[430px] overflow-y-auto rounded-t-lg border-[1.5px] border-text bg-surface text-text shadow-sheet"
    >
      <div className="flex flex-col gap-3 px-5 pt-3 pb-8">
        <div className="flex items-center justify-between">
          <span aria-hidden="true" className="mx-auto h-1 w-10 rounded-sm bg-text" />
        </div>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-h2">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex size-11 items-center justify-center">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export function ConfirmSheet({
  open,
  title,
  body,
  confirm,
  cancel,
  busy = false,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirm: string;
  cancel: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Sheet title={title} open={open} onClose={onCancel}>
      {error !== undefined && error !== null ? (
        <Notice tone="error" title="That did not work">
          {error}
        </Notice>
      ) : null}
      <p className="text-small">{body}</p>
      <Button loading={busy} onClick={onConfirm}>
        {confirm}
      </Button>
      <Button look="secondary" disabled={busy} onClick={onCancel}>
        {cancel}
      </Button>
    </Sheet>
  );
}
