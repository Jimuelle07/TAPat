"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";

const TABS: Array<{ label: string; href: string; icon: IconName; active: (path: string) => boolean }> = [
  {
    label: "Home",
    href: "/",
    icon: "home",
    active: (p) => p === "/" || ["/program", "/stations", "/cards", "/activity", "/health"].some((r) => p.startsWith(r)),
  },
  { label: "Masterlist", href: "/intake", icon: "list", active: (p) => p.startsWith("/intake") },
  { label: "Enroll", href: "/enroll", icon: "idcard", active: (p) => p.startsWith("/enroll") },
  { label: "Station", href: "/station/A", icon: "pump", active: (p) => p.startsWith("/station/") },
  { label: "Agents", href: "/demo", icon: "pulse", active: (p) => p.startsWith("/demo") },
];

/** The bar's top edge rising in an arc over the active tab's raised circle. */
function ActiveCurve() {
  const curve =
    "M0 11C5 11 7 9.7 9.32 7.32C14.01 2.63 20.37 0 27 0C33.63 0 39.99 2.63 44.68 7.32C47 9.7 49 11 54 11";
  return (
    <svg aria-hidden="true" width="54" height="13" viewBox="0 0 54 13" className="absolute -top-[11.75px] left-1/2 -translate-x-1/2 overflow-visible">
      <path d={`${curve}V13H0Z`} className="fill-raised" />
    </svg>
  );
}

export function TabBar() {
  const path = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed bottom-0 left-1/2 z-20 w-full max-w-[430px] -translate-x-1/2 bg-raised pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_12px_rgb(27_46_40_/_0.08)]"
    >
      <ul className="flex h-14">
        {TABS.map((tab) => {
          const on = tab.active(path);
          return (
            <li key={tab.label} className="relative flex-1">
              {on ? <ActiveCurve /> : null}
              <Link
                href={tab.href}
                aria-current={on ? "page" : undefined}
                className="relative flex h-full flex-col items-center justify-end gap-1 pb-1.5"
              >
                {on ? (
                  <span className="absolute -top-2.5 flex size-11 items-center justify-center rounded-full bg-primary text-surface shadow-button">
                    <Icon name={tab.icon} size={28} />
                  </span>
                ) : (
                  <Icon name={tab.icon} className="text-muted" />
                )}
                <span className={on ? "text-caption font-semibold text-primary" : "text-caption text-muted"}>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
