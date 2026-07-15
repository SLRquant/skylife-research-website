"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildClusterScale, type ClusterScale } from "@/components/graph-stats/colors";

export type GNode = {
  id: string;
  symbol: string;
  cluster: number;
  centrality: number; // 0..1, normalised by the caller — drives node SIZE only
  /** The un-normalised metric, when the caller has it. The hover readout must show THIS:
      the normalised value is a size scale, and printing it as "eig" misreports the number
      (the top node would always read 1.000 regardless of its true centrality). */
  raw?: number;
};
export type GEdge = { source: string; target: string; weight: number; corr?: number };

type Sim = GNode & {
  x: number; y: number; vx: number; vy: number;
  s: number;              // radius, world units
  px?: number; py?: number; // anchor target = position at the previous step
  stability: number;      // 0..1 — 1 = structural role unchanged
  drift: number;          // world-units moved by the last morph — a LAYOUT quantity, not a market one
  dcent: number;          // |Δ centrality| across the window change — the real, reportable number
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

/**
 * Labels: EVERY node asks for one; a greedy collision pass in centrality order decides who
 * actually gets it. The most central names always win the space, less central ones appear
 * wherever there's room — and zooming in frees room, so labels reveal progressively (the
 * Obsidian-graph behaviour people intuitively expect). The top HUB_K hubs render brighter
 * and a step larger, so the eye finds the market's core names first.
 */
const HUB_K = 7;

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

export type GraphCanvasHandle = { drift: Array<{ symbol: string; drift: number; stability: number; dcent: number }> };

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
  onDrift?: (rows: Array<{ symbol: string; drift: number; stability: number; dcent: number }>) => void;
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
        // The RAW |Δcentrality|, not the normalised one. `stability` divides by the round's biggest
        // mover, which makes it relative to whoever else happened to move; this is the absolute
        // change, on the same 0..1 scale as the centrality shown everywhere else on the page.
        dcent: isMorph ? (deltas.get(n.id) ?? 0) : 0,
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
    const m = 56; // room for hulls + the label row under edge nodes
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

      /* ---- vignette: the plate reads as a recessed screen. Drawn FIRST (pure background
              depth) so no node or label ever loses brightness to it. ---- */
      const vg = ctx.createRadialGradient(
        rw / 2, rh / 2, Math.min(rw, rh) * 0.30,
        rw / 2, rh / 2, Math.max(rw, rh) * 0.75
      );
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.30)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, rw, rh);

      /* ---- hulls: a WHISPER of territory, not filled continents. The old alphas (.06 fill /
              .25 stroke) stacked wherever communities overlap and turned the middle of the
              plate to mud — the single biggest reason the graph read "dull". ---- */
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
        const poly = chaikin(inflate(convexHull(pts), pad.cur), 3);
        if (poly.length < 3) continue;
        const col = sc.color(c);
        const p = new Path2D();
        p.moveTo(X(poly[0][0]), Y(poly[0][1]));
        for (let i = 1; i < poly.length; i++) p.lineTo(X(poly[i][0]), Y(poly[i][1]));
        p.closePath();
        // fill only — atmosphere, not shape. A visible outline is a claim the hull can't
        // honestly make (convex hulls of overlapping communities draw wrong shapes).
        ctx.globalAlpha = hot ? 0.015 : 0.035;
        ctx.fillStyle = col;
        ctx.fill(p);
        ctx.globalAlpha = hot ? 0.03 : 0.06;
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.stroke(p);
      }
      ctx.globalAlpha = 1;

      /* ---- edges ----
         At rest: |corr| decides how much an edge is allowed to say. Three weight tiers —
         strong ties visibly brighter/wider than weak ones — so the eye reads STRUCTURE
         instead of a uniform hairball (142 identical lines was the hairball).
         On hover: an edge lights only if BOTH endpoints are inside the traced neighbourhood
         (either-endpoint lit half the graph), and its brightness falls off with hop ring, so
         the BFS ripple has depth. Everything else drops to a ghost. */
      const es = edgesRef.current;
      let wMin = Infinity, wMax = -Infinity;
      for (const e of es) {
        const w = Math.abs(e.corr ?? e.weight);
        if (w < wMin) wMin = w;
        if (w > wMax) wMax = w;
      }
      const wSpan = wMax - wMin || 1;

      if (!hot) {
        // Within-community edges are TINTED toward their cluster colour; cross-community
        // edges stay neutral. Clusters then cohere visually with no hull geometry at all —
        // the cleanest community encoding there is (colouring the ties, not the territory).
        const cross = [new Path2D(), new Path2D(), new Path2D()];
        const intra = new Map<number, [Path2D, Path2D, Path2D]>();
        for (const e of es) {
          const a = byIdRef.current.get(e.source);
          const b = byIdRef.current.get(e.target);
          if (!a || !b) continue;
          const t = (Math.abs(e.corr ?? e.weight) - wMin) / wSpan;
          const tier = t < 0.34 ? 0 : t < 0.67 ? 1 : 2;
          let p: Path2D;
          if (a.cluster === b.cluster) {
            let set = intra.get(a.cluster);
            if (!set) { set = [new Path2D(), new Path2D(), new Path2D()]; intra.set(a.cluster, set); }
            p = set[tier];
          } else {
            p = cross[tier];
          }
          p.moveTo(X(a.x), Y(a.y));
          p.lineTo(X(b.x), Y(b.y));
        }
        // weak ties barely present; the strongest correlations carry the picture
        const lws = [0.6, 0.9, 1.4];
        const crossAlpha = [0.06, 0.12, 0.22];
        const crossCol = ["#7f8ba3", "#98a2b6", "#c3cbd9"];
        for (let i = 0; i < 3; i++) {
          ctx.lineWidth = lws[i];
          ctx.globalAlpha = crossAlpha[i];
          ctx.strokeStyle = crossCol[i];
          ctx.stroke(cross[i]);
        }
        const intraAlpha = [0.10, 0.18, 0.32];
        for (const [c, set] of intra) {
          ctx.strokeStyle = sc.color(c);
          for (let i = 0; i < 3; i++) {
            ctx.lineWidth = lws[i];
            ctx.globalAlpha = intraAlpha[i];
            ctx.stroke(set[i]);
          }
        }
        ctx.globalAlpha = 1;
      } else {
        const ghost = new Path2D();
        const rings = [new Path2D(), new Path2D(), new Path2D()]; // by hop ring 0/1/2+
        for (const e of es) {
          const a = byIdRef.current.get(e.source);
          const b = byIdRef.current.get(e.target);
          if (!a || !b) continue;
          const ha = hops.get(e.source);
          const hb = hops.get(e.target);
          const p = ha === undefined || hb === undefined
            ? ghost
            : rings[Math.min(Math.min(ha, hb), 2)];
          p.moveTo(X(a.x), Y(a.y));
          p.lineTo(X(b.x), Y(b.y));
        }
        ctx.strokeStyle = "#8a93a6";
        ctx.globalAlpha = 0.02;
        ctx.lineWidth = 0.8;
        ctx.stroke(ghost);

        // the traced neighbourhood: 3-pass additive on ring 0, fading through the rings.
        // Wide+faint -> narrow+bright; the widest stays faint — a PLOT, not a neon sign.
        ctx.globalCompositeOperation = "lighter";
        const passes: Array<[number, number, string]> = [
          [3.0, 0.045, "#7f8ba3"],
          [1.6, 0.10, "#aab4c6"],
          [0.8, 0.34, "#d7dde7"],
        ];
        const ringGain = [1, 0.45, 0.18];
        for (let r = 0; r < 3; r++) {
          for (const [lw, al, col] of passes) {
            ctx.lineWidth = lw;
            ctx.globalAlpha = al * ringGain[r];
            ctx.strokeStyle = col;
            ctx.stroke(rings[r]);
          }
        }
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
      }

      /* ---- nodes: CIRCLES (client direction — overrides DIRECTION-A §5 "squares"). ---- */
      const ranked = [...sim].sort((a, b) => b.centrality - a.centrality);
      const hubs = new Set(ranked.slice(0, HUB_K).map((n) => n.id));

      // Nodes grow SUBLINEARLY with zoom (r ∝ k^0.6): zooming in opens space for labels
      // instead of inflating balloons — the whole point of zooming here is to read names.
      const kAdj = Math.pow(Math.max(view.current.k, 0.01), -0.4);
      const rOf = (n: Sim, isHot: boolean) =>
        Math.max(n.s * s * kAdj, 2.5) * (isHot ? 1.3 : 1);

      for (const n of sim) {
        const hop = hops.get(n.id);
        const isHot = n.id === hot;
        const on = !hot || hop !== undefined;
        const col = sc.color(n.cluster);
        const cx = X(n.x);
        const cy = Y(n.y);
        const half = rOf(n, isHot);

        ctx.globalAlpha = on ? 1 : 0.12;

        // the traced neighbourhood glows in its own cluster colour — the payoff of hovering.
        // shadowBlur is expensive, so it's spent ONLY on the ≤ dozen hover-lit nodes.
        if (hot && hop !== undefined && hop <= 1) {
          ctx.shadowColor = col;
          ctx.shadowBlur = isHot ? 22 : 10;
        }

        // fill: inlaid enamel in the faceplate
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(cx, cy, half, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // a hairline rim lifts every node off the edge lines beneath it — the single
        // cheapest "crispness" trick a dark scatter has
        ctx.strokeStyle = "rgba(232,234,237,0.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, half, 0, Math.PI * 2);
        ctx.stroke();

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

      /* ---- labels LAST, above everything ----
         Every node asks; a greedy collision pass in centrality order decides. Two candidate
         slots (below the node, then above) before giving up — zooming in frees space, so
         more names appear the closer you look. Text renders with a dark HALO so it stays
         legible even when it crosses an edge line; without the halo, labels sink into the
         hairline layer (exactly what the old plate suffered from). */
      const placed: Array<[number, number, number, number]> = [];
      const collides = (x: number, y: number, w: number, h: number) => {
        for (const [px, py, pw, ph] of placed) {
          if (x < px + pw && px < x + w && y < py + ph && py < y + h) return true;
        }
        return false;
      };

      // during a hover, only the traced neighbourhood keeps labels — focus over census
      const order = hot ? ranked.filter((n) => (hops.get(n.id) ?? 9) <= 1) : ranked;

      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.lineJoin = "round";
      for (const n of order) {
        const isHot = n.id === hot;
        const isHub = hubs.has(n.id);
        const cx = X(n.x);
        const cy = Y(n.y);
        const half = rOf(n, isHot);

        const fpx = isHot ? 12 : isHub ? 11 : 9.5;
        ctx.font = `${isHub || isHot ? 600 : 500} ${fpx}px ui-monospace, "SF Mono", Menlo, monospace`;
        const w = ctx.measureText(n.symbol).width;
        const fh = fpx + 3;

        // slot 1: centred below the node; slot 2: centred above. First fit wins.
        let ly = cy + half + 4;
        if (collides(cx - w / 2 - 3, ly - 1, w + 6, fh)) {
          ly = cy - half - 4 - fh;
          if (collides(cx - w / 2 - 3, ly - 1, w + 6, fh)) continue;
        }
        placed.push([cx - w / 2 - 3, ly - 1, w + 6, fh]);

        // halo first (the plate colour), then the ink
        ctx.strokeStyle = "rgba(11,15,25,0.88)";
        ctx.lineWidth = 3;
        ctx.strokeText(n.symbol, cx, ly);
        ctx.fillStyle = isHot ? "#ffffff" : isHub ? "#dfe3ea" : "#9aa3b2";
        ctx.fillText(n.symbol, cx, ly);
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
            const rows: Array<{ symbol: string; drift: number; stability: number; dcent: number }> = [];
            for (const n of simRef.current) {
              if (n.px != null && n.py != null) n.drift = Math.hypot(n.x - n.px, n.y - n.py);
              rows.push({ symbol: n.symbol, drift: n.drift, stability: n.stability, dcent: n.dcent });
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
            cent: n.raw ?? n.centrality,
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
