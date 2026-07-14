"use client";

import { usePulse } from "@/lib/usePulse";
import { buildClusterScale } from "@/components/graph-stats/colors";

/**
 * The machine's own readout. Every number is real, from /api/public/pulse.
 * The values are amber because they are LIVE MEASURED VALUES — that is the only thing amber
 * is ever allowed to mean on this site.
 */
export function LiveStrip() {
  const { pulse, isLoading } = usePulse();
  const scale = buildClusterScale(pulse?.leaders?.map((l) => l.community) ?? []);

  const asOf = pulse?.asOf
    ? new Date(pulse.asOf).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

  return (
    <div className="wrap">
      <dl className="readout">
        <div className="readout-cell">
          <dt className="label">Universe</dt>
          <dd className="readout-val">{pulse?.universe ?? "NIFTY 50"}</dd>
          <dd className="readout-sub label">
            <span className="sig">{pulse?.stocks ?? "—"}</span> tradable names · NSE
          </dd>
        </div>

        <div className="readout-cell">
          <dt className="label">Communities</dt>
          <dd className="readout-val sig">{pulse?.communities ?? "—"}</dd>
          <dd className="readout-sub label">Louvain · {asOf}</dd>
        </div>

        <div className="readout-cell">
          <dt className="label">Modularity</dt>
          <dd className="readout-val sig">{pulse?.modularity?.toFixed(3) ?? "—"}</dd>
          <dd className="readout-sub label">
            {/* modularity means something — say it, don't write "Optimized" */}
            {pulse ? ((pulse.modularity ?? 0) > 0.5 ? "strong separation" : "weak separation") : "—"}
          </dd>
        </div>

        <div className="readout-cell">
          <dt className="label">Most central</dt>
          <dd className="readout-leaders">
            {pulse?.leaders?.length ? (
              pulse.leaders.map((l) => (
                <span key={l.symbol} className="readout-leader">
                  <span className="chip" style={{ background: scale.color(l.community) }} />
                  {l.symbol}
                  <em className="sig">{l.centrality.toFixed(3)}</em>
                </span>
              ))
            ) : (
              <span className="label">{isLoading ? "computing…" : "—"}</span>
            )}
          </dd>
        </div>
      </dl>
    </div>
  );
}
