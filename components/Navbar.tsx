"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Logo } from "./Logo";
import { MarketStatus } from "./MarketStatus";
import { useAuth } from "@/lib/firebase/AuthProvider";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const closeMenu = () => setOpen(false);

  return (
    <header
      ref={headerRef}
      className={`site-header${scrolled ? " scrolled" : ""}`}
    >
      <div className="wrap nav-inner">
        <Logo href="/" />
        <nav
          className={`nav-links${open ? " open" : ""}`}
          aria-label="Primary"
        >
          <Link href="/#platform" onClick={closeMenu}>
            Platform
          </Link>
          <Link href="/#methodology" onClick={closeMenu}>
            Methodology
          </Link>
          <Link href="/#pricing" onClick={closeMenu}>
            Pricing
          </Link>
          <Link href="/#faq" onClick={closeMenu}>
            Research
          </Link>
          <Link href="/#contact" onClick={closeMenu}>
            Contact
          </Link>
          <Link
            href="/#pricing"
            className="mobile-cta"
            onClick={closeMenu}
          >
            Start 7-day trial →
          </Link>
        </nav>
        <div className="nav-right">
          <MarketStatus />
          {user ? (
            <Link className="btn btn-ghost nav-signin" href="/dashboard">
              Dashboard
            </Link>
          ) : (
            <Link className="btn btn-ghost nav-signin" href="/auth/sign-in">
              Sign in
            </Link>
          )}
          <Link className="btn btn-primary" href="/#pricing">
            Start 7-day trial
          </Link>
          <button
            className={`nav-toggle${open ? " open" : ""}`}
            aria-label="Open menu"
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
