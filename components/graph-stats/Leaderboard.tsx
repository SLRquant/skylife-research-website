"use client";

import { useMemo, useState } from "react";
import type { Series } from "@/lib/graph-stats";
import { clusterColor } from "./colors";

type Row = {
  symbol: string;
  community?: number | null;
  first: number | null;
  latest: number | null;
  delta: number | null;
  pct: number | null;
  rank: number;
  rankDelta: number | null; // + = climbed
  spark: Array<number | null>;
};

type SortKey = "rank" | "symbol" | "latest" | "delta" | "rankDelta";

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** Rank descending by value; nulls sink to the bottom. */
function rankOf(values: Array<{ symbol: string; v: number | null }>): Map<string, number> {
  const sorted = [...values].sort((a, b) => {
    if (a.v === null && b.v === null) return 0;
    if (a.v === null) return 1;
    if (b.v === null) return -1;
    return b.v - a.v;
  });
  return new Map(sorted.map((d, i) => [d.symbol, i + 1]));
}

function Sparkline({ values, color }: { values: Array<number | null>; color: string }) {
  const pts = values.filter((v): v is number => v !== null);
  if (pts.length < 2) return <span className="dim mono">—</span>;
  const lo = Math.min(...pts);
  const hi = Math.max(...pts);
  const span = hi - lo || 1;
  const w = 64;
  const h = 18;
  const step = w / (values.length - 1);

  let d = "";
  let pen = false;
  values.forEach((v, i) => {
    if (v === null) {
      pen = false; // gap, don't bridge it
      return;
    }
    const x = i * step;
    const y = h - ((v - lo) / span) * h;
    d += `${pen ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    pen = true;
  });

  return (
    <svg width={w} height={h} className="gs-spark" aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}

export function Leaderboard({
  series,
  metric,
  highlighted,
  onToggle,
}: {
  series: Series[];
  metric: string;
  highlighted: Set<string>;
  onToggle: (s: string) => void;
}) {
  const [sort, setSort] = useState<SortKey>("rank");
  const [asc, setAsc] = useState(false);

  const rows: Row[] = useMemo(() => {
    const firstVals = series.map((s) => ({
      symbol: s.symbol,
      v: num(s.points[0]?.[metric]),
    }));
    const lastVals = series.map((s) => ({
      symbol: s.symbol,
      v: num(s.points[s.points.length - 1]?.[metric]),
    }));
    const rFirst = rankOf(firstVals);
    const rLast = rankOf(lastVals);

    return series.map((s) => {
      const first = num(s.points[0]?.[metric]);
      const latest = num(s.points[s.points.length - 1]?.[metric]);
      const delta = first !== null && latest !== null ? latest - first : null;
      const pct = first !== null && latest !== null && first !== 0 ? (delta! / Math.abs(first)) * 100 : null;
      const r0 = rFirst.get(s.symbol);
      const r1 = rLast.get(s.symbol)!;
      return {
        symbol: s.symbol,
        community: s.community,
        first,
        latest,
        delta,
        pct,
        rank: r1,
        rankDelta: r0 !== undefined ? r0 - r1 : null, // positive = moved up
        spark: s.points.map((p) => num(p[metric])),
      };
    });
  }, [series, metric]);

  const sorted = useMemo(() => {
    const dir = asc ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sort === "symbol") return a.symbol.localeCompare(b.symbol) * (asc ? 1 : -1);
      if (sort === "rank") return (a.rank - b.rank) * (asc ? 1 : -1) * -1; // rank 1 first by default
      const av = (a[sort] as number | null) ?? -Infinity;
      const bv = (b[sort] as number | null) ?? -Infinity;
      return (av - bv) * dir;
    });
  }, [rows, sort, asc]);

  const head = (key: SortKey, label: string) => (
    <th
      onClick={() => {
        if (sort === key) setAsc(!asc);
        else {
          setSort(key);
          setAsc(false);
        }
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
            const color = clusterColor(r.community);
            return (
              <tr
                key={r.symbol}
                onClick={() => onToggle(r.symbol)}
                className={`gs-tr${on ? " on" : ""}`}
              >
                <td className="mono dim">{r.rank}</td>
                <td>
                  <span className="gs-dot" style={{ background: color }} />
                  <span className="mono gs-sym">{r.symbol}</span>
                </td>
                <td className="mono">{r.latest?.toFixed(4) ?? "—"}</td>
                <td
                  className="mono"
                  style={{
                    color:
                      r.delta === null
                        ? undefined
                        : r.delta >= 0
                          ? "var(--accent-2)"
                          : "var(--danger)",
                  }}
                >
                  {r.delta === null
                    ? "—"
                    : `${r.delta >= 0 ? "+" : ""}${r.delta.toFixed(4)}`}
                  {r.pct !== null && (
                    <span className="dim gs-pct">
                      {" "}
                      ({r.pct >= 0 ? "+" : ""}
                      {r.pct.toFixed(0)}%)
                    </span>
                  )}
                </td>
                <td>
                  <Sparkline values={r.spark} color={color} />
                </td>
                <td className="mono">
                  {r.rankDelta === null || r.rankDelta === 0 ? (
                    <span className="dim">—</span>
                  ) : (
                    <span
                      style={{
                        color: r.rankDelta > 0 ? "var(--accent-2)" : "var(--danger)",
                      }}
                    >
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
