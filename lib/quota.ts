/**
 * Per-email usage quota for the graph-stats tool. SERVER ONLY.
 *
 * Each user gets N runs (GRAPH_STATS_FREE_LIMIT, default 5), ever. Admins are unlimited.
 *
 * Two properties this has to get right:
 *   1. ATOMIC — the check-and-increment happens inside a Firestore transaction, so two tabs
 *      racing for the last slot can't both win (a naive read-then-write would let both through).
 *   2. FAIR — we reserve *before* calling the slow upstream, then REFUND if it fails. A 502 or a
 *      timeout must never burn one of the user's runs.
 */
import "server-only";

import { db, isDevStub } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { TIERS, type Tier } from "@/lib/graph-stats-schema";

const COLLECTION = "graph_stats_usage";

export const FREE_LIMIT = Number(process.env.GRAPH_STATS_FREE_LIMIT ?? 5);

const ADMIN_EMAILS = new Set(
  (process.env.GRAPH_STATS_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

export type Quota = {
  limit: number | null; // null = unlimited (admin)
  used: number;
  remaining: number | null;
  admin: boolean;
};

export class QuotaExceeded extends Error {
  constructor(public quota: Quota) {
    super("quota exceeded");
    this.name = "QuotaExceeded";
  }
}

export function isAdmin(email: string): boolean {
  return ADMIN_EMAILS.has(email.toLowerCase());
}

/**
 * Which entitlement tier this caller gets.
 *
 * There is no billing yet, so nobody is "pro" — when payments land, this is the single place
 * that has to learn about them (look the subscription up, return "pro"). Everything downstream
 * already keys off the tier.
 */
export function tierFor(email: string): Tier {
  // No billing yet, so only admins are "paid". When payments land, this is the ONE function
  // that has to learn about subscriptions — everything downstream already keys off the tier.
  return isAdmin(email) ? "paid" : "free";
}

/** Paid (and admin) users have no run cap. */
function unlimitedRuns(email: string): boolean {
  return TIERS[tierFor(email)].runs === null;
}

const unlimited = (used = 0): Quota => ({ limit: null, used, remaining: null, admin: true });

/* ---- dev stub: in-memory counter, only when Firebase isn't configured ---- */
const memory = new Map<string, number>();

/** Read usage without consuming a run. */
export async function readQuota(email: string): Promise<Quota> {
  if (unlimitedRuns(email)) return unlimited();

  if (isDevStub()) {
    const used = memory.get(email) ?? 0;
    return { limit: FREE_LIMIT, used, remaining: Math.max(0, FREE_LIMIT - used), admin: false };
  }

  const snap = await db().collection(COLLECTION).doc(email).get();
  const used = (snap.exists ? (snap.data()?.used as number) : 0) ?? 0;
  return { limit: FREE_LIMIT, used, remaining: Math.max(0, FREE_LIMIT - used), admin: false };
}

/**
 * Atomically claim one run. Throws QuotaExceeded if the user is out.
 * Call this BEFORE the upstream request, and refund() if that request fails.
 */
export async function reserve(email: string, uid: string): Promise<Quota> {
  if (unlimitedRuns(email)) return unlimited();

  if (isDevStub()) {
    const used = memory.get(email) ?? 0;
    if (used >= FREE_LIMIT) {
      throw new QuotaExceeded({ limit: FREE_LIMIT, used, remaining: 0, admin: false });
    }
    memory.set(email, used + 1);
    return {
      limit: FREE_LIMIT,
      used: used + 1,
      remaining: FREE_LIMIT - used - 1,
      admin: false,
    };
  }

  const ref = db().collection(COLLECTION).doc(email);

  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const used = (snap.exists ? (snap.data()?.used as number) : 0) ?? 0;

    if (used >= FREE_LIMIT) {
      throw new QuotaExceeded({ limit: FREE_LIMIT, used, remaining: 0, admin: false });
    }

    tx.set(
      ref,
      {
        email,
        uid,
        used: used + 1,
        limit: FREE_LIMIT,
        lastAt: FieldValue.serverTimestamp(),
        ...(snap.exists ? {} : { firstAt: FieldValue.serverTimestamp() }),
      },
      { merge: true }
    );

    return {
      limit: FREE_LIMIT,
      used: used + 1,
      remaining: FREE_LIMIT - used - 1,
      admin: false,
    };
  });
}

/** Give a run back when the upstream call failed. Never drops below zero. */
export async function refund(email: string): Promise<void> {
  if (unlimitedRuns(email)) return;

  if (isDevStub()) {
    memory.set(email, Math.max(0, (memory.get(email) ?? 1) - 1));
    return;
  }

  const ref = db().collection(COLLECTION).doc(email);
  try {
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return;
      const used = (snap.data()?.used as number) ?? 0;
      tx.update(ref, { used: Math.max(0, used - 1) });
    });
  } catch {
    // A failed refund must not mask the original upstream error the caller is reporting.
  }
}

/** Fire-and-forget audit row. Never allowed to break the request. */
export async function logRun(
  email: string,
  entry: { params: unknown; ok: boolean; ms: number; error?: string }
): Promise<void> {
  if (isDevStub()) return;
  try {
    await db()
      .collection(COLLECTION)
      .doc(email)
      .collection("runs")
      .add({ ...entry, at: FieldValue.serverTimestamp() });
  } catch {
    /* audit is best-effort */
  }
}
