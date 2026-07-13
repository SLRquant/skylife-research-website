import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Source_Serif_4, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/firebase/AuthProvider";

/* The serif IS the signature. No competitor in dark-quant-SaaS is running one — it reads as
   published research rather than product marketing, which is exactly the posture we want. */
const display = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

/* A paper is READ. Long-form body text is a serif. */
const body = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--font-body",
  display: "swap",
});

/* Mono is for tabular figures, tickers, timestamps and figure captions. NOTHING else. */
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Structure and Its Motion in the Indian Equity Market — Skylife Research",
  description:
    "We rebuild the correlation graph of the NIFTY-50 and measure each stock's position within it. Community structure by Louvain. We make no directional claim: lead-lag does not survive an FDR-10% null.",
  openGraph: {
    title: "Structure and Its Motion in the Indian Equity Market",
    description:
      "Graph-theoretic market-structure research on the NIFTY-50. Run the engine yourself.",
    type: "article",
  },
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f1ea" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f19" },
  ],
};

/**
 * Resolve the theme BEFORE first paint, or the page flashes the wrong stock.
 * Paper is the default; the OS preference and then the user's stored choice override it.
 */
const THEME_BOOT = `
(function(){
  try{
    var s = localStorage.getItem('slr-theme');
    var t = s || (matchMedia('(prefers-color-scheme: dark)').matches ? 'ink' : 'paper');
    document.documentElement.setAttribute('data-theme', t);
  }catch(e){
    document.documentElement.setAttribute('data-theme','paper');
  }
})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="paper"
      className={`${display.variable} ${body.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
