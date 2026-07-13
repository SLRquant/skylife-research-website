"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GraphCanvas } from "@/components/GraphCanvas";

/* ---------- Types ---------- */

type GraphNode = {
  id: string;
  symbol: string;
  name?: string;
  cluster: number;
  clusterLabel?: string;
  clusterColor?: string;
  centrality: number;
  momentum: number;
  marketCap?: number;
};

type GraphEdge = {
  source: string;
  target: string;
  weight: number;
};

type GraphMeta = {
  universe?: string;
  method?: string;
  lookbackDays?: number;
  correlationThreshold?: number;
  clustersDetected?: number;
  modularity?: number;
  asOf?: string;
  fallback?: boolean;
};

type GraphPayload = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  meta: GraphMeta;
};

/* ---------- Component ---------- */

export function NetworkGraphTool() {
  const [data, setData] = useState<GraphPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        const res = await fetch("/api/network-graph", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as Partial<GraphPayload>;
        if (!json || !Array.isArray(json.nodes) || !Array.isArray(json.edges)) {
          throw new Error("Malformed graph response");
        }
        if (!abort) {
          setData({
            nodes: json.nodes as GraphNode[],
            edges: json.edges as GraphEdge[],
            meta: (json.meta ?? {}) as GraphMeta,
          });
          setLoading(false);
        }
      } catch (e) {
        if (!abort) {
          setError(e instanceof Error ? e.message : "Failed to load");
          setLoading(false);
        }
      }
    })();
    return () => {
      abort = true;
    };
  }, []);

  return (
    <div className="tool-page">
      <div className="wrap tool-wrap">
        <header className="tool-header">
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              <span className="eb-primary">● LIVE TOOL</span>
              <span className="sep">/</span>
              <span>NIFTY-50 correlation network</span>
            </div>
            <h1 className="tool-title">Network Graph</h1>
            <p className="tool-sub">
              The NIFTY-50 plotted by correlation structure. Clusters are detected via Louvain;
              node size is eigenvector centrality; edge weight is |correlation| over the last 60
              sessions.
            </p>
          </div>
          <Link href="/" className="btn btn-ghost tool-back" aria-label="Back">
            <span>← Back</span>
          </Link>
        </header>

        <div className="tool-layout">
          <div className="tool-canvas-wrap">
            {loading && <LoadingOverlay />}
            {error && !data && <ErrorState message={error} />}
            {/* An empty graph means the live feed failed. Say so — never dress up
                placeholder numbers as if they were today's market. */}
            {data && data.nodes.length === 0 && (
              <ErrorState message="Live graph unavailable — please try again shortly." />
            )}
            {data && data.nodes.length > 0 && (
              <GraphCanvas
                nodes={data.nodes}
                edges={data.edges}
                selected={selected?.id ?? null}
                onSelect={(id) =>
                  setSelected(id ? data.nodes.find((n) => n.id === id) ?? null : null)
                }
                height={620}
              />
            )}
            {data && data.nodes.length > 0 && (
              <MetaBar meta={data.meta} nodes={data.nodes.length} edges={data.edges.length} />
            )}
          </div>

          <aside className="tool-side">
            {data && data.nodes.length > 0 && (
              <Sidebar data={data} selected={selected} onSelect={setSelected} />
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ---------- Sidebar ---------- */

function Sidebar({
  data,
  selected,
  onSelect,
}: {
  data: GraphPayload;
  selected: GraphNode | null;
  onSelect: (n: GraphNode | null) => void;
}) {
  const clusters = useMemo(() => {
    const m = new Map<
      number,
      {
        id: number;
        label: string;
        color: string;
        members: GraphNode[];
      }
    >();
    data.nodes.forEach((n) => {
      if (!m.has(n.cluster)) {
        m.set(n.cluster, {
          id: n.cluster,
          label: n.clusterLabel ?? `Cluster ${n.cluster}`,
          color: n.clusterColor ?? "#7dd3fc",
          members: [],
        });
      }
      m.get(n.cluster)!.members.push(n);
    });
    return [...m.values()].sort((a, b) => b.members.length - a.members.length);
  }, [data]);

  if (selected) {
    return (
      <NodeDetail node={selected} data={data} onBack={() => onSelect(null)} />
    );
  }

  return (
    <div className="side-pane">
      <div className="side-head">
        <span className="mono dim">CLUSTERS</span>
        <span className="mono dim">{clusters.length}</span>
      </div>
      <div className="side-clusters">
        {clusters.map((c) => {
          const topLeader = [...c.members].sort(
            (a, b) => b.centrality - a.centrality
          )[0];
          return (
            <div key={c.id} className="cluster-row">
              <div className="cluster-row-head">
                <span
                  className="cluster-dot"
                  style={{ background: c.color, boxShadow: `0 0 10px ${c.color}` }}
                />
                <span className="cluster-label mono">{c.label}</span>
                <span className="cluster-count mono dim">
                  {c.members.length} stocks
                </span>
              </div>
              <div className="cluster-leader">
                <span className="dim mono">LEADER</span>
                <button
                  type="button"
                  className="leader-btn"
                  onClick={() => onSelect(topLeader)}
                >
                  {topLeader.symbol}
                  <span className="leader-cent mono">
                    c={topLeader.centrality.toFixed(2)}
                  </span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="side-hint">
        <span className="mono dim">→</span> Click any node to inspect.
      </div>
    </div>
  );
}

function NodeDetail({
  node,
  data,
  onBack,
}: {
  node: GraphNode;
  data: GraphPayload;
  onBack: () => void;
}) {
  const neighbors = useMemo(() => {
    const out: Array<{ node: GraphNode; weight: number }> = [];
    for (const e of data.edges) {
      if (e.source === node.id) {
        const n = data.nodes.find((x) => x.id === e.target);
        if (n) out.push({ node: n, weight: e.weight });
      } else if (e.target === node.id) {
        const n = data.nodes.find((x) => x.id === e.source);
        if (n) out.push({ node: n, weight: e.weight });
      }
    }
    return out.sort((a, b) => b.weight - a.weight).slice(0, 10);
  }, [node, data]);

  return (
    <div className="side-pane">
      <button className="side-back mono" onClick={onBack}>
        ← back to clusters
      </button>
      <div className="node-detail-head">
        <div
          className="node-color-chip"
          style={{
            background: node.clusterColor,
            boxShadow: `0 0 10px ${node.clusterColor}`,
          }}
        />
        <div>
          <div className="node-symbol">{node.symbol}</div>
          <div className="node-name dim">{node.name}</div>
        </div>
      </div>

      <div className="node-stats">
        <Stat label="CLUSTER" value={node.clusterLabel ?? String(node.cluster)} />
        <Stat
          label="CENTRALITY"
          value={node.centrality.toFixed(3)}
          color="var(--accent)"
        />
        <Stat
          label="MOMENTUM"
          value={`${node.momentum >= 0 ? "+" : ""}${node.momentum.toFixed(1)}%`}
          color={node.momentum >= 0 ? "var(--accent-2)" : "var(--danger)"}
        />
        {node.marketCap && (
          <Stat
            label="MCAP (CR)"
            value={`₹${new Intl.NumberFormat("en-IN").format(node.marketCap)}`}
          />
        )}
      </div>

      <div className="neighbors-head mono dim">
        <span>TOP CORRELATED</span>
        <span>ρ</span>
      </div>
      <div className="neighbors-list">
        {neighbors.map((n) => (
          <div key={n.node.id} className="neighbor-row">
            <span
              className="neighbor-dot"
              style={{ background: n.node.clusterColor }}
            />
            <span className="neighbor-sym mono">{n.node.symbol}</span>
            <span className="neighbor-name dim">{n.node.name}</span>
            <span className="neighbor-weight mono">{n.weight.toFixed(2)}</span>
          </div>
        ))}
        {neighbors.length === 0 && (
          <div className="dim mono" style={{ padding: "12px 0" }}>
            No correlations ≥ threshold.
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="stat-cell">
      <div className="mono dim stat-label">{label}</div>
      <div className="stat-value" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}

/* ---------- Meta / loading / error ---------- */

function MetaBar({
  meta,
  nodes,
  edges,
}: {
  meta: GraphMeta;
  nodes: number;
  edges: number;
}) {
  return (
    <div className="tool-meta mono">
      <span className="dim">UNIVERSE</span>
      <span>{meta.universe ?? "NIFTY50"}</span>
      <span className="dim">·</span>
      <span className="dim">NODES</span>
      <span>{nodes}</span>
      <span className="dim">·</span>
      <span className="dim">EDGES</span>
      <span>{edges}</span>
      <span className="dim">·</span>
      <span className="dim">MODULARITY</span>
      <span style={{ color: "var(--accent-2)" }}>
        {meta.modularity?.toFixed(3) ?? "—"}
      </span>
      {meta.asOf && (
        <>
          <span className="dim">·</span>
          <span className="dim">AS OF</span>
          <span>{meta.asOf.slice(0, 10)}</span>
        </>
      )}
      {meta.fallback && (
        <>
          <span className="dim">·</span>
          <span style={{ color: "var(--warn)" }}>LIVE FEED DOWN</span>
        </>
      )}
    </div>
  );
}

function LoadingOverlay() {
  return (
    <div className="tool-overlay">
      <div className="tool-overlay-inner mono">
        <span className="tool-spinner" />
        <span>Loading network...</span>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="tool-overlay">
      <div className="tool-overlay-inner mono" style={{ color: "var(--danger)" }}>
        Failed to load: {message}
      </div>
    </div>
  );
}
