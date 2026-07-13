/**
 * Firebase Admin — SERVER ONLY. Never import this from a "use client" file.
 *
 * Verifies the caller's Firebase ID token so the server knows *who* is asking. This is the
 * real security gate; the client-side <ProtectedRoute> is only a UX redirect and can be
 * trivially bypassed.
 *
 * DEV STUB: when no service account is configured we fall back to a fake identity so the
 * feature can be built and tested locally. It refuses to run in production.
 */
import "server-only";

import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

const IS_PROD = process.env.NODE_ENV === "production";

export function isAdminConfigured(): boolean {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_B64);
}

/** True only when we're allowed to run without Firebase (local dev, no creds). */
export function isDevStub(): boolean {
  if (isAdminConfigured()) return false;
  if (IS_PROD) {
    // Fail loudly rather than silently shipping an unauthenticated endpoint.
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_B64 is not set. Refusing to run the dev auth stub in production."
    );
  }
  return true;
}

let appInstance: App | null = null;

function adminApp(): App {
  if (appInstance) return appInstance;
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!b64) throw new Error("FIREBASE_SERVICE_ACCOUNT_B64 is not set");

  const json = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  appInstance = getApps().length
    ? getApp()
    : initializeApp({
        credential: cert({
          projectId: json.project_id,
          clientEmail: json.client_email,
          privateKey: json.private_key,
        }),
      });
  return appInstance;
}

export function db(): Firestore {
  return getFirestore(adminApp());
}

export type Caller = {
  uid: string;
  email: string;
  provider: string; // e.g. "google.com" | "password"
  emailVerified: boolean;
  stub: boolean;
};

/**
 * Verify the `Authorization: Bearer <firebase-id-token>` header.
 *
 * SECURITY: the email is taken from the *verified token*, never from the request body — if we
 * trusted a client-supplied email, any user could reset their quota by changing one string.
 */
export async function verifyRequest(req: Request): Promise<Caller | null> {
  if (isDevStub()) {
    return {
      uid: "dev-stub-uid",
      email: "dev@localhost",
      provider: "google.com",
      emailVerified: true,
      stub: true,
    };
  }

  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;

  try {
    const decoded = await getAuth(adminApp()).verifyIdToken(token);
    const email = decoded.email?.toLowerCase();
    if (!email) return null; // no email on the token => we cannot meter them
    return {
      uid: decoded.uid,
      email,
      provider: decoded.firebase?.sign_in_provider ?? "unknown",
      emailVerified: Boolean(decoded.email_verified),
      stub: false,
    };
  } catch {
    return null; // expired / malformed / wrong project
  }
}

/** Set GRAPH_STATS_REQUIRE_GOOGLE=false to also allow email/password users. */
const REQUIRE_GOOGLE = process.env.GRAPH_STATS_REQUIRE_GOOGLE !== "false";

/**
 * Gate the metered tool to Google accounts.
 *
 * The 5-run quota is per-email, and email/password signup is free and unlimited — so anyone
 * could farm infinite runs by registering new addresses. Google accounts are materially harder
 * to mass-create, which turns the quota into a real limit rather than a speed bump.
 *
 * Returns an error string, or null if the caller may proceed.
 */
export function checkToolAccess(caller: Caller): string | null {
  if (caller.stub) return null;
  if (REQUIRE_GOOGLE && caller.provider !== "google.com") {
    return "This tool requires a Google account. Please sign in with Google.";
  }
  if (!REQUIRE_GOOGLE && !caller.emailVerified) {
    return "Please verify your email address before using this tool.";
  }
  return null;
}
