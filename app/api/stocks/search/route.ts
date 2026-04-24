import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

type StockEntry = { symbol: string; name: string; sector?: string };

let cached: StockEntry[] | null = null;

async function loadStocks(): Promise<StockEntry[]> {
  if (cached) return cached;
  try {
    const p = path.join(process.cwd(), "public", "data", "nse-stocks.json");
    const raw = await fs.readFile(p, "utf8");
    cached = JSON.parse(raw) as StockEntry[];
    return cached;
  } catch {
    cached = [];
    return cached;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 100);

  const stocks = await loadStocks();
  if (!q) {
    return NextResponse.json(
      { query: "", results: stocks.slice(0, limit), count: 0 },
      { status: 200 }
    );
  }

  const results: StockEntry[] = [];
  for (const s of stocks) {
    if (
      s.symbol.toLowerCase().includes(q) ||
      (s.name && s.name.toLowerCase().includes(q))
    ) {
      results.push(s);
      if (results.length >= limit) break;
    }
  }

  return NextResponse.json(
    { query: q, results, count: results.length },
    {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
      },
    }
  );
}
