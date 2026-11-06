import type { ReactNode } from "react";
import { Suspense } from "react";
import { TabBar } from "./_components/TabBar";
import { PhoneFrame } from "./_components/PhoneFrame";
import { AuthProvider } from "./_components/Auth";

export default function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <PhoneFrame>
      {/* The design is a 390px phone screen; on desktop it renders inside the phone mockup. */}
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-surface pb-[calc(56px+env(safe-area-inset-bottom))] md:min-h-full">
        <AuthProvider>
          {children}
          <Suspense fallback={null}>
            <TabBar />
          </Suspense>
        </AuthProvider>
      </div>
    </PhoneFrame>
  );
}
