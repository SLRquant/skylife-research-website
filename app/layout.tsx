import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/firebase/AuthProvider";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter-tight",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Skylife Research — Trade the Hidden Network",
  description:
    "Daily community-detection signals on NIFTY500 — powered by graph theory and eigenvector centrality. Delivered as a feed, dashboard, or API.",
  openGraph: {
    title: "Skylife Research — Trade the Hidden Network",
    description:
      "Graph-theory-powered quantitative research for the Indian stock market.",
    type: "website",
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#05070d",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${interTight.variable} ${plexMono.variable} js-ready`}
    >
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
