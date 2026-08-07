import Script from "next/script";

/**
 * Two-column list. No accordion chrome — an instrument does not hide its spec behind a
 * disclosure triangle. Honest answers only; the site's best asset is that it says "no".
 *
 * 20 questions, three groups: Methodology, Portfolio & Overlap, General.
 */
const ITEMS = [
  // ── Methodology ──────────────────────────────────────
  {
    q: "What does Skylife Research actually do?",
    a: "We build and publish a live correlation graph of the NIFTY-50. Every trading session, the engine ingests 1-minute OHLCV bars from NSE, computes pairwise correlations over a trailing window, sparsifies the result into a graph, detects communities, and scores each stock on five centrality metrics. The output is a structural map of the market \u2014 who is central, who is peripheral, and how that shifts over time.",
  },
  {
    q: "What is a correlation graph, and why should I care?",
    a: "A correlation graph is a network where each stock is a node and each edge represents how closely two stocks have moved together over a defined window. Traditional analysis looks at stocks one at a time; a graph lets you see which stocks behave as a cluster, which ones bridge clusters, and which are genuinely independent. If you hold five stocks that all sit in the same dense cluster, you own one bet with five tickers.",
  },
  {
    q: "How is correlation calculated?",
    a: "Pearson correlation on log-returns, computed over a trailing window of your chosen length. We also support Spearman (rank) correlation. The window length is the most consequential parameter in the pipeline \u2014 a 30-bar and 120-bar window will share roughly 25% of their strongest edges. We let you move the window and watch what changes, because most vendors pick one and never show you the others.",
  },
  {
    q: "What does the graph actually look like, and how do I read it?",
    a: "On the Network Graph page you see a force-directed layout: each stock is a dot coloured by its Louvain community, and edges connect correlated pairs. Hover a ticker and its influence neighbourhood lights up hop by hop \u2014 a tight cluster flashes at once, a bridge stock lights in slow, thin chains. The position of a node tells you its structural role; the colour tells you its cluster.",
  },
  {
    q: "What do the edge weights mean?",
    a: "Each edge carries the Pearson (or Spearman) correlation coefficient between the two connected stocks over the current window. A weight near 1.0 means the two stocks moved almost identically in that period. After sparsification (MST, kNN, threshold, or complete), only structurally significant edges survive.",
  },
  {
    q: "What are the key metrics you compute, and what do they tell me?",
    a: "Five centrality metrics per stock per as-of day: eigenvector centrality (influence through influential connections), betweenness centrality (how often a stock sits on shortest paths between others), PageRank (recursive importance), degree strength (total weight of all edges), and closeness centrality (how quickly information could spread from this node). Together they answer: is this stock a hub, a bridge, a satellite, or an outlier?",
  },
  {
    q: "What is eigenvector centrality, and why is it your \u201cflagship\u201d metric?",
    a: "Eigenvector centrality scores a stock based not just on how many connections it has, but on how important those connections are. A stock connected to five central banks will score higher than one connected to five peripheral chemicals. It captures systemic influence \u2014 the stocks that, if they move, tend to pull the whole market with them. It\u2019s our flagship because it best reflects structural importance.",
  },
  {
    q: "What is betweenness centrality, and how is it different?",
    a: "Betweenness counts how often a stock lies on the shortest path between every other pair in the graph. High betweenness means the stock is a bridge \u2014 it connects clusters that would otherwise be separate. These bridge stocks are structurally important for a different reason: they transmit shocks between sectors. A stock can have low eigenvector centrality (not in the central cluster) but high betweenness (it connects the central cluster to a peripheral one).",
  },

  // ── Usage & interpretation ───────────────────────────
  {
    q: "How should I use the daily pulse on the homepage?",
    a: "The pulse is a live reading from the engine, not a signal. It tells you the current state of the graph \u2014 how many communities the market has resolved into, the modularity score, the most-central stock, and the most-drifted stock. Use it as a structural check: if the market suddenly drops from 5 communities to 2, correlations are spiking and diversification is collapsing. That\u2019s information.",
  },
  {
    q: "Can this predict the market?",
    a: "No \u2014 and we would rather say so. Graph Stats measures market structure: who is central, who is peripheral, and how that shifts. It is a research input, not a prediction or signal. If someone sells you centrality as alpha, they are skipping several steps. Our job is to show you the structure honestly, including when it is unstable.",
  },

  // ── Data & methodology detail ────────────────────────
  {
    q: "Where does the data come from?",
    a: "1-minute OHLCV bars from the National Stock Exchange (NSE) of India, sourced via Angel Broking\u2019s SmartAPI. The data is for the NIFTY-50 universe \u2014 49 tradable names (TMPV, which has no trading history, is excluded). Data starts from January 2025. There is no history before that, and we do not claim any.",
  },
  {
    q: "How is the correlation window chosen?",
    a: "You choose it. The window is the number of trailing bars used to compute each correlation matrix. A short window (e.g. 30 bars) captures recent regime shifts but is noisy. A long window (e.g. 120 bars) is stabler but smooths out structural changes. There is no universally \u201ccorrect\u201d window \u2014 which is exactly why we let you set it and compare.",
  },
  {
    q: "What is the Louvain algorithm, and is the clustering stable?",
    a: "Louvain is a community-detection algorithm that maximises modularity \u2014 it finds groups of stocks that are more densely connected to each other than to the rest of the graph. It is fast enough to rebuild the graph per as-of day, which makes the time-series product possible. We run it with a fixed seed, so the same window always yields the same partition. Modularity (Q) is reported with every result so you can judge how real the separation is.",
  },
  {
    q: "Do you do lead-lag testing \u2014 who moves before whom?",
    a: "We tested it. Granger causality across all 2,450 directed pairs in the NIFTY-50, with multiple lag structures. After Benjamini-Hochberg false-discovery-rate correction at 10%, zero pairs survive. So there is no lead-lag product, and nothing on this site shows a directed flow between two stocks, because that would imply a relationship our own research rejects.",
  },
  {
    q: "What is Granger causality, and why doesn\u2019t it work here?",
    a: "Granger causality tests whether past values of stock A help predict future values of stock B, beyond what B\u2019s own past predicts. In theory it could reveal lead-lag relationships. In practice, with 2,450 pairs and multiple hypothesis tests, any apparent leads are indistinguishable from noise after FDR correction. We could have shipped it anyway \u2014 most vendors do \u2014 but it would be selling a false positive.",
  },
  {
    q: "What is the false discovery rate correction, and why does it matter?",
    a: "When you run 2,450 statistical tests (one for each directed pair), some will appear \u201csignificant\u201d by chance alone. The Benjamini-Hochberg procedure controls how many of your claimed discoveries are actually false. At a 10% FDR threshold, you accept that up to 10% of your reported pairs may be spurious. Even with this lenient threshold, no pair survives \u2014 which means the lead-lag signal in the NIFTY-50 is indistinguishable from noise.",
  },

  // ── Portfolio & overlap ──────────────────────────────
  {
    q: "What is Portfolio Overlap, and how does graph-based overlap differ from traditional overlap?",
    a: "Traditional portfolio overlap counts shared tickers between two portfolios. Graph-based overlap goes further: if two stocks are in the same Louvain community with high mutual correlation, your portfolio carries concentrated risk even if the tickers are different. Upload your holdings and see how much of your book is the same structural bet wearing different names.",
  },
  {
    q: "Can graph centrality replace traditional diversification analysis?",
    a: "No \u2014 it supplements it. Traditional diversification looks at sector allocation, correlation matrices, and VaR. Graph centrality adds a structural layer: it shows you when stocks that look different (different sectors, different betas) actually occupy the same node neighbourhood in the correlation graph. The two approaches answer different questions, and both are worth asking.",
  },

  // ── General ──────────────────────────────────────────
  {
    q: "How is Skylife Research different from a stock tip or signal service?",
    a: "We do not tip stocks, recommend trades, or provide entry/exit signals. We publish quantitative structural research: the correlation graph, centrality metrics, and community detection results for the NIFTY-50, rebuilt every session. What you do with that information is your decision. The disclaimer is not a legal footnote \u2014 it is the product philosophy.",
  },
  {
    q: "What markets or exchanges does Skylife Research cover?",
    a: "Currently, the NIFTY-50 on the National Stock Exchange (NSE) of India. On request, we run wider universes (NIFTY-500, custom baskets), longer history, additional metrics, and alternative graph methods. These are gated behind a conversation, not a self-serve toggle \u2014 tell us what you need.",
  },
];

/** JSON-LD FAQPage structured data for search engines. */
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: ITEMS.map((it) => ({
    "@type": "Question",
    name: it.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: it.a,
    },
  })),
};

export function FAQ() {
  return (
    <section id="faq" className="section">
      <Script
        id="faq-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

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
