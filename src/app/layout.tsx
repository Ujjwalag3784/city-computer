import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

// docs/05-DESIGN-SYSTEM.md §2 — three families, self-hosted via next/font
// (zero layout shift, no third-party request; fixes audit defect 01 A.4 #8,
// Material Symbols/webfont loading). Geist comes from Vercel's own `geist`
// package rather than next/font/google, which doesn't carry it.
//
// JUDGMENT CALL: docs/05 asks for Inter subset "latin + devanagari", but
// Google's Inter distribution does not ship Devanagari glyphs at all (it's
// a Latin/Cyrillic/Greek family) — there is no `devanagari` subset for
// Inter to request. Nepali (ne locale) body text falls back to the next
// font in the stack (see --font-sans in globals.css), which is the
// standard, acceptable pattern here; flagging this rather than silently
// dropping the requirement.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "City Computer Systems",
  description: "Genuine Products. Best Prices. Laptops, PCs, components and repairs in Kathmandu.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`dark ${GeistSans.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
