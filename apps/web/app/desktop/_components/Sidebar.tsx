"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/app/(app)/_components/Auth";
import { Icon, type IconName } from "@/app/(app)/_components/Icon";
import { Chip } from "@/app/(app)/_components/ui";

const GROUPS: Array<{ label: string; links: Array<{ label: string; href: string; icon: IconName; match: string }> }> = [
  {
    label: "Program",
    links: [
      { label: "Overview", href: "/desktop", icon: "home", match: "/desktop" },
      { label: "Masterlist", href: "/desktop/intake", icon: "list", match: "/desktop/intake" },
      { label: "Cards", href: "/desktop/cards", icon: "wallet", match: "/desktop/cards" },
      { label: "Stations", href: "/desktop/stations", icon: "pump", match: "/desktop/stations" },
      { label: "Activity", href: "/desktop/activity", icon: "receipt", match: "/desktop/activity" },
    ],
  },
  {
    label: "Operate",
    links: [
      { label: "Agents", href: "/desktop/demo", icon: "pulse", match: "/desktop/demo" },
      { label: "Station terminal", href: "/desktop/station/A", icon: "tap", match: "/desktop/station" },
      { label: "Enroll driver", href: "/desktop/enroll", icon: "idcard", match: "/desktop/enroll" },
      { label: "System health", href: "/desktop/health", icon: "info", match: "/desktop/health" },
    ],
  },
];

function isActive(path: string, match: string): boolean {
  return match === "/desktop" ? path === match : path === match || path.startsWith(`${match}/`);
}

function Account() {
  const { user, logout } = useAuth();
  const button = "flex min-h-11 items-center justify-center rounded-md border-[1.5px] border-text text-label hover:bg-mint";
  if (user === null) {
    return (
      <Link href="/desktop/login" className={button}>
        Log in
      </Link>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-label">{user.displayName}</span>
        <Chip tone={user.role === "officer" ? "mint" : "outline"}>{user.role}</Chip>
      </div>
      <button type="button" onClick={() => void logout()} className={button}>
        Log out
      </button>
    </div>
  );
}

export function Sidebar() {
  const path = usePathname();
  const { user } = useAuth();
  return (
    <aside className="fixed inset-y-0 left-0 flex w-64 flex-col gap-6 overflow-y-auto border-r-[1.5px] border-text bg-raised p-4">
      <Link href="/desktop" aria-label="TAPat home" className="block h-14 w-28 shrink-0 overflow-hidden">
        {/* The icon file is square with wide margins; this slot shows its middle band. */}
        <Image src="/tapat-app-icon-1024.png" alt="" width={112} height={112} className="-mt-7 max-w-none mix-blend-darken" priority />
      </Link>
      <nav aria-label="Main" className="flex flex-1 flex-col gap-6">
        {user !== null && GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-1">
            <h2 className="px-3 pb-1 text-caption text-muted">{group.label}</h2>
            {group.links.map((link) => {
              const on = isActive(path, link.match);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={on ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-label transition-colors duration-[var(--motion-fast)] ${
                    on ? "bg-primary text-surface" : "hover:bg-mint"
                  }`}
                >
                  <Icon name={link.icon} />
                  {link.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <Account />
    </aside>
  );
}
