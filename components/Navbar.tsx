"use client";

import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "@/lib/firebase/AuthProvider";

/**
 * The masthead of a journal, not the nav bar of a SaaS app.
 * No backdrop-blur, no glass, no pill. One hairline rule and the name of the publication.
 */
export function Navbar() {
  const { user } = useAuth();

  return (
    <header className="masthead">
      <div className="wrap masthead-inner">
        <Link href="/" className="brand" aria-label="Skylife Research — home">
          <span>Skylife Research</span>
          <span className="sub">NSE · NIFTY-50</span>
        </Link>

        <nav className="masthead-nav" aria-label="Primary">
          <Link href="/#figure-1">Fig. 1</Link>
          <Link href="/#methods">Methods</Link>
          <Link href="/network-graph">Graph</Link>
          <Link href="/#access">Access</Link>
          <Link href="/#contact">Contact</Link>
        </nav>

        <div className="masthead-right">
          <ThemeToggle />
          <Link className="btn" href={user ? "/dashboard" : "/auth/sign-in"}>
            {user ? "Dashboard" : "Sign in"}
          </Link>
        </div>
      </div>
    </header>
  );
}
