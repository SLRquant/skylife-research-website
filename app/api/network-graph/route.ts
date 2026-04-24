import { NextResponse } from "next/server";
import { getApiBase, getApiToken } from "@/lib/upstream";
import { sampleGraph } from "@/lib/sample-graph";

export const dynamic = "force-dynamic";

type UpstreamEdge = {
  source: string;
  target: string;
  weight: number;
  community: number;
};

type UpstreamPayload = Record<string, UpstreamEdge[]>;

/** Cluster color palette — stable by community id. */
const CLUSTER_COLORS = [
  "#4dd4ac",
  "#6ea8fe",
  "#e879f9",
  "#fbbf24",
  "#fb7185",
  "#818cf8",
  "#34d399",
  "#f97316",
];

const CLUSTER_LABELS: Record<number, string> = {
  1: "FIN",
  2: "IT",
  3: "CON",
  4: "ENE",
  5: "PHA",
  6: "AUTO",
  7: "MAT",
  8: "UTIL",
};

function pickLatestKey(payload: UpstreamPayload): string | null {
  const keys = Object.keys(payload);
  if (!keys.length) return null;
  // Sort descending — keys look like nif50_centrality_20260424_0400
  keys.sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
  return keys[0];
}

function parseDateFromKey(key: string): string | undefined {
  // nif50_centrality_YYYYMMDD_HHMM
  const m = key.match(/(\d{8})_(\d{4})/);
  if (!m) return undefined;
  const [, d, t] = m;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${t.slice(0, 2)}:${t.slice(2, 4)}:00Z`;
}

/** Transform upstream edge list into {nodes, edges, meta}. */
function normalize(payload: UpstreamPayload) {
  const key = pickLatestKey(payload);
  if (!key) return null;
  const rawEdges = payload[key];
  if (!Array.isArray(rawEdges) || rawEdges.length === 0) return null;

  // Derive nodes & compute degree centrality
  const nodeMap = new Map<
    string,
    { id: string; symbol: string; cluster: number; degree: number; weightSum: number }
  >();

  for (const e of rawEdges) {
    for (const sym of [e.source, e.target]) {
      const existing = nodeMap.get(sym);
      if (existing) {
        existing.degree += 1;
        existing.weightSum += e.weight;
      } else {
        nodeMap.set(sym, {
          id: sym,
          symbol: sym.replace(/-EQ$/, ""),
          cluster: e.community ?? 0,
          degree: 1,
          weightSum: e.weight,
        });
      }
    }
  }

  const maxDegree = Math.max(...Array.from(nodeMap.values()).map((n) => n.degree), 1);
  const communities = new Set<number>();

  const nodes = Array.from(nodeMap.values()).map((n) => {
    communities.add(n.cluster);
    return {
      id: n.id,
      symbol: n.symbol,
      name: n.symbol,
      cluster: n.cluster,
      clusterLabel: CLUSTER_LABELS[n.cluster] ?? `C${n.cluster}`,
      clusterColor: CLUSTER_COLORS[(n.cluster - 1 + CLUSTER_COLORS.length) % CLUSTER_COLORS.length],
      centrality: n.degree / maxDegree,
      momentum: 0,
    };
  });

  // Prune to strongest edges per node so layout doesn't collapse (MST-ish)
  // Keep edges above threshold OR top-K per node.
  const TOP_PER_NODE = 4;
  const adj = new Map<string, { e: UpstreamEdge; other: string }[]>();
  for (const e of rawEdges) {
    (adj.get(e.source) ?? adj.set(e.source, []).get(e.source)!).push({ e, other: e.target });
    (adj.get(e.target) ?? adj.set(e.target, []).get(e.target)!).push({ e, other: e.source });
  }
  const keep = new Set<UpstreamEdge>();
  for (const [, list] of adj) {
    list.sort((a, b) => b.e.weight - a.e.weight);
    for (let i = 0; i < Math.min(TOP_PER_NODE, list.length); i++) keep.add(list[i].e);
  }
  const edges = Array.from(keep).map((e) => ({
    source: e.source,
    target: e.target,
    weight: e.weight,
  }));

  return {
    nodes,
    edges,
    meta: {
      universe: "NIFTY 50",
      method: "Correlation network · Louvain communities",
      lookbackDays: 60,
      correlationThreshold: 0.5,
      clustersDetected: communities.size,
      asOf: parseDateFromKey(key),
      fallback: false,
    },
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const upstreamUrl = new URL(`${getApiBase()}/network-graph`);
  searchParams.forEach((v, k) => upstreamUrl.searchParams.set(k, v));

  const token = getApiToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(upstreamUrl.toString(), {
      headers,
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const json = (await res.json()) as UpstreamPayload;
    const normalized = normalize(json);
    if (normalized) {
      return NextResponse.json(normalized, {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      });
    }
  } catch (err) {
    console.error("[network-graph] upstream failed", err);
  }

  // Fallback
  return NextResponse.json(
    { ...sampleGraph, meta: { ...sampleGraph.meta, fallback: true } },
    {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
