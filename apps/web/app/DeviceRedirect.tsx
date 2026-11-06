"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DESKTOP_MEDIA, deviceTarget } from "@/lib/device-route";

/** Keeps laptops in /desktop and phones in the mobile app, including links the shared components hardcode to mobile paths. */
export function DeviceRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    const media = window.matchMedia(DESKTOP_MEDIA);
    const go = () => {
      const target = deviceTarget(pathname, media.matches);
      // Velo's checkout return (?budget=) and the login ?next= have to survive the hop.
      if (target !== null) router.replace(`${target}${window.location.search}${window.location.hash}`);
    };
    go();
    media.addEventListener("change", go);
    return () => media.removeEventListener("change", go);
  }, [router, pathname]);
  return null;
}
