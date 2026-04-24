import Link from "next/link";
import { NetworkGraph } from "@/components/NetworkGraph";
import { TerminalTicker, AlphaRow } from "@/components/TerminalTicker";
import { RunStamp } from "@/components/RunStamp";

export function Hero() {
  return (
    <section className="hero">
      <div className="wrap">
        <div className="eyebrow">
          <span className="eb-primary">● QUANTITATIVE RESEARCH</span>
          <span className="sep">/</span>
          <span>NSE · BSE</span>
          <span className="sep">/</span>
          <RunStamp />
        </div>
        <div className="hero-grid">
          <div className="hero-copy">
            <h1 className="hero-h">
              The Indian market is a <em>network.</em>
              <br />
              <span className="muted-h">
                We trade the edges between stocks.
              </span>
            </h1>
            <p className="hero-sub">
              Daily community-detection signals on NIFTY500, powered by graph
              theory and eigenvector centrality — delivered as a feed,
              dashboard, or API.
            </p>
            <div className="hero-ctas">
              <Link className="btn btn-primary btn-lg" href="#pricing">
                For individual traders <span className="arr">→</span>
              </Link>
              <Link className="btn btn-ghost btn-lg" href="/network-graph">
                Open network graph <span className="arr">→</span>
              </Link>
              <Link className="link-arrow" href="#contact">
                Book a 20-min walkthrough →
              </Link>
            </div>
          </div>
          <div className="hero-side">
            <div
              className="terminal"
              role="figure"
              aria-label="Live NIFTY500 graph analysis"
            >
              <div className="term-head">
                <span className="term-dot" />
                <span className="term-dot" />
                <span className="term-dot g" />
                <span className="term-title">
                  skylife://live · nifty500.clusters
                </span>
              </div>
              <div className="term-body">
                <div className="row">
                  <span className="dim">
                    &gt; run detect --window 30d --algo louvain
                  </span>
                  <span className="c">OK</span>
                </div>
                <TerminalTicker />
                <NetworkGraph />
                <div className="row hi">
                  <span>TOP_LEADER</span>
                  <span className="c">RELIANCE · centrality 0.84</span>
                </div>
                <div className="row">
                  <span>cluster_01.size</span>
                  <span>12 stocks</span>
                </div>
                <div className="row">
                  <span>cluster_01.beta</span>
                  <span className="g">+1.24</span>
                </div>
                <AlphaRow />
                <div className="row">
                  <span className="dim">$ stream --tail</span>
                  <span className="caret">▊</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
