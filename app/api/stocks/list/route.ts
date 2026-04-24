import { NextResponse } from "next/server";
import { getApiBase, proxyUpstream } from "@/lib/upstream";
import { sampleGraph } from "@/lib/sample-graph";

export const dynamic = "force-dynamic";

export async function GET() {
  const upstreamUrl = `${getApiBase()}/stocks-list`;
  const res = await proxyUpstream(upstreamUrl, { cacheSeconds: 600 });

  if (res.status === 200) return res;

  // Fallback: derive list from sample graph
  const stocks = sampleGraph.nodes
    .map((n) => ({
      symbol: n.symbol,
      name: n.name ?? n.symbol,
      cluster: n.cluster,
      clusterLabel: n.clusterLabel,
      centrality: n.centrality,
      momentum: n.momentum,
    }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));

  return NextResponse.json(
    {
      stocks,
      count: stocks.length,
      meta: { fallback: true, asOf: sampleGraph.meta.asOf },
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600",
      },
    }
  );
}
