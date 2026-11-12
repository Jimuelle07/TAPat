import { Fraunces, IBM_Plex_Mono, Inter } from "next/font/google";

// Quiet Livery faces, loaded only by the app's layouts so the landing page keeps its own set.
const display = Fraunces({ variable: "--font-ql-display", subsets: ["latin"], axes: ["SOFT", "opsz"], display: "swap" });
const sans = Inter({ variable: "--font-ql-sans", subsets: ["latin"], display: "swap" });
const mono = IBM_Plex_Mono({ variable: "--font-ql-mono", subsets: ["latin"], weight: ["400", "500"], display: "swap" });

/** Class names for the app's root: the three font variables plus the `quiet-livery` scope that styles everything inside. */
export const QUIET_LIVERY = `quiet-livery ${display.variable} ${sans.variable} ${mono.variable}`;
