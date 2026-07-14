"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { GraphCanvas, type GEdge, type GNode } from "@/components/GraphCanvas";

/** The whitelist the public route accepts. Nothing else reaches upstream. */
const LOOKBACKS = [30, 40, 50, 60, 75, 90, 105, 120];
const DEFAULT_IDX = 3; // 60 bars

type Meta = {
  modularity?: number;
  clustersDetected?: number;
  asOf?: string;
  lookback?: number;
  fallback?: boolean;
};
type Payload = { nodes: GNode[]; edges: GEdge[]; meta: Meta };

/**
 * THE SIGNATURE — the temporal morph engine, driven by the estimation window.
 *
 * The graph is NEVER re-laid-out from scratch between steps. `GraphCanvas` warm-starts from the
 * previous positions, reheats to alpha 0.15 (not 1.0), and anchors each node to where it was
 * with strength ∝ its stability. So:
 *
 *     stable stocks barely move — stocks whose structural role changed MIGRATE VISIBLY.
 *
 * The axis is the estimation window, not time, and that is a deliberate honesty call: the
 * upstream API returns the edge list for the latest as-of date ONLY, so a real graph-through-time
 * sequence does not exist to be shown. The window axis, by contrast, is entirely real — 62% of
 * the edges change between a 30-bar and a 60-bar window — and it asks the better question:
 * how much of this stock's centrality is signal, and how much is the window you picked?
 */
export function Hero() {
  const [idx, setIdx] = useState(DEFAULT_IDX);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [drift, setDrift] = useState<Array<{ symbol: string; drift: number; stability: number }>>([]);
  const [, setErr] = useState<string | null>(null);
  const cache = useRef<Map<number, Payload>>(new Map());

  const lookback = LOOKBACKS[idx];

  useEffect(() => {
    let abort = false;
    const cached = cache.current.get(lookback);
    if (cached) { setData(cached); setLoading(false); return; }

    setLoading(true);
    fetch(`/api/network-graph?lookback=${lookback}`)
      .then((r) => r.json())
      .then((j: Payload) => {
        if (abort) return;
        if (!Array.isArray(j.nodes)) throw new Error("bad payload");
        cache.current.set(lookback, j);
        setData(j);
        setLoading(false);
      })
      .catch((e) => {
        if (abort) return;
        setErr(e instanceof Error ? e.message : "failed");
        setLoading(false);
      });
    return () => { abort = true; };
  }, [lookback]);

  const onDrift = useCallback(
    (rows: Array<{ symbol: string; drift: number; stability: number }>) => setDrift(rows),
    []
  );

  const migrants = useMemo(() => drift.filter((d) => d.drift > 1).slice(0, 3), [drift]);
  const maxDrift = migrants[0]?.drift ?? 1;

  const meta = data?.meta;
  const live = !!data && !meta?.fallback && data.nodes.length > 0;

  return (
    <section className="hero">
      <div className="wrap">
        {/* ---- the recessed screen bezel: the graph is the page ---- */}
        <div className="bezel">
          <div className="bezel-head">
            <span className="label">
              NIFTY-50 · CORRELATION GRAPH · KNN K=4 · LOUVAIN
            </span>
            <span className="label">
              {live ? (
                <>
                  N <i className="sig">{data!.nodes.length}</i>{"  "}
                  EDGES <i className="sig">{data!.edges.length}</i>{"  "}
                  Q <i className="sig">{meta?.modularity?.toFixed(3) ?? "—"}</i>{"  "}
                  ASOF {meta?.asOf?.slice(0, 10) ?? "—"}
                </>
              ) : loading ? (
                "COMPUTING…"
              ) : (
                "LINK DOWN"
              )}
            </span>
          </div>

          {data && data.nodes.length > 0 ? (
            <GraphCanvas
              nodes={data.nodes}
              edges={data.edges}
              selected={null}
              onSelect={() => {}}
              onDrift={onDrift}
              height={480}
            />
          ) : (
            <div style={{ height: 480, display: "grid", placeItems: "center" }}>
              <span className="label">{loading ? "COMPUTING GRAPH…" : "LIVE GRAPH UNAVAILABLE"}</span>
            </div>
          )}

          {/* ---- the estimation-window dial. Every position is a real, recomputed graph. ---- */}
          <div className="bezel-foot">
            <div className="dial">
              <span className="label">WINDOW</span>
              <input
                type="range"
                min={0}
                max={LOOKBACKS.length - 1}
                step={1}
                value={idx}
                onChange={(e) => setIdx(Number(e.target.value))}
                aria-label="Correlation estimation window, in trailing bars"
              />
              <span className="label" style={{ minWidth: "9ch" }}>
                <i className="sig">{lookback}</i> BARS
              </span>
            </div>

            <div style={{ minWidth: 260 }}>
              <span className="label">
                {migrants.length ? "Migrated" : "Move the dial to measure displacement"}
              </span>
              {migrants.length > 0 && (
                <div className="drift" style={{ marginTop: "var(--space-2)" }}>
                  {migrants.map((m) => (
                    <div key={m.symbol} className="drift-row">
                      <span>{m.symbol}</span>
                      <span className="sig">{Math.round(m.drift)}u</span>
                      <span className="drift-bar">
                        <i style={{ width: `${Math.min(100, (m.drift / maxDrift) * 100)}%` }} />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ---- the words come SECOND. The instrument speaks first. ---- */}
        <h1 className="hero-h">
          The market
          <br />
          is not a list.
        </h1>
        <p className="hero-sub">
          We rebuild the NIFTY-50 correlation graph from 1-minute bars and measure where every
          stock sits inside it. Move the window dial above: between a 30-bar and a 120-bar
          estimate, <strong>75% of the edges change</strong> and the most-central stock is a
          different name entirely. The nodes that barely move are the ones you can believe.
        </p>
        <div className="hero-ctas">
          <Link className="btn btn-primary" href="/dashboard/graph-stats">
            Run the graph
          </Link>
          <Link className="btn btn-ghost" href="/network-graph">
            Today&apos;s clusters
          </Link>
        </div>
      </div>
    </section>
  );
}
