/**
 * Typed client for the graph_stats API. SERVER ONLY — holds the API key.
 *
 * The browser never talks to graph-api directly: it calls our own /api/graph-stats/run, which
 * calls this. That keeps GRAPH_STATS_API_KEY out of the client bundle entirely, and because
 * this is a server-to-server request, CORS never applies.
 */
import "server-only";

// Single source of truth for params — the form imports the same module, so client and server
// can never drift apart on what's valid.
export {
  METRICS,
  ALL_INTERVALS,
  ALL_GRAPH_METHODS,
  TIERS,
  HARD,
  ParamsSchema,
  validateForTier,
  type Params,
  type Tier,
} from "./graph-stats-schema";

import { ParamsSchema as _Schema } from "./graph-stats-schema";
import type { z } from "zod";

const BASE = process.env.GRAPH_STATS_API_BASE ?? "https://graph-api.skyliferesearch.com";

/**
 * Whitelist of what a user may ask for. Anything not in this schema never reaches the upstream.
 *
 * The caps are not arbitrary: a full-universe call takes ~11s, and `periods` and symbol count
 * are what drive that. periods<=30 and <=50 symbols keeps us inside the 60s serverless ceiling.
 */

/* ---------- response shapes ---------- */

export type Edge = { source: string; target: string; weight: number; corr: number };

export type LatestGraph = {
  asof_date: string;
  nodes: number;
  edges: number;
  method: string;
  n_communities: number;
  modularity: number | null;
  communities: Record<string, number>;
  edge_list: Edge[];
};

export type MetricPoint = { date: string } & Record<string, number | null | string>;
export type Series = { symbol: string; community?: number | null; points: MetricPoint[] };

export type RollingData = {
  type: "rolling";
  asof_dates: string[];
  metrics: string[];
  series: Series[];
  latest_graph?: LatestGraph;
};

export type SnapshotData = {
  type: "snapshot";
  asof_date: string;
  metrics: string[];
  graph: Partial<LatestGraph> & { nodes: number; edges: number; method: string };
  stocks: Array<{ symbol: string; community?: number | null } & Record<string, unknown>>;
};

export type GraphStatsData = RollingData | SnapshotData;

export type Envelope = {
  success: boolean;
  errors: Array<{ code: string; message: string }> | null;
  data: GraphStatsData | null;
  meta: {
    generated_at?: string;
    params?: Record<string, unknown>;
    diagnostics?: { missing_symbols?: string[]; [k: string]: unknown };
  };
};

export class UpstreamError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
    this.name = "UpstreamError";
  }
}

/** Vercel Hobby caps a function at 60s, so abort before that to leave room to respond. */
const TIMEOUT_MS = 45_000;

export class CancelledError extends Error {
  constructor() {
    super("Run cancelled.");
    this.name = "CancelledError";
  }
}

/**
 * `external` is the incoming request's signal. When the user hits Cancel the browser aborts,
 * Next aborts req.signal, we abort the upstream fetch, this throws — and the caller's catch
 * refunds the run. Without threading it through, a cancelled run would still cost the user one.
 */
export async function fetchGraphStats(
  p: z.infer<typeof _Schema>,
  external?: AbortSignal
): Promise<Envelope> {
  const key = process.env.GRAPH_STATS_API_KEY;
  if (!key) throw new UpstreamError("GRAPH_STATS_API_KEY is not configured", 500);

  const q = new URLSearchParams({
    interval: p.interval,
    lookback: String(p.lookback),
    periods: String(p.periods),
    metrics: p.metrics.join(","),
    graph_method: p.graph_method,
    corr_method: p.corr_method,
    include_graph: String(p.include_graph),
  });
  if (p.symbols) q.set("symbols", p.symbols);
  if (p.graph_method === "knn") q.set("knn_k", String(p.knn_k));
  if (p.graph_method === "threshold") q.set("corr_threshold", String(p.corr_threshold));

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  // abort on EITHER our timeout or the client hanging up (Cancel)
  const signal = external ? AbortSignal.any([ctrl.signal, external]) : ctrl.signal;

  let res: Response;
  try {
    res = await fetch(`${BASE}/v1/graph-stats/chart?${q}`, {
      headers: { "x-api-key": key, Accept: "application/json" },
      signal,
      cache: "no-store",
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      // Distinguish "user cancelled" from "we timed out" — only one of them is our fault.
      if (external?.aborted) throw new CancelledError();
      throw new UpstreamError(
        "The graph service took too long (>45s). Try a shorter lookback or fewer symbols.",
        504
      );
    }
    throw new UpstreamError("Could not reach the graph service.", 502);
  } finally {
    clearTimeout(timer);
  }

  let body: Envelope;
  try {
    body = (await res.json()) as Envelope;
  } catch {
    throw new UpstreamError(`Graph service returned a non-JSON response (${res.status}).`, 502);
  }

  if (!res.ok || !body.success) {
    const msg = body?.errors?.[0]?.message ?? `Graph service error (${res.status}).`;
    throw new UpstreamError(msg, res.status >= 500 ? 502 : res.status);
  }
  return body;
}
