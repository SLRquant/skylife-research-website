export function Methodology() {
  return (
    <section id="methodology" className="section">
      <div className="wrap">
        <div className="sec-head">
          <div>
            <div className="sec-eyebrow">◉ Methodology</div>
            <h2 className="sec-title">
              Three capabilities, <em>three outputs.</em>
            </h2>
          </div>
          <p className="sec-desc">
            Most quant signals stop at the stock. Ours start at the{" "}
            <span className="em-strong">edges</span> between them.
          </p>
        </div>
        <div className="caps">
          <div className="cap">
            <div className="cap-tag">◎ 01 · COMMUNITY DETECTION</div>
            <h4>
              Louvain modularity on 30-day returns surfaces today&apos;s cohesive
              clusters — the stocks actually moving together, not just the ones
              in the same NSE sector bucket.
            </h4>
            <div className="cap-metric">
              <span>Rolling window</span>
              <b>30 days</b>
            </div>
          </div>
          <div className="cap">
            <div className="cap-tag">◉ 02 · EIGENVECTOR CENTRALITY</div>
            <h4>
              Rank every stock inside its cluster by centrality to find the
              mover — the one whose price action the rest of the cluster tends
              to follow.
            </h4>
            <div className="cap-metric">
              <span>Per-cluster leaders</span>
              <b>Top 5 ranked</b>
            </div>
          </div>
          <div className="cap">
            <div className="cap-tag">◈ 03 · PORTFOLIO CONCENTRATION</div>
            <h4>
              Measure your book&apos;s single-node dependence via graph
              centrality — not just sector-tag overlap. Find the position that,
              if it breaks, drags the rest with it.
            </h4>
            <div className="cap-metric">
              <span>Exposure surface</span>
              <b>Centrality-weighted</b>
            </div>
          </div>
        </div>

        <div className="coverage">
          <div className="cov">
            <div className="cov-label">Coverage</div>
            <div className="cov-val">NIFTY 500</div>
            <div className="cov-sub">
              Large, mid, and small cap — rebalanced daily
            </div>
          </div>
          <div className="cov">
            <div className="cov-label">Refresh</div>
            <div className="cov-val">Daily · 08:00</div>
            <div className="cov-sub">Pre-market graph refresh, IST</div>
          </div>
          <div className="cov">
            <div className="cov-label">Exchanges</div>
            <div className="cov-val">NSE / BSE</div>
            <div className="cov-sub">Equity cash · FAO</div>
          </div>
        </div>
      </div>
    </section>
  );
}
