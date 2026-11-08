"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";
import { Icon, type IconName } from "./Icon";

const TABS: Array<{ label: string; href: string; icon: IconName; active: (path: string) => boolean }> = [
  {
    label: "Home",
    href: "/dashboard",
    icon: "home",
    active: (p) => ["/dashboard", "/program", "/stations", "/cards", "/activity", "/health"].some((r) => p.startsWith(r)),
  },
  { label: "Masterlist", href: "/intake", icon: "list", active: (p) => p.startsWith("/intake") },
  { label: "Enroll", href: "/enroll", icon: "idcard", active: (p) => p.startsWith("/enroll") },
  { label: "Station", href: "/station/A", icon: "pump", active: (p) => p.startsWith("/station/") },
  { label: "Agents", href: "/demo", icon: "pulse", active: (p) => p.startsWith("/demo") },
];

/**
 * The bar's top edge swelling into a bump concentric with the active tab's raised circle: an arc of
 * radius 27 centred on the circle's centre leaves a uniform 5px bar-coloured gap above it, so the
 * circle reads as a perfect circle, and 9px cubic shoulders blend the arc into the bar edge.
 */
function ActiveCurve() {
  // Bar top edge sits at y=15 (the path runs 1px past it to hide a seam); the circle centre is (37, 27).
  const bump =
    "M0 16V15H7C10.5 15 11.17 15.77 16.32 9.64A27 27 0 0 1 57.68 9.64C62.83 15.77 63.5 15 67 15H74V16Z";
  return (
    <svg aria-hidden="true" width="74" height="16" viewBox="0 0 74 16" className="tab-curve absolute -top-[15px] left-1/2 -translate-x-1/2 overflow-visible">
      <path d={bump} className="fill-raised" />
    </svg>
  );
}

export function TabBar() {
  const path = usePathname();
  // -1 when no tab matches (login, signup): no orb, so no raised circle points at the wrong tab.
  const activeIndex = TABS.findIndex((tab) => tab.active(path));
  // The login and signup screens are full-bleed, with no tab bar.
  if (path === "/login" || path === "/signup") return null;
  return (
    <nav
      aria-label="Main"
      className="fixed bottom-0 left-1/2 z-20 w-full max-w-[430px] -translate-x-1/2 bg-raised pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_0_rgba(27,46,40,0.06),0_-6px_16px_rgba(27,46,40,0.10)]"
    >
      {activeIndex >= 0 ? (
        <span className="tab-orb" style={{ "--tab": activeIndex } as CSSProperties} aria-hidden="true">
          <ActiveCurve />
          <span className="absolute -top-2.5 left-1/2 flex size-11 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-surface shadow-button">
            <Icon key={path} name={TABS[activeIndex].icon} size={28} className="tab-bounce" />
          </span>
        </span>
      ) : null}
      <ul className="flex h-14">
        {TABS.map((tab) => {
          const on = tab.active(path);
          return (
            <li key={tab.label} className="relative flex-1">
              <Link
                href={tab.href}
                aria-current={on ? "page" : undefined}
                className="relative flex h-full flex-col items-center justify-end gap-1 pb-1.5"
              >
                {on ? null : <Icon name={tab.icon} className="text-muted" />}
                <span
                  className={`text-caption transition-colors duration-[var(--motion-fast)] ${on ? "font-semibold text-primary" : "text-muted"}`}
                >
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
