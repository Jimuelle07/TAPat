import type { ReactNode } from "react";

// Desktop (md+): the app sits under public/phone-frame.png and shows through its transparent screen hole.
// Insets and corner radius are measured from the PNG (353×707, screen 24→332 × 15→689).
// The screen box carries a transform so `position: fixed` children (TabBar) pin to the screen, not the window.
// Phone (< md): every wrapper is unstyled, so the app fills the viewport as before.
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="md:flex md:min-h-dvh md:items-center md:justify-center md:p-4">
      <div className="relative md:aspect-[353/707] md:h-[min(820px,calc(100dvh-2rem))]">
        <div className="md:absolute md:left-[6.8%] md:right-[5.95%] md:top-[2.12%] md:bottom-[2.55%] md:overflow-hidden md:rounded-[11.7%/5.3%] md:[transform:translateZ(0)]">
          <div className="no-scrollbar md:h-full md:overflow-y-auto md:overflow-x-hidden">{children}</div>
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-30 hidden md:block"
          style={{ backgroundImage: "url(/phone-frame.png)", backgroundSize: "100% 100%" }}
        />
      </div>
    </div>
  );
}
