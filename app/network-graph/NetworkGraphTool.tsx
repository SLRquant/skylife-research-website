"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

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

type SimNode = GraphNode & {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
};

/* ---------- Layout constants ---------- */

const CANVAS_W = 900;
const CANVAS_H = 640;
const REPEL = 850;
const SPRING = 0.045;
const SPRING_REST = 68;
const CLUSTER_PULL = 0.004;
const DAMPING = 0.86;
const CENTER_PULL = 0.002;

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
        const json = (await res.json()) as GraphPayload;
        if (!abort) {
          setData(json);
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
              <span>NIFTY momentum network</span>
            </div>
            <h1 className="tool-title">Network Graph</h1>
            <p className="tool-sub">
              Stocks plotted by correlation structure. Clusters are detected via
              Louvain; node size is eigenvector centrality; edge weight is
              correlation over the last 63 sessions.
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
            {data && (
              <GraphCanvas
                data={data}
                onSelect={setSelected}
                selectedId={selected?.id ?? null}
              />
            )}
            {data && <MetaBar meta={data.meta} nodes={data.nodes.length} edges={data.edges.length} />}
          </div>

          <aside className="tool-side">
            {data && (
              <Sidebar
                data={data}
                selected={selected}
                onSelect={setSelected}
              />
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ---------- Canvas ---------- */

function GraphCanvas({
  data,
  onSelect,
  selectedId,
}: {
  data: GraphPayload;
  onSelect: (n: GraphNode | null) => void;
  selectedId: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoverRef = useRef<string | null>(null);
  const [, setFrame] = useState(0); // force re-render for cursor changes

  const simRef = useRef<{
    nodes: SimNode[];
    byId: Map<string, SimNode>;
    edges: GraphEdge[];
    clusterCenters: Map<number, { x: number; y: number }>;
  } | null>(null);

  // Build simulation
  useEffect(() => {
    const clusterIds = Array.from(new Set(data.nodes.map((n) => n.cluster)));
    const clusterCenters = new Map<number, { x: number; y: number }>();
    const R = Math.min(CANVAS_W, CANVAS_H) * 0.32;
    clusterIds.forEach((cid, i) => {
      const a = (i / clusterIds.length) * Math.PI * 2 - Math.PI / 2;
      clusterCenters.set(cid, {
        x: CANVAS_W / 2 + Math.cos(a) * R,
        y: CANVAS_H / 2 + Math.sin(a) * R,
      });
    });

    const nodes: SimNode[] = data.nodes.map((n, i) => {
      const c = clusterCenters.get(n.cluster)!;
      const theta = (i / data.nodes.length) * Math.PI * 2;
      return {
        ...n,
        x: c.x + Math.cos(theta) * 20 + (Math.random() - 0.5) * 10,
        y: c.y + Math.sin(theta) * 20 + (Math.random() - 0.5) * 10,
        vx: 0,
        vy: 0,
        r: 4 + n.centrality * 14,
      };
    });
    const byId = new Map(nodes.map((n) => [n.id, n]));

    simRef.current = { nodes, byId, edges: data.edges, clusterCenters };
  }, [data]);

  // Draw + simulate loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let raf = 0;
    let t = 0;
    const step = () => {
      const sim = simRef.current;
      if (!sim) {
        raf = requestAnimationFrame(step);
        return;
      }
      t += 1;
      const rect = canvas.getBoundingClientRect();
      const W = rect.width;
      const H = rect.height;
      const sx = W / CANVAS_W;
      const sy = H / CANVAS_H;

      // --- simulate ---
      const { nodes, byId, edges, clusterCenters } = sim;
      // repulsion (limit pairs for perf)
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) d2 = 1;
          if (d2 > 40000) continue;
          const f = REPEL / d2;
          const d = Math.sqrt(d2);
          dx /= d;
          dy /= d;
          a.vx += dx * f * 0.01;
          a.vy += dy * f * 0.01;
          b.vx -= dx * f * 0.01;
          b.vy -= dy * f * 0.01;
        }
      }
      // edge springs
      for (const e of edges) {
        const a = byId.get(e.source);
        const b = byId.get(e.target);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
        const diff = d - SPRING_REST;
        const f = SPRING * diff * e.weight;
        const nx = dx / d;
        const ny = dy / d;
        a.vx += nx * f;
        a.vy += ny * f;
        b.vx -= nx * f;
        b.vy -= ny * f;
      }
      // cluster pull + center + damping
      for (const n of nodes) {
        const c = clusterCenters.get(n.cluster)!;
        n.vx += (c.x - n.x) * CLUSTER_PULL;
        n.vy += (c.y - n.y) * CLUSTER_PULL;
        n.vx += (CANVAS_W / 2 - n.x) * CENTER_PULL;
        n.vy += (CANVAS_H / 2 - n.y) * CENTER_PULL;
        n.vx *= DAMPING;
        n.vy *= DAMPING;
        n.x += n.vx;
        n.y += n.vy;
        // clamp
        const m = 20;
        if (n.x < m) n.x = m;
        if (n.x > CANVAS_W - m) n.x = CANVAS_W - m;
        if (n.y < m) n.y = m;
        if (n.y > CANVAS_H - m) n.y = CANVAS_H - m;
      }

      // --- draw ---
      ctx.clearRect(0, 0, W, H);

      // subtle grid
      ctx.strokeStyle = "rgba(36,46,71,0.3)";
      ctx.lineWidth = 1;
      const gridGap = 40;
      ctx.beginPath();
      for (let x = 0; x < W; x += gridGap) {
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, H);
      }
      for (let y = 0; y < H; y += gridGap) {
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(W, y + 0.5);
      }
      ctx.stroke();

      // edges
      for (const e of edges) {
        const a = byId.get(e.source);
        const b = byId.get(e.target);
        if (!a || !b) continue;
        const sameCluster = a.cluster === b.cluster;
        const isActive =
          selectedId && (a.id === selectedId || b.id === selectedId);
        const hovered =
          hoverRef.current &&
          (a.id === hoverRef.current || b.id === hoverRef.current);
        const alpha = isActive ? 0.7 : hovered ? 0.45 : sameCluster ? 0.18 : 0.07;
        ctx.strokeStyle = sameCluster
          ? `${a.clusterColor ?? "#7dd3fc"}`
          : "#475569";
        ctx.globalAlpha = alpha;
        ctx.lineWidth = isActive ? 1.4 : 0.6;
        ctx.beginPath();
        ctx.moveTo(a.x * sx, a.y * sy);
        ctx.lineTo(b.x * sx, b.y * sy);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // nodes
      for (const n of nodes) {
        const isSel = selectedId === n.id;
        const isHov = hoverRef.current === n.id;
        const rr = n.r * (isSel ? 1.35 : isHov ? 1.15 : 1);
        const cx = n.x * sx;
        const cy = n.y * sy;
        // glow
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr * 2.6);
        grad.addColorStop(0, (n.clusterColor ?? "#7dd3fc") + "aa");
        grad.addColorStop(1, (n.clusterColor ?? "#7dd3fc") + "00");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, rr * 2.6, 0, Math.PI * 2);
        ctx.fill();
        // core
        ctx.fillStyle = n.clusterColor ?? "#7dd3fc";
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.fill();
        // outline for high-centrality / selection
        if (n.centrality > 0.7 || isSel) {
          ctx.strokeStyle = isSel ? "#ffffff" : "rgba(230,236,245,0.6)";
          ctx.lineWidth = isSel ? 2 : 1;
          ctx.stroke();
        }
        // label for important nodes
        if (n.centrality > 0.6 || isSel || isHov) {
          ctx.fillStyle = isSel ? "#ffffff" : "#b7c0d3";
          ctx.font = `${
            isSel ? 12 : 11
          }px "IBM Plex Mono", ui-monospace, monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillText(n.symbol, cx, cy + rr + 6);
        }
      }

      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [selectedId]);

  // hit-testing / interaction
  const onMove = (ev: React.MouseEvent<HTMLCanvasElement>) => {
    const sim = simRef.current;
    if (!sim) return;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;
    const sx = W / CANVAS_W;
    const sy = H / CANVAS_H;
    const mx = ev.clientX - rect.left;
    const my = ev.clientY - rect.top;
    let found: string | null = null;
    for (let i = sim.nodes.length - 1; i >= 0; i--) {
      const n = sim.nodes[i];
      const dx = mx - n.x * sx;
      const dy = my - n.y * sy;
      const rr = n.r * 1.4;
      if (dx * dx + dy * dy < rr * rr) {
        found = n.id;
        break;
      }
    }
    if (found !== hoverRef.current) {
      hoverRef.current = found;
      canvas.style.cursor = found ? "pointer" : "default";
      setFrame((f) => f + 1);
    }
  };

  const onClick = (ev: React.MouseEvent<HTMLCanvasElement>) => {
    const sim = simRef.current;
    if (!sim) return;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;
    const sx = W / CANVAS_W;
    const sy = H / CANVAS_H;
    const mx = ev.clientX - rect.left;
    const my = ev.clientY - rect.top;
    for (let i = sim.nodes.length - 1; i >= 0; i--) {
      const n = sim.nodes[i];
      const dx = mx - n.x * sx;
      const dy = my - n.y * sy;
      const rr = n.r * 1.4;
      if (dx * dx + dy * dy < rr * rr) {
        onSelect(n);
        return;
      }
    }
    onSelect(null);
  };

  return (
    <div className="tool-canvas-box">
      <canvas
        ref={canvasRef}
        className="tool-canvas"
        onMouseMove={onMove}
        onClick={onClick}
        onMouseLeave={() => {
          hoverRef.current = null;
          if (canvasRef.current) canvasRef.current.style.cursor = "default";
        }}
      />
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
      {meta.fallback && (
        <>
          <span className="dim">·</span>
          <span style={{ color: "var(--warn)" }}>SAMPLE_DATA</span>
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
