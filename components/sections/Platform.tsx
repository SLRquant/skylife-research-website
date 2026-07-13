import Link from "next/link";

/**
 * §3 — the two doors that actually open, and the one that doesn't.
 * No bento. No icon + 3-word heading + 1 line of copy. Two cells and a rule.
 */
export function Platform() {
  return (
    <section id="tools" className="section">
      <div className="wrap">
        <div className="section-head">
          <div className="label">§ 3 — Instruments</div>
          <div>
            <h2>
              Not a report. <em>A machine you run.</em>
            </h2>
            <p className="section-lede">
              Every number on this page came out of the same engine you get access to. Set your own
              window, universe and metrics, then look for yourself.
            </p>
          </div>
        </div>

        <div className="tools">
          <Link href="/dashboard/graph-stats" className="tool">
            <div className="label">Instrument A — live</div>
            <h3>Graph Stats</h3>
            <p>
              Rebuild the correlation graph for every as-of day in your window and track each
              stock&apos;s centrality through time. Five metrics, four graph methods, any symbol set
              up to 50. Export the whole series as CSV.
            </p>
            <span className="tool-cta">Open →</span>
          </Link>

          <Link href="/network-graph" className="tool">
            <div className="label">Instrument B — live, public</div>
            <h3>Network Graph</h3>
            <p>
              Today&apos;s tree as a full plate. Hover a stock to trace its neighbourhood hop by
              hop; move the estimation window and watch which stocks hold their position and which
              were never really there.
            </p>
            <span className="tool-cta">Open →</span>
          </Link>

          <div className="tool soon">
            <div className="label">Instrument C — in build</div>
            <h3>Portfolio Overlap</h3>
            <p>
              Upload your book and see how much of it is the same bet wearing different tickers.
              This does not exist yet, so we are not selling it — see §4.
            </p>
            <span className="tool-cta">Not shipped</span>
          </div>
        </div>
      </div>
    </section>
  );
}
