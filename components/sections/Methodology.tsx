"use client";

import { usePulse } from "@/lib/usePulse";

/**
 * §2 — Methods. A numbered procedure, because it genuinely IS one. (Numbering is only legitimate
 * when the content is a real sequence; this is.)
 *
 * Every parameter quoted here is one the code actually uses, and the live ones are read from
 * /api/public/pulse rather than typed in.
 */
export function Methodology() {
  const { pulse } = usePulse();

  return (
    <section id="methods" className="section">
      <div className="wrap">
        <div className="section-head">
          <div className="label">§ 2 — Methods</div>
          <div>
            <h2>
              Prices in. <em>Structure out.</em>
            </h2>
            <p className="section-lede">
              Most signals stop at the stock. These start at the edges between them — and no step is
              a black box.
            </p>
          </div>
        </div>

        <div className="methods">
          <div className="method">
            <div className="method-n">2.1</div>
            <div>
              <h3>Returns</h3>
              <p>
                Each stock&apos;s OHLCV is resampled from 1-minute bars to the chosen interval and
                converted to log returns over a trailing window. History begins 2025-01-01; there is
                none before it and we do not pretend otherwise.
              </p>
              <div className="method-param">
                intervals <b>1m · 5m · 15m · 1h · 1d</b> · default window <b>60 bars</b>
              </div>
            </div>
          </div>

          <div className="method">
            <div className="method-n">2.2</div>
            <div>
              <h3>Correlation becomes structure</h3>
              <p>
                Pearson (or Spearman) correlation across the window gives a dense matrix. We
                sparsify it into a graph: a Mantegna minimum spanning tree by default — the 1999
                econophysics construction this whole aesthetic is borrowed from — or kNN, a
                correlation threshold, or the complete graph.
              </p>
              <div className="method-param">
                methods <b>mst · knn · threshold · complete</b> · edges today{" "}
                <b>{pulse?.edges ?? "—"}</b>
              </div>
            </div>
          </div>

          <div className="method">
            <div className="method-n">2.3</div>
            <div>
              <h3>Communities and centrality</h3>
              <p>
                Louvain recovers the communities with a fixed seed, so the same window always yields
                the same partition and cluster ids do not shuffle between calls. Five centrality
                measures then score each stock&apos;s position. Modularity is reported with every
                result so you can judge how real the separation is.
              </p>
              <div className="method-param">
                metrics <b>eigenvector · pagerank · degree · betweenness · closeness</b> · modularity
                today <b>{pulse?.modularity?.toFixed(3) ?? "—"}</b>
              </div>
            </div>
          </div>

          <div className="method">
            <div className="method-n">2.4</div>
            <div>
              <h3>What we did not find</h3>
              <p>
                We tested directed lead-lag across every ordered pair in the universe. Zero of 2,450
                pairs survived a 10% false-discovery-rate null. There is therefore no directional
                claim anywhere in this product, no arrow between two stocks, and no animation
                implying that one leads another. A negative result is still a result, and reporting
                it is cheaper than being caught not reporting it.
              </p>
              <div className="method-param">
                directed pairs tested <b>2,450</b> · surviving FDR-10% <b>0</b>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
