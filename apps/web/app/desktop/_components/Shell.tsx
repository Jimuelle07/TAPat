"use client";

import { Suspense, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PUBLIC_PATHS } from "@/app/(app)/_components/Auth";

// Hidden on phones, which DeviceRedirect sends to the mobile app.
const FRAME = "desktop-shell min-h-dvh bg-surface max-lg:invisible";

/**
 * The desktop frame; login and signup get no sidebar, since there is nothing to navigate to yet.
 * The pathname is runtime data on dynamic routes (cacheComponents), so it is read inside <Suspense>;
 * the fallback is the empty frame, so the prerendered shell keeps the page background.
 */
export function Shell({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  return (
    <Suspense fallback={<div className={FRAME} />}>
      <Frame sidebar={sidebar}>{children}</Frame>
    </Suspense>
  );
}

function Frame({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  const bare = PUBLIC_PATHS.includes(usePathname());
  return (
    <div className={`${FRAME} ${bare ? "" : "pl-64"}`}>
      {bare ? null : sidebar}
      {children}
    </div>
  );
}
