/**
 * GET /api/network-graph — the real NIFTY-50 correlation network.
 *
 * This used to proxy api.skyliferesearch.com/network-graph, which returns 403 — so the page
 * ALWAYS fell through to lib/sample-graph.ts and showed invented numbers (RELIANCE c=0.84,
 * modularity 0.452) to every visitor. It now reads the same engine as everything else.
 *
 * Public, so it is cached for an hour and its params are fixed here — a visitor cannot use it
 * to drive arbitrary (metered) queries against the upstream API.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 3600;
export const maxDuration = 60;

const BASE = process.env.GRAPH_STATS_API_BASE ?? "https://graph-api.skyliferesearch.com";

const CLUSTER_COLORS = [
  "#4dd4ac", "#6ea8fe", "#e879f9", "#fbbf24",
  "#fb7185", "#818cf8", "#34d399", "#f97316",
];

const color = (c: number) => CLUSTER_COLORS[(c - 1 + CLUSTER_COLORS.length) % CLUSTER_COLORS.length];

export async function GET() {
  const key = process.env.GRAPH_STATS_API_KEY;

  const q = new URLSearchParams({
    interval: "1d",
    lookback: "60",
    periods: "1",
    metrics: "eigenvector_centrality",
    graph_method: "knn",   // knn gives a richer, more readable web than an MST tree
    knn_k: "4",
    include_graph: "true",
  });

  try {
    if (!key) throw new Error("GRAPH_STATS_API_KEY not set");

    const res = await fetch(`${BASE}/v1/graph-stats/chart?${q}`, {
      headers: { "x-api-key": key, Accept: "application/json" },
      next: { revalidate },
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);

    const body = await res.json();
    if (!body?.success || body.data?.type !== "snapshot") throw new Error("bad payload");

    const d = body.data;
    const communities: Record<string, number> = d.graph.communities ?? {};

    const cents = d.stocks.map((s: { eigenvector_centrality: number }) => s.eigenvector_centrality ?? 0);
    const maxC = Math.max(...cents, 1e-9);

    const nodes = d.stocks.map((s: { symbol: string; eigenvector_centrality: number | null }) => {
      const cluster = communities[s.symbol] ?? 0;
      return {
        id: s.symbol,
        symbol: s.symbol,
        name: s.symbol,
        cluster,
        clusterLabel: `C${cluster}`,
        clusterColor: color(cluster),
        centrality: (s.eigenvector_centrality ?? 0) / maxC, // normalized -> drives node size
        momentum: 0,
      };
    });

    const edges = (d.graph.edge_list ?? []).map(
      (e: { source: string; target: string; weight: number }) => ({
        source: e.source,
        target: e.target,
        weight: e.weight,
      })
    );

    return NextResponse.json(
      {
        nodes,
        edges,
        meta: {
          universe: "NIFTY 50",
          method: "Correlation network · Louvain communities",
          lookbackDays: 60,
          clustersDetected: d.graph.n_communities ?? 0,
          modularity: d.graph.modularity ?? undefined,
          asOf: d.asof_date ?? undefined,
          fallback: false,
        },
      },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${revalidate}, stale-while-revalidate=86400`,
        },
      }
    );
  } catch (e) {
    // Surface the failure instead of quietly serving invented numbers as if they were real.
    console.error("[network-graph] upstream failed", e instanceof Error ? e.message : e);
    return NextResponse.json(
      {
        nodes: [],
        edges: [],
        meta: { universe: "NIFTY 50", fallback: true, error: "Live graph unavailable." },
      },
      { status: 200, headers: { "Cache-Control": "public, s-maxage=60" } }
    );
  }
}
