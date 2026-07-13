"use client";

import { motion } from "framer-motion";
import { usePulse } from "@/lib/usePulse";
import { CountUp } from "@/components/CountUp";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * How the engine actually works — every claim here is something the code does.
 * (The previous copy advertised a NIFTY-500 universe, 2018 history, and intraday
 * cluster-breakdown alerts. None of those exist.)
 */
const STEPS = [
  {
    n: "01",
    tag: "RETURNS",
    title: "Log returns, session-aligned",
    body:
      "Every stock's OHLCV is resampled from 1-minute bars to your interval, then converted to log returns over a trailing window you choose — 60 bars by default.",
    metric: ["Intervals", "1m → 1w"],
  },
  {
    n: "02",
    tag: "GRAPH",
    title: "Correlation becomes structure",
    body:
      "Pearson (or Spearman) correlation across the window gives a dense matrix. We sparsify it into a graph — a Mantegna minimum spanning tree by default, or kNN, threshold, or complete.",
    metric: ["Methods", "MST · kNN · θ"],
  },
  {
    n: "03",
    tag: "CENTRALITY",
    title: "Where each stock sits",
    body:
      "Louvain finds the communities; five centrality measures score each stock's position — eigenvector, PageRank, degree strength, betweenness, closeness. Rebuilt per as-of day, so you see it move.",
    metric: ["Metrics", "5 per stock"],
  },
];

export function Methodology() {
  const { pulse } = usePulse();

  return (
    <section id="methodology" className="section">
      <div className="wrap">
        <motion.div
          className="sec-head"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <div>
            <div className="sec-eyebrow mono">◉ HOW IT WORKS</div>
            <h2 className="sec-title">
              Prices in. <em>Structure out.</em>
            </h2>
          </div>
          <p className="sec-desc">
            Most signals stop at the stock. Ours start at the{" "}
            <span className="em-strong">edges</span> between them — and no step is a black box.
          </p>
        </motion.div>

        <div className="steps">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              className="step"
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.55, ease: EASE, delay: i * 0.08 }}
            >
              <div className="step-rail">
                <span className="step-n mono">{s.n}</span>
                {i < STEPS.length - 1 && <span className="step-line" />}
              </div>
              <div className="step-body">
                <div className="step-tag mono">{s.tag}</div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
                <div className="step-metric">
                  <span className="mono dim">{s.metric[0]}</span>
                  <b className="mono">{s.metric[1]}</b>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="coverage"
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <div className="cov">
            <div className="cov-label mono">COVERAGE</div>
            <div className="cov-val">NIFTY 50</div>
            <div className="cov-sub">
              <CountUp value={pulse?.stocks} /> tradable names · NSE
            </div>
          </div>
          <div className="cov">
            <div className="cov-label mono">GRANULARITY</div>
            <div className="cov-val">1-minute</div>
            <div className="cov-sub">Resampled to any interval, 1m → 1w</div>
          </div>
          <div className="cov">
            <div className="cov-label mono">HISTORY</div>
            <div className="cov-val">2025 →</div>
            <div className="cov-sub">Rebuilt every session, not backfilled</div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
