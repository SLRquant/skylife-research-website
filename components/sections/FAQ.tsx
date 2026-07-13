"use client";

import { motion } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Honest answers only. The previous copy claimed backtests to 2018, a NIFTY-500 benchmark
 * study, intraday cluster-breakdown alerts and a PMS registration — none of which exist.
 * Overclaiming to traders is the fastest way to lose them.
 */
const ITEMS = [
  {
    q: "What universe and history do you actually cover?",
    a: "The NIFTY-50 — 49 tradable names — on NSE. Underlying data is 1-minute bars from January 2025, resampled to whatever interval you ask for (1m, 5m, 15m, 1h, 1d, 1w). We don't claim history we don't have.",
  },
  {
    q: "Can I run it on my own symbols?",
    a: "Yes. Pass any comma-separated symbol list instead of the default universe, up to 50 names, and the whole pipeline runs on that set. Custom universes beyond NIFTY-50 are on the roadmap for Enterprise.",
  },
  {
    q: "Why Louvain, and is the clustering stable?",
    a: "Louvain is fast enough to rebuild the graph per as-of day, which is what makes the time series possible. We run it with a fixed seed, so the same window always yields the same partition — cluster IDs don't shuffle between calls. Modularity is reported with every result so you can judge how real the separation is.",
  },
  {
    q: "Is this a signal I can trade directly?",
    a: "No — and we'd rather say so. Graph Stats measures market structure: who is central, who is peripheral, and how that shifts. It's a research input, not an entry/exit signal. Anyone selling you centrality as alpha is skipping several steps.",
  },
  {
    q: "How fresh is the data?",
    a: "The graph is rebuilt from the database on each run. A full-universe query takes roughly 10–15 seconds because it genuinely recomputes every graph in your window rather than serving a cached picture.",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="section">
      <div className="wrap">
        <motion.div
          className="sec-head"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <div>
            <div className="sec-eyebrow mono">❯ FAQ</div>
            <h2 className="sec-title">
              Skeptical? <em>Good.</em>
            </h2>
          </div>
          <p className="sec-desc">
            The questions a serious desk asks before it trusts anyone&apos;s numbers.
          </p>
        </motion.div>

        <div className="faq">
          {ITEMS.map((it, i) => (
            <motion.details
              className="faq-item"
              key={it.q}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.45, ease: EASE, delay: i * 0.05 }}
            >
              <summary>
                <span className="faq-q">{it.q}</span>
                <span className="faq-plus" aria-hidden="true">
                  ＋
                </span>
              </summary>
              <div className="faq-a">{it.a}</div>
            </motion.details>
          ))}
        </div>
      </div>
    </section>
  );
}
