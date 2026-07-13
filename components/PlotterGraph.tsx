"use client";

/**
 * PlotterGraph — the signature element.
 *
 * The market correlation graph, DRAWN rather than rendered: hairline strokes, hatched community
 * hulls, and a real 8x8 Bayer ordered-dither pass in WebGL2. It replaces the old GraphCanvas.
 *
 * Three things here are load-bearing:
 *
 *  1. THE TEMPORAL MORPH (FOUNDATION §8.1). Between frames the layout is never rebuilt from
 *     scratch. It warm-starts from the previous positions, reheats gently (alpha 0.15), and each
 *     node is anchored to where it just was with a strength proportional to its STABILITY
 *     (1 − normalised |Δcentrality|). Stable stocks barely move; stocks whose structural role
 *     actually changed migrate visibly. Displacement is the message.
 *
 *  2. THE SIMULATION COOLS. d3's own timer is stopped and we tick manually inside one rAF loop
 *     that EXITS when alpha < ALPHA_MIN and nothing is animating. The old component ticked
 *     forever — Playwright could not even screenshot it. (DEFECT 2)
 *
 *  3. THE VIEW FITS THE CONTENT, not the viewBox — the node bounding box is measured every frame
 *     and the transform eases toward it, so the graph fills its canvas instead of sitting in a
 *     small disc surrounded by dead space. (DEFECT 3)
 *
 * Layering, which is the whole print conceit:
 *     plate (offscreen 2D)  -> structure: hulls, hatching, edges, nodes    -> gets DITHERED
 *     gl (visible)          -> the Bayer pass, or a straight blit if no WebGL2
 *     overlay (visible 2D)  -> type: labels, hover ring, focus ring        -> stays CRISP
 * A printed figure is screened; the type set on top of it is not.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationNodeDatum,
} from "d3";
import { clusterInk, hatchAngle } from "@/components/graph-stats/colors";

/* ---------------------------------------------------------------- types ---- */

export type PFrame = {
  lookback: number;
  asOf: string | null;
  nodes: Array<{ id: string; community: number; centrality: number }>;
  edges: Array<{ source: string; target: string; rho: number }>;
  nCommunities: number;
  modularity: number | null;
};

type PNode = SimulationNodeDatum & {
  id: string;
  community: number;
  centrality: number;
  /** anchor target = where this node sat in the PREVIOUS frame */
  ax?: number;
  ay?: number;
  /** 0..1 — how little this node's centrality moved between frames */
  stability: number;
  /** px it travelled in the last morph; drives the displacement tick */
  drift: number;
  r: number;
  fixed?: boolean;
};
type PLink = { source: string | PNode; target: string | PNode; rho: number };

/* ------------------------------------------------------------ constants ---- */

const ALPHA_MIN = 0.005;
const REHEAT = 0.15;      // FOUNDATION §8.1 — relax into the new structure, don't re-solve it
const DECAY_MORPH = 0.06; // ~40 ticks
const DECAY_COLD = 0.022; // first layout gets longer to find itself
const HOP_MS = 70;        // hop-by-hop hover trace cadence

/* The screen. 3 levels + a 2px cell is what makes it read as a PRINTED halftone rather than as
   an anti-aliased vector: at 4 levels / 1px cell the Bayer pattern is below the eye's pitch and
   the whole point is lost. */
const DITHER_LEVELS = 3.0;
const DITHER_CELL = 2;

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ------------------------------------------------------- the Bayer pass ---- */

const BAYER8 = [
   0, 32,  8, 40,  2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44,  4, 36, 14, 46,  6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
   3, 35, 11, 43,  1, 33,  9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47,  7, 39, 13, 45,  5, 37,
  63, 31, 55, 23, 61, 29, 53, 21,
];

const VERT = `#version 300 es
void main() {
  // one fullscreen triangle, no buffers
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2  uRes;
uniform float uLevels;
uniform float uScale;   // dither cell size in device px
out vec4 outColor;

const float bayer[64] = float[64](${BAYER8.join(".0,")}.0);

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  uv.y = 1.0 - uv.y;                    // canvas2d is y-down
  vec3 c = texture(uTex, uv).rgb;

  ivec2 cell = ivec2(floor(gl_FragCoord.xy / uScale));
  int idx = (((cell.y % 8) + 8) % 8) * 8 + (((cell.x % 8) + 8) % 8);
  float t = (bayer[idx] + 0.5) / 64.0;  // ordered threshold in [0,1)

  // Per-channel ordered dither. Quantising each channel through the Bayer matrix keeps HUE
  // (so cluster inks survive) while producing a true ordered-dither screen, not a noise filter.
  vec3 q = floor(c * uLevels + t) / uLevels;
  outColor = vec4(clamp(q, 0.0, 1.0), 1.0);
}`;

