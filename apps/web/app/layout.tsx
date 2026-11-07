import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Azeret_Mono, Outfit } from "next/font/google";
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
  preload: false,
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
      <body className="min-h-full">{children}</body>
    </html>
  );
}
