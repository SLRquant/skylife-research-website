import type { Metadata, Viewport } from "next";
import { Inter_Tight, Martian_Mono } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { AuthProvider } from "@/lib/firebase/AuthProvider";

/** Body. Weight capped at 500 — there is no 700 on this site. */
const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-inter-tight",
  display: "swap",
});

/**
 * DISPLAY *and* DATA. Mono-as-display is the typographic signature: it says "this output was
 * computed" before a single word is read. Martian Mono is variable on both `wght` and `wdth`,
 * which is what lets headings physically EXPAND as they cross the viewport (globals.css .unfurl).
 */
const martianMono = Martian_Mono({
  subsets: ["latin"],
  // no `weight` => the variable font ships whole, which is what exposes `wdth` to the
  // unfurl animation. Declaring weights would subset it to static instances.
  axes: ["wdth"],
  variable: "--font-display-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Skylife Research — The market is not a list.",
  description:
    "Per-stock network centrality on the NIFTY-50, rebuilt from 1-minute bars. Watch the correlation graph re-form as you change the estimation window — and see how much of a stock's structural role is real.",
  openGraph: {
    title: "Skylife Research — The market is not a list.",
    description: "Graph-theoretic market-structure research for the Indian stock market.",
    type: "website",
  },
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = { themeColor: "#0b0f19" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${interTight.variable} ${martianMono.variable}`}>
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-RC0FET1BTG"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-RC0FET1BTG');
          `}
        </Script>
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
