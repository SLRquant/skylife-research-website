"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Plate } from "@/components/Plate";
import { GraphCanvas, type GEdge, type GNode } from "@/components/GraphCanvas";
import { buildClusterScale } from "@/components/graph-stats/colors";
import { Def, DefList, InfoBox } from "@/components/InfoBox";

const LOOKBACKS = [30, 40, 50, 60, 75, 90, 105, 120];

/** The centrality columns shown in the inspector, in reading order. Keys match the API. */
const METRIC_COLS = [
  { key: "eigenvector_centrality", label: "Eigenvector", short: "Eig" },
  { key: "pagerank", label: "PageRank", short: "PR" },
  { key: "degree_strength", label: "Degree", short: "Deg" },
  { key: "betweenness_centrality", label: "Betweenness", short: "Btw" },
  { key: "closeness_centrality", label: "Closeness", short: "Cls" },
] as const;
type MetricKey = (typeof METRIC_COLS)[number]["key"];

type Meta = {
  universe?: string;
  method?: string;
  lookback?: number;
  clustersDetected?: number;
  modularity?: number;
  asOf?: string;
  fallback?: boolean;
};
type Node = GNode & {
  name?: string;
  raw?: number;
  metrics?: Record<MetricKey, number | null>;
};
type Payload = { nodes: Node[]; edges: GEdge[]; meta: Meta };

