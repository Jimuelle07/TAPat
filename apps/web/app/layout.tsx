import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { Azeret_Mono, Outfit } from "next/font/google";
import { TabBar } from "./_components/TabBar";
import { PhoneFrame } from "./_components/PhoneFrame";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const azeret = Azeret_Mono({
  variable: "--font-azeret",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "TAPat",
  description: "TAPat — fuel aid released, capped, and returned on-chain",
};

export const viewport: Viewport = {
  themeColor: "#fbf5e3",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${outfit.variable} ${azeret.variable} h-full antialiased`}>
      <body className="min-h-full">
        <PhoneFrame>
          {/* The design is a 390px phone screen; on desktop it renders inside the phone mockup. */}
          <div className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-surface pb-[calc(56px+env(safe-area-inset-bottom))] md:min-h-full">
            {children}
            <Suspense fallback={null}>
              <TabBar />
            </Suspense>
          </div>
        </PhoneFrame>
      </body>
    </html>
  );
}
