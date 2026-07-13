"use client";

import { motion } from "framer-motion";
import { CountUp } from "@/components/CountUp";
import { usePulse } from "@/lib/usePulse";
import { clusterColor } from "@/components/graph-stats/colors";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * The headline numbers — all of them real, pulled from /api/public/pulse.
 * (These used to be hardcoded: "3 clusters", "0.452 modularity". They now reflect the
 * graph the engine actually built this session.)
 */
export function LiveStrip() {
  const { pulse, isLoading } = usePulse();

  const asOf = pulse?.asOf
    ? new Date(pulse.asOf).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <section className="live-strip-wrap">
      <div className="wrap">
        <motion.div
          className="live-strip"
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <div className="live-cell">
            <div className="live-label mono">UNIVERSE</div>
            <div className="live-value">{pulse?.universe ?? "NIFTY 50"}</div>
            <div className="live-delta mono">
              <CountUp value={pulse?.stocks} /> tradable names
            </div>
          </div>

          <div className="live-cell">
            <div className="live-label mono">CLUSTERS TODAY</div>
            <div className="live-value">
              <CountUp value={pulse?.communities} />
            </div>
            <div className="live-delta mono">Louvain · {asOf ?? "—"}</div>
          </div>

          <div className="live-cell">
            <div className="live-label mono">MODULARITY</div>
            <div className="live-value accent">
              <CountUp value={pulse?.modularity} decimals={3} />
            </div>
            <div className="live-delta mono">
              {/* Modularity has a meaning; say it instead of a vague "Optimized". */}
              {pulse && (pulse.modularity ?? 0) > 0.5
                ? "strong separation"
                : "weak separation"}
            </div>
          </div>

          <div className="live-cell">
            <div className="live-label mono">MOST CENTRAL</div>
            <div className="live-leaders">
              {pulse?.leaders?.length ? (
                pulse.leaders.map((l) => (
                  <span key={l.symbol} className="live-leader mono">
                    <span
                      className="live-leader-dot"
                      style={{ background: clusterColor(l.community) }}
                    />
                    {l.symbol}
                    <em>{l.centrality.toFixed(2)}</em>
                  </span>
                ))
              ) : (
                <span className="dim mono">{isLoading ? "computing…" : "—"}</span>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
