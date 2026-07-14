/**
 * Lightweight in-memory rate limiter. SERVER ONLY.
 *
 * A fixed-window counter keyed by IP (or any string). This is a *backstop* against bursts and
 * bots — the per-email Firestore quota is the real limit.
 *
 * Caveat: serverless instances don't share memory, so the effective limit is per-instance. That
 * is fine for the abuse it's meant to stop (one client hammering one endpoint). If you ever need
 * a strict global limit, move this to Firestore/Upstash.
 */
import "server-only";

type Window = { count: number; resetAt: number };

const buckets = new Map<string, Window>();

/** Purge expired entries so the map can't grow without bound. */
function sweep(now: number) {
  if (buckets.size < 500) return;
  for (const [k, w] of buckets) if (w.resetAt <= now) buckets.delete(k);
}

export type Limit = { ok: boolean; remaining: number; retryAfter: number };

export function rateLimit(key: string, max: number, windowMs: number): Limit {
  const now = Date.now();
  sweep(now);

  const w = buckets.get(key);
  if (!w || w.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: max - 1, retryAfter: 0 };
  }

  w.count += 1;
  if (w.count > max) {
    return { ok: false, remaining: 0, retryAfter: Math.ceil((w.resetAt - now) / 1000) };
  }
  return { ok: true, remaining: max - w.count, retryAfter: 0 };
}

/** Best-effort client IP. Vercel sets x-forwarded-for; the first entry is the real client. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
