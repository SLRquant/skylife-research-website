"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildClusterScale, type ClusterScale } from "@/components/graph-stats/colors";

export type GNode = {
  id: string;
  symbol: string;
  cluster: number;
  centrality: number; // 0..1, normalised by the caller
};
export type GEdge = { source: string; target: string; weight: number; corr?: number };

type Sim = GNode & {
  x: number; y: number; vx: number; vy: number;
  s: number;              // radius, world units
  px?: number; py?: number; // anchor target = position at the previous step
  stability: number;      // 0..1 — 1 = structural role unchanged
  drift: number;          // world-units moved by the last morph (this is the INFORMATION)
  fixed?: boolean;
};

const W = 1000;
const H = 700;

/* Forces. */
const REPEL = 4200;
const REPEL_RANGE2 = 380 * 380;
const CENTER_PULL = 0.0012;
const DAMPING = 0.86;

/* Cooling (DEFECT 2). The layout MUST come to rest. */
const ALPHA_MIN = 0.005;
const ALPHA_DECAY_COLD = 0.028; // first build
const ALPHA_DECAY_WARM = 0.06;  // a morph: ~40 ticks, settles < 700ms (FOUNDATION §8.1)
const REHEAT = 0.15;            // NOT 1.0 — the layout relaxes, it does not re-form

const LABEL_TOP_K = 7; // text is the bottleneck — never draw 49 labels

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/* ------------------------------------------------------------------ */
/* geometry helpers                                                     */
/* ------------------------------------------------------------------ */

