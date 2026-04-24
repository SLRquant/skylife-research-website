/**
 * Shared helper for proxying requests to Skylife upstream APIs.
 */
import { NextResponse } from "next/server";

const DEFAULT_API_BASE = "https://api.skyliferesearch.com";
const DEFAULT_MCP_BASE = "https://mcp-api.skyliferesearch.com";

export function getApiBase(): string {
  return process.env.SKYLIFE_API_BASE || DEFAULT_API_BASE;
}

export function getMcpBase(): string {
  return process.env.SKYLIFE_MCP_BASE || DEFAULT_MCP_BASE;
}

export function getApiToken(): string | undefined {
  return process.env.SKYLIFE_API_TOKEN;
}

type ProxyOpts = {
  method?: "GET" | "POST";
  body?: unknown;
  cacheSeconds?: number; // edge cache hint
};

/**
 * Proxy a request to an upstream Skylife API.
 * Returns a NextResponse that can be returned directly from a route handler.
 */
export async function proxyUpstream(
  url: string,
  opts: ProxyOpts = {}
): Promise<NextResponse> {
  const token = getApiToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(url, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      // Cache successful GETs at the edge for 60s by default
      next: opts.method === "POST" ? undefined : {
        revalidate: opts.cacheSeconds ?? 60,
      },
    });

    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      return NextResponse.json(
        {
          error: "upstream_error",
          status: res.status,
          message:
            (data && typeof data === "object" && "message" in data
              ? (data as { message: string }).message
              : `Upstream returned ${res.status}`) || "Upstream error",
        },
        { status: res.status }
      );
    }

    return NextResponse.json(data, {
      status: 200,
      headers: {
        "Cache-Control":
          opts.method === "POST"
            ? "no-store"
            : `public, s-maxage=${opts.cacheSeconds ?? 60}, stale-while-revalidate=120`,
      },
    });
  } catch (err) {
    console.error("[proxyUpstream] failed", url, err);
    return NextResponse.json(
      {
        error: "upstream_unreachable",
        message:
          "Could not reach the Skylife data service. Please try again shortly.",
      },
      { status: 502 }
    );
  }
}
