import Link from "next/link";

/**
 * DEFECT 5 FIX.
 *
 * The old pricing table sold "Cluster-break alerts (intraday)", a "Co-integrated pairs report"
 * and a "Portfolio risk graph" — while the Platform section one scroll up marks Portfolio Overlap
 * "IN BUILD" and the FAQ says outright that those features don't exist. Selling three features
 * the same page disowns is the fastest possible way to lose a quant.
 *
 * So this sells exactly what the tier system actually enforces server-side, in
 * `lib/graph-stats-schema.ts` — intervals, graph methods, lookback depth, symbol count, run
 * count — and nothing else. An instrument ships with a spec sheet, not three glowing cards.
 *
 * Prices are TBD because they have not been decided. Inventing one would be the same lie in a
 * different font.
 */

const ROWS: Array<{ k: string; free: string; paid: string }> = [
  { k: "Intervals", free: "1d", paid: "1m · 5m · 15m · 1h · 1d" },
  { k: "Graph methods", free: "MST · kNN", paid: "MST · kNN · threshold · complete" },
  { k: "Correlation", free: "Pearson · Spearman", paid: "Pearson · Spearman" },
  { k: "Max lookback", free: "100 bars", paid: "300 bars" },
  { k: "As-of days per run", free: "10", paid: "10" },
  { k: "Symbols per run", free: "50", paid: "50" },
  { k: "Runs", free: "5", paid: "Unlimited" },
  { k: "Centrality metrics", free: "All 5", paid: "All 5" },
  { k: "CSV export", free: "Yes", paid: "Yes" },
  { k: "Network graph", free: "Yes", paid: "Yes" },
];

export function Pricing() {
  return (
    <section id="pricing" className="section">
      <div className="wrap">
        <div className="sec-head">
          <div>
            <span className="label">Specification</span>
            <h2 className="sec-title unfurl">One engine. Two access levels.</h2>
          </div>
          <p className="sec-desc">
            The ladder is the engine&apos;s own limits — intervals, sparsifiers, window depth, run
            count. There is no second product.
          </p>
        </div>

        <table className="spec">
          <thead>
            <tr>
              <th scope="col">Parameter</th>
              <th scope="col">Free</th>
              <th scope="col">Paid</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Price</th>
              <td className="spec-price">₹0</td>
              <td className="spec-price">TBD</td>
            </tr>
            {ROWS.map((r) => (
              <tr key={r.k}>
                <th scope="row">{r.k}</th>
                <td className={r.free === "—" ? "no" : "yes"}>{r.free}</td>
                <td className="yes">{r.paid}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="spec-foot">
          <Link className="btn btn-primary" href="/dashboard/graph-stats">
            Start on Free
          </Link>
          <Link className="btn btn-ghost" href="#contact">
            Ask about Paid
          </Link>
        </div>

        <p className="note">
          Skylife Research provides quantitative research and data, not investment advice. Graph
          centrality measures market structure — it is a research input, not an entry or exit
          signal. Trading involves risk.
        </p>
      </div>
    </section>
  );
}
