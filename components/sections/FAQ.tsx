/**
 * Two-column list. No accordion chrome — an instrument does not hide its spec behind a
 * disclosure triangle. Honest answers only; the site's best asset is that it says "no".
 */
const ITEMS = [
  {
    q: "What universe and history do you cover?",
    a: "The NIFTY-50 — 49 tradable names — on NSE. Underlying data is 1-minute bars from January 2025, resampled to whatever interval you ask for. There is no history before 2025 and we don't claim any.",
  },
  {
    q: "Why does the graph change so much when I move the window?",
    a: "Because correlation is estimated, not observed. Between a 30-bar and a 120-bar window, 75% of the edges in this graph change and the most-central stock goes from JIOFIN to BAJAJFINSV. That instability is not a bug in our pipeline — it is a property of the data, and most vendors simply pick one window and never show you the others.",
  },
  {
    q: "Is this a signal I can trade directly?",
    a: "No — and we'd rather say so. Graph Stats measures market structure: who is central, who is peripheral, and how that shifts. It's a research input, not an entry/exit signal. Anyone selling you centrality as alpha is skipping several steps.",
  },
  {
    q: "Do you model lead-lag — who moves before whom?",
    a: "No, and we won't. We tested it: of 2,450 directed pairs, zero survive a 10% false-discovery-rate null. So there is no lead-lag product, and nothing on this site animates a directed flow between two stocks, because that would imply a relationship our own research rejects.",
  },
  {
    q: "Can I run it on my own symbols?",
    a: "Yes. Pass any comma-separated symbol list instead of the default universe, up to 50 names, and the whole pipeline runs on that set.",
  },
  {
    q: "Why Louvain, and is the clustering stable?",
    a: "Louvain is fast enough to rebuild the graph per as-of day, which is what makes the time series possible. We run it with a fixed seed, so the same window always yields the same partition. Modularity is reported with every result so you can judge how real the separation is.",
  },
  {
    q: "How fresh is the data?",
    a: "The graph is rebuilt from the database on each run. A full-universe query takes roughly 10–15 seconds because it genuinely recomputes every graph in your window rather than serving a cached picture.",
  },
  {
    q: "What happens if the engine is down?",
    a: "The page says so. It will not fall back to invented placeholder numbers dressed up as today's market — an earlier version of this site did exactly that, and it was wrong.",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="section">
      <div className="wrap">
        <div className="sec-head">
          <div>
            <span className="label">FAQ</span>
            <h2 className="sec-title unfurl">Skeptical? Good.</h2>
          </div>
          <p className="sec-desc">
            The questions a serious desk asks before it trusts anyone&apos;s numbers.
          </p>
        </div>

        <div className="faq">
          {ITEMS.map((it) => (
            <div className="faq-item" key={it.q}>
              <h3 className="faq-q">{it.q}</h3>
              <p className="faq-a">{it.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
