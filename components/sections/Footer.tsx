"use client";

import Link from "next/link";
import { Logo } from "@/components/Logo";
import { usePulse } from "@/lib/usePulse";

export function Footer() {
  const { pulse } = usePulse();

  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="foot-top">
          <div>
            <Logo href="/" />
            <p className="foot-desc">
              Graph-theoretic market-structure research for the Indian stock market. We publish
              what the engine computes, including when it disagrees with us.
            </p>
          </div>
          <div className="foot-col">
            <h5 className="label">Platform</h5>
            <Link href="/dashboard/graph-stats">Graph Stats</Link>
            <Link href="/network-graph">Network Graph</Link>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/#pricing">Specification</Link>
          </div>
          <div className="foot-col">
            <h5 className="label">Method</h5>
            <Link href="/#methodology">Methodology</Link>
            <Link href="/#faq">FAQ</Link>
            <Link href="/#contact">Contact</Link>
          </div>
          <div className="foot-col">
            <h5 className="label">Connect</h5>
            <a
              href="https://www.linkedin.com/company/skylife-research/"
              target="_blank"
              rel="noopener noreferrer"
            >
              LinkedIn ↗
            </a>
            <a href="mailto:aakashk@skyliferesearch.com?cc=sagark@skyliferesearch.com">
              Email us
            </a>
            <a
              href="https://developers.skyliferesearch.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              Developer docs ↗
            </a>
          </div>
          <div className="foot-col">
            <h5 className="label">Legal</h5>
            <a href="#">Terms</a>
            <a href="#">Privacy</a>
            <a href="#">Disclaimer</a>
          </div>
        </div>

        <div className="foot-bot">
          <span className="label">© 2026 Skylife Research · Mumbai</span>
          {/* the footer stamp is a real reading, not a fake build number */}
          <span className="label">
            {pulse?.live ? (
              <>
                ENGINE UP · N <i className="sig">{pulse.stocks}</i> · Q{" "}
                <i className="sig">{pulse.modularity?.toFixed(3) ?? "—"}</i> · ASOF{" "}
                {pulse.asOf?.slice(0, 10) ?? "—"}
              </>
            ) : (
              "ENGINE — AWAITING LINK"
            )}
          </span>
        </div>
      </div>
    </footer>
  );
}
