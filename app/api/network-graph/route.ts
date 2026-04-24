import { NextResponse } from "next/server";
import { getApiBase, proxyUpstream } from "@/lib/upstream";
import { sampleGraph } from "@/lib/sample-graph";

export const dynamic = "force-dynamic"; // allow query params to flow through

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const upstreamUrl = new URL(`${getApiBase()}/network-graph`);
  searchParams.forEach((v, k) => upstreamUrl.searchParams.set(k, v));

  // If upstream is not reachable or not configured, fall back to sample graph
  // so the UI still has something to render.
  const res = await proxyUpstream(upstreamUrl.toString(), { cacheSeconds: 300 });
  if (res.status === 200) return res;

  // Fallback — deterministic sample so UX never fully fails
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
