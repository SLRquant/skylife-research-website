const ITEMS = [
  {
    q: "Can I back-test your signals on my own universe?",
    a: "Yes. Enterprise tier includes a backtest harness that accepts any custom universe (ETF constituents, your own watchlist, thematic baskets) and returns rolling-window modularity, leader lists, and hit-rate statistics back to 2018.",
  },
  {
    q: "What happens when a cluster breaks down mid-day?",
    a: "We monitor intraday correlation drift. Professional and Enterprise get a real-time alert the moment a cluster's internal correlation falls below a calibrated threshold, along with the likely new groupings.",
  },
  {
    q: "Do you front-run your own signals?",
    a: "No. We publish to all subscribers simultaneously and do not operate a prop book on Indian equities. Our compliance note and PMS registration details are available on request.",
  },
  {
    q: "How does Louvain hold up against other community-detection algorithms?",
    a: "In the full methodology note we benchmark Louvain against Leiden, Infomap, and spectral clustering on 2018–2025 NIFTY500 returns. Leiden gives slightly higher stability but similar leader-hit-rate; we default to Louvain for speed at production cadence.",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="section">
      <div className="wrap">
        <div className="sec-head">
          <div>
            <div className="sec-eyebrow">❯ FAQ</div>
            <h2 className="sec-title">
              Skeptical? <em>Good.</em>
            </h2>
          </div>
          <p className="sec-desc">
            The questions every serious trader asks us before they sign up.
          </p>
        </div>
        <div className="faq">
          {ITEMS.map((it) => (
            <details className="faq-item" key={it.q}>
              <summary>
                <span className="faq-q">{it.q}</span>
                <span className="faq-plus">＋</span>
              </summary>
              <div className="faq-a">{it.a}</div>
            </details>
          ))}
        </div>
        <p className="faq-more">
          <a className="link-arrow" href="#">
            Read the full methodology note →
          </a>
        </p>
      </div>
    </section>
  );
}
