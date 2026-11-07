import type { ReactNode } from "react";
import { Suspense } from "react";
import { AuthProvider, RequireLogin } from "../(app)/_components/Auth";
import { DeviceRedirect } from "../DeviceRedirect";
import { Shell } from "./_components/Shell";
import { Sidebar } from "./_components/Sidebar";

export default function DesktopLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <AuthProvider>
      <Suspense fallback={null}>
        <DeviceRedirect />
      </Suspense>
      <Shell
        sidebar={
          <Suspense fallback={null}>
            <Sidebar />
          </Suspense>
        }
      >
        <Suspense fallback={null}>
          <RequireLogin>{children}</RequireLogin>
        </Suspense>
      </Shell>
    </AuthProvider>
  );
}
