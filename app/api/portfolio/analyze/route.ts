import { NextResponse } from "next/server";
import { z } from "zod";
import { getMcpBase, proxyUpstream } from "@/lib/upstream";

export const dynamic = "force-dynamic";

const holdingSchema = z.object({
  symbol: z.string().min(1),
  quantity: z.number().positive().optional(),
  weight: z.number().min(0).max(1).optional(),
  avgPrice: z.number().positive().optional(),
});

const bodySchema = z.object({
  holdings: z.array(holdingSchema).min(1).max(200),
  currency: z.string().optional(),
  benchmark: z.string().optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_payload",
        issues: parsed.error.issues,
      },
      { status: 400 }
    );
  }

  const upstreamUrl = `${getMcpBase()}/portfolio/analyze`;
  return proxyUpstream(upstreamUrl, {
    method: "POST",
    body: parsed.data,
  });
}
