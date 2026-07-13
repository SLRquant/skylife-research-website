/**
 * GET /api/public/graph-series — a SEQUENCE of real correlation graphs.
 *
 * This is the data behind Fig. 1 (the temporal morph). Every frame is a real MST computed by
 * the real engine on real NIFTY-50 returns. Nothing here is synthesised.
 *
 * ── Why the axis is the ESTIMATION WINDOW and not the as-of date ──────────────────────────────
 * The upstream `/v1/graph-stats/chart` endpoint has no `as_of` / `end` parameter: `latest_graph`
 * is ALWAYS the graph at the most recent as-of date. A rolling call returns per-stock centrality
 * for each past as-of day, but only ONE edge list. So a 10-day sequence of *graphs* simply does
 * not exist upstream, and inventing the intermediate edge lists would be exactly the kind of
 * fabrication this brand refuses.
 *
 * What DOES exist, and is arguably the better figure: sweep the correlation window. Each lookback
 * yields a genuinely different tree — measured, between L=30 and L=120, ~50% of the 48 MST edges
 * change and the Louvain partition moves between 6 and 8 communities. So the sweep answers a real
 * question a quant actually asks: *how much of this stock's network role is an artifact of my
 * window choice?* Displacement across frames = window-fragility. That is information.
 *
 * Public, so: params are fixed here (never caller-controlled), and the whole thing is cached for
 * an hour — at most ~24 × 6 upstream calls a day regardless of traffic.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 3600;
export const maxDuration = 60;

const BASE = process.env.GRAPH_STATS_API_BASE ?? "https://graph-api.skyliferesearch.com";

/** The swept windows. 6 frames × ~1.4s ≈ 9s cold, comfortably inside the 60s function budget. */
const WINDOWS = [30, 45, 60, 75, 90, 120] as const;

export type Frame = {
  lookback: number;
  asOf: string | null;
  nodes: Array<{ id: string; community: number; centrality: number }>;
  edges: Array<{ source: string; target: string; rho: number }>;
  nCommunities: number;
  modularity: number | null;
};

export type GraphSeries = {
  universe: string;
  method: string;
  metric: string;
  frames: Frame[];
  live: boolean;
};

const EMPTY: GraphSeries = {
  universe: "NIFTY 50",
  method: "mst",
  metric: "eigenvector_centrality",
  frames: [],
  live: false,
};

async function fetchFrame(key: string, lookback: number): Promise<Frame | null> {
  const q = new URLSearchParams({
    interval: "1d",
    lookback: String(lookback),
    periods: "1",
    metrics: "eigenvector_centrality",
    graph_method: "mst",
    include_graph: "true",
  });

  const res = await fetch(`${BASE}/v1/graph-stats/chart?${q}`, {
    headers: { "x-api-key": key, Accept: "application/json" },
    next: { revalidate },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`upstream ${res.status} at lookback=${lookback}`);

  const body = await res.json();
  if (!body?.success || body.data?.type !== "snapshot") throw new Error("bad payload");

  const d = body.data;
  const g = d.graph;
  const communities: Record<string, number> = g.communities ?? {};

  const raw = (d.stocks ?? []) as Array<{ symbol: string; eigenvector_centrality: number | null }>;
  // Normalise centrality within the frame so node radius is comparable ACROSS frames:
  // each frame's most-central stock is 1.0. (Eigenvector centrality has no absolute scale.)
  const peak = Math.max(...raw.map((s) => s.eigenvector_centrality ?? 0), 1e-9);

  return {
    lookback,
    asOf: d.asof_date ?? null,
    nodes: raw.map((s) => ({
      id: s.symbol,
      community: communities[s.symbol] ?? 0,
      centrality: (s.eigenvector_centrality ?? 0) / peak,
    })),
    edges: ((g.edge_list ?? []) as Array<{ source: string; target: string; corr: number; weight: number }>).map(
      (e) => ({ source: e.source, target: e.target, rho: e.corr ?? e.weight })
    ),
    nCommunities: g.n_communities ?? 0,
    modularity: g.modularity ?? null,
  };
}

export async function GET() {
  const key = process.env.GRAPH_STATS_API_KEY;
  if (!key) return NextResponse.json(EMPTY);

  try {
    // Sequential, not parallel: six concurrent hits is a needless thundering herd on an engine
    // that takes ~1.4s each, and we have a 60s budget to spend.
    const frames: Frame[] = [];
    for (const w of WINDOWS) {
      const f = await fetchFrame(key, w);
      if (f) frames.push(f);
    }
    if (!frames.length) throw new Error("no frames");

    const out: GraphSeries = {
      universe: "NIFTY 50",
      method: "mst",
      metric: "eigenvector_centrality",
      frames,
      live: true,
    };
    return NextResponse.json(out, {
      headers: {
        "Cache-Control": `public, s-maxage=${revalidate}, stale-while-revalidate=86400`,
      },
    });
  } catch (e) {
    console.error("[graph-series] upstream failed", e instanceof Error ? e.message : e);
    // Say the feed is down. Never dress up invented structure as today's market.
    return NextResponse.json(EMPTY, { headers: { "Cache-Control": "public, s-maxage=60" } });
  }
}
