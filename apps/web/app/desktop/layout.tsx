import type { ReactNode } from "react";
import { Suspense } from "react";
import { AuthProvider, RequireLogin } from "../(app)/_components/Auth";
import { Sidebar } from "./_components/Sidebar";

export default function DesktopLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <AuthProvider>
      {/* Hidden on phones, which DeviceRedirect sends to the mobile app. */}
      <div className="desktop-shell min-h-dvh bg-surface pl-64 max-lg:invisible">
        <Suspense fallback={null}>
          <Sidebar />
        </Suspense>
        <Suspense fallback={null}>
          <RequireLogin>{children}</RequireLogin>
        </Suspense>
      </div>
    </AuthProvider>
  );
}
