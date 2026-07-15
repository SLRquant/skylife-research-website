/**
 * POST /api/dev/token — mint a 24h developer JWT for the signed-in user.
 *
 * Flow: verify Firebase ID token -> Google-only gate -> mint upstream with the server key.
 *
 * The upstream mint endpoint is server-to-server and authed with GRAPH_STATS_API_KEY, which
 * lives ONLY here. The browser sends its Firebase token; the email we mint against is taken from
 * the VERIFIED token (never the request body), so a developer cannot mint a token for anyone else.
 * The returned dev JWT is what the developer then sends directly to graph-api as
 * `Authorization: Bearer <token>`.
 */
import { NextResponse } from "next/server";
import { checkToolAccess, verifyRequest } from "@/lib/firebase/admin";
import { missingServerConfig, unconfiguredResponse } from "@/lib/server-config";

// firebase-admin needs Node (not Edge). This is a fresh token every call — never cache it.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = process.env.GRAPH_STATS_API_BASE ?? "https://graph-api.skyliferesearch.com";

/** The real API's published limits — surfaced to the developer so they can pace their calls. */
const LIMITS = { perMinute: 1, perDay: 30 } as const;

type MintEnvelope = {
  success?: boolean;
  errors?: Array<{ code?: string; message?: string }> | null;
  data?: {
    access_token?: string;
    token_type?: string;
    expires_in_hours?: number;
    email?: string;
  } | null;
};

export async function POST(req: Request) {
  // Before anything else: is this deployment even configured? verifyRequest() below THROWS when
  // the service account is absent, which would otherwise reach the browser as an HTML error page.
  const missing = missingServerConfig();
  if (missing.length > 0) {
    console.error(`[dev-token] missing server env: ${missing.join(", ")}`);
    const { body, status } = unconfiguredResponse();
    return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  }

  const caller = await verifyRequest(req);
  if (!caller) {
    return NextResponse.json(
      { error: "unauthorized", message: "Sign in to generate a token." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  // Google-only: same gate as the metered tool. The mint is keyed on a verified email.
  const denied = checkToolAccess(caller);
  if (denied) {
    return NextResponse.json(
      { error: "forbidden", message: denied },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  const key = process.env.GRAPH_STATS_API_KEY;
  if (!key) {
    // missingServerConfig() already covers this, but keep the type narrow for the fetch below.
    const { body, status } = unconfiguredResponse();
    return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}/v1/dev/mint`, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      // The email comes from the VERIFIED token, never from the client.
      body: JSON.stringify({ email: caller.email }),
      cache: "no-store",
    });
  } catch {
    console.error("[dev-token] could not reach mint endpoint");
    return NextResponse.json(
      { error: "upstream_error", message: "Could not reach the token service. Please try again." },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }

  let body: MintEnvelope;
  try {
    body = (await res.json()) as MintEnvelope;
  } catch {
    console.error(`[dev-token] non-JSON mint response (${res.status})`);
    return NextResponse.json(
      { error: "upstream_error", message: `The token service returned an unreadable response (${res.status}).` },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }

  const token = body?.data?.access_token;
  if (!res.ok || !body?.success || !token) {
    const message = body?.errors?.[0]?.message ?? `Token service error (${res.status}).`;
    console.error(`[dev-token] mint failed (${res.status}): ${message}`);
    return NextResponse.json(
      { error: "upstream_error", message },
      { status: res.status >= 500 || res.ok ? 502 : res.status, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    {
      access_token: token,
      token_type: body.data?.token_type ?? "Bearer",
      expires_in_hours: body.data?.expires_in_hours ?? 24,
      email: body.data?.email ?? caller.email,
      limits: LIMITS,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
