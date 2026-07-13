"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "./Logo";
import { MarketStatus } from "./MarketStatus";
import { useAuth } from "@/lib/firebase/AuthProvider";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const close = () => setOpen(false);

  return (
    <header className={`site-header${scrolled ? " scrolled" : ""}`}>
      <div className="wrap nav-inner">
        <Logo href="/" />

        <nav className={`nav-links${open ? " open" : ""}`} aria-label="Primary">
          <Link href="/#platform" onClick={close}>Platform</Link>
          <Link href="/network-graph" onClick={close}>Network</Link>
          <Link href="/#methodology" onClick={close}>Method</Link>
          <Link href="/#pricing" onClick={close}>Spec</Link>
          <Link href="/#contact" onClick={close}>Contact</Link>
        </nav>

        <div className="nav-right">
          <MarketStatus />
          <Link className="btn btn-ghost" href={user ? "/dashboard" : "/auth/sign-in"}>
            {user ? "Dashboard" : "Sign in"}
          </Link>
          <button
            className="nav-toggle"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>
    </header>
  );
}
