"use client";

import { useMemo, useState } from "react";
import { line, scaleLinear, scalePoint } from "d3";
import type { Series } from "@/lib/graph-stats";
import { buildClusterScale, seriesColor, stableOrder } from "./colors";

const W = 820;
const H = 380;
const M = { top: 16, right: 116, bottom: 34, left: 56 };

type Props = {
  series: Series[];
  metric: string;
  asofDates: string[];
  interval: string;
  highlighted: Set<string>;
  onToggle: (symbol: string) => void;
};

const axisLabel = (iso: string, intraday: boolean) => {
  const d = new Date(iso);
  return intraday
    ? d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })
    : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

const tipStamp = (iso: string, intraday: boolean) => {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
  if (!intraday) return date;
  return `${date} · ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
};

type Tip = { symbol: string; community?: number | null; date: string; value: number; px: number; py: number };

export function TimeSeriesChart({ series, metric, asofDates, interval, highlighted, onToggle }: Props) {
  const intraday = interval !== "1d";
  const [hover, setHover] = useState<string | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  /**
   * DEFECT 1 FIX. Colour used to encode the CLUSTER — so eight highlighted series rendered in
   * four colours and three of them were the same magenta. The user tracks a STOCK, so the line
   * colour now encodes the STOCK. `order` is sorted, so a stock keeps its hue as others toggle.
   */
  const order = useMemo(() => stableOrder(highlighted), [highlighted]);
  const clusters = useMemo(() => buildClusterScale(series.map((s) => s.community)), [series]);

  const x = useMemo(
    () => scalePoint<string>().domain(asofDates).range([M.left, W - M.right]).padding(0.5),
    [asofDates]
  );

  const y = useMemo(() => {
    const vals: number[] = [];
    for (const s of series) {
      for (const p of s.points) {
        const v = p[metric];
        if (typeof v === "number" && Number.isFinite(v)) vals.push(v);
      }
    }
    const lo = vals.length ? Math.min(...vals) : 0;
    const hi = vals.length ? Math.max(...vals) : 1;
    const pad = (hi - lo) * 0.1 || 0.05;
    return scaleLinear().domain([lo - pad, hi + pad]).nice().range([H - M.bottom, M.top]);
  }, [series, metric]);

  const path = useMemo(
    () =>
      line<{ date: string; v: number | null }>()
        .defined((d) => d.v !== null && Number.isFinite(d.v)) // gaps, not zeros
        .x((d) => x(d.date) ?? 0)
        .y((d) => y(d.v as number)),
    [x, y]
  );

  const toPts = (s: Series) =>
    s.points.map((p) => ({
      date: p.date,
      v: typeof p[metric] === "number" ? (p[metric] as number) : null,
    }));

  const ticks = y.ticks(5);

  const labelled = series
    .filter((s) => highlighted.has(s.symbol))
    .map((s) => {
      const pts = toPts(s).filter((p) => p.v !== null);
      const last = pts[pts.length - 1];
      return last ? { symbol: s.symbol, community: s.community, y: y(last.v as number) } : null;
    })
    .filter(Boolean) as Array<{ symbol: string; community?: number | null; y: number }>;

  labelled.sort((a, b) => a.y - b.y);
  for (let i = 1; i < labelled.length; i++) {
    if (labelled[i].y - labelled[i - 1].y < 13) labelled[i].y = labelled[i - 1].y + 13;
  }

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    const my = ((e.clientY - rect.top) / rect.height) * H;

    let date = asofDates[0];
    let best = Infinity;
    for (const d of asofDates) {
      const dx = Math.abs((x(d) ?? 0) - mx);
      if (dx < best) { best = dx; date = d; }
    }
    if (best > 40) { setTip(null); return; }

    let pick: Tip | null = null;
    let dy = Infinity;
    for (const s of series) {
      if (!highlighted.has(s.symbol)) continue;
      const pt = s.points.find((p) => p.date === date);
      const v = pt?.[metric];
      if (typeof v !== "number" || !Number.isFinite(v)) continue;
      const py = y(v);
      const d = Math.abs(py - my);
      if (d < dy) {
        dy = d;
        pick = { symbol: s.symbol, community: s.community, date, value: v, px: x(date) ?? 0, py };
      }
    }
    setTip(dy < 60 ? pick : null);
    setHover(dy < 60 ? (pick?.symbol ?? null) : null);
  };

  return (
    <div className="gs-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="gs-chart-svg"
        role="img"
        onMouseMove={onMove}
        onMouseLeave={() => { setTip(null); setHover(null); }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} className="gs-grid" />
            <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="gs-axis">
              {t.toFixed(3)}
            </text>
          </g>
        ))}

        {asofDates.map((d, i) => {
          const every = Math.ceil(asofDates.length / 8);
          if (i % every !== 0 && i !== asofDates.length - 1) return null;
          return (
            <text key={d} x={x(d)} y={H - M.bottom + 18} textAnchor="middle" className="gs-axis">
              {axisLabel(d, intraday)}
            </text>
          );
        })}

        {/* context lines first, so highlighted ones draw on top */}
        {series
          .filter((s) => !highlighted.has(s.symbol))
          .map((s) => (
            <path
              key={s.symbol}
              d={path(toPts(s)) ?? undefined}
              className="gs-line-ghost"
              onMouseEnter={() => setHover(s.symbol)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onToggle(s.symbol)}
            />
          ))}

        {series
          .filter((s) => highlighted.has(s.symbol))
          .map((s) => (
            <path
              key={s.symbol}
              d={path(toPts(s)) ?? undefined}
              className={`gs-line${hover === s.symbol ? " hot" : ""}`}
              stroke={seriesColor(s.symbol, order)}   /* by STOCK — not by cluster */
              onMouseEnter={() => setHover(s.symbol)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onToggle(s.symbol)}
            />
          ))}

        {/* end labels: the SERIES hue names the line; a small square carries the CLUSTER */}
        {labelled.map((l) => (
          <g key={l.symbol} onClick={() => onToggle(l.symbol)} style={{ cursor: "pointer" }}>
            <circle
              cx={W - M.right + 9}
              cy={l.y}
              r={3.5}
              fill={clusters.color(l.community)}
            />
            <text
              x={W - M.right + 17}
              y={l.y}
              dy="0.32em"
              className={`gs-endlabel${hover === l.symbol ? " hot" : ""}`}
              fill={seriesColor(l.symbol, order)}
            >
              {l.symbol}
            </text>
          </g>
        ))}

        {tip && (
          <g pointerEvents="none">
            <line x1={tip.px} x2={tip.px} y1={M.top} y2={H - M.bottom} className="gs-crosshair" />
            <circle
              cx={tip.px}
              cy={tip.py}
              r={4}
              fill={seriesColor(tip.symbol, order)}
              stroke="#e8eaed"
              strokeWidth={1}
            />
          </g>
        )}
      </svg>

      {tip && (
        <div
          className="gs-tip"
          style={{
            left: `${((tip.px + (tip.px > W * 0.72 ? -160 : 14)) / W) * 100}%`,
            top: `${(tip.py / H) * 100}%`,
          }}
        >
          <strong style={{ color: seriesColor(tip.symbol, order) }}>{tip.symbol}</strong>
          <span>
            {clusters.label(tip.community)} · {tipStamp(tip.date, intraday)}
          </span>
          {/* a live measured value — and therefore, and only therefore, amber */}
          <span className="gs-tip-val sig">{tip.value.toFixed(4)}</span>
        </div>
      )}

      <div className="gs-chart-hint label">
        {highlighted.size} of {series.length} shown · line colour = stock · square = cluster
      </div>
    </div>
  );
}
