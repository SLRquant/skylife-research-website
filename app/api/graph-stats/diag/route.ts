/**
 * GET /api/graph-stats/diag?key=<GRAPH_STATS_API_KEY> — TEMPORARY deployment diagnostic.
 *
 * WHY: /run and /quota were returning an HTML 500 in production even though the config preflight
 * is the FIRST statement in both handlers — which is only possible if something throws at module
 * import, before any of our code runs. From the outside those failures are indistinguishable, and
 * Next's error page tells us nothing. This route imports the same modules DYNAMICALLY, inside a
 * try/catch, so the real error survives and can be read.
 *
 * It reports only booleans and error messages — never a secret's value. It is gated on the API key
 * so the public cannot read our deployment's internals.
 *
 * DELETE THIS ROUTE once the tool is confirmed working. It is a probe, not a feature.
 */
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const expected = process.env.GRAPH_STATS_API_KEY;
  if (!expected) return false; // nothing to compare against: deny
  const given = new URL(req.url).searchParams.get("key") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const msg = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message}` : String(e));

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const out: Record<string, unknown> = {};

  // 1. Which env vars actually reach this runtime. Presence + length only — never the value.
  const names = [
    "FIREBASE_SERVICE_ACCOUNT_B64",
    "GRAPH_STATS_API_KEY",
    "GRAPH_STATS_API_BASE",
    "GRAPH_STATS_FREE_LIMIT",
    "GRAPH_STATS_ADMIN_EMAILS",
  ];
  out.env = Object.fromEntries(
    names.map((n) => {
      const v = process.env[n];
      return [n, v ? { set: true, length: v.length } : { set: false }];
    })
  );

  // 2. Can firebase-admin even be imported here? This is the suspected failure.
  for (const mod of ["firebase-admin/app", "firebase-admin/auth", "firebase-admin/firestore"]) {
    try {
      await import(/* webpackIgnore: true */ mod);
      out[mod] = "import ok";
    } catch (e) {
      out[mod] = `IMPORT FAILED — ${msg(e)}`;
    }
  }

  // 3. Does the service account decode, and does Firebase accept it? A value mangled by a stray
  //    newline in the Vercel paste would fail exactly here, and nowhere earlier.
  try {
    const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
    if (!b64) throw new Error("not set");
    const json = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    out.serviceAccount = {
      decoded: true,
      type: json.type,
      project_id: json.project_id,
      hasPrivateKey: typeof json.private_key === "string" && json.private_key.includes("PRIVATE KEY"),
    };

    const { cert, getApps, initializeApp } = await import("firebase-admin/app");
    const app = getApps().length
      ? getApps()[0]
      : initializeApp({
          credential: cert({
            projectId: json.project_id,
            clientEmail: json.client_email,
            privateKey: json.private_key,
          }),
        });
    out.adminInit = "ok";

    // A real round-trip: if Firestore rejects us, the quota system cannot work.
    const { getFirestore } = await import("firebase-admin/firestore");
    await getFirestore(app).collection("graph_stats_usage").limit(1).get();
    out.firestoreRead = "ok";
  } catch (e) {
    out.serviceAccountOrInit = `FAILED — ${msg(e)}`;
  }

  return NextResponse.json(out, { status: 200, headers: { "Cache-Control": "no-store" } });
}
