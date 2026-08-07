import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Plate } from "@/components/Plate";
import { Footer } from "@/components/sections/Footer";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How It Works — Skylife Research",
  description:
    "Every number on this site is computed, not curated. From 1-minute OHLCV bars to correlation graphs, community detection, and five centrality metrics — here is the full methodology.",
  openGraph: {
    title: "How It Works — Skylife Research",
    description:
      "From raw price data to graph-theoretic market structure: the complete Skylife Research methodology.",
    type: "website",
  },
};

const PIPELINE = [
  {
    n: "01",
    title: "The data",
    body: "OHLCV 1-minute bars for the NIFTY-50 universe from NSE, sourced via Angel Broking\u2019s SmartAPI. Resampled to your chosen interval (1m, 5m, 15m, 1h, 1d) and converted to log-returns over a trailing window. No interpolation. No backfill. If a bar is missing, it stays missing. TMPV, which has no trading history, is excluded \u2014 we would rather drop a name than fake one.",
    detail:
      "The window length is the single most consequential parameter in the whole pipeline. A 30-bar and 120-bar window will share roughly 25% of their strongest edges. We let you move the window and watch what changes, because most vendors pick one and never show you the others.",
    k: "Intervals",
    v: "1m \u00b7 5m \u00b7 15m \u00b7 1h \u00b7 1d",
  },
  {
    n: "02",
    title: "Correlation",
    body: "Pearson correlation on log-returns across the trailing window produces a dense 49\u00d749 matrix. We also support Spearman (rank) correlation. Each cell is the co-movement coefficient between two stocks over the current window.",
    detail:
      "The correlation matrix is the raw material. It captures every pairwise relationship in the universe \u2014 but it is noisy and dense. The next step turns it into structure.",
    k: "Estimators",
    v: "Pearson \u00b7 Spearman",
  },
  {
    n: "03",
    title: "Graph construction",
    body: "The dense correlation matrix is sparsified into a weighted graph. Each stock becomes a node; each surviving correlation becomes an edge. The sparsifier controls which edges survive \u2014 it is a modelling choice, and it is yours.",
    detail:
      "Minimum Spanning Tree (Mantegna) keeps the N\u22121 edges that form the cheapest connected tree. kNN connects each node to its k most-correlated neighbours. Threshold keeps all edges above a cutoff. Complete keeps everything. Each method answers a different structural question.",
    k: "Methods",
    v: "MST \u00b7 kNN \u00b7 \u03b8 \u00b7 complete",
  },
  {
    n: "04",
    title: "Community detection",
    body: "The Louvain algorithm partitions the graph into communities \u2014 groups of stocks more densely connected to each other than to the rest. It maximises modularity (Q), which measures how real the separation is. Q > 0.3 is considered meaningful structure.",
    detail:
      "Louvain is fast enough to rebuild the graph per as-of day, which is what makes the time-series product possible. We run it with a fixed seed, so the same input always yields the same partition. Modularity is reported with every result so you can judge the separation yourself.",
    k: "Output",
    v: "Communities \u00b7 Q score",
  },
  {
    n: "05",
    title: "Centrality metrics",
    body: "Five measures score each stock\u2019s position in the graph, rebuilt per as-of day. Together they answer: is this stock a hub, a bridge, a satellite, or an outlier?",
    detail: null,
    k: "Metrics",
    v: "5 per stock",
  },
];

