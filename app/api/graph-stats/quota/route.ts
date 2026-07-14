/**
 * GET /api/graph-stats/quota — how many runs the signed-in user has left.
 * Read-only: this does NOT consume a run. The UI calls it on page load.
 */
import { NextResponse } from "next/server";
import { checkToolAccess, verifyRequest } from "@/lib/firebase/admin";
import { readQuota, tierFor } from "@/lib/quota";
import { TIERS } from "@/lib/graph-stats-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const caller = await verifyRequest(req);
  if (!caller) {
    return NextResponse.json(
      { error: "unauthorized", message: "Sign in to use this tool." },
      { status: 401 }
    );
  }

  // Tell the UI up front, so it can show "sign in with Google" instead of a failed run.
  const denied = checkToolAccess(caller);
  if (denied) {
    return NextResponse.json({ error: "forbidden", message: denied }, { status: 403 });
  }

  try {
    const quota = await readQuota(caller.email);
    const tier = tierFor(caller.email);
    // Ship the tier's limits so the form can lock what isn't included and prompt an upgrade,
    // rather than letting the user compose a request that's guaranteed to be rejected.
    return NextResponse.json(
      { email: caller.email, quota, tier, limits: TIERS[tier] },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error("[graph-stats] quota read failed", e);
    return NextResponse.json(
      { error: "quota_unavailable", message: "Could not read your usage quota." },
      { status: 503 }
    );
  }
}
