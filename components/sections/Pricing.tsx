import Link from "next/link";
import { TIERS } from "@/lib/graph-stats-schema";

/**
 * DEFECT 5 — FIXED.
 *
 * This section used to advertise "Cluster-break alerts (intraday)", a "Co-integrated pairs report"
 * and a "Portfolio risk graph" — while the Platform section one scroll away marked Portfolio
 * Overlap as IN BUILD and the FAQ explicitly said those features don't exist. Selling a quant
 * audience three features your own page disowns is the fastest way to lose them.
 *
 * So: we sell ONLY what the code actually enforces. The real feature ladder is the tier system in
 * `lib/graph-stats-schema.ts` — intervals, graph methods, lookback depth, run count — enforced
 * server-side in `app/api/graph-stats/run/route.ts`. Every row below is READ FROM that same
 * module, so this table cannot drift from what the API will really let you do.
 *
 * Prices are TBD because they are, in fact, TBD.
 */

const fmtList = (xs: readonly string[]) => xs.join(" · ");

export function Pricing() {
  const free = TIERS.free;
  const paid = TIERS.paid;

  return (
    <section id="access" className="section">
      <div className="wrap">
        <div className="section-head">
          <div className="label">§ 4 — Access</div>
          <div>
            <h2>
              What you can <em>actually</em> run.
            </h2>
            <p className="section-lede">
              There is one product — the engine — and two levels of access to it. The rows below are
              read straight out of the tier schema the server enforces, so this table cannot drift
              from what the API will really let you do.
            </p>
          </div>
        </div>

        <div className="tiers">
          <article className="tier">
            <div className="label">Free</div>
            <div className="tier-price">
              ₹0<small> / forever</small>
            </div>
            <dl>
              <dt>Intervals</dt>
              <dd>{fmtList(free.intervals)}</dd>
              <dt>Graph methods</dt>
              <dd>{fmtList(free.graphMethods)}</dd>
              <dt>Lookback</dt>
              <dd>≤ {free.lookbackMax} bars</dd>
              <dt>Symbols</dt>
              <dd>≤ {free.symbolsMax}</dd>
              <dt>Runs</dt>
              <dd>{free.runs ?? "∞"}</dd>
              <dt>CSV export</dt>
              <dd>Yes</dd>
            </dl>
            <Link className="btn" href="/dashboard/graph-stats">
              Run it →
            </Link>
          </article>

          <article className="tier">
            <div className="label">Paid</div>
            <div className="tier-price">
              TBD<small> — not priced yet</small>
            </div>
            <dl>
              <dt>Intervals</dt>
              <dd>{fmtList(paid.intervals)}</dd>
              <dt>Graph methods</dt>
              <dd>{fmtList(paid.graphMethods)}</dd>
              <dt>Lookback</dt>
              <dd>≤ {paid.lookbackMax} bars</dd>
              <dt>Symbols</dt>
              <dd>≤ {paid.symbolsMax}</dd>
              <dt>Runs</dt>
              <dd>Unlimited</dd>
              <dt>CSV export</dt>
              <dd>Yes</dd>
            </dl>
            <Link className="btn btn-solid" href="#contact">
              Talk to us →
            </Link>
          </article>
        </div>

        <p className="notice">
          The paid caps above are the ENGINE&apos;s hard ceilings, not a paywall: a request past
          them cannot be served inside the 60-second function budget. There is no lookback past 300
          bars because there is no data past it — the history begins 2025-01-01.
        </p>

        <p className="notice">
          Skylife Research publishes quantitative research and data. It is not investment advice,
          and a market-structure measurement is not a trading signal — see §5, and the abstract.
        </p>
      </div>
    </section>
  );
}
