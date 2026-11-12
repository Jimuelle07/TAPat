import type { ReactNode } from "react";
import { Suspense } from "react";
import { DeviceRedirect } from "../DeviceRedirect";
import { TabBar } from "./_components/TabBar";
import { PhoneFrame } from "./_components/PhoneFrame";
import { AuthProvider, RequireLogin, SignedIn } from "./_components/Auth";
import { QUIET_LIVERY } from "./_components/fonts";

export default function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    // Hidden on laptops, which DeviceRedirect sends to /desktop, so the phone mockup never flashes first.
    <div className={`${QUIET_LIVERY} lg:invisible`}>
      <Suspense fallback={null}>
        <DeviceRedirect />
      </Suspense>
      <PhoneFrame>
        {/* The design is a 390px phone screen; on desktop it renders inside the phone mockup. */}
        <div className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-surface pb-[calc(56px+env(safe-area-inset-bottom))] md:min-h-full">
          <AuthProvider>
            <Suspense fallback={null}>
              <RequireLogin>{children}</RequireLogin>
            </Suspense>
            <SignedIn>
              <Suspense fallback={null}>
                <TabBar />
              </Suspense>
            </SignedIn>
          </AuthProvider>
        </div>
      </PhoneFrame>
    </div>
  );
}
