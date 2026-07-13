"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Plate } from "@/components/Plate";
import { GraphCanvas, type GEdge, type GNode } from "@/components/GraphCanvas";
import { buildClusterScale } from "@/components/graph-stats/colors";

const LOOKBACKS = [30, 40, 50, 60, 75, 90, 105, 120];

type Meta = {
  universe?: string;
  method?: string;
  lookback?: number;
  clustersDetected?: number;
  modularity?: number;
  asOf?: string;
  fallback?: boolean;
};
type Node = GNode & { name?: string; raw?: number };
type Payload = { nodes: Node[]; edges: GEdge[]; meta: Meta };

export function NetworkGraphTool() {
  const [idx, setIdx] = useState(3); // 60 bars
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [drift, setDrift] = useState<Array<{ symbol: string; drift: number; stability: number }>>([]);
  const cache = useRef<Map<number, Payload>>(new Map());

  const lookback = LOOKBACKS[idx];

  useEffect(() => {
    let abort = false;
    const hit = cache.current.get(lookback);
    if (hit) { setData(hit); setLoading(false); return; }
    setLoading(true);
    fetch(`/api/network-graph?lookback=${lookback}`)
      .then((r) => r.json())
      .then((j: Payload) => {
        if (abort) return;
        if (!Array.isArray(j.nodes)) throw new Error("Malformed graph response");
        cache.current.set(lookback, j);
        setData(j);
        setError(null);
        setLoading(false);
      })
      .catch((e) => {
        if (abort) return;
        setError(e instanceof Error ? e.message : "Failed to load");
        setLoading(false);
      });
    return () => { abort = true; };
  }, [lookback]);

  const onDrift = useCallback(
    (rows: Array<{ symbol: string; drift: number; stability: number }>) => setDrift(rows),
    []
  );

  const scale = useMemo(
    () => buildClusterScale(data?.nodes.map((n) => n.cluster) ?? []),
    [data]
  );

  const node = data?.nodes.find((n) => n.id === selected) ?? null;

  const neighbours = useMemo(() => {
    if (!data || !node) return [];
    const out: Array<{ n: Node; w: number }> = [];
    for (const e of data.edges) {
      const other =
        e.source === node.id ? e.target : e.target === node.id ? e.source : null;
      if (!other) continue;
      const nn = data.nodes.find((x) => x.id === other);
      if (nn) out.push({ n: nn, w: Math.abs(e.corr ?? e.weight) });
    }
    return out.sort((a, b) => b.w - a.w).slice(0, 8);
  }, [data, node]);

  const migrants = drift.filter((d) => d.drift > 1).slice(0, 6);
  const maxDrift = migrants[0]?.drift ?? 1;
  const anchored = [...drift].reverse().filter((d) => d.stability > 0).slice(0, 3);

  return (
    <>
      <Plate />
      <Navbar />
      <main className="tool-page">
        <div className="wrap">
          <header className="tool-header">
            <div>
              <span className="label">Live tool / NIFTY-50 correlation network</span>
              <h1 className="tool-title">Network Graph</h1>
              <p className="tool-sub">
                Node size is eigenvector centrality; an edge is a kNN link on |ρ| over the trailing
                window; communities are Louvain. Move the window dial and the plate re-forms —
                it does not re-draw. Nodes hold their position in proportion to how little their
                structural role changed, so whatever <strong>moves</strong> is telling you its
                centrality was an artefact of the window.
              </p>
            </div>
            <Link href="/" className="btn btn-ghost">← Back</Link>
          </header>

          <div className="bezel">
            <div className="bezel-head">
              <span className="label">
                {data?.meta.method ?? "knn k=4 · pearson · Louvain"}
              </span>
              <span className="label">
                {data && !data.meta.fallback ? (
                  <>
                    N <i className="sig">{data.nodes.length}</i>{"  "}
                    EDGES <i className="sig">{data.edges.length}</i>{"  "}
                    K <i className="sig">{data.meta.clustersDetected ?? "—"}</i>{"  "}
                    Q <i className="sig">{data.meta.modularity?.toFixed(3) ?? "—"}</i>{"  "}
                    ASOF {data.meta.asOf?.slice(0, 10) ?? "—"}
                  </>
                ) : loading ? "COMPUTING…" : "LINK DOWN"}
              </span>
            </div>

            {data && data.nodes.length > 0 ? (
              <GraphCanvas
                nodes={data.nodes}
                edges={data.edges}
                selected={selected}
                onSelect={setSelected}
                onDrift={onDrift}
                height={620}
              />
            ) : (
              <div style={{ height: 620, display: "grid", placeItems: "center" }}>
                <span className="label">
                  {loading
                    ? "COMPUTING GRAPH…"
                    : error
                      ? `FAILED — ${error}`
                      : "LIVE GRAPH UNAVAILABLE"}
                </span>
              </div>
            )}

            <div className="bezel-foot">
              <div className="dial">
                <span className="label">Estimation window</span>
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
            </div>
          </div>

          {/* ---- the morph's own output. Displacement IS the information. ---- */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", marginTop: "var(--space-4)" }}>
            <div className="panel">
              <div className="panel-head">
                <span className="label">Migrated most on the last window change</span>
                <span className="label">Δ position</span>
              </div>
              <div className="panel-body">
                {migrants.length ? (
                  <div className="drift">
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
                ) : (
                  <p className="label">Move the window dial to measure displacement.</p>
                )}
                {anchored.length > 0 && (
                  <p className="label" style={{ marginTop: "var(--space-3)" }}>
                    Held position: {anchored.map((a) => a.symbol).join(" · ")}
                  </p>
                )}
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">
                <span className="label">{node ? node.symbol : "Communities"}</span>
                <span className="label">
                  {node ? scale.label(node.cluster) : `${data?.meta.clustersDetected ?? "—"} detected`}
                </span>
              </div>
              <div className="panel-body">
                {node ? (
                  <>
                    <div className="drift-row" style={{ borderBottom: "1px solid var(--rule-3)" }}>
                      <span className="label">Eigenvector centrality</span>
                      <span className="sig">{(node.raw ?? node.centrality).toFixed(4)}</span>
                      <span />
                    </div>
                    <p className="label" style={{ margin: "var(--space-3) 0 var(--space-2)" }}>
                      Strongest edges
                    </p>
                    {neighbours.map((x) => (
                      <div key={x.n.id} className="drift-row">
                        <span>
                          <span className="gs-dot" style={{ background: scale.color(x.n.cluster) }} />
                          {x.n.symbol}
                        </span>
                        <span className="sig">{x.w.toFixed(3)}</span>
                        <span className="drift-bar">
                          <i style={{ width: `${Math.min(100, x.w * 100)}%` }} />
                        </span>
                      </div>
                    ))}
                    <button className="btn btn-ghost" style={{ marginTop: "var(--space-3)" }} onClick={() => setSelected(null)}>
                      Clear
                    </button>
                  </>
                ) : (
                  <>
                    {scale.ranked.map((c) => {
                      const members = data?.nodes.filter((n) => n.cluster === c) ?? [];
                      const lead = [...members].sort((a, b) => b.centrality - a.centrality)[0];
                      return (
                        <div key={c} className="drift-row">
                          <span>
                            <span className="gs-dot" style={{ background: scale.color(c) }} />
                            {scale.label(c)} · {members.length} names
                          </span>
                          <span>{lead?.symbol ?? "—"}</span>
                          <span className="sig" style={{ textAlign: "right" }}>
                            {(lead?.raw ?? lead?.centrality ?? 0).toFixed(3)}
                          </span>
                        </div>
                      );
                    })}
                    {scale.merged && (
                      <p className="label" style={{ marginTop: "var(--space-3)" }}>
                        Smaller communities are merged into OTHER — six is the most that can be
                        told apart by colour alone on a dark surface.
                      </p>
                    )}
                    <p className="label" style={{ marginTop: "var(--space-3)" }}>
                      Click a node to inspect it. Hover to trace its neighbourhood hop by hop.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
