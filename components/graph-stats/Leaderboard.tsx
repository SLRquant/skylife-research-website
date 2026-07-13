"use client";

import { useMemo, useState } from "react";
import type { Series } from "@/lib/graph-stats";
import { buildClusterScale, seriesColor, stableOrder } from "./colors";

type Row = {
  symbol: string;
  community?: number | null;
  first: number | null;
  latest: number | null;
  delta: number | null;
  rank: number;
  rankDelta: number | null; // + = climbed
  spark: Array<number | null>;
};

type SortKey = "rank" | "symbol" | "latest" | "delta" | "rankDelta";

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function rankOf(values: Array<{ symbol: string; v: number | null }>): Map<string, number> {
  const sorted = [...values].sort((a, b) => {
    if (a.v === null && b.v === null) return 0;
    if (a.v === null) return 1;
    if (b.v === null) return -1;
    return b.v - a.v;
  });
  return new Map(sorted.map((d, i) => [d.symbol, i + 1]));
}

/**
 * Every sparkline shares ONE y-domain (`lo`/`hi` computed across the whole table). Previously
 * each was autoscaled to its own min/max, which made a flat line and a violent one look
 * identical — they were not comparable, which is the only thing a sparkline is for.
 */
function Sparkline({
  values, color, lo, hi,
}: { values: Array<number | null>; color: string; lo: number; hi: number }) {
  const pts = values.filter((v): v is number => v !== null);
  if (pts.length < 2) return <span className="dim">—</span>;
  const span = hi - lo || 1;
  const w = 64;
  const h = 18;
  const step = w / (values.length - 1);

  let d = "";
  let pen = false;
  values.forEach((v, i) => {
    if (v === null) { pen = false; return; } // gap, don't bridge it
    const x = i * step;
    const y = h - ((v - lo) / span) * h;
    d += `${pen ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    pen = true;
  });

  return (
    <svg width={w} height={h} className="gs-spark" aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth={1.25} />
    </svg>
  );
}

export function Leaderboard({
  series, metric, highlighted, onToggle,
}: {
  series: Series[];
  metric: string;
  highlighted: Set<string>;
  onToggle: (s: string) => void;
}) {
  const [sort, setSort] = useState<SortKey>("rank");
  const [asc, setAsc] = useState(false);

  const order = useMemo(() => stableOrder(highlighted), [highlighted]);
  const clusters = useMemo(() => buildClusterScale(series.map((s) => s.community)), [series]);

  const { rows, lo, hi } = useMemo(() => {
    const firstVals = series.map((s) => ({ symbol: s.symbol, v: num(s.points[0]?.[metric]) }));
    const lastVals = series.map((s) => ({
      symbol: s.symbol,
      v: num(s.points[s.points.length - 1]?.[metric]),
    }));
    const rFirst = rankOf(firstVals);
    const rLast = rankOf(lastVals);

    const all: number[] = [];
    for (const s of series) for (const p of s.points) { const v = num(p[metric]); if (v !== null) all.push(v); }

    const rows = series.map((s) => {
      const first = num(s.points[0]?.[metric]);
      const latest = num(s.points[s.points.length - 1]?.[metric]);
      const r0 = rFirst.get(s.symbol);
      const r1 = rLast.get(s.symbol)!;
      return {
        symbol: s.symbol,
        community: s.community,
        first,
        latest,
        // Δ only. The old "% change" divided by a 0–1 centrality and printed "+1287%".
        delta: first !== null && latest !== null ? latest - first : null,
        rank: r1,
        rankDelta: r0 !== undefined ? r0 - r1 : null,
        spark: s.points.map((p) => num(p[metric])),
      } as Row;
    });

    return {
      rows,
      lo: all.length ? Math.min(...all) : 0,
      hi: all.length ? Math.max(...all) : 1,
    };
  }, [series, metric]);

  const sorted = useMemo(() => {
    const dir = asc ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sort === "symbol") return a.symbol.localeCompare(b.symbol) * (asc ? 1 : -1);
      if (sort === "rank") return (a.rank - b.rank) * (asc ? -1 : 1);
      const av = (a[sort] as number | null) ?? -Infinity;
      const bv = (b[sort] as number | null) ?? -Infinity;
      return (av - bv) * dir;
    });
  }, [rows, sort, asc]);

  const head = (key: SortKey, label: string) => (
    <th
      onClick={() => {
        if (sort === key) setAsc(!asc);
        else { setSort(key); setAsc(false); }
      }}
      className={`gs-th${sort === key ? " active" : ""}`}
    >
      {label}
      {sort === key && <span className="gs-caret">{asc ? "▲" : "▼"}</span>}
    </th>
  );

  return (
    <div className="gs-table-wrap">
      <table className="gs-table">
        <thead>
          <tr>
            {head("rank", "#")}
            {head("symbol", "STOCK")}
            {head("latest", "LATEST")}
            {head("delta", "Δ WINDOW")}
            <th className="gs-th">TREND</th>
            {head("rankDelta", "RANK Δ")}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const on = highlighted.has(r.symbol);
            // the sparkline takes the SERIES hue when the stock is highlighted, so the table and
            // the chart name the same thing the same way; otherwise it stays neutral.
            const stroke = on ? seriesColor(r.symbol, order) : "#5c6373";
            return (
              <tr key={r.symbol} onClick={() => onToggle(r.symbol)} className={`gs-tr${on ? " on" : ""}`}>
                <td className="dim">{r.rank}</td>
                <td>
                  <span className="gs-dot" style={{ background: clusters.color(r.community) }} />
                  <span className="gs-sym">{r.symbol}</span>
                </td>
                <td className={on ? "sig" : undefined}>{r.latest?.toFixed(4) ?? "—"}</td>
                <td className={r.delta === null ? undefined : r.delta >= 0 ? "up" : "down"}>
                  {r.delta === null ? "—" : `${r.delta >= 0 ? "+" : ""}${r.delta.toFixed(4)}`}
                </td>
                <td>
                  <Sparkline values={r.spark} color={stroke} lo={lo} hi={hi} />
                </td>
                <td>
                  {r.rankDelta === null || r.rankDelta === 0 ? (
                    <span className="dim">—</span>
                  ) : (
                    <span className={r.rankDelta > 0 ? "up" : "down"}>
                      {r.rankDelta > 0 ? "▲" : "▼"} {Math.abs(r.rankDelta)}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