function convexHull(pts: Array<[number, number]>): Array<[number, number]> {
  if (pts.length < 3) return pts;
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: [number, number], a: [number, number], b: [number, number]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Array<[number, number]> = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: Array<[number, number]> = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/** Push each hull vertex out along its normal from the centroid. */
function inflate(hull: Array<[number, number]>, pad: number): Array<[number, number]> {
  if (!hull.length) return hull;
  const cx = hull.reduce((a, p) => a + p[0], 0) / hull.length;
  const cy = hull.reduce((a, p) => a + p[1], 0) / hull.length;
  return hull.map(([x, y]) => {
    const dx = x - cx;
    const dy = y - cy;
    const d = Math.hypot(dx, dy) || 1;
    return [x + (dx / d) * pad, y + (dy / d) * pad] as [number, number];
  });
}

/** Chaikin corner-cutting — turns the polygon into something drawn, not computed. */
function chaikin(pts: Array<[number, number]>, iters = 2): Array<[number, number]> {
  let out = pts;
  for (let k = 0; k < iters; k++) {
    if (out.length < 3) return out;
    const next: Array<[number, number]> = [];
    for (let i = 0; i < out.length; i++) {
      const a = out[i];
      const b = out[(i + 1) % out.length];
      next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      next.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    out = next;
  }
  return out;
}

/* ------------------------------------------------------------------ */

export type GraphCanvasHandle = { drift: Array<{ symbol: string; drift: number; stability: number }> };

export function GraphCanvas({
  nodes,
  edges,
  selected,
  onSelect,
  height = 560,
  onDrift,
}: {
  nodes: GNode[];
  edges: GEdge[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  height?: number;
  /** Reports how far each node MIGRATED on the last morph. Displacement is information. */
  onDrift?: (rows: Array<{ symbol: string; drift: number; stability: number }>) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const simRef = useRef<Sim[]>([]);
  const byIdRef = useRef<Map<string, Sim>>(new Map());
  const adjRef = useRef<Map<string, Set<string>>>(new Map());
  const edgesRef = useRef<GEdge[]>([]);
  const alphaRef = useRef(0);
  const decayRef = useRef(ALPHA_DECAY_COLD);
  const view = useRef({ k: 1, tx: 0, ty: 0, fitted: false });
  const dirtyRef = useRef(true);
  const visibleRef = useRef(true);
  const morphRef = useRef(false);   // true only once a DIFFERENT graph has arrived
  const sigRef = useRef<string>("");

  /* hop-by-hop hover trace */
  const hoverRef = useRef<string | null>(null);
  const hopRef = useRef<Map<string, number>>(new Map());
  const hoverAtRef = useRef(0);

  const selRef = useRef<string | null>(selected);
  selRef.current = selected;

  const drag = useRef<{ node: Sim | null; panning: boolean; lx: number; ly: number; moved: number }>({
    node: null, panning: false, lx: 0, ly: 0, moved: 0,
  });

  /* hull padding eases to its target — a community tightening CONTRACTS, one splitting SWELLS */
  const hullPad = useRef<Map<number, { cur: number; target: number }>>(new Map());

  const [readout, setReadout] = useState<{ sym: string; cluster: string; cent: number; x: number; y: number } | null>(null);
  const [crosshair, setCrosshair] = useState<{ x: number; y: number } | null>(null);

  const scale: ClusterScale = useMemo(
    () => buildClusterScale(nodes.map((n) => n.cluster)),
    [nodes]
  );
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  /* ---------------- coherence: mean |rho| of a community's internal edges ---------------- */
  const coherence = useMemo(() => {
    const sum = new Map<number, number>();
    const cnt = new Map<number, number>();
    const cl = new Map(nodes.map((n) => [n.id, n.cluster]));
    for (const e of edges) {
      const a = cl.get(e.source);
      const b = cl.get(e.target);
      if (a === undefined || a !== b) continue;
      const r = Math.abs(e.corr ?? e.weight);
      sum.set(a, (sum.get(a) ?? 0) + r);
      cnt.set(a, (cnt.get(a) ?? 0) + 1);
    }
    const out = new Map<number, number>();
    for (const [c, s] of sum) out.set(c, s / (cnt.get(c) || 1));
    return out;
  }, [nodes, edges]);

  const visibleHops = useRef(0);

  /* one physics step */
  const tick = useCallback((alpha: number) => {
    const sim = simRef.current;
    const byId = byIdRef.current;
    const es = edgesRef.current;
    const n = sim.length;

    for (let i = 0; i < n; i++) {
      const a = sim[i];
      for (let j = i + 1; j < n; j++) {
        const b = sim[j];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) d2 = 1;
        if (d2 > REPEL_RANGE2) continue;
        const f = (REPEL / d2) * alpha;
        const d = Math.sqrt(d2);
        dx /= d; dy /= d;
        a.vx += dx * f * 0.05; a.vy += dy * f * 0.05;
        b.vx -= dx * f * 0.05; b.vy -= dy * f * 0.05;
      }
    }

    for (const e of es) {
      const a = byId.get(e.source);
      const b = byId.get(e.target);
      if (!a || !b) continue;
      const rho = Math.min(Math.abs(e.corr ?? e.weight), 1);
      const rest = 30 + 90 * (1 - rho);          // strong correlation = short edge
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.max(Math.hypot(dx, dy), 0.01);
      const f = 0.06 * (d - rest) * Math.max(rho, 0.15) * alpha;
      a.vx += (dx / d) * f; a.vy += (dy / d) * f;
      b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
    }

    for (const nd of sim) {
      if (nd.fixed) { nd.vx = 0; nd.vy = 0; continue; }

      // ANCHOR DRIFT — the heart of the morph. Strength ∝ stability.
      if (nd.px != null && nd.py != null) {
        const k = 0.08 * alpha * nd.stability;
        nd.vx += (nd.px - nd.x) * k;
        nd.vy += (nd.py - nd.y) * k;
      }

      nd.vx += (W / 2 - nd.x) * CENTER_PULL * alpha;
      nd.vy += (H / 2 - nd.y) * CENTER_PULL * alpha;
      nd.vx *= DAMPING; nd.vy *= DAMPING;
      nd.x += nd.vx; nd.y += nd.vy;
    }
  }, []);

  /* ---------------- THE TEMPORAL MORPH ENGINE (FOUNDATION §8.1) ----------------
     Never re-lay-out from scratch. Warm-start from the previous positions, reheat
     GENTLY, and anchor each node to where it was with strength ∝ its stability.
     Stable stocks barely move. Stocks whose structural role changed MIGRATE. */
  useEffect(() => {
    if (!nodes.length) return;

    const prev = byIdRef.current;

    // A morph is a move to a genuinely DIFFERENT graph. React StrictMode re-runs this effect
    // with identical data in dev; treating that as a morph would report a displacement that
    // never happened — a fabricated measurement, which is exactly what this site must not do.
    const sig =
      `${nodes.length}:${edges.length}:` +
      nodes.reduce((a, n) => a + n.centrality, 0).toFixed(6) + ":" +
      edges.reduce((a, e) => a + Math.abs(e.corr ?? e.weight), 0).toFixed(6);
    if (sig === sigRef.current && prev.size > 0) return; // same graph — nothing to do
    const isMorph = prev.size > 0;
    sigRef.current = sig;

    // stability = 1 - normalised |Δcentrality|. Real data, no invented constant.
    const deltas = new Map<string, number>();
    let maxD = 0;
    for (const n of nodes) {
      const p = prev.get(n.id);
      const d = p ? Math.abs(n.centrality - p.centrality) : 0;
      deltas.set(n.id, d);
      if (d > maxD) maxD = d;
    }

    const cx = W / 2;
    const cy = H / 2;

    const sim: Sim[] = nodes.map((n, i) => {
      const p = prev.get(n.id);
      const stability = maxD > 1e-9 ? 1 - (deltas.get(n.id) ?? 0) / maxD : 1;
      // a name we've never laid out before is born near the centre
      const th = (i / nodes.length) * Math.PI * 2;
      return {
        ...n,
        x: p?.x ?? cx + Math.cos(th) * 150 + (Math.random() - 0.5) * 40,
        y: p?.y ?? cy + Math.sin(th) * 110 + (Math.random() - 0.5) * 40,
        vx: 0, vy: 0,
        s: 4 + n.centrality * 11,   // radius, world units. Size = centrality.
        px: p?.x,             // anchor target
        py: p?.y,
        stability: isMorph ? stability : 1,
        drift: 0,
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

    simRef.current = sim;
    byIdRef.current = byId;
    adjRef.current = adj;
    edgesRef.current = edges;

    // hull padding targets: padding ∝ (1 − coherence)
    for (const c of new Set(nodes.map((n) => n.cluster))) {
      const coh = coherence.get(c) ?? 0.5;
      const target = 12 + (1 - Math.min(Math.max(coh, 0), 1)) * 26;
      const e = hullPad.current.get(c);
      if (e) e.target = target;
      else hullPad.current.set(c, { cur: target, target });
    }

    // Drift is only meaningful ACROSS a morph. On the very first layout there is nothing to
    // have moved from, so we must not report a number — that would be ornament, not a measurement.
    morphRef.current = isMorph;

    if (isMorph) {
      alphaRef.current = REHEAT;          // relax into the new structure
      decayRef.current = ALPHA_DECAY_WARM;
    } else {
      // first build: settle synchronously so it opens composed, then cool the last of it on screen
      alphaRef.current = 1;
      decayRef.current = ALPHA_DECAY_COLD;
      for (let i = 0; i < 260; i++) tick(0.35);
      view.current.fitted = false;
      alphaRef.current = 0.06;
    }

    // reduced motion: no positional animation at all — converge now, paint one static frame
    if (prefersReducedMotion()) {
      for (let i = 0; i < 300; i++) tick(0.3);
      alphaRef.current = 0;
      view.current.fitted = false;
    }

    dirtyRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, coherence]);

  /* -------------------- fit-to-content zoom (DEFECT 3) -------------------- */
  const fit = useCallback((rw: number, rh: number) => {
    const sim = simRef.current;
    if (!sim.length) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of sim) {
      x0 = Math.min(x0, n.x - n.s); y0 = Math.min(y0, n.y - n.s);
      x1 = Math.max(x1, n.x + n.s); y1 = Math.max(y1, n.y + n.s);
    }
    const m = 40; // room for hulls + labels
    const bw = Math.max(x1 - x0, 1);
    const bh = Math.max(y1 - y0, 1);
    const base = Math.min(rw / W, rh / H);
    // zoom to fit the CONTENT bounding box, not the viewBox
    const k = Math.min((rw - m * 2) / (bw * base), (rh - m * 2) / (bh * base));
    const s = base * k;
    const bx = (x0 + x1) / 2;
    const by = (y0 + y1) / 2;
    view.current.k = k;
    view.current.tx = rw / 2 - (bx * s + (rw - W * s) / 2);
    view.current.ty = rh / 2 - (by * s + (rh - H * s) / 2);
    view.current.fitted = true;
  }, []);

  const proj = useCallback((rw: number, rh: number) => {
    const { k, tx, ty } = view.current;
    const base = Math.min(rw / W, rh / H);
    const s = base * k;
    const ox = (rw - W * s) / 2 + tx;
    const oy = (rh - H * s) / 2 + ty;
    return { s, ox, oy };
  }, []);

  /* -------------------- render -------------------- */
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let rw = 0;
    let rh = 0;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2); // clamp DPR to 2
      rw = r.width; rh = r.height;
      canvas.width = Math.round(rw * dpr);
      canvas.height = Math.round(rh * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      view.current.fitted = false;
      dirtyRef.current = true;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const io = new IntersectionObserver(
      ([e]) => { visibleRef.current = e.isIntersecting; if (e.isIntersecting) dirtyRef.current = true; },
      { threshold: 0 }
    );
    io.observe(wrap);

    const draw = () => {
      const sim = simRef.current;
      const sc = scaleRef.current;
      if (!sim.length || !rw) return;
      if (!view.current.fitted) fit(rw, rh);
      const { s, ox, oy } = proj(rw, rh);
      const X = (x: number) => x * s + ox;
      const Y = (y: number) => y * s + oy;

      ctx.clearRect(0, 0, rw, rh);

      const hot = hoverRef.current ?? selRef.current;
      const hops = hopRef.current;

      /* ---- hulls: engraved regions on the faceplate ---- */
      const groups = new Map<number, Array<[number, number]>>();
      for (const n of sim) {
        if (!groups.has(n.cluster)) groups.set(n.cluster, []);
        groups.get(n.cluster)!.push([n.x, n.y]);
      }
      for (const [c, pts] of groups) {
        if (pts.length < 3) continue;
        const pad = hullPad.current.get(c);
        if (!pad) continue;
        pad.cur += (pad.target - pad.cur) * 0.12; // eases; does NOT oscillate forever
        const poly = chaikin(inflate(convexHull(pts), pad.cur), 2);
        if (poly.length < 3) continue;
        const col = sc.color(c);
        const p = new Path2D();
        p.moveTo(X(poly[0][0]), Y(poly[0][1]));
        for (let i = 1; i < poly.length; i++) p.lineTo(X(poly[i][0]), Y(poly[i][1]));
        p.closePath();
        ctx.globalAlpha = hot ? 0.03 : 0.06;
        ctx.fillStyle = col;
        ctx.fill(p);
        ctx.globalAlpha = hot ? 0.12 : 0.25;
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.stroke(p);
      }
      ctx.globalAlpha = 1;

      /* ---- edges: hairlines, 3-pass additive. Batched by bucket (Path2D), not per edge. ---- */
      const es = edgesRef.current;
      const lit = new Path2D();
      const dim = new Path2D();
      for (const e of es) {
        const a = byIdRef.current.get(e.source);
        const b = byIdRef.current.get(e.target);
        if (!a || !b) continue;
        const on = !hot || hops.has(e.source) || hops.has(e.target);
        const p = on ? lit : dim;
        p.moveTo(X(a.x), Y(a.y));
        p.lineTo(X(b.x), Y(b.y));
      }
      ctx.strokeStyle = "#8a93a6";
      ctx.globalAlpha = 0.05;
      ctx.lineWidth = 1;
      ctx.stroke(dim);

      // three passes, wide+faint -> narrow+bright. Real luminous depth; the widest stays faint,
      // because this is a PLOT, not a neon sign.
      ctx.globalCompositeOperation = "lighter";
      const passes: Array<[number, number, string]> = [
        [3.0, 0.045, "#7f8ba3"],
        [1.6, 0.10, "#aab4c6"],
        [0.8, 0.34, "#d7dde7"],
      ];
      for (const [lw, al, col] of passes) {
        ctx.lineWidth = lw;
        ctx.globalAlpha = al;
        ctx.strokeStyle = col;
        ctx.stroke(lit);
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;

      /* ---- nodes: CIRCLES (client direction — overrides DIRECTION-A §5 "squares"). ---- */
      const ranked = [...sim].sort((a, b) => b.centrality - a.centrality);
      const labelSet = new Set(ranked.slice(0, LABEL_TOP_K).map((n) => n.id));
      if (hot) {
        labelSet.clear();
        for (const [id, h] of hops) if (h <= 1) labelSet.add(id);
      }

      // label collision: draw in centrality order and drop any label whose box would
      // overlap one already placed. An unreadable label is worse than no label.
      // only labels contend for space with each other — reserving all 49 node boxes as well
      // starved the layout and culled almost every label, which defeats the point.
      const placed: Array<[number, number, number, number]> = [];
      const fits = (x: number, y: number, w: number, h: number) => {
        for (const [px, py, pw, ph] of placed) {
          if (x < px + pw && px < x + w && y < py + ph && py < y + h) return false;
        }
        placed.push([x, y, w, h]);
        return true;
      };

      for (const n of sim) {
        const hop = hops.get(n.id);
        const isHot = n.id === hot;
        const on = !hot || hop !== undefined;
        const col = sc.color(n.cluster);
        const cx = X(n.x);
        const cy = Y(n.y);
        const half = Math.max(n.s * s, 2.5) * (isHot ? 1.3 : 1);

        ctx.globalAlpha = on ? 1 : 0.16;

        // fill: inlaid enamel in the faceplate
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(cx, cy, half, 0, Math.PI * 2);
        ctx.fill();

        // a node that MIGRATED gets an amber ring — displacement is a measured value
        if (n.drift > 26) {
          ctx.strokeStyle = "#ff9e2c";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(cx, cy, half + 4, 0, Math.PI * 2);
          ctx.stroke();
        }

        if (isHot) {
          ctx.strokeStyle = "#e8eaed";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(cx, cy, half + 3, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.globalAlpha = 1;
      }

      // labels LAST, in centrality order, so the most-central name wins any collision
      ctx.font = `500 10px ui-monospace, "SF Mono", Menlo, monospace`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      for (const n of ranked) {
        if (!labelSet.has(n.id)) continue;
        const isHot = n.id === hot;
        const cx = X(n.x);
        const cy = Y(n.y);
        const half = Math.max(n.s * s, 2.5) * (isHot ? 1.3 : 1);
        const w = ctx.measureText(n.symbol).width;
        const lx = cx - w / 2;
        const ly = cy + half + 5;
        if (!fits(lx - 3, ly - 2, w + 6, 13)) continue;
        ctx.fillStyle = isHot ? "#e8eaed" : "#a8adb8";
        ctx.fillText(n.symbol, lx, ly);
      }
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!visibleRef.current) return; // pause off-screen

      const a = alphaRef.current;
      if (a > ALPHA_MIN) {
        tick(a);
        // COOLING. This is DEFECT 2. The loop must be able to stop doing work.
        alphaRef.current = a * (1 - decayRef.current);
        if (alphaRef.current <= ALPHA_MIN) {
          alphaRef.current = 0;
          // the morph is over — record how far everything actually moved
          if (morphRef.current) {
            const rows: Array<{ symbol: string; drift: number; stability: number }> = [];
            for (const n of simRef.current) {
              if (n.px != null && n.py != null) n.drift = Math.hypot(n.x - n.px, n.y - n.py);
              rows.push({ symbol: n.symbol, drift: n.drift, stability: n.stability });
            }
            onDrift?.(rows.sort((p, q) => q.drift - p.drift));
          }
          view.current.fitted = false; // re-fit once it has come to rest
        }
        dirtyRef.current = true;
      }

      // hop-by-hop hover trace: reveal the influence neighbourhood one ring at a time
      if (hoverRef.current && hopRef.current.size) {
        const elapsed = performance.now() - hoverAtRef.current;
        const maxHop = Math.floor(elapsed / 70);
        const want = new Map<string, number>();
        for (const [id, h] of hopRef.current) if (h <= maxHop) want.set(id, h);
        if (want.size !== visibleHops.current) {
          visibleHops.current = want.size;
          dirtyRef.current = true;
        }
      }

      if (!dirtyRef.current) return; // <- the canvas goes QUIET
      dirtyRef.current = false;
      draw();
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit, proj, tick, onDrift]);

  /* -------------------- picking -------------------- */
  const pick = useCallback((cx: number, cy: number): Sim | null => {
    const canvas = canvasRef.current;
    const sim = simRef.current;
    if (!canvas || !sim.length) return null;
    const r = canvas.getBoundingClientRect();
    const { s, ox, oy } = proj(r.width, r.height);
    let best: Sim | null = null;
    let bd = Infinity;
    for (const n of sim) {
      const dx = cx - (n.x * s + ox);
      const dy = cy - (n.y * s + oy);
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = n; }
    }
    // snap radius — generous, this is a crosshair not a pixel hunt
    return best && bd < 48 * 48 ? best : null;
  }, [proj]);

  const toGraph = (cx: number, cy: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const { s, ox, oy } = proj(r.width, r.height);
    return { x: (cx - ox) / s, y: (cy - oy) / s };
  };

  const setHover = (id: string | null) => {
    if (id === hoverRef.current) return;
    hoverRef.current = id;
    hoverAtRef.current = performance.now();
    visibleHops.current = 0;
    const hops = new Map<string, number>();
    if (id) {
      // BFS by hop — a tight cluster flashes at once; a BRIDGE lights in slow thin chains
      hops.set(id, 0);
      let frontier = [id];
      for (let h = 1; h <= 3 && frontier.length; h++) {
        const next: string[] = [];
        for (const f of frontier) {
          for (const nb of adjRef.current.get(f) ?? []) {
            if (!hops.has(nb)) { hops.set(nb, h); next.push(nb); }
          }
        }
        frontier = next;
      }
    }
    hopRef.current = hops;
    dirtyRef.current = true;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const cx = e.clientX - r.left;
    const cy = e.clientY - r.top;
    const n = pick(cx, cy);
    e.currentTarget.setPointerCapture(e.pointerId);
    if (n) {
      drag.current = { node: n, panning: false, lx: cx, ly: cy, moved: 0 };
      n.fixed = true;
    } else {
      drag.current = { node: null, panning: true, lx: cx, ly: cy, moved: 0 };
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const cx = e.clientX - r.left;
    const cy = e.clientY - r.top;
    const d = drag.current;

    if (d.node) {
      const p = toGraph(cx, cy);
      d.node.x = p.x;
      d.node.y = p.y;
      d.moved += Math.abs(cx - d.lx) + Math.abs(cy - d.ly);
      d.lx = cx; d.ly = cy;
      if (!prefersReducedMotion()) {
        alphaRef.current = Math.max(alphaRef.current, 0.12); // reheat on drag
        decayRef.current = ALPHA_DECAY_WARM;
      }
      dirtyRef.current = true;
      return;
    }
    if (d.panning) {
      view.current.tx += cx - d.lx;
      view.current.ty += cy - d.ly;
      d.moved += Math.abs(cx - d.lx) + Math.abs(cy - d.ly);
      d.lx = cx; d.ly = cy;
      dirtyRef.current = true;
      return;
    }

    setCrosshair({ x: cx, y: cy });
    const n = pick(cx, cy);
    setHover(n?.id ?? null);
    setReadout(
      n
        ? {
            sym: n.symbol,
            cluster: scaleRef.current.label(n.cluster),
            cent: n.centrality,
            x: cx,
            y: cy,
          }
        : null
    );
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (d.node) {
      d.node.fixed = false;
      if (d.moved < 5) onSelect(selRef.current === d.node.id ? null : d.node.id);
    } else if (d.panning && d.moved < 5) {
      onSelect(null);
    }
    drag.current = { node: null, panning: false, lx: 0, ly: 0, moved: 0 };
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const cx = e.clientX - r.left;
    const cy = e.clientY - r.top;
    const before = toGraph(cx, cy);
    view.current.k = Math.max(0.4, Math.min(5, view.current.k * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
    const after = toGraph(cx, cy);
    const { s } = proj(r.width, r.height);
    view.current.tx += (after.x - before.x) * s;
    view.current.ty += (after.y - before.y) * s;
    dirtyRef.current = true;
  };

  return (
    <div className="gc" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className="gc-canvas"
        style={{ height }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          setHover(null);
          setReadout(null);
          setCrosshair(null);
        }}
        onWheel={onWheel}
      />

      {/* CROSSHAIR — two 1px hairlines, mix-blend-mode:difference, inverting against whatever
          is beneath. An oscilloscope gesture, not a pointer. */}
      {crosshair && (
        <>
          <span className="gc-cross-v" style={{ left: crosshair.x }} aria-hidden="true" />
          <span className="gc-cross-h" style={{ top: crosshair.y }} aria-hidden="true" />
        </>
      )}

      {readout && (
        <div
          className="gc-readout"
          style={{
            left: Math.min(readout.x + 12, (canvasRef.current?.clientWidth ?? 800) - 210),
            top: Math.max(readout.y - 34, 6),
          }}
        >
          <b>{readout.sym}</b>
          <span className="gc-sep">·</span>
          <span>{readout.cluster}</span>
          <span className="gc-sep">·</span>
          <span>
            eig <i className="sig">{readout.cent.toFixed(3)}</i>
          </span>
        </div>
      )}

      <span className="gc-hint label">scroll zoom · drag node · drag plate to pan</span>
    </div>
  );
}
