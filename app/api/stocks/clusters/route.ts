import { NextResponse } from "next/server";
import { getApiBase, proxyUpstream } from "@/lib/upstream";
import { sampleGraph } from "@/lib/sample-graph";

export const dynamic = "force-dynamic";

export async function GET() {
  // Spec: Upstream is the same stocks-list endpoint; we derive clusters here.
  const upstreamUrl = `${getApiBase()}/stocks-list`;
  const res = await proxyUpstream(upstreamUrl, { cacheSeconds: 300 });

  if (res.status === 200) return res;

  // Fallback: derive clusters from the sample graph
  const groups = new Map<
    number,
    {
      cluster: number;
      label: string;
      color: string;
      size: number;
      stocks: string[];
      topLeader: string;
    }
  >();

  sampleGraph.nodes.forEach((n) => {
    const g = groups.get(n.cluster) ?? {
      cluster: n.cluster,
      label: n.clusterLabel ?? `Cluster ${n.cluster}`,
      color: n.clusterColor ?? "#7dd3fc",
      size: 0,
      stocks: [] as string[],
      topLeader: "",
    };
    g.size += 1;
    g.stocks.push(n.symbol);
    if (!g.topLeader || n.centrality > (sampleGraph.nodes.find((x) => x.symbol === g.topLeader)?.centrality ?? 0)) {
      g.topLeader = n.symbol;
    }
    groups.set(n.cluster, g);
  });

  return NextResponse.json(
    {
      clusters: [...groups.values()].sort((a, b) => b.size - a.size),
      meta: { fallback: true, asOf: sampleGraph.meta.asOf },
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