function initGL(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl2", {
    antialias: false,
    preserveDrawingBuffer: true, // so Playwright / toDataURL can actually capture the plate
  });
  if (!gl) return null;

  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn("[dither]", gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  };
  const vs = sh(gl.VERTEX_SHADER, VERT);
  const fs = sh(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;

  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn("[dither]", gl.getProgramInfoLog(prog));
    return null;
  }

  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const vao = gl.createVertexArray();
  const u = {
    tex: gl.getUniformLocation(prog, "uTex"),
    res: gl.getUniformLocation(prog, "uRes"),
    levels: gl.getUniformLocation(prog, "uLevels"),
    scale: gl.getUniformLocation(prog, "uScale"),
  };

  return {
    draw(plate: HTMLCanvasElement, cellPx: number) {
      if (canvas.width !== plate.width || canvas.height !== plate.height) {
        canvas.width = plate.width;
        canvas.height = plate.height;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(prog);
      gl.bindVertexArray(vao);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, plate);
      gl.uniform1i(u.tex, 0);
      gl.uniform2f(u.res, canvas.width, canvas.height);
      gl.uniform1f(u.levels, DITHER_LEVELS);
      gl.uniform1f(u.scale, cellPx);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
}

/* -------------------------------------------------------------- geometry --- */

function convexHull(pts: Array<[number, number]>): Array<[number, number]> {
  if (pts.length < 3) return pts;
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: number[], a: number[], b: number[]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (src: Array<[number, number]>) => {
    const h: Array<[number, number]> = [];
    for (const q of src) {
      while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop();
      h.push(q);
    }
    h.pop();
    return h;
  };
  return [...half(p), ...half([...p].reverse())];
}

/** Inflate along vertex normals, then 2x Chaikin — a soft, drawn-looking boundary. */
function inflate(hull: Array<[number, number]>, pad: number): Array<[number, number]> {
  const n = hull.length;
  if (n < 3) return hull;
  const cx = hull.reduce((s, p) => s + p[0], 0) / n;
  const cy = hull.reduce((s, p) => s + p[1], 0) / n;
  let out = hull.map(([x, y]) => {
    const dx = x - cx, dy = y - cy;
    const d = Math.hypot(dx, dy) || 1;
    return [x + (dx / d) * pad, y + (dy / d) * pad] as [number, number];
  });
  for (let k = 0; k < 2; k++) {
    const next: Array<[number, number]> = [];
    for (let i = 0; i < out.length; i++) {
      const a = out[i], b = out[(i + 1) % out.length];
      next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      next.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    out = next;
  }
  return out;
}

const hullPath = (pts: Array<[number, number]>) => {
  const p = new Path2D();
  if (!pts.length) return p;
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
  p.closePath();
  return p;
};

/* ============================================================== component === */

export function PlotterGraph({
  frames,
  frame = 0,
  height = 560,
  selected = null,
  onSelect,
  dither = true,
  labelTopK = 10,
  className = "",
}: {
  frames: PFrame[];
  frame?: number;
  height?: number;
  selected?: string | null;
  onSelect?: (id: string | null) => void;
  dither?: boolean;
  labelTopK?: number;
  className?: string;
}) {
  const plateRef = useRef<HTMLCanvasElement>(null);   // offscreen structure layer
  const glRef = useRef<HTMLCanvasElement>(null);      // dithered output
  const overlayRef = useRef<HTMLCanvasElement>(null); // crisp type layer
  const wrapRef = useRef<HTMLDivElement>(null);

  const simRef = useRef<Simulation<PNode, PLink> | null>(null);
  const nodesRef = useRef<PNode[]>([]);
  const linksRef = useRef<PLink[]>([]);
  const adjRef = useRef<Map<string, Set<string>>>(new Map());
  const ditherRef = useRef<ReturnType<typeof initGL> | null>(null);

  const view = useRef({ k: 1, tx: 0, ty: 0, init: false });
  const userView = useRef(false); // once the user pans/zooms, stop auto-fitting
  const viewSettled = useRef(true); // has the eased transform ARRIVED at the content bbox?
  const drag = useRef<{ node: PNode | null; pan: boolean; x: number; y: number; moved: number }>({
    node: null, pan: false, x: 0, y: 0, moved: 0,
  });

  const hoverRef = useRef<string | null>(null);
  const hopRef = useRef<{ levels: Map<string, number>; t0: number } | null>(null);
  const selRef = useRef(selected);
  selRef.current = selected;

  const rafRef = useRef(0);
  const runningRef = useRef(false);
  const visibleRef = useRef(true);
  const themeRef = useRef({ ink: "#16150f", paper: "#ffffff", rule: "#999", signal: "#b23a1e", mute: "#8a857a" });

  const [tip, setTip] = useState<{ id: string; x: number; y: number; c: number; cen: number; drift: number } | null>(null);
  const [glOK, setGlOK] = useState(true);

  const cur = frames[Math.min(frame, Math.max(frames.length - 1, 0))];

  /** Mean |rho| of a community's internal edges = how coherent it actually is. Real number. */
  const coherence = useMemo(() => {
    const out = new Map<number, number>();
    if (!cur) return out;
    const m = new Map<number, { s: number; n: number }>();
    const comm = new Map(cur.nodes.map((n) => [n.id, n.community]));
    for (const e of cur.edges) {
      const a = comm.get(e.source), b = comm.get(e.target);
      if (a === undefined || a !== b) continue;
      const rec = m.get(a) ?? { s: 0, n: 0 };
      rec.s += Math.abs(e.rho);
      rec.n += 1;
      m.set(a, rec);
    }
    for (const [k, v] of m) out.set(k, v.n ? v.s / v.n : 0);
    return out;
  }, [cur]);

  /* ---- read the live theme so the plate is drawn in the current mode's inks ---- */
  const readTheme = useCallback(() => {
    if (!wrapRef.current) return;
    const cs = getComputedStyle(wrapRef.current);
    const v = (n: string, f: string) => cs.getPropertyValue(n).trim() || f;
    themeRef.current = {
      ink: v("--ink", "#16150f"),
      paper: v("--plate", "#ffffff"),
      rule: v("--rule-solid", "#c9c3b6"),
      signal: v("--signal", "#b23a1e"),
      mute: v("--ink-3", "#8a857a"),
    };
  }, []);

  /* ---------------------------------------------------------------- draw ---- */
  const draw = useCallback(() => {
    const plate = plateRef.current;
    const overlay = overlayRef.current;
    const wrap = wrapRef.current;
    if (!plate || !overlay || !wrap) return;

    const rect = wrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.max(1, Math.round(rect.width));
    const H = Math.max(1, Math.round(height));

    for (const c of [plate, overlay]) {
      if (c.width !== W * dpr || c.height !== H * dpr) {
        c.width = W * dpr;
        c.height = H * dpr;
      }
    }
    const g = plate.getContext("2d")!;
    const o = overlay.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    o.setTransform(dpr, 0, 0, dpr, 0, 0);

    const T = themeRef.current;
    const nodes = nodesRef.current;

    // ---- fit-to-CONTENT (DEFECT 3): measure the node bbox, ease the transform onto it
    if (nodes.length) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const n of nodes) {
        x0 = Math.min(x0, n.x! - n.r); y0 = Math.min(y0, n.y! - n.r);
        x1 = Math.max(x1, n.x! + n.r); y1 = Math.max(y1, n.y! + n.r);
      }
      const M = 46; // room for labels
      const k = Math.min((W - M * 2) / Math.max(x1 - x0, 1), (H - M * 2) / Math.max(y1 - y0, 1));
      const target = {
        k,
        tx: W / 2 - ((x0 + x1) / 2) * k,
        ty: H / 2 - ((y0 + y1) / 2) * k,
      };
      if (!userView.current) {
        const v = view.current;
        const e = v.init ? 0.12 : 1; // snap the first time, ease thereafter
        v.k += (target.k - v.k) * e;
        v.tx += (target.tx - v.tx) * e;
        v.ty += (target.ty - v.ty) * e;
        v.init = true;
        // The loop must not cool while the transform is still mid-ease, or the view freezes
        // part-way and the graph sits cropped. The rAF keeps going until this is true.
        viewSettled.current =
          Math.abs(target.k - v.k) < 1e-3 &&
          Math.abs(target.tx - v.tx) < 0.5 &&
          Math.abs(target.ty - v.ty) < 0.5;
      } else {
        viewSettled.current = true;
      }
    }
    const { k, tx, ty } = view.current;
    const X = (x: number) => x * k + tx;
    const Y = (y: number) => y * k + ty;

    /* ============ PLATE — the structure. This is what gets screened. ============ */
    g.fillStyle = T.paper;
    g.fillRect(0, 0, W, H);

    const hot = hoverRef.current ?? selRef.current;
    const hop = hopRef.current;
    const hopVisible = (id: string) => {
      if (!hot) return true;
      if (!hop) return id === hot;
      const lvl = hop.levels.get(id);
      if (lvl === undefined) return false;
      const elapsed = performance.now() - hop.t0;
      return reducedMotion() ? true : elapsed >= lvl * HOP_MS;
    };

    // ---- community hulls, HATCHED not filled (the secondary encoding, per Direction B §5.1)
    const byComm = new Map<number, PNode[]>();
    for (const n of nodes) {
      if (!byComm.has(n.community)) byComm.set(n.community, []);
      byComm.get(n.community)!.push(n);
    }
    for (const [c, members] of byComm) {
      if (members.length < 3) continue;
      const coh = coherence.get(c) ?? 0.5;
      // padding is DATA: a loose community swells, a tightening one contracts.
      // Kept tight — a fat hull on a sprawling MST swallows its neighbours and the plate turns
      // to mush. The SWELL is the signal, so it has to be readable against a quiet baseline.
      const pad = 6 + (1 - coh) * 16;
      const pts = inflate(convexHull(members.map((n) => [X(n.x!), Y(n.y!)] as [number, number])), pad);
      if (pts.length < 3) continue;
      const path = hullPath(pts);
      const ink = clusterInk(c);

      g.save();
      g.clip(path);
      // hatch at the cluster's own angle — 4 angles x 6 inks distinguishes far past 6 clusters
      const ang = (hatchAngle(c) * Math.PI) / 180;
      const step = 6 + coh * 5; // denser hatch = more coherent
      g.globalAlpha = hot ? 0.22 : 0.42;
      g.strokeStyle = ink;
      g.lineWidth = 1;
      g.beginPath();
      const R = Math.hypot(W, H);
      const cxh = pts.reduce((s, p) => s + p[0], 0) / pts.length;
      const cyh = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      for (let d = -R; d < R; d += step) {
        const ox = Math.cos(ang + Math.PI / 2) * d;
        const oy = Math.sin(ang + Math.PI / 2) * d;
        g.moveTo(cxh + ox - Math.cos(ang) * R, cyh + oy - Math.sin(ang) * R);
        g.lineTo(cxh + ox + Math.cos(ang) * R, cyh + oy + Math.sin(ang) * R);
      }
      g.stroke();
      g.restore();

      g.globalAlpha = hot ? 0.3 : 0.75;
      g.strokeStyle = ink;
      g.lineWidth = 1;
      g.stroke(path);
      g.globalAlpha = 1;
    }

    // ---- edges: hairline. A pen has ONE width. No glow, no additive blending.
    //      Batched into two Path2Ds (lit / dim) — 2 strokes, not 48.
    const lit = new Path2D();
    const dim = new Path2D();
    for (const l of linksRef.current) {
      const a = l.source as PNode, b = l.target as PNode;
      if (a.x == null || b.x == null) continue;
      const on = !hot || (hopVisible(a.id) && hopVisible(b.id));
      const p = on ? lit : dim;
      p.moveTo(X(a.x!), Y(a.y!));
      p.lineTo(X(b.x!), Y(b.y!));
    }
    g.lineWidth = 1;
    g.strokeStyle = T.rule;
    g.globalAlpha = hot ? 0.18 : 0.5;
    g.stroke(dim);
    g.globalAlpha = 1;
    g.strokeStyle = T.ink;
    g.stroke(lit);

    // ---- nodes: drawn, not lit. Radius = centrality. Cross-hair for hubs, circle otherwise.
    for (const n of nodes) {
      if (n.x == null) continue;
      const on = hopVisible(n.id);
      const cx = X(n.x!), cy = Y(n.y!);
      const r = Math.max(2.5, n.r * Math.min(k, 1.6) * 0.55);
      g.globalAlpha = on ? 1 : 0.16;

      g.fillStyle = T.paper;
      g.strokeStyle = n.id === hot ? T.signal : clusterInk(n.community);
      g.lineWidth = n.id === hot ? 2 : 1.2;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fill();
      g.stroke();

      // a hub gets a registration cross through it — plotter language for "this one matters"
      if (n.centrality > 0.55) {
        g.beginPath();
        g.moveTo(cx - r - 3, cy); g.lineTo(cx + r + 3, cy);
        g.moveTo(cx, cy - r - 3); g.lineTo(cx, cy + r + 3);
        g.stroke();
      }
      g.globalAlpha = 1;
    }

    /* ============ SCREEN the plate ============ */
    const gl = glRef.current;
    if (dither && gl && ditherRef.current) {
      ditherRef.current.draw(plate, Math.max(1, Math.round(dpr)) * DITHER_CELL);
    }

    /* ============ OVERLAY — type. Never dithered. ============ */
    o.clearRect(0, 0, W, H);

    // label only the top-k hubs plus whatever is hovered/selected — text is the real bottleneck
    const ranked = [...nodes].sort((a, b) => b.centrality - a.centrality);
    const show = new Set(ranked.slice(0, labelTopK).map((n) => n.id));
    if (hot) {
      show.add(hot);
      for (const nb of adjRef.current.get(hot) ?? []) show.add(nb);
    }

    for (const n of nodes) {
      if (n.x == null || !show.has(n.id)) continue;
      const on = hopVisible(n.id);
      if (hot && !on) continue;
      const cx = X(n.x!), cy = Y(n.y!);
      const r = Math.max(2.5, n.r * Math.min(k, 1.6) * 0.55);
      const isHot = n.id === hot;

      o.font = `${isHot ? 600 : 400} ${isHot ? 11 : 10}px var(--font-mono), ui-monospace, monospace`;
      o.textAlign = "center";
      o.textBaseline = "top";
      const ty2 = cy + r + 5;

      // knock the label out of the screen so it stays legible over hatching
      const w = o.measureText(n.id).width;
      o.globalAlpha = 0.82;
      o.fillStyle = themeRef.current.paper;
      o.fillRect(cx - w / 2 - 2, ty2 - 1, w + 4, 12);
      o.globalAlpha = 1;

      o.fillStyle = isHot ? themeRef.current.signal : themeRef.current.ink;
      o.fillText(n.id, cx, ty2);

      // a node that MIGRATED in the last morph gets a displacement tick. This is the payoff:
      // the drift is the information, so it is the one thing we annotate.
      if (!hot && n.drift > 26) {
        o.strokeStyle = themeRef.current.signal;
        o.lineWidth = 1;
        o.beginPath();
        o.moveTo(cx - 4, cy - r - 5);
        o.lineTo(cx + 4, cy - r - 5);
        o.stroke();
      }
    }

    if (hot) {
      const n = nodesRef.current.find((d) => d.id === hot);
      if (n && n.x != null) {
        o.strokeStyle = themeRef.current.signal;
        o.lineWidth = 1;
        o.beginPath();
        o.arc(X(n.x!), Y(n.y!), Math.max(2.5, n.r * Math.min(k, 1.6) * 0.55) + 6, 0, Math.PI * 2);
        o.stroke();
      }
    }
  }, [coherence, dither, height, labelTopK]);

  /* ---------------------------------------------------------- the rAF loop --- */
  const kick = useCallback(() => {
    if (runningRef.current || !visibleRef.current) return;
    runningRef.current = true;
    const loop = () => {
      const sim = simRef.current;
      const animatingHops =
        !!hopRef.current && performance.now() - hopRef.current.t0 < 8 * HOP_MS;

      let moving = false;
      if (sim && sim.alpha() > ALPHA_MIN) {
        sim.tick();
        moving = true;
      }
      // the view eases onto the content bbox, so keep drawing until it has arrived too
      draw();

      const keepGoing = moving || animatingHops || !!drag.current.node || !viewSettled.current;
      if (keepGoing && visibleRef.current) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        runningRef.current = false; // COOL. The element becomes stable; Playwright can shoot it.
      }
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [draw]);

  /* ------------------------------------------------------------ build sim --- */
  useEffect(() => {
    if (!cur || !cur.nodes.length) return;
    readTheme();

    const prev = new Map(nodesRef.current.map((n) => [n.id, n]));
    const isMorph = prev.size > 0;

    // stability = 1 - normalised |Δcentrality| (FOUNDATION §8.1)
    const deltas = new Map<string, number>();
    let maxD = 1e-9;
    for (const n of cur.nodes) {
      const p = prev.get(n.id);
      const d = p ? Math.abs(n.centrality - p.centrality) : 0;
      deltas.set(n.id, d);
      maxD = Math.max(maxD, d);
    }

    const cx = 0, cy = 0;
    const nodes: PNode[] = cur.nodes.map((n) => {
      const p = prev.get(n.id);
      const stability = 1 - (deltas.get(n.id) ?? 0) / maxD;
      return {
        id: n.id,
        community: n.community,
        centrality: n.centrality,
        // WARM START — seed from the previous frame's final position. New listings born at centre.
        x: p?.x ?? cx + (Math.random() - 0.5) * 40,
        y: p?.y ?? cy + (Math.random() - 0.5) * 40,
        vx: 0,
        vy: 0,
        ax: p?.x,
        ay: p?.y,
        stability,
        drift: 0,
        r: 5 + n.centrality * 16,
      };
    });
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const links: PLink[] = cur.edges
      .filter((e) => byId.has(e.source) && byId.has(e.target))
      .map((e) => ({ source: e.source, target: e.target, rho: e.rho }));

    const adj = new Map<string, Set<string>>();
    for (const e of links) {
      const s = e.source as string, t = e.target as string;
      if (!adj.has(s)) adj.set(s, new Set());
      if (!adj.has(t)) adj.set(t, new Set());
      adj.get(s)!.add(t);
      adj.get(t)!.add(s);
    }
    adjRef.current = adj;

    /**
     * Community cohesion — pull each node gently toward its own community's centroid.
     *
     * Without this the MST sprawls and the Louvain partition, which is REAL data, is spatially
     * meaningless: the hulls all overlap into mush and you cannot see a community at all. This
     * force does not invent structure — it renders structure the engine already found, the same
     * way a coloured node does. It is deliberately weak (0.04) so tree topology still dominates
     * the layout and a stock genuinely between two communities still sits between them.
     */
    const cohere = () => {
      let ns: PNode[] = [];
      const f = (alpha: number) => {
        const cen = new Map<number, { x: number; y: number; n: number }>();
        for (const n of ns) {
          const c = cen.get(n.community) ?? { x: 0, y: 0, n: 0 };
          c.x += n.x!; c.y += n.y!; c.n++;
          cen.set(n.community, c);
        }
        for (const n of ns) {
          const c = cen.get(n.community)!;
          const k = 0.03 * alpha;
          n.vx! += (c.x / c.n - n.x!) * k;
          n.vy! += (c.y / c.n - n.y!) * k;
        }
      };
      f.initialize = (_: PNode[]) => { ns = _; };
      return f;
    };

    /** the anchor force — the heart of the morph */
    const anchor = () => {
      let ns: PNode[] = [];
      const f = (alpha: number) => {
        for (const n of ns) {
          if (n.ax == null) continue;
          const s = 0.08 * alpha * n.stability;
          n.vx! += (n.ax - n.x!) * s;
          n.vy! += (n.ay! - n.y!) * s;
        }
      };
      f.initialize = (_: PNode[]) => { ns = _; };
      return f;
    };

    simRef.current?.stop();
    const sim = forceSimulation<PNode, PLink>(nodes)
      .force(
        "link",
        forceLink<PNode, PLink>(links)
          .id((d) => d.id)
          // strong correlation => SHORT edge. The geometry means something.
          .distance((l) => 50 + 110 * (1 - Math.abs(l.rho)))
        // NOTE: link STRENGTH is left at d3's default (1 / min(deg(source), deg(target))), which
        // is tuned for exactly this case — it stops a high-degree hub from being torn apart by its
        // own spokes. Overriding it with |rho| (~0.6–0.9 on every MST edge) made every spring
        // equally stiff and collapsed the tree into a hairball. The correlation still drives the
        // geometry, through DISTANCE, which is where it belongs.
      )
      .force("charge", forceManyBody<PNode>().strength(-520).distanceMax(900))
      .force("collide", forceCollide<PNode>((d) => d.r + 7).strength(0.9))
      .force("x", forceX<PNode>(cx).strength(0.015))
      .force("y", forceY<PNode>(cy).strength(0.04)) // squash y a little: the plate is 16:9, not square
      .force("cohere", cohere())
      .force("anchor", anchor())
      .alphaMin(ALPHA_MIN)
      .stop(); // WE drive the ticks — d3's internal timer would never let the page go idle

    if (isMorph) sim.alpha(REHEAT).alphaDecay(DECAY_MORPH);
    else sim.alpha(1).alphaDecay(DECAY_COLD);

    simRef.current = sim;
    nodesRef.current = nodes;
    linksRef.current = links;

    // The FIRST layout is solved synchronously and opens already settled. Two reasons:
    //   · the figure is below the fold, so the IntersectionObserver (correctly) parks the rAF
    //     loop — without a warm-up the plate would be caught mid-expansion, cropped, whenever a
    //     reader scrolled to it, and a screenshot would catch it there too;
    //   · a settled opening frame is the honest one. The motion we want the eye to spend itself
    //     on is the MORPH, not the birth.
    // A morph, by contrast, IS animated — that is the entire product.
    if (!isMorph || reducedMotion()) {
      for (let k = 0; k < 400 && sim.alpha() > ALPHA_MIN; k++) sim.tick();
      for (const n of nodes) {
        n.drift = n.ax != null ? Math.hypot(n.x! - n.ax, n.y! - n.ay!) : 0;
      }
      userView.current = false;
      view.current.init = false; // snap the fit; there is nothing to ease from
      draw();
      return;
    }

    // measure the displacement once the morph has settled — that number IS the product
    const settle = window.setTimeout(() => {
      for (const n of nodesRef.current) {
        n.drift = n.ax != null ? Math.hypot(n.x! - n.ax, n.y! - n.ay!) : 0;
      }
      draw();
    }, 900);

    kick();
    return () => window.clearTimeout(settle);
  }, [cur, draw, kick, readTheme]);

  /* ---------------------------------------------------- gl + observers ------ */
  useEffect(() => {
    if (!dither) return;
    const gl = glRef.current;
    if (!gl) return;
    const d = initGL(gl);
    ditherRef.current = d;
    setGlOK(!!d); // no WebGL2 -> fall back to the plain hairline plate. Still deliberate.
    if (d) draw();
  }, [dither, draw]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const ro = new ResizeObserver(() => {
      view.current.init = false;
      userView.current = false;
      draw();
      kick();
    });
    ro.observe(wrap);

    const io = new IntersectionObserver(
      ([e]) => {
        visibleRef.current = e.isIntersecting;
        if (e.isIntersecting) kick(); // never burn frames off-screen
      },
      { threshold: 0 }
    );
    io.observe(wrap);

    const mo = new MutationObserver(() => { readTheme(); draw(); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      cancelAnimationFrame(rafRef.current);
      runningRef.current = false;
      simRef.current?.stop();
    };
  }, [draw, kick, readTheme]);

  /* ------------------------------------------------------------ interaction - */
  const toGraph = (px: number, py: number) => {
    const { k, tx, ty } = view.current;
    return { x: (px - tx) / k, y: (py - ty) / k };
  };

  const pick = (px: number, py: number): PNode | null => {
    const { k, tx, ty } = view.current;
    let best: PNode | null = null;
    let bd = Infinity;
    for (const n of nodesRef.current) {
      if (n.x == null) continue;
      const dx = px - (n.x! * k + tx);
      const dy = py - (n.y! * k + ty);
      const d = Math.hypot(dx, dy);
      const hit = Math.max(n.r * Math.min(k, 1.6) * 0.55, 9) * 1.6;
      if (d < hit && d < bd) { bd = d; best = n; }
    }
    return best;
  };

  /** BFS from the hovered node — the trace lights up hop by hop, so embeddedness is FELT. */
  const setHop = (id: string | null) => {
    if (!id) { hopRef.current = null; return; }
    const levels = new Map<string, number>([[id, 0]]);
    let front = [id];
    let lvl = 0;
    while (front.length && lvl < 8) {
      lvl++;
      const next: string[] = [];
      for (const f of front) {
        for (const nb of adjRef.current.get(f) ?? []) {
          if (!levels.has(nb)) { levels.set(nb, lvl); next.push(nb); }
        }
      }
      front = next;
    }
    hopRef.current = { levels, t0: performance.now() };
  };

  const local = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = local(e);
    e.currentTarget.setPointerCapture(e.pointerId);
    const n = pick(x, y);
    drag.current = { node: n, pan: !n, x, y, moved: 0 };
    if (n) { n.fixed = true; n.fx = n.x; n.fy = n.y; }
    kick();
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = local(e);
    const d = drag.current;

    if (d.node) {
      const p = toGraph(x, y);
      d.node.fx = p.x;
      d.node.fy = p.y;
      d.moved += Math.hypot(x - d.x, y - d.y);
      d.x = x; d.y = y;
      simRef.current?.alpha(0.25).restart().stop(); // reheat on drag, then WE tick it
      kick();
      return;
    }
    if (d.pan) {
      view.current.tx += x - d.x;
      view.current.ty += y - d.y;
      d.moved += Math.hypot(x - d.x, y - d.y);
      d.x = x; d.y = y;
      userView.current = true;
      draw();
      return;
    }

    const n = pick(x, y);
    const id = n?.id ?? null;
    if (id !== hoverRef.current) {
      hoverRef.current = id;
      setHop(id);
      e.currentTarget.style.cursor = id ? "pointer" : "default";
      setTip(
        n ? { id: n.id, x, y, c: n.community, cen: n.centrality, drift: n.drift } : null
      );
      kick();
    } else if (n) {
      setTip({ id: n.id, x, y, c: n.community, cen: n.centrality, drift: n.drift });
    }
  };

  const onUp = () => {
    const d = drag.current;
    if (d.node) {
      d.node.fx = null;
      d.node.fy = null;
      d.node.fixed = false;
      if (d.moved < 4) onSelect?.(selRef.current === d.node.id ? null : d.node.id);
    } else if (d.pan && d.moved < 4) {
      onSelect?.(null);
    }
    drag.current = { node: null, pan: false, x: 0, y: 0, moved: 0 };
    kick();
  };

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    const before = toGraph(px, py);
    view.current.k = Math.max(0.3, Math.min(5, view.current.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
    const after = toGraph(px, py);
    view.current.tx += (after.x - before.x) * view.current.k;
    view.current.ty += (after.y - before.y) * view.current.k;
    userView.current = true;
    draw();
  };

  const resetView = () => {
    userView.current = false;
    view.current.init = false;
    draw();
    kick();
  };

  const showDither = dither && glOK;

  return (
    <div ref={wrapRef} className={`pg ${className}`} style={{ height }}>
      {/* the plate. Hidden when the dither pass owns the pixels; shown raw when it can't. */}
      <canvas
        ref={plateRef}
        className="pg-layer"
        style={{ opacity: showDither ? 0 : 1 }}
        aria-hidden="true"
      />
      <canvas
        ref={glRef}
        className="pg-layer"
        style={{ display: showDither ? "block" : "none" }}
        aria-hidden="true"
      />
      <canvas
        ref={overlayRef}
        className="pg-layer pg-hit"
        role="img"
        aria-label={
          cur
            ? `Correlation network, ${cur.nodes.length} stocks, ${cur.nCommunities} communities, ${cur.lookback}-bar window`
            : "Correlation network"
        }
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={() => {
          hoverRef.current = null;
          hopRef.current = null;
          setTip(null);
          draw();
        }}
        onWheel={onWheel}
      />

      {tip && (
        <div
          className="pg-tip"
          style={{ left: Math.min(tip.x + 14, 520), top: Math.max(tip.y - 8, 4) }}
        >
          <strong>{tip.id}</strong>
          <span>
            <span className="pg-swatch" style={{ background: clusterInk(tip.c) }} />
            community {tip.c}
          </span>
          <span>eigenvector {tip.cen.toFixed(3)}</span>
          {tip.drift > 26 && <span className="pg-drift">migrated {Math.round(tip.drift)}px</span>}
        </div>
      )}

      <button type="button" className="pg-reset" onClick={resetView}>
        RESET VIEW
      </button>
    </div>
  );
}
