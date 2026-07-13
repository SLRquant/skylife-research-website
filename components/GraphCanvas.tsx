"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type GNode = {
  id: string;
  symbol: string;
  cluster: number;
  clusterColor?: string;
  centrality: number; // 0..1
};
export type GEdge = { source: string; target: string; weight: number };

type Sim = GNode & { x: number; y: number; vx: number; vy: number; r: number; fixed?: boolean };

const W = 1000;
const H = 700;

/* Forces. Tuned so a ~50-node / ~150-edge knn graph spreads instead of collapsing. */
const REPEL = 5200;
const REPEL_RANGE2 = 400 * 400;
const SPRING = 0.02;
const REST = 120;
const CLUSTER_PULL = 0.004;
const CENTER_PULL = 0.0015;
const DAMPING = 0.9;
const WARMUP = 320; // ticks run before first paint, so it opens settled

export function GraphCanvas({
  nodes,
  edges,
  selected,
  onSelect,
  height = 560,
}: {
  nodes: GNode[];
  edges: GEdge[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<{ nodes: Sim[]; byId: Map<string, Sim>; adj: Map<string, Set<string>> } | null>(null);
  const view = useRef({ k: 1, tx: 0, ty: 0 });          // zoom + pan
  const drag = useRef<{ node: Sim | null; panning: boolean; lx: number; ly: number }>({
    node: null, panning: false, lx: 0, ly: 0,
  });
  const hoverRef = useRef<string | null>(null);
  const selRef = useRef<string | null>(selected);
  selRef.current = selected;

  const [hover, setHover] = useState<{ n: GNode; x: number; y: number } | null>(null);
  const [, force] = useState(0);

  /* ---- build + warm up the layout ---- */
  useEffect(() => {
    if (!nodes.length) return;

    const cids = [...new Set(nodes.map((n) => n.cluster))];
    const centers = new Map<number, { x: number; y: number }>();
    const R = Math.min(W, H) * 0.3;
    cids.forEach((c, i) => {
      const a = (i / cids.length) * Math.PI * 2 - Math.PI / 2;
      centers.set(c, { x: W / 2 + Math.cos(a) * R, y: H / 2 + Math.sin(a) * R });
    });

    const sim: Sim[] = nodes.map((n, i) => {
      const c = centers.get(n.cluster)!;
      const th = (i / nodes.length) * Math.PI * 2;
      return {
        ...n,
        x: c.x + Math.cos(th) * 80 + (Math.random() - 0.5) * 30,
        y: c.y + Math.sin(th) * 80 + (Math.random() - 0.5) * 30,
        vx: 0, vy: 0,
        r: 5 + n.centrality * 14,
      };
    });
    const byId = new Map(sim.map((n) => [n.id, n]));

    const adj = new Map<string, Set<string>>();
    for (const e of edges) {
      if (!adj.has(e.source)) adj.set(e.source, new Set());
      if (!adj.has(e.target)) adj.set(e.target, new Set());
      adj.get(e.source)!.add(e.target);
      adj.get(e.target)!.add(e.source);
    }

    const tick = () => {
      for (let i = 0; i < sim.length; i++) {
        const a = sim[i];
        for (let j = i + 1; j < sim.length; j++) {
          const b = sim[j];
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) d2 = 1;
          if (d2 > REPEL_RANGE2) continue;
          const f = REPEL / d2;
          const d = Math.sqrt(d2);
          dx /= d; dy /= d;
          a.vx += dx * f * 0.02; a.vy += dy * f * 0.02;
          b.vx -= dx * f * 0.02; b.vy -= dy * f * 0.02;
        }
      }
      for (const e of edges) {
        const a = byId.get(e.source);
        const b = byId.get(e.target);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.max(Math.hypot(dx, dy), 0.01);
        const f = SPRING * (d - REST) * Math.max(e.weight, 0.15);
        a.vx += (dx / d) * f; a.vy += (dy / d) * f;
        b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
      }
      for (const n of sim) {
        if (n.fixed) { n.vx = 0; n.vy = 0; continue; }
        const c = centers.get(n.cluster)!;
        n.vx += (c.x - n.x) * CLUSTER_PULL + (W / 2 - n.x) * CENTER_PULL;
        n.vy += (c.y - n.y) * CLUSTER_PULL + (H / 2 - n.y) * CENTER_PULL;
        n.vx *= DAMPING; n.vy *= DAMPING;
        n.x = Math.max(30, Math.min(W - 30, n.x + n.vx));
        n.y = Math.max(30, Math.min(H - 30, n.y + n.vy));
      }
    };

    for (let i = 0; i < WARMUP; i++) tick(); // settle before the user ever sees it

    simRef.current = { nodes: sim, byId, adj };
    (simRef.current as unknown as { tick: () => void }).tick = tick;
    view.current = { k: 1, tx: 0, ty: 0 };
    force((v) => v + 1);
  }, [nodes, edges]);

  /* ---- render loop ---- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const sim = simRef.current;
      if (!sim) return;
      (sim as unknown as { tick: () => void }).tick();

      const rect = canvas.getBoundingClientRect();
      const { k, tx, ty } = view.current;
      const base = Math.min(rect.width / W, rect.height / H);
      const s = base * k;
      const ox = (rect.width - W * s) / 2 + tx;
      const oy = (rect.height - H * s) / 2 + ty;
      const X = (x: number) => x * s + ox;
      const Y = (y: number) => y * s + oy;

      ctx.clearRect(0, 0, rect.width, rect.height);

      const hot = hoverRef.current ?? selRef.current;
      const nbrs = hot ? sim.adj.get(hot) : null;
      const focus = (id: string) => !hot || id === hot || !!nbrs?.has(id);

      // edges
      for (const e of edges) {
        const a = sim.byId.get(e.source);
        const b = sim.byId.get(e.target);
        if (!a || !b) continue;
        const on = !hot || e.source === hot || e.target === hot;
        ctx.globalAlpha = on ? 0.16 + e.weight * 0.5 : 0.04;
        ctx.strokeStyle =
          a.cluster === b.cluster ? a.clusterColor ?? "#7dd3fc" : "#475569";
        ctx.lineWidth = on ? 0.6 + e.weight * 1.8 : 0.5;
        ctx.beginPath();
        ctx.moveTo(X(a.x), Y(a.y));
        ctx.lineTo(X(b.x), Y(b.y));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // nodes
      for (const n of sim.nodes) {
        const isHot = n.id === hot;
        const lit = focus(n.id);
        const col = n.clusterColor ?? "#7dd3fc";
        const cx = X(n.x);
        const cy = Y(n.y);
        const r = n.r * s * (isHot ? 1.35 : 1);

        ctx.globalAlpha = lit ? 1 : 0.22;

        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.8);
        g.addColorStop(0, col + "aa");
        g.addColorStop(1, col + "00");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 2.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        if (isHot) {
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // label the hubs, the hovered node, and its neighbours
        if (isHot || (lit && (n.centrality > 0.45 || !!nbrs?.has(n.id)))) {
          ctx.globalAlpha = 1;
          ctx.fillStyle = isHot ? "#fff" : "#c3ccdc";
          ctx.font = `${isHot ? 12 : 10.5}px "IBM Plex Mono", monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillText(n.symbol, cx, cy + r + 5);
        }
        ctx.globalAlpha = 1;
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [edges]);

  /* ---- interaction: hit-test in graph space ---- */
  const pick = useCallback((cx: number, cy: number): Sim | null => {
    const sim = simRef.current;
    const canvas = canvasRef.current;
    if (!sim || !canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const { k, tx, ty } = view.current;
    const base = Math.min(rect.width / W, rect.height / H);
    const s = base * k;
    const ox = (rect.width - W * s) / 2 + tx;
    const oy = (rect.height - H * s) / 2 + ty;

    for (let i = sim.nodes.length - 1; i >= 0; i--) {
      const n = sim.nodes[i];
      const dx = cx - (n.x * s + ox);
      const dy = cy - (n.y * s + oy);
      const rr = Math.max(n.r * s, 9) * 1.5; // generous target — never require a pixel-perfect hit
      if (dx * dx + dy * dy < rr * rr) return n;
    }
    return null;
  }, []);

  const toGraph = (cx: number, cy: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const { k, tx, ty } = view.current;
    const base = Math.min(rect.width / W, rect.height / H);
    const s = base * k;
    const ox = (rect.width - W * s) / 2 + tx;
    const oy = (rect.height - H * s) / 2 + ty;
    return { x: (cx - ox) / s, y: (cy - oy) / s };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const n = pick(cx, cy);
    e.currentTarget.setPointerCapture(e.pointerId);
    if (n) {
      drag.current = { node: n, panning: false, lx: cx, ly: cy };
      n.fixed = true;
    } else {
      drag.current = { node: null, panning: true, lx: cx, ly: cy };
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const d = drag.current;

    if (d.node) {
      const p = toGraph(cx, cy);
      d.node.x = p.x;
      d.node.y = p.y;
      return;
    }
    if (d.panning) {
      view.current.tx += cx - d.lx;
      view.current.ty += cy - d.ly;
      d.lx = cx;
      d.ly = cy;
      return;
    }

    const n = pick(cx, cy);
    const id = n?.id ?? null;
    if (id !== hoverRef.current) {
      hoverRef.current = id;
      e.currentTarget.style.cursor = id ? "grab" : "default";
      setHover(n ? { n, x: cx, y: cy } : null);
    } else if (n) {
      setHover({ n, x: cx, y: cy });
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (d.node) {
      d.node.fixed = false;
      // treat a click (no real movement) as a selection
      const rect = e.currentTarget.getBoundingClientRect();
      const moved = Math.hypot(e.clientX - rect.left - d.lx, e.clientY - rect.top - d.ly);
      if (moved < 4) onSelect(selRef.current === d.node.id ? null : d.node.id);
    } else if (d.panning) {
      const rect = e.currentTarget.getBoundingClientRect();
      const moved = Math.hypot(e.clientX - rect.left - d.lx, e.clientY - rect.top - d.ly);
      if (moved < 4) onSelect(null); // click on empty space clears
    }
    drag.current = { node: null, panning: false, lx: 0, ly: 0 };
  };

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const before = toGraph(cx, cy);
    const k = Math.max(0.5, Math.min(4, view.current.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
    view.current.k = k;
    const after = toGraph(cx, cy);
    // keep the point under the cursor anchored while zooming
    const base = Math.min(rect.width / W, rect.height / H) * k;
    view.current.tx += (after.x - before.x) * base;
    view.current.ty += (after.y - before.y) * base;
  };

  const reset = () => {
    view.current = { k: 1, tx: 0, ty: 0 };
  };

  return (
    <div className="gc-wrap">
      <canvas
        ref={canvasRef}
        className="gc-canvas"
        style={{ height }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          hoverRef.current = null;
          setHover(null);
        }}
        onWheel={onWheel}
      />

      {hover && (
        <div
          className="gc-tip mono"
          style={{
            left: Math.min(hover.x + 14, 640),
            top: Math.max(hover.y - 10, 4),
          }}
        >
          <strong style={{ color: hover.n.clusterColor }}>{hover.n.symbol}</strong>
          <span>cluster C{hover.n.cluster}</span>
          <span>centrality {hover.n.centrality.toFixed(3)}</span>
        </div>
      )}

      <div className="gc-hint mono dim">scroll to zoom · drag a node · drag background to pan</div>
      <button type="button" className="gc-reset mono" onClick={reset}>
        RESET VIEW
      </button>
    </div>
  );
}
