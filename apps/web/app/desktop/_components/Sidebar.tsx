"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, type CSSProperties } from "react";
import { useAuth } from "@/app/(app)/_components/Auth";
import { Icon, type IconName } from "@/app/(app)/_components/Icon";

// The Quiet Livery rail: Program links, a divider, then Operate links. `title` keeps the full name on hover.
const LINKS: Array<{ label: string; title: string; href: string; icon: IconName; match: string }> = [
  { label: "Overview", title: "Overview", href: "/desktop", icon: "home", match: "/desktop" },
  { label: "Masterlist", title: "Masterlist", href: "/desktop/intake", icon: "list", match: "/desktop/intake" },
  { label: "Cards", title: "Cards", href: "/desktop/cards", icon: "wallet", match: "/desktop/cards" },
  { label: "Stations", title: "Stations", href: "/desktop/stations", icon: "pump", match: "/desktop/stations" },
  { label: "Activity", title: "Activity", href: "/desktop/activity", icon: "receipt", match: "/desktop/activity" },
  { label: "Agents", title: "Agents", href: "/desktop/demo", icon: "pulse", match: "/desktop/demo" },
  { label: "Terminal", title: "Station terminal", href: "/desktop/station/A", icon: "tap", match: "/desktop/station" },
  { label: "Enroll", title: "Enroll driver", href: "/desktop/enroll", icon: "idcard", match: "/desktop/enroll" },
  { label: "Health", title: "System health", href: "/desktop/health", icon: "info", match: "/desktop/health" },
];
const OPERATE = 5; // index of the first Operate link
const ITEM = 60; // rail item pitch in px
const DIVIDER = 21; // the divider's height, margins included

function isActive(path: string, match: string): boolean {
  return match === "/desktop" ? path === match : path === match || path.startsWith(`${match}/`);
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function Account() {
  const { user, logout } = useAuth();
  if (user === null) {
    return (
      <Link href="/desktop/login" className="ql-rail-it">
        <Icon name="logout" />
        <span>Log in</span>
      </Link>
    );
  }
  return (
    <div className="ql-rail-account">
      <button type="button" onClick={() => void logout()} className="ql-rail-it" aria-label={`Log out ${user.displayName}`}>
        <Icon name="logout" />
        <span>Log out</span>
      </button>
    </div>
  );
}

export function Sidebar() {
  const path = usePathname();
  const { user } = useAuth();
  const active = LINKS.findIndex((link) => isActive(path, link.match));
  const y = active * ITEM + (active >= OPERATE ? DIVIDER : 0);
  return (
    <aside className="ql-rail fixed inset-y-0 left-0 z-30 flex w-[84px] flex-col items-center overflow-y-auto">
      <Link href="/desktop" aria-label="TAPat home" className="ql-rail-logo">
        <Image src="/tapat-logo.png" alt="" width={64} height={38} priority />
      </Link>
      <nav aria-label="Main" className="ql-rail-items">
        {user !== null ? (
          <>
            {active >= 0 ? <span className="ql-rail-ind" style={{ "--y": `${y}px` } as CSSProperties} aria-hidden="true" /> : null}
            {LINKS.map((link, index) => {
              const on = index === active;
              return (
                <Fragment key={link.href}>
                  {index === OPERATE ? <hr className="ql-rail-div" /> : null}
                  <Link href={link.href} title={link.title} aria-current={on ? "page" : undefined} className="ql-rail-it">
                    <Icon key={on ? "on" : "off"} name={link.icon} className={on ? "ql-rail-pop" : ""} />
                    <span>{link.label}</span>
                  </Link>
                </Fragment>
              );
            })}
          </>
        ) : null}
      </nav>
      <Account />
    </aside>
  );
}
