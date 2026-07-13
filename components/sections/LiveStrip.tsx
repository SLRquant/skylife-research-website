"use client";

import { usePulse } from "@/lib/usePulse";
import { clusterInk } from "@/components/graph-stats/colors";

/**
 * Table 1 — the readout. Real numbers from /api/public/pulse, set as a data table.
 *
 * No count-up-on-scroll. A number that animates from 0 to its value is, for the several hundred
 * milliseconds in between, a WRONG NUMBER on screen. In a trading context that is a defect, not a
 * delight. These print instantly, in mono, tabular.
 */
export function LiveStrip() {
  const { pulse, isLoading } = usePulse();
  const dash = isLoading ? "…" : "—";

  return (
    <section className="wrap">
      <div className="readout">
        <div className="readout-cell">
          <div className="label">Universe</div>
          <div className="readout-v">{pulse?.stocks ?? dash}</div>
          <div className="readout-sub">tradable names · {pulse?.universe ?? "NIFTY 50"}</div>
        </div>

        <div className="readout-cell">
          <div className="label">Communities</div>
          <div className="readout-v">{pulse?.communities ?? dash}</div>
          <div className="readout-sub">Louvain · {pulse?.edges ?? dash} edges ({pulse?.method ?? "mst"})</div>
        </div>

        <div className="readout-cell">
          <div className="label">Modularity</div>
          <div className="readout-v sig">{pulse?.modularity?.toFixed(3) ?? dash}</div>
          <div className="readout-sub">
            {pulse == null
              ? " "
              : (pulse.modularity ?? 0) > 0.5
                ? "strong separation"
                : "weak separation"}
          </div>
        </div>

        <div className="readout-cell">
          <div className="label">Most central</div>
          <div className="readout-leaders">
            {pulse?.leaders?.length ? (
              pulse.leaders.map((l) => (
                <span key={l.symbol} className="readout-leader">
                  <span
                    className="swatch"
                    style={{ background: clusterInk(l.community ?? 0) }}
                    aria-hidden="true"
                  />
                  {l.symbol}
                  <em>{l.centrality.toFixed(3)}</em>
                </span>
              ))
            ) : (
              <span className="dim">{dash}</span>
            )}
          </div>
          <div className="readout-sub">eigenvector centrality</div>
        </div>
      </div>
    </section>
  );
}
