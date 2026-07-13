"use client";

import Link from "next/link";
import { usePulse } from "@/lib/usePulse";

/**
 * Engineering-schematic diagrams — boxes, arrows, labels, drawn on the grid — instead of the
 * icon + three-word-heading + one-line-of-copy bento that every dark dev-tool site ships.
 * The glyphs are drawn here, by hand, in the product's own vocabulary. No icon library.
 */

function SchemaSeries() {
  return (
    <svg viewBox="0 0 220 64" fill="none" aria-hidden="true">
      <path d="M0 52h220" stroke="rgba(255,255,255,.12)" />
      <path d="M4 46 L40 34 L76 38 L112 20 L148 26 L184 10 L216 14"
            stroke="#a8adb8" strokeWidth="1.25" />
      <path d="M4 50 L40 48 L76 44 L112 46 L148 40 L184 42 L216 38"
            stroke="#009fc1" strokeWidth="1.25" />
      <path d="M4 42 L40 44 L76 30 L112 36 L148 32 L184 34 L216 28"
            stroke="#924a87" strokeWidth="1.25" />
      {[4, 40, 76, 112, 148, 184, 216].map((x) => (
        <path key={x} d={`M${x} 52v4`} stroke="rgba(255,255,255,.22)" />
      ))}
    </svg>
  );
}

function SchemaGraph() {
  const n: Array<[number, number]> = [
    [30, 16], [70, 34], [40, 50], [110, 20], [150, 42], [190, 22], [180, 52], [120, 52],
  ];
  const e: Array<[number, number]> = [[0, 1], [1, 2], [1, 3], [3, 4], [4, 5], [4, 6], [4, 7], [2, 7]];
  return (
    <svg viewBox="0 0 220 64" fill="none" aria-hidden="true">
      {e.map(([a, b], i) => (
        <path key={i} d={`M${n[a][0]} ${n[a][1]} L${n[b][0]} ${n[b][1]}`}
              stroke="rgba(255,255,255,.28)" />
      ))}
      {n.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3.5"
                fill={i === 4 || i === 1 ? "#009c85" : "#536fbd"} />
      ))}
      <circle cx="150" cy="42" r="9" stroke="rgba(255,255,255,.45)" fill="none" />
    </svg>
  );
}

function SchemaOverlap() {
  return (
    <svg viewBox="0 0 220 64" fill="none" aria-hidden="true">
      <rect x="46" y="12" width="60" height="40" stroke="rgba(255,255,255,.28)" />
      <rect x="86" y="12" width="60" height="40" stroke="rgba(255,255,255,.28)" />
      <rect x="86" y="12" width="20" height="40" fill="rgba(255,255,255,.10)" />
      <path d="M96 4v56" stroke="rgba(255,255,255,.22)" strokeDasharray="2 3" />
    </svg>
  );
}

export function Platform() {
  const { pulse } = usePulse();

  return (
    <section id="platform" className="section">
      <div className="wrap">
        <div className="sec-head">
          <div>
            <span className="label">The instruments</span>
            <h2 className="sec-title unfurl">Not a report. A machine you run.</h2>
          </div>
          <p className="sec-desc">
            Every number on this page came out of the same engine you get access to. Set your own
            window, universe, and metrics — then look.
          </p>
        </div>

        <div className="schema">
          <Link href="/dashboard/graph-stats" className="schema-cell">
            <div className="schema-top">
              <span className="label">01 / Flagship</span>
              <span className="label">Live</span>
            </div>
            <div className="schema-dia"><SchemaSeries /></div>
            <h3>Graph Stats</h3>
            <p>
              Rebuild the correlation graph for every as-of day in your window and track each
              stock&apos;s centrality through it. Five metrics, four graph methods, any symbol set.
              Export the whole series.
            </p>
            <div className="schema-foot">
              <span className="label">
                Metrics 5 · Stocks <i className="sig">{pulse?.stocks ?? "—"}</i>
              </span>
              <span className="label">Open →</span>
            </div>
          </Link>

          <Link href="/network-graph" className="schema-cell">
            <div className="schema-top">
              <span className="label">02 / Visual</span>
              <span className="label">Live</span>
            </div>
            <div className="schema-dia"><SchemaGraph /></div>
            <h3>Network Graph</h3>
            <p>
              Today&apos;s clusters as a force-directed plate. Hover a ticker and its influence
              neighbourhood lights up hop by hop — a tight cluster flashes at once, a bridge lights
              in slow, thin chains.
            </p>
            <div className="schema-foot">
              <span className="label">
                Communities <i className="sig">{pulse?.communities ?? "—"}</i>
              </span>
              <span className="label">Open →</span>
            </div>
          </Link>

          {/* Honest: not built. Don't advertise a door that doesn't open. */}
          <div className="schema-cell off">
            <div className="schema-top">
              <span className="label">03 / Portfolio</span>
              <span className="label">In build</span>
            </div>
            <div className="schema-dia"><SchemaOverlap /></div>
            <h3>Portfolio Overlap</h3>
            <p>
              Upload your book and see how much of it is the same bet wearing different tickers.
              Not shipped yet — so we are not selling it.
            </p>
            <div className="schema-foot">
              <span className="label">Not available</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
