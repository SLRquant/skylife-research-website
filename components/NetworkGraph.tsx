"use client";

import { useEffect, useRef } from "react";

type Cluster = {
  color: string;
  center: [number, number];
  n: number;
  label: string;
};

const CLUSTERS: Cluster[] = [
  { color: "#00e1ff", center: [0.22, 0.5], n: 8, label: "FIN" },
  { color: "#35f0b5", center: [0.52, 0.3], n: 7, label: "IT" },
  { color: "#7dd3fc", center: [0.78, 0.55], n: 6, label: "CON" },
  { color: "#c084fc", center: [0.45, 0.75], n: 5, label: "ENE" },
];

export function NetworkGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let W = 0;
    let H = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    type Node = {
      ci: number;
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      baseCx: number;
      baseCy: number;
      color: string;
      pulse: number;
    };
    const nodes: Node[] = [];
    CLUSTERS.forEach((c, ci) => {
      for (let i = 0; i < c.n; i++) {
        const a = (i / c.n) * Math.PI * 2 + ci;
        const r = 18 + Math.random() * 18;
        nodes.push({
          ci,
          x: c.center[0] * W + Math.cos(a) * r,
          y: c.center[1] * H + Math.sin(a) * r,
          vx: (Math.random() - 0.5) * 0.12,
          vy: (Math.random() - 0.5) * 0.12,
          r: 2 + Math.random() * 1.5,
          baseCx: c.center[0],
          baseCy: c.center[1],
          color: c.color,
          pulse: Math.random() * Math.PI * 2,
        });
      }
    });

    const edges: Array<[number, number, string, number]> = [];
    nodes.forEach((n, i) => {
      nodes.forEach((m, j) => {
        if (j <= i) return;
        if (n.ci === m.ci && Math.random() < 0.35)
          edges.push([i, j, n.color, 0.18]);
        else if (n.ci !== m.ci && Math.random() < 0.02)
          edges.push([i, j, "#334155", 0.12]);
      });
    });

    let raf = 0;
    let t = 0;
    const step = () => {
      ctx.clearRect(0, 0, W, H);
      t += 0.016;

      nodes.forEach((n) => {
        const tx = n.baseCx * W;
        const ty = n.baseCy * H;
        n.vx += (tx - n.x) * 0.0008;
        n.vy += (ty - n.y) * 0.0008;
        n.vx *= 0.96;
        n.vy *= 0.96;
        n.x += n.vx;
        n.y += n.vy;
        n.pulse += 0.04;
      });

      edges.forEach(([a, b, col, al]) => {
        const n = nodes[a];
        const m = nodes[b];
        ctx.strokeStyle = col;
        ctx.globalAlpha = al;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(n.x, n.y);
        ctx.lineTo(m.x, m.y);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;

      nodes.forEach((n) => {
        const glow = 1 + Math.sin(n.pulse) * 0.25;
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 10 * glow);
        g.addColorStop(0, n.color + "aa");
        g.addColorStop(1, n.color + "00");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 10 * glow, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = n.color;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.font = '9px "IBM Plex Mono", ui-monospace, monospace';
      ctx.fillStyle = "#4a556e";
      ctx.textAlign = "left";
      CLUSTERS.forEach((c) => {
        ctx.fillText(
          `cluster_${c.label}`,
          c.center[0] * W + 22,
          c.center[1] * H - 14
        );
      });

      raf = requestAnimationFrame(step);
    };

    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) step();
    else raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="net-graph"
      width={520}
      height={200}
      aria-hidden="true"
    />
  );
}
