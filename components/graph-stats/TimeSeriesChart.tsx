"use client";

import { useMemo, useState } from "react";
import { line, scaleLinear, scalePoint } from "d3";
import type { Series } from "@/lib/graph-stats";
import { clusterInk, seriesInk, seriesDash } from "./colors";

const W = 860;
const H = 400;
const M = { top: 14, right: 104, bottom: 34, left: 56 };

type Props = {
  series: Series[];
  metric: string;
  asofDates: string[];
  interval: string;
  highlighted: Set<string>;
  onToggle: (symbol: string) => void;
};

/**
 * At 1d an as-of point IS a day, so a date is enough. At 1m/5m/15m/1h each point is a BAR —
 * several land on the same date, so the axis and the tooltip must carry the time.
 */
const axisLabel = (iso: string, intraday: boolean) => {
  const d = new Date(iso);
  return intraday
    ? d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })
    : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

const tipStamp = (iso: string, intraday: boolean) => {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-IN", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric",
  });
  if (!intraday) return date;
  return `${date} · ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
};

type Tip = {
  symbol: string;
  community?: number | null;
  date: string;
  value: number;
  px: number;
  py: number;
  ink: string;
};

/**
 * DEFECT 1 — FIXED.
 *
 * This chart used to stroke every line with `clusterColor(s.community)`. Colour therefore encoded
 * the CLUSTER while the user was tracking a STOCK, so 8 highlighted series rendered in 4 colours —
 * ULTRACEMCO, HINDUNILVR and GRASIM were three identical magenta lines, and because the end-labels
 * were cluster-coloured too, the legend could not disambiguate them either.
 *
 * Now:
 *   line + end-label colour  ->  the STOCK  (8 validated, CVD-safe series inks)
 *   cluster                  ->  a keyed swatch beside the label (secondary channel)
 * Colour stops competing for hue with itself.
 */
export function TimeSeriesChart({
  series, metric, asofDates, interval, highlighted, onToggle,
}: Props) {
  const intraday = interval !== "1d";
  const [hover, setHover] = useState<string | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  /** Stable ink per highlighted stock: index into the series palette, in a fixed symbol order. */
  const inkOf = useMemo(() => {
    const on = series.filter((s) => highlighted.has(s.symbol)).map((s) => s.symbol).sort();
    const m = new Map<string, { ink: string; dash: string }>();
    on.forEach((sym, i) => m.set(sym, { ink: seriesInk(i), dash: seriesDash(i) }));
    return m;
  }, [series, highlighted]);

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
      return last
        ? { symbol: s.symbol, community: s.community, y: y(last.v as number) }
        : null;
    })
    .filter(Boolean) as Array<{ symbol: string; community?: number | null; y: number }>;

  // nudge overlapping end-labels apart so they stay readable
  labelled.sort((a, b) => a.y - b.y);
  for (let i = 1; i < labelled.length; i++) {
    if (labelled[i].y - labelled[i - 1].y < 13) labelled[i].y = labelled[i - 1].y + 13;
  }

  /** Snap to the nearest (date, series) DATA POINT, not an interpolated spot on a path. */
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
        pick = {
          symbol: s.symbol,
          community: s.community,
          date,
          value: v,
          px: x(date) ?? 0,
          py,
          ink: inkOf.get(s.symbol)?.ink ?? "var(--ink)",
        };
      }
    }
    setTip(dy < 60 ? pick : null);
    setHover(dy < 60 ? pick?.symbol ?? null : null);
  };

  return (
    <div className="chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="chart-svg"
        role="img"
        aria-label={`${metric} over ${asofDates.length} as-of points, ${highlighted.size} of ${series.length} stocks highlighted`}
        onMouseMove={onMove}
        onMouseLeave={() => { setTip(null); setHover(null); }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} className="c-grid" />
            <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="c-axis">
              {t.toFixed(3)}
            </text>
          </g>
        ))}

        {/* the plate frame — a printed figure has a box, not a floating chart */}
        <rect
          x={M.left}
          y={M.top}
          width={W - M.right - M.left}
          height={H - M.bottom - M.top}
          className="c-frame"
        />

        {asofDates.map((d, i) => {
          const every = Math.ceil(asofDates.length / 8);
          if (i % every !== 0 && i !== asofDates.length - 1) return null;
          return (
            <text key={d} x={x(d)} y={H - M.bottom + 18} textAnchor="middle" className="c-axis">
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
              className="c-ghost"
              onMouseEnter={() => setHover(s.symbol)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onToggle(s.symbol)}
            />
          ))}

        {series
          .filter((s) => highlighted.has(s.symbol))
          .map((s) => {
            const k = inkOf.get(s.symbol)!;
            return (
              <path
                key={s.symbol}
                d={path(toPts(s)) ?? undefined}
                className={`c-line${hover === s.symbol ? " hot" : ""}`}
                stroke={k.ink}                /* <- the STOCK, not the cluster */
                strokeDasharray={k.dash}      /* <- redundant encoding: CVD-safe by construction */
                onMouseEnter={() => setHover(s.symbol)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onToggle(s.symbol)}
              />
            );
          })}

        {labelled.map((l) => {
          const k = inkOf.get(l.symbol)!;
          return (
            <g key={l.symbol} onClick={() => onToggle(l.symbol)} style={{ cursor: "pointer" }}>
              {/* cluster keeps its own channel — a swatch, never the line colour */}
              <rect
                x={W - M.right + 6}
                y={l.y - 4}
                width={8}
                height={8}
                fill={clusterInk(l.community ?? 0)}
                stroke="var(--rule-2)"
              />
              <text
                x={W - M.right + 19}
                y={l.y}
                className={`c-endlabel${hover === l.symbol ? " hot" : ""}`}
                fill={k.ink}
                onMouseEnter={() => setHover(l.symbol)}
                onMouseLeave={() => setHover(null)}
              >
                {l.symbol}
              </text>
            </g>
          );
        })}

        {tip && (
          <g pointerEvents="none">
            <line x1={tip.px} x2={tip.px} y1={M.top} y2={H - M.bottom} className="c-crosshair" />
            <circle cx={tip.px} cy={tip.py} r={4} fill="var(--plate)" stroke={tip.ink} strokeWidth={2} />
          </g>
        )}
      </svg>

      {tip && (
        <div
          className="chart-tip"
          style={{
            left: `${((tip.px + (tip.px > W * 0.72 ? -160 : 14)) / W) * 100}%`,
            top: `${(tip.py / H) * 100}%`,
          }}
        >
          <strong style={{ color: tip.ink }}>{tip.symbol}</strong>
          <span>{tipStamp(tip.date, intraday)}</span>
          <span className="v">{tip.value.toFixed(4)}</span>
        </div>
      )}

      <div className="chart-hint">
        {highlighted.size} of {series.length} shown · line colour = stock · swatch = community ·
        click to toggle
      </div>
    </div>
  );
}