export function NetworkGraphTool() {
  const [idx, setIdx] = useState(3); // 60 bars
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
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

  /**
   * Per-metric ranks and column maxima, computed once per payload. Ranks let the inspector say
   * "3rd of 49 on Betweenness"; the maxima drive the little bars. A stock's role is only legible
   * relative to the others, so both are cross-sectional.
   */
  const stats = useMemo(() => {
    const nodes = data?.nodes ?? [];
    const rank: Record<string, Map<string, number>> = {};
    const max: Record<string, number> = {};
    for (const { key } of METRIC_COLS) {
      const vals = nodes
        .map((n) => ({ sym: n.symbol, v: n.metrics?.[key] ?? -Infinity }))
        .sort((a, b) => b.v - a.v);
      rank[key] = new Map(vals.map((x, i) => [x.sym, i + 1]));
      max[key] = Math.max(...nodes.map((n) => n.metrics?.[key] ?? 0), 1e-9);
    }
    return { rank, max, n: nodes.length };
  }, [data]);

  /** All stocks, sorted by eigenvector centrality — the default full-width table. */
  const ranked = useMemo(
    () =>
      [...(data?.nodes ?? [])].sort(
        (a, b) => (b.metrics?.eigenvector_centrality ?? 0) - (a.metrics?.eigenvector_centrality ?? 0)
      ),
    [data]
  );

  const val = (n: Node | null, k: MetricKey) => n?.metrics?.[k] ?? null;
  const fmt = (v: number | null) => (v == null ? "—" : v.toFixed(4));

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

          <InfoBox title="What these numbers mean">
            <DefList>
              <Def term="N">
                How many <strong>stocks</strong> are in the graph. The NIFTY-50, minus any name
                without enough price history in the window.
              </Def>
              <Def term="Edges">
                How many <strong>links</strong> survived. Two stocks are linked when their returns
                move together strongly enough — here, each stock keeps its <em>k=4</em> strongest
                partners. Not every pair is joined; that is the point.
              </Def>
              <Def term="K">
                How many <strong>communities</strong> the algorithm found — clusters of stocks that
                move as a bloc. Nobody tells it &ldquo;banks&rdquo; or &ldquo;IT&rdquo;; it finds
                them from the price data alone.
              </Def>
              <Def term="Q">
                <strong>Modularity</strong>, 0 to 1. How cleanly the market splits into those
                blocs. <em>Q ≈ 0</em> means the grouping is no better than chance;{" "}
                <em>Q &gt; 0.3</em> means real structure; <em>0.4–0.7</em> is a strongly clustered
                market. Ours usually sits near <em>0.44</em>.
              </Def>
              <Def term="Asof">
                The <strong>trading day</strong> the graph was built from. It is rebuilt for every
                session.
              </Def>
              <Def term="Node size">
                <strong>Eigenvector centrality</strong>, 0 to 1 — how central a stock is, counting
                not just how many things it moves with but how central <em>those</em> are. A big dot
                is a hub: the market&rsquo;s weather reaches it first.
              </Def>
              <Def term="Node colour">
                Which <strong>community</strong> it belongs to. Colours are for telling groups
                apart, nothing more — they carry no ranking.
              </Def>
              <Def term="Bars">
                The <strong>estimation window</strong>: how many trailing days of returns the
                correlations are measured over. Drag it and the graph re-solves. This is the honest
                part — a structure that only exists at one window setting was never really there.
              </Def>
              <Def term="The table">
                Below the graph, every stock scored <strong>five ways</strong> (see the legend under
                it), with its rank on each. Click any row — or any node — to open that stock on its
                own.
              </Def>
              <Def term="Strongest edges">
                Inside a selected stock, its <strong>correlations</strong> (|ρ|, 0 to 1) with its
                nearest neighbours. <em>0.82</em> is a very tight co-movement; <em>0.30</em> is
                loose.
              </Def>
            </DefList>
          </InfoBox>

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

          {/* ---- full-width inspector: every stock's position, measured five ways ---- */}
          <section className="panel" style={{ marginTop: "var(--space-4)" }}>
            <div className="panel-head">
              <span className="label">
                {node ? (
                  <>
                    {node.symbol} · <span className="sig">{scale.label(node.cluster)}</span>
                  </>
                ) : (
                  "Centrality — every stock, five ways"
                )}
              </span>
              <span className="label">
                {node ? "one stock" : `${stats.n} names · ranked by eigenvector`}
              </span>
            </div>

            <div className="panel-body">
              {node ? (
                /* ---- one stock, in depth ---- */
                <>
                  <div className="ng-metric-grid">
                    {METRIC_COLS.map((col) => {
                      const v = val(node, col.key);
                      const r = stats.rank[col.key]?.get(node.symbol);
                      const w = v == null ? 0 : Math.min(100, (v / stats.max[col.key]) * 100);
                      return (
                        <div key={col.key} className="ng-metric">
                          <span className="label">{col.label}</span>
                          <span className="ng-metric-val sig">{fmt(v)}</span>
                          <span className="ng-metric-rank">
                            #{r ?? "—"} of {stats.n}
                          </span>
                          <span className="drift-bar">
                            <i style={{ width: `${w}%` }} />
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <p className="label" style={{ margin: "var(--space-4) 0 var(--space-2)" }}>
                    Strongest edges · |ρ| to nearest neighbours
                  </p>
                  <div className="ng-edges">
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
                  </div>

                  <button
                    className="btn btn-ghost"
                    style={{ marginTop: "var(--space-4)" }}
                    onClick={() => setSelected(null)}
                  >
                    ← All stocks
                  </button>
                </>
              ) : (
                /* ---- the whole universe, sortable at a glance, click to drill in ---- */
                <div className="ng-table-wrap">
                  <table className="ng-table">
                    <thead>
                      <tr>
                        <th className="ng-num">#</th>
                        <th>Stock</th>
                        <th>Cmty</th>
                        {METRIC_COLS.map((c) => (
                          <th key={c.key} className="ng-num" title={c.label}>
                            {c.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ranked.map((n, i) => (
                        <tr key={n.id} className="ng-row" onClick={() => setSelected(n.id)}>
                          <td className="ng-num dim">{i + 1}</td>
                          <td className="ng-sym">
                            <span className="gs-dot" style={{ background: scale.color(n.cluster) }} />
                            {n.symbol}
                          </td>
                          <td className="dim">{scale.label(n.cluster)}</td>
                          {METRIC_COLS.map((c) => (
                            <td key={c.key} className="ng-num sig">
                              {fmt(val(n, c.key))}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="label" style={{ padding: "var(--space-3)" }}>
                    Click any row to inspect that stock. Or click a node in the graph above.
                  </p>
                </div>
              )}
            </div>
          </section>

          <InfoBox title="The five centrality measures">
            <DefList>
              <Def term="Eigenvector">
                <strong>Influence via influential peers.</strong> 0 to 1. Being linked to many
                stocks scores well; being linked to <em>central</em> ones scores far better. The
                top score is the market&rsquo;s main hub — a shock there travels furthest. This is
                also what sizes the nodes in the graph.
              </Def>
              <Def term="PageRank">
                <strong>Where a random walk settles.</strong> Set something loose on the network and
                let it wander the links; PageRank is the share of time spent on each stock. Kinder
                than Eigenvector to well-connected names outside the core. Sums to 1 across all
                stocks, so values are small — <em>~0.02</em> is average here.
              </Def>
              <Def term="Degree">
                <strong>Raw connectedness.</strong> The summed correlation strength of every link a
                stock has. Blunt but honest: it counts the crowd, and doesn&rsquo;t weigh whether
                the crowd matters.
              </Def>
              <Def term="Betweenness">
                <strong>The bridge.</strong> How often a stock sits on the shortest path between two
                others. High = it <em>connects otherwise separate parts</em> of the market; it may
                be small, yet removing it would split the network. Most names score near{" "}
                <em>0</em> — that skew is the signal.
              </Def>
              <Def term="Closeness">
                <strong>Reach.</strong> The inverse of the average distance to every other stock.
                High = news reaches it quickly from anywhere; low = it sits out on the rim.
              </Def>
              <Def term="# of 49">
                Each stock&rsquo;s <strong>rank</strong> on that measure across the whole universe,
                1 = most central. A name can top one measure and sit mid-table on another — that
                disagreement is often the interesting part.
              </Def>
            </DefList>
          </InfoBox>

          {/* ---- communities, kept as its own strip ---- */}
          <section className="panel" style={{ marginTop: "var(--space-4)" }}>
            <div className="panel-head">
              <span className="label">Communities</span>
              <span className="label">{data?.meta.clustersDetected ?? "—"} detected</span>
            </div>
            <div className="panel-body">
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
                  Smaller communities are merged into OTHER — six is the most that can be told apart
                  by colour alone on a dark surface.
                </p>
              )}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
