/**
 * POST /api/graph-stats/run — the ONLY way the browser reaches graph-api.
 *
 * Flow: verify Firebase ID token -> reserve one run (atomic) -> call upstream -> refund on failure.
 *
 * The API key lives only here, server-side. The browser sends its Firebase token; it never sees,
 * and cannot obtain, the upstream key.
 */
import { NextResponse } from "next/server";
import { checkToolAccess, verifyRequest } from "@/lib/firebase/admin";
import { CancelledError, fetchGraphStats, ParamsSchema, UpstreamError } from "@/lib/graph-stats";
import { validateForTier } from "@/lib/graph-stats-schema";
import { QuotaExceeded, logRun, readQuota, refund, reserve, tierFor } from "@/lib/quota";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// firebase-admin needs Node (not Edge). A live call takes ~11s, well over Vercel's 10s
// default — 60s is the max allowed on the Hobby plan and is required here.
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Backstop before we do any work: one client can't hold open a pile of 12s requests.
  const ip = rateLimit(`run:${clientIp(req)}`, 12, 60_000);
  if (!ip.ok) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many requests. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(ip.retryAfter) } }
    );
  }

  const caller = await verifyRequest(req);
  if (!caller) {
    return NextResponse.json(
      { error: "unauthorized", message: "Sign in to use this tool." },
      { status: 401 }
    );
  }

  // Google-only: the per-email quota is meaningless if new emails are free to mint.
  const denied = checkToolAccess(caller);
  if (denied) {
    return NextResponse.json({ error: "forbidden", message: denied }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = ParamsSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_params", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const params = parsed.data;

  // Entitlement. Enforced HERE, not in the form — hiding an option in a <select> is not
  // security; a hand-crafted request must not reach a tier it hasn't paid for.
  const tier = tierFor(caller.email);
  const tierIssues = validateForTier(params, tier);
  if (tierIssues.length > 0) {
    return NextResponse.json(
      {
        error: "upgrade_required",
        message: tierIssues[0].message,
        issues: tierIssues,
        tier,
      },
      { status: 403 }
    );
  }

  // Reserve BEFORE the slow call so concurrent tabs can't double-spend the last run.
  let quota;
  try {
    quota = await reserve(caller.email, caller.uid);
  } catch (e) {
    if (e instanceof QuotaExceeded) {
      return NextResponse.json(
        {
          error: "quota_exceeded",
          message: `You've used all ${e.quota.limit} of your runs. Contact us to raise your limit.`,
          quota: e.quota,
        },
        { status: 429 }
      );
    }
    console.error("[graph-stats] quota backend failed", e);
    return NextResponse.json(
      { error: "quota_unavailable", message: "Could not verify your usage quota." },
      { status: 503 }
    );
  }

  const started = Date.now();
  try {
    const envelope = await fetchGraphStats(params, req.signal);
    const ms = Date.now() - started;
    void logRun(caller.email, { params, ok: true, ms });

    return NextResponse.json(
      { data: envelope.data, meta: envelope.meta, quota },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    // The run failed through no fault of the user — give the credit back. This covers Cancel
    // too: the client hanging up aborts the upstream fetch, which lands here, so a cancelled
    // run costs the user nothing.
    await refund(caller.email);
    const ms = Date.now() - started;

    if (e instanceof CancelledError) {
      void logRun(caller.email, { params, ok: false, ms, error: "cancelled" });
      return NextResponse.json({ error: "cancelled" }, { status: 499 });
    }

    const message = e instanceof Error ? e.message : "Unknown error";
    void logRun(caller.email, { params, ok: false, ms, error: message });
    console.error("[graph-stats] upstream failed", message);

    const status = e instanceof UpstreamError ? e.status : 502;
    return NextResponse.json(
      { error: "upstream_error", message, quota: await readQuota(caller.email) },
      { status }
    );
  }
}
