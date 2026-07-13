"use client";

import { usePulse } from "@/lib/usePulse";

/** Every claim here is something the code actually does. */
const STEPS = [
  {
    n: "01",
    title: "Log returns, session-aligned",
    body:
      "Every stock's OHLCV is resampled from 1-minute bars to your interval, then converted to log returns over a trailing window you choose. The window is the single most consequential parameter in the whole pipeline, which is why we let you move it and watch what happens.",
    k: "Intervals",
    v: "1m · 5m · 15m · 1h · 1d",
  },
  {
    n: "02",
    title: "Correlation becomes structure",
    body:
      "Pearson (or Spearman) correlation across the window gives a dense matrix. We sparsify it into a graph — a Mantegna minimum spanning tree by default, or kNN, threshold, or complete. The sparsifier is a choice, and it is yours.",
    k: "Methods",
    v: "MST · kNN · θ · complete",
  },
  {
    n: "03",
    title: "Where each stock sits",
    body:
      "Louvain finds the communities; five centrality measures score each stock's position — eigenvector, PageRank, degree strength, betweenness, closeness. Rebuilt per as-of day, with a fixed seed, so the partition does not shuffle between calls.",
    k: "Metrics",
    v: "5 per stock",
  },
];

export function Methodology() {
  const { pulse } = usePulse();

  return (
    <section id="methodology" className="section">
      <div className="wrap">
        <div className="sec-head">
          <div>
            <span className="label">How it works</span>
            <h2 className="sec-title unfurl">Prices in. Structure out.</h2>
          </div>
          <p className="sec-desc">
            Most signals stop at the stock. Ours start at the edges between them — and no step is
            a black box.
          </p>
        </div>

        <div className="steps">
          {STEPS.map((s, i) => (
            <div className="step" key={s.n}>
              <div className="step-rail">
                <span className="step-n">{s.n}</span>
                {i < STEPS.length - 1 && <span className="step-line" />}
              </div>
              <div className="step-body">
                <h3>{s.title}</h3>
                <p>{s.body}</p>
                <div className="step-metric">
                  <span className="label">{s.k}</span>
                  <span>{s.v}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="coverage">
          <div className="cov">
            <span className="label">Coverage</span>
            <div className="cov-val">NIFTY 50</div>
            <p>
              <span className="sig">{pulse?.stocks ?? "—"}</span> tradable names on NSE. TMPV is
              excluded — it has no price history, and we would rather drop a name than fake one.
            </p>
          </div>
          <div className="cov">
            <span className="label">Granularity</span>
            <div className="cov-val">1-minute</div>
            <p>Resampled to any interval from 1m to 1d. Nothing is interpolated.</p>
          </div>
          <div className="cov">
            <span className="label">History</span>
            <div className="cov-val">2025 →</div>
            <p>
              Rebuilt every session, not backfilled. We have no history before 2025 and we do not
              claim any.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
