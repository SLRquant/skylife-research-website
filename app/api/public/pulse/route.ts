/**
 * GET /api/public/pulse — real market-structure headline numbers for the landing page.
 *
 * Public and unauthenticated (it's marketing surface), but it must not become a free proxy to
 * the metered API, so:
 *   - the response is cached for 1 hour (`revalidate`), i.e. at most ~24 upstream calls a day
 *     no matter how much traffic the site gets,
 *   - the params are FIXED here — the caller cannot influence the upstream request at all,
 *   - it returns only aggregate headline stats, never the full per-stock series.
 *
 * This replaces the hardcoded numbers the landing page used to show.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 3600; // 1 hour
export const maxDuration = 60;

const BASE = process.env.GRAPH_STATS_API_BASE ?? "https://graph-api.skyliferesearch.com";

type Pulse = {
  universe: string;
  stocks: number;
  communities: number;
  modularity: number | null;
  edges: number;
  method: string;
  asOf: string | null;
  leaders: Array<{ symbol: string; centrality: number; community: number | null }>;
  live: boolean; // false => upstream unavailable, these are last-known/fallback values
};

/** Shown only if the API is unreachable, so the page never renders empty. */
const FALLBACK: Pulse = {
  universe: "NIFTY 50",
  stocks: 49,
  communities: 8,
  modularity: 0.717,
  edges: 48,
  method: "mst",
  asOf: null,
  leaders: [],
  live: false,
};

export async function GET() {
  const key = process.env.GRAPH_STATS_API_KEY;
  if (!key) return NextResponse.json(FALLBACK);

  const q = new URLSearchParams({
    interval: "1d",
    lookback: "60",
    periods: "1",
    metrics: "eigenvector_centrality",
    graph_method: "mst",
    include_graph: "true",
  });

  try {
    const res = await fetch(`${BASE}/v1/graph-stats/chart?${q}`, {
      headers: { "x-api-key": key, Accept: "application/json" },
      next: { revalidate }, // cached at the data layer too
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);

    const body = await res.json();
    if (!body?.success || body.data?.type !== "snapshot") throw new Error("bad payload");

    const d = body.data;
    const communities: Record<string, number> = d.graph.communities ?? {};

    const leaders = [...(d.stocks ?? [])]
      .filter((s) => typeof s.eigenvector_centrality === "number")
      .sort((a, b) => b.eigenvector_centrality - a.eigenvector_centrality)
      .slice(0, 3)
      .map((s) => ({
        symbol: s.symbol,
        centrality: Number(s.eigenvector_centrality.toFixed(3)),
        community: communities[s.symbol] ?? null,
      }));

    const pulse: Pulse = {
      universe: "NIFTY 50",
      stocks: d.graph.nodes,
      communities: d.graph.n_communities ?? 0,
      modularity: d.graph.modularity ?? null,
      edges: d.graph.edges,
      method: d.graph.method,
      asOf: d.asof_date ?? null,
      leaders,
      live: true,
    };

    return NextResponse.json(pulse, {
      headers: {
        "Cache-Control": `public, s-maxage=${revalidate}, stale-while-revalidate=86400`,
      },
    });
  } catch (e) {
    console.error("[pulse] upstream failed", e instanceof Error ? e.message : e);
    return NextResponse.json(FALLBACK, {
      headers: { "Cache-Control": "public, s-maxage=60" },
    });
  }
}
