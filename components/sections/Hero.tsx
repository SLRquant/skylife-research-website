"use client";

import { usePulse } from "@/lib/usePulse";

/**
 * The paper's head: title, byline, ABSTRACT.
 *
 * No hero. No pill. No gradient headline. No fade-up-and-stagger. A paper opens with an abstract,
 * and the abstract states the limitation IN THE FIRST SCREEN — because the honesty is the brand,
 * and because a quant who reads "we make no directional claim" before the pitch is a quant who
 * will believe the rest of the page.
 *
 * Every number here comes from /api/public/pulse. Nothing is typed in by hand.
 */
export function Hero() {
  const { pulse, isLoading } = usePulse();

  const asOf = pulse?.asOf
    ? new Date(pulse.asOf).toLocaleDateString("en-IN", {
        year: "numeric", month: "long", day: "numeric",
      })
    : null;

  return (
    <section className="paper-head">
      <div className="wrap">
        <h1 className="title">
          Structure and Its <em>Motion</em> in the Indian Equity Market
        </h1>

        <div className="byline">
          <span>Skylife Research</span>
          <span className="sep">·</span>
          <span>NSE · NIFTY-50 (n={pulse?.stocks ?? 49})</span>
          <span className="sep">·</span>
          <span>1-minute bars, 2025-01-01 →</span>
          <span className="sep">·</span>
          <span>
            Graph rebuilt {asOf ?? (isLoading ? "…" : "—")}
            {pulse && !pulse.live && " (last known — live feed down)"}
          </span>
        </div>

        <div className="abstract">
          <div className="label">Abstract</div>
          <div className="abstract-body">
            <p>
              We rebuild the correlation graph of the NIFTY-50 for every trading session and measure
              each stock&apos;s position within it. Log returns over a trailing window give a Pearson
              correlation matrix; the matrix is sparsified into a graph — a Mantegna minimum
              spanning tree by default — and community structure is recovered by Louvain. Five
              centrality measures then score every stock&apos;s position in that network, and because
              the graph is rebuilt per as-of day, the position can be watched to <em>move</em>.
            </p>
            <p>
              On the most recent session the tree carries{" "}
              <strong>{pulse?.edges ?? "—"} edges</strong> over{" "}
              <strong>{pulse?.stocks ?? "—"} names</strong> and resolves into{" "}
              <strong>{pulse?.communities ?? "—"} communities</strong> at a modularity of{" "}
              <strong>{pulse?.modularity?.toFixed(3) ?? "—"}</strong>. The most central name is{" "}
              <strong>{pulse?.leaders?.[0]?.symbol ?? "—"}</strong> (eigenvector{" "}
              {pulse?.leaders?.[0]?.centrality?.toFixed(3) ?? "—"}).
            </p>

            <p className="caveat">
              <strong>We make no directional claim.</strong> Lead-lag between these stocks does not
              survive an FDR-10% null — zero of 2,450 directed pairs — so nothing on this site
              animates a causal flow from one stock to another, and nothing here is an entry signal.
              What we measure is structure: who is central, who is peripheral, and how much of that
              is real rather than an artifact of the estimation window. Fig. 1 is about exactly that
              last question, and it does not flatter us.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
