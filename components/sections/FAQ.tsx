/**
 * §5 — Discussion. Honest answers only.
 * The previous copy claimed backtests to 2018, a NIFTY-500 benchmark study, intraday
 * cluster-breakdown alerts and a PMS registration. None of those exist.
 */
const ITEMS = [
  {
    q: "Is this a signal I can trade directly?",
    a: "No — and we'd rather say so. Graph Stats measures market structure: who is central, who is peripheral, and how that shifts. It is a research input, not an entry or exit signal. Anyone selling you centrality as alpha is skipping several steps.",
  },
  {
    q: "Why does Fig. 1 sweep the estimation window instead of time?",
    a: "Because that is the sequence the engine can actually produce, and we will not fabricate the one it cannot. The API returns the edge list for the latest as-of date only — there is no parameter that asks for the tree as of a past date — so a true day-by-day sequence of graphs does not exist to be fetched. Sweeping the window does produce a sequence of genuinely recomputed trees, and it answers a sharper question anyway: how much of a stock's network role is a property of the market, and how much is a property of your window? Roughly half the tree's edges change between a 30-bar and a 120-bar window. That is worth knowing before you trust any single frame.",
  },
  {
    q: "What universe and history do you actually cover?",
    a: "The NIFTY-50 — 49 tradable names — on NSE. TMPV is excluded because it has no price history. Underlying data is 1-minute bars from January 2025, resampled to whatever interval you ask for. We do not claim history we do not have.",
  },
  {
    q: "Why Louvain, and is the clustering stable?",
    a: "Louvain is fast enough to rebuild the graph per as-of day, which is what makes the time series possible at all. We run it with a fixed seed, so the same window always yields the same partition. Stability across windows is a different question, and Fig. 1 is our answer to it: the partition moves between six and eight communities as the window widens. We show you that rather than hiding it.",
  },
  {
    q: "Can I run it on my own symbols?",
    a: "Yes. Pass any comma-separated symbol list instead of the default universe, up to 50 names, and the whole pipeline runs on that set.",
  },
  {
    q: "How fresh is the data?",
    a: "The graph is rebuilt from the database on each run. A full-universe query takes roughly 10–15 seconds because it genuinely recomputes every graph in your window rather than serving a cached picture. The figures on this page are cached for an hour so that public traffic cannot bill the engine.",
  },
];

export function FAQ() {
  return (
    <section id="discussion" className="section">
      <div className="wrap">
        <div className="section-head">
          <div className="label">§ 5 — Discussion</div>
          <div>
            <h2>
              Skeptical? <em>Good.</em>
            </h2>
            <p className="section-lede">
              The questions a serious desk asks before it trusts anyone&apos;s numbers.
            </p>
          </div>
        </div>

        <div className="qa">
          {ITEMS.map((it) => (
            <details className="qa-item" key={it.q}>
              <summary>
                <span className="qa-q">{it.q}</span>
                <span className="qa-mark" aria-hidden="true">
                  [+]
                </span>
              </summary>
              <div className="qa-a">{it.a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
