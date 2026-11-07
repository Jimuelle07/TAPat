"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PUBLIC_PATHS } from "@/app/(app)/_components/Auth";

/** The desktop frame; login and signup get no sidebar, since there is nothing to navigate to yet. */
export function Shell({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  const bare = PUBLIC_PATHS.includes(usePathname());
  return (
    // Hidden on phones, which DeviceRedirect sends to the mobile app.
    <div className={`desktop-shell min-h-dvh bg-surface max-lg:invisible ${bare ? "" : "pl-64"}`}>
      {bare ? null : sidebar}
      {children}
    </div>
  );
}