const METRICS = [
  {
    name: "Eigenvector centrality",
    desc: "Measures influence through connections to other influential nodes. A stock connected to five central banks scores higher than one connected to five peripheral chemicals. It captures systemic influence \u2014 the stocks that, if they move, tend to pull the whole market with them. Our flagship metric.",
  },
  {
    name: "Betweenness centrality",
    desc: "Counts how often a stock lies on the shortest path between every other pair in the graph. High betweenness means the stock is a bridge \u2014 it connects clusters that would otherwise be separate. These bridge stocks transmit shocks between sectors.",
  },
  {
    name: "PageRank",
    desc: "Google\u2019s algorithm applied to stock correlations. Recursive importance: a stock is important if important stocks are correlated with it. Differs from eigenvector centrality in how it handles the directed-flow analogy.",
  },
  {
    name: "Degree strength",
    desc: "The sum of all edge weights attached to a stock. Raw connectivity \u2014 how much total correlation this node carries. Simple and interpretable.",
  },
  {
    name: "Closeness centrality",
    desc: "How quickly information could spread from this node to every other node in the graph. A stock with high closeness is structurally \u201cnear\u201d the centre; one with low closeness sits on the periphery.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <Plate />
      <Navbar />
      <main className="hiw-page">
        <div className="wrap">
          {/* ---- hero ---- */}
          <div className="hiw-hero">
            <span className="label">Methodology</span>
            <h1 className="hiw-title unfurl">How it works</h1>
            <p className="hiw-sub">
              Every number on this site is computed, not curated. From 1-minute
              price bars to a correlation graph with five centrality metrics
              &mdash; no step is a black box.
            </p>
          </div>

          {/* ---- pipeline steps ---- */}
          <section className="hiw-section">
            <div className="sec-head">
              <div>
                <span className="label">Pipeline</span>
                <h2 className="sec-title unfurl">
                  Prices in. Structure out.
                </h2>
              </div>
              <p className="sec-desc">
                The full data pipeline, from raw OHLCV bars to the structural
                map you see on the platform.
              </p>
            </div>

            <div className="steps">
              {PIPELINE.map((s, i) => (
                <div className="step" key={s.n}>
                  <div className="step-rail">
                    <span className="step-n">{s.n}</span>
                    {i < PIPELINE.length - 1 && <span className="step-line" />}
                  </div>
                  <div className="step-body">
                    <h3>{s.title}</h3>
                    <p>{s.body}</p>
                    {s.detail && (
                      <p style={{ marginTop: "var(--space-2)" }}>{s.detail}</p>
                    )}
                    <div className="step-metric">
                      <span className="label">{s.k}</span>
                      <span>{s.v}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ---- centrality deep-dive ---- */}
          <section className="hiw-section">
            <div className="sec-head">
              <div>
                <span className="label">Centrality</span>
                <h2 className="sec-title unfurl">
                  Five ways to measure position
                </h2>
              </div>
              <p className="sec-desc">
                Each metric answers a different structural question. No single
                number tells the whole story.
              </p>
            </div>

            <div className="hiw-metrics">
              {METRICS.map((m) => (
                <div className="hiw-metric" key={m.name}>
                  <h3>{m.name}</h3>
                  <p>{m.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ---- lead-lag ---- */}
          <section className="hiw-section">
            <div className="sec-head">
              <div>
                <span className="label">Lead-lag</span>
                <h2 className="sec-title unfurl">
                  And why we don&apos;t ship it
                </h2>
              </div>
              <p className="sec-desc">
                We tested it. Our own research rejects it. So there is no
                lead-lag product.
              </p>
            </div>

            <div className="hiw-text-block">
              <p>
                Granger causality across all 2,450 directed pairs in the
                NIFTY-50, with multiple lag structures. After
                Benjamini-Hochberg false-discovery-rate correction at 10%,{" "}
                <strong>zero pairs survive</strong>.
              </p>
              <p>
                Granger causality tests whether past values of stock A help
                predict future values of stock B, beyond what B&apos;s own past
                predicts. In theory it could reveal lead-lag relationships. In
                practice, with 2,450 pairs and multiple hypothesis tests, any
                apparent leads are indistinguishable from noise after FDR
                correction.
              </p>
              <p>
                We could have shipped it anyway &mdash; most vendors do &mdash;
                but it would be selling a false positive. Nothing on this site
                shows a directed flow between two stocks, because that would
                imply a relationship our own research rejects.
              </p>
            </div>
          </section>

          {/* ---- portfolio overlap ---- */}
          <section className="hiw-section">
            <div className="sec-head">
              <div>
                <span className="label">Portfolio</span>
                <h2 className="sec-title unfurl">Graph-based overlap</h2>
              </div>
              <p className="sec-desc">
                Traditional overlap counts shared tickers. Graph overlap finds
                shared structure.
              </p>
            </div>

            <div className="hiw-text-block">
              <p>
                Traditional portfolio overlap counts shared tickers between two
                portfolios. Graph-based overlap goes further: if two stocks are
                in the same Louvain community with high mutual correlation, your
                portfolio carries concentrated risk even if the tickers are
                different.
              </p>
              <p>
                Upload your holdings and see how much of your book is the same
                structural bet wearing different names. Five stocks in the same
                dense cluster is one bet with five tickers &mdash; and a
                sector-allocation chart won&apos;t show you that.
              </p>
            </div>
          </section>

          {/* ---- CTA ---- */}
          <div className="hiw-cta">
            <p className="sec-desc">
              The engine is running. Set your own window, universe, and metrics
              &mdash; then look.
            </p>
            <div className="hero-ctas">
              <Link href="/dashboard/graph-stats" className="btn btn-primary">
                Open Graph Stats
              </Link>
              <Link href="/network-graph" className="btn">
                Network Graph
              </Link>
              <Link href="/#faq" className="btn btn-ghost">
                Read the FAQ
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
