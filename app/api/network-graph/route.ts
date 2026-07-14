/**
 * GET /api/network-graph[?lookback=NN] — the real NIFTY-50 correlation network.
 *
 * Public, so the params are FIXED here and `lookback` is restricted to a WHITELIST: a visitor
 * cannot use this to drive arbitrary (metered) queries against the upstream API. Each of the 8
 * allowed values is cached for an hour independently.
 *
 * WHY LOOKBACK IS A REAL AXIS, AND WHY IT IS THE ONE WE EXPOSE
 * ------------------------------------------------------------
 * The upstream `include_graph` returns the edge list for the LATEST as-of date only (see its
 * OpenAPI: "rolling: latest as-of date only") and there is no `asof`/`end_date` parameter. So a
 * genuine sequence of graphs THROUGH TIME cannot be obtained from this API, and we will not
 * invent one — a fabricated time axis on a quant site is exactly the lie the brand refuses.
 *
 * What IS real, and is recomputed by the engine from scratch on every call, is the ESTIMATION
 * WINDOW: the number of trailing bars the correlation matrix is built from. Sweeping it produces
 * genuinely different graphs of the same 49 names, and the differences are large and honest:
 *
 *     lookback  30 vs  60 :  62% of the edge union changes
 *     lookback  60 vs 120 :  63%
 *     lookback  30 vs 120 :  75%
 *     most-central stock:  JIOFIN (30 bars) -> SHRIRAMFIN (60) -> BAJAJFINSV (120)
 *
 * That is the axis the morph engine scrubs. Displacement under it = how much of a stock's
 * structural role is real, and how much is an artefact of the window you happened to pick.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 3600;
export const maxDuration = 60;

const BASE = process.env.GRAPH_STATS_API_BASE ?? "https://graph-api.skyliferesearch.com";

/** The only lookbacks a visitor may ask for. 8 cached variants, nothing else reaches upstream. */
export const LOOKBACKS = [30, 40, 50, 60, 75, 90, 105, 120] as const;
const DEFAULT_LOOKBACK = 60;

/**
 * Why the graph is missing, in terms the operator can act on. Distinguishing these matters:
 * "the key isn't set" and "the key is set but we can't reach the box" look identical from the
 * browser and have opposite fixes. None of these values leak anything — no key material, no URL,
 * no upstream body — they name a class of failure, nothing more.
 */
type Reason =
  | "not_configured" // GRAPH_STATS_API_KEY absent from this runtime -> set it in Vercel
  | "upstream_unreachable" // DNS/TLS/firewall/timeout -> the API is up but Vercel can't get to it
  | "upstream_rejected" // we reached it and it said no (401 = wrong key, 4xx/5xx = its problem)
  | "bad_payload"; // reached, authorised, but the response wasn't the shape we expect

class GraphUnavailable extends Error {
  constructor(readonly reason: Reason, message: string) {
    super(message);
  }
}

export async function GET(req: Request) {
  const key = process.env.GRAPH_STATS_API_KEY;

  const asked = Number(new URL(req.url).searchParams.get("lookback"));
  const lookback = (LOOKBACKS as readonly number[]).includes(asked) ? asked : DEFAULT_LOOKBACK;

  const q = new URLSearchParams({
    interval: "1d",
    lookback: String(lookback),
    periods: "1",
    metrics: "eigenvector_centrality",
    graph_method: "knn", // knn gives a richer, more readable web than an MST tree
    knn_k: "4",
    include_graph: "true",
  });

  try {
    if (!key) {
      throw new GraphUnavailable(
        "not_configured",
        "GRAPH_STATS_API_KEY is not set in this runtime"
      );
    }

    let res: Response;
    try {
      res = await fetch(`${BASE}/v1/graph-stats/chart?${q}`, {
        headers: { "x-api-key": key, Accept: "application/json" },
        next: { revalidate },
        signal: AbortSignal.timeout(45_000),
      });
    } catch (e) {
      // fetch() only rejects when the request never got an answer: DNS, TLS, connection refused,
      // a security group that drops us, or the 45s timeout. The key is irrelevant here.
      throw new GraphUnavailable(
        "upstream_unreachable",
        `cannot reach ${BASE}: ${e instanceof Error ? e.message : e}`
      );
    }

    if (!res.ok) {
      throw new GraphUnavailable(
        "upstream_rejected",
        `upstream ${res.status}` + (res.status === 401 ? " (the API key was rejected)" : "")
      );
    }

    const body = await res.json();
    if (!body?.success || body.data?.type !== "snapshot") {
      throw new GraphUnavailable("bad_payload", "upstream returned an unexpected shape");
    }

    const d = body.data;
    const communities: Record<string, number> = d.graph.communities ?? {};

    const cents = d.stocks.map((s: { eigenvector_centrality: number }) => s.eigenvector_centrality ?? 0);
    const maxC = Math.max(...cents, 1e-9);

    const nodes = d.stocks.map((s: { symbol: string; eigenvector_centrality: number | null }) => ({
      id: s.symbol,
      symbol: s.symbol,
      name: s.symbol,
      cluster: communities[s.symbol] ?? 0,
      centrality: (s.eigenvector_centrality ?? 0) / maxC, // normalised -> drives node size
      raw: s.eigenvector_centrality ?? 0,
    }));

    const edges = (d.graph.edge_list ?? []).map(
      (e: { source: string; target: string; weight: number; corr?: number }) => ({
        source: e.source,
        target: e.target,
        weight: e.weight,
        corr: e.corr ?? e.weight,
      })
    );

    return NextResponse.json(
      {
        nodes,
        edges,
        meta: {
          universe: "NIFTY 50",
          method: "knn k=4 · pearson · Louvain",
          lookback,
          interval: "1d",
          clustersDetected: d.graph.n_communities ?? 0,
          modularity: d.graph.modularity ?? undefined,
          asOf: d.asof_date ?? undefined,
          fallback: false,
        },
      },
      { headers: { "Cache-Control": `public, s-maxage=${revalidate}, stale-while-revalidate=86400` } }
    );
  } catch (e) {
    // Surface the failure instead of quietly serving invented numbers as if they were real.
    const reason: Reason = e instanceof GraphUnavailable ? e.reason : "bad_payload";
    const detail = e instanceof Error ? e.message : String(e);
    console.error(`[network-graph] ${reason}: ${detail}`);

    return NextResponse.json(
      {
        nodes: [],
        edges: [],
        meta: {
          universe: "NIFTY 50",
          lookback,
          fallback: true,
          error: "Live graph unavailable.",
          // The operator can read this straight off the network tab without Vercel log access.
          // It says WHICH failure, never anything about the credential itself.
          reason,
        },
      },
      // s-maxage=0: a misconfiguration must not get cached for an hour. The moment the env var
      // lands and the box is reachable, the very next request serves a real graph.
      { status: 200, headers: { "Cache-Control": "public, s-maxage=0, must-revalidate" } }
    );
  }
}
