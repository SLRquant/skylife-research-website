"use client";

import { useMemo, useState } from "react";
import type { Series } from "@/lib/graph-stats";
import { clusterInk } from "./colors";

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

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

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
 * Sparklines share ONE y-domain across the whole table.
 *
 * They used to be autoscaled to each row's own min/max, which made them look dramatic and be
 * meaningless: a stock wobbling in the 4th decimal drew the same mountain range as a genuine hub.
 * They are only comparable if they share a scale, so they do.
 */
function Sparkline({
  values, lo, hi, colour,
}: {
  values: Array<number | null>;
  lo: number;
  hi: number;
  colour: string;
}) {
  const pts = values.filter((v): v is number => v !== null);
  if (pts.length < 2) return <span className="dim">—</span>;
  const span = hi - lo || 1;
  const w = 68;
  const h = 16;
  const step = w / (values.length - 1);

  let d = "";
  let pen = false;
  values.forEach((v, i) => {
    if (v === null) { pen = false; return; } // a gap is a gap; never bridge it
    const x = i * step;
    const y = h - ((v - lo) / span) * h;
    d += `${pen ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    pen = true;
  });

  return (
    <svg width={w} height={h} aria-hidden="true" style={{ display: "block", overflow: "visible" }}>
      <line x1={0} x2={w} y1={h} y2={h} stroke="var(--rule)" strokeWidth={1} />
      <path d={d} fill="none" stroke={colour} strokeWidth={1.2} />
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

  const { rows, lo, hi } = useMemo(() => {
    const firstVals = series.map((s) => ({ symbol: s.symbol, v: num(s.points[0]?.[metric]) }));
    const lastVals = series.map((s) => ({
      symbol: s.symbol,
      v: num(s.points[s.points.length - 1]?.[metric]),
    }));
    const rFirst = rankOf(firstVals);
    const rLast = rankOf(lastVals);

    // one shared domain for every sparkline in the table
    const all: number[] = [];
    for (const s of series) {
      for (const p of s.points) {
        const v = num(p[metric]);
        if (v !== null) all.push(v);
      }
    }
    const lo = all.length ? Math.min(...all) : 0;
    const hi = all.length ? Math.max(...all) : 1;

    const rows: Row[] = series.map((s) => {
      const first = num(s.points[0]?.[metric]);
      const latest = num(s.points[s.points.length - 1]?.[metric]);
      const delta = first !== null && latest !== null ? latest - first : null;
      const r0 = rFirst.get(s.symbol);
      const r1 = rLast.get(s.symbol)!;
      return {
        symbol: s.symbol,
        community: s.community,
        first,
        latest,
        delta,
        // NOTE: no % column. `delta / |first| * 100` on a 0..1 centrality produced readings like
        // "+1287%" — arithmetically true, completely meaningless. The absolute delta and the RANK
        // delta are the two numbers that actually say something, so those are the two we show.
        rank: r1,
        rankDelta: r0 !== undefined ? r0 - r1 : null,
        spark: s.points.map((p) => num(p[metric])),
      };
    });
    return { rows, lo, hi };
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
      className={sort === key ? "active" : undefined}
      aria-sort={sort === key ? (asc ? "ascending" : "descending") : "none"}
    >
      {label}
      {sort === key && <span> {asc ? "▲" : "▼"}</span>}
    </th>
  );

  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            {head("rank", "#")}
            {head("symbol", "Stock")}
            {head("latest", "Latest")}
            {head("delta", "Δ window")}
            <th>Trend</th>
            {head("rankDelta", "Rank Δ")}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const on = highlighted.has(r.symbol);
            const ink = clusterInk(r.community ?? 0);
            return (
              <tr key={r.symbol} onClick={() => onToggle(r.symbol)} className={on ? "on" : undefined}>
                <td className="dim">{r.rank}</td>
                <td>
                  <span className="cell-key">
                    <span className="swatch" style={{ background: ink }} />
                    <span className="sym">{r.symbol}</span>
                  </span>
                </td>
                <td>{r.latest?.toFixed(4) ?? "—"}</td>
                <td className={r.delta === null ? undefined : r.delta >= 0 ? "up" : "down"}>
                  {r.delta === null
                    ? "—"
                    : `${r.delta >= 0 ? "+" : "−"}${Math.abs(r.delta).toFixed(4)}`}
                </td>
                <td>
                  <Sparkline values={r.spark} lo={lo} hi={hi} colour={ink} />
                </td>
                <td
                  className={
                    r.rankDelta === null || r.rankDelta === 0
                      ? "dim"
                      : r.rankDelta > 0
                        ? "up"
                        : "down"
                  }
                >
                  {/* status ships with a GLYPH and a number — never colour alone */}
                  {r.rankDelta === null || r.rankDelta === 0
                    ? "—"
                    : `${r.rankDelta > 0 ? "▲" : "▼"} ${Math.abs(r.rankDelta)}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
