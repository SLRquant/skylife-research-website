/**
 * Param schema, TIER limits, and validation — shared by the FORM and the SERVER.
 *
 * Deliberately free of `server-only` so the client can import it: the form validates against the
 * exact same rules the route enforces, which is what lets us show a precise message under the
 * offending field instead of a bare "invalid_params" after a round trip.
 *
 * Tiers gate the expensive knobs. `free` is deliberately capable enough to be useful and
 * deliberately limited enough to be worth upgrading from.
 */
import { z } from "zod";

export const METRICS = [
  "degree_strength",
  "eigenvector_centrality",
  "betweenness_centrality",
  "closeness_centrality",
  "pagerank",
] as const;

/** Fixed number of as-of days plotted. */
export const PERIODS = 10;

export const ALL_INTERVALS = ["1m", "5m", "15m", "1h", "1d"] as const;
export const ALL_GRAPH_METHODS = ["mst", "knn", "threshold", "complete"] as const;

export type Interval = (typeof ALL_INTERVALS)[number];
export type GraphMethod = (typeof ALL_GRAPH_METHODS)[number];
export type Metric = (typeof METRICS)[number];
/** True for intraday bars — these need a TIME on the axis, not just a date. */
export function isIntraday(i: string): boolean {
  return i !== "1d";
}

/**
 * Two tiers only.
 *   free — a genuinely useful taste of the tool
 *   paid — everything unlocked, no caps beyond the engine's own hard ceilings
 * Admins are simply on `paid`.
 */
export type Tier = "free" | "paid";

export type TierLimits = {
  label: string;
  intervals: readonly Interval[];
  graphMethods: readonly GraphMethod[];
  lookbackMax: number;
  periodsMax: number;
  symbolsMax: number;
  /** null = unlimited runs */
  runs: number | null;
  /**
   * `null` = the user picks any subset of METRICS.
   * A list = the metric set is FIXED. The form locks the chips and the server rejects anything
   * else, so the two cannot drift apart.
   */
  fixedMetrics: readonly Metric[] | null;
};

/**
 * The metric set a free user always gets. Fixed, not chosen.
 *
 * Choosing metrics is a power-user act — it presumes you already know what Betweenness is and why
 * you'd want it without Closeness. A first-time visitor doesn't, and a half-picked set makes the
 * tool look broken rather than restrained. So free runs the whole panel: all five, every time, no
 * decision to get wrong. (Cost isn't the constraint — all 5 metrics over the full universe were
 * measured at ~9s; the engine barely notices.)
 */
export const FREE_METRICS = [
  "eigenvector_centrality",
  "pagerank",
  "degree_strength",
  "betweenness_centrality",
  "closeness_centrality",
] as const satisfies readonly Metric[];

export const TIERS: Record<Tier, TierLimits> = {
  free: {
    label: "Free",
    intervals: ["1d"],
    graphMethods: ["mst", "knn"],
    lookbackMax: 100,
    periodsMax: 30,
    symbolsMax: 50,
    runs: Number(process.env.NEXT_PUBLIC_GRAPH_STATS_FREE_LIMIT ?? 5),
    fixedMetrics: FREE_METRICS,
  },
  paid: {
    label: "Paid",
    // No product limits. The numbers below are the ENGINE's hard ceilings (a request past them
    // simply cannot be served inside the 60s function budget) — not a paywall.
    intervals: ALL_INTERVALS,
    graphMethods: ALL_GRAPH_METHODS,
    lookbackMax: 300,   // 300 + 10 periods = 310 < ~377 available bars
    periodsMax: 30,
    symbolsMax: 50,
    runs: null,
    fixedMetrics: null,   // paid chooses freely
  },
};

/** Absolute ceilings — the schema's job is shape, the tier's job is entitlement. */
export const HARD = {
  lookback: { min: 2, max: 300 },   // beyond this there is simply no history
  periods: { min: 1, max: 30 },
  knn_k: { min: 1, max: 20 },
  corr_threshold: { min: 0, max: 1 },
  symbols: { max: 50 },
} as const;

export const ParamsSchema = z.object({
  // Shape-valid for anyone; entitlement is checked separately by validateForTier().
  interval: z.enum(ALL_INTERVALS).default("1d"),

  lookback: z.coerce
    .number({ message: "Enter a number." })
    .int("Must be a whole number.")
    .min(HARD.lookback.min, `Must be at least ${HARD.lookback.min} bars.`)
    .max(HARD.lookback.max, `Must be ${HARD.lookback.max} bars or fewer.`)
    .default(60),

  // Fixed at 10 as-of days — not a user knob. 10 trading days is enough to see a stock's
  // centrality move without pushing the window past the available history.
  periods: z.coerce.number().int().min(1).max(HARD.periods.max).default(PERIODS),

  symbols: z
    .string()
    .trim()
    .max(600, "Too long.")
    .optional()
    .transform((s) => (s ? s : undefined))
    .refine(
      (s) => !s || s.split(",").filter(Boolean).length <= HARD.symbols.max,
      `At most ${HARD.symbols.max} symbols.`
    ),

  metrics: z.array(z.enum(METRICS)).min(1, "Select at least one metric."),

  graph_method: z.enum(ALL_GRAPH_METHODS).default("mst"),

  knn_k: z.coerce
    .number({ message: "Enter a number." })
    .int("Must be a whole number.")
    .min(HARD.knn_k.min)
    .max(HARD.knn_k.max)
    .default(5),

  corr_threshold: z.coerce
    .number({ message: "Enter a number." })
    .min(HARD.corr_threshold.min, "Must be ≥ 0.")
    .max(HARD.corr_threshold.max, "Must be ≤ 1.")
    .default(0.5),

  corr_method: z.enum(["pearson", "spearman"]).default("pearson"),

  include_graph: z.boolean().default(true),
});

export type Params = z.infer<typeof ParamsSchema>;

/** A tier violation: which field, what to say, and whether upgrading would fix it. */
export type TierIssue = { path: string[]; message: string; upgrade: boolean };

/**
 * Check a shape-valid params object against a tier's entitlements.
 * Returns [] when the caller may proceed.
 */
export function validateForTier(p: Params, tier: Tier): TierIssue[] {
  const t = TIERS[tier];
  const issues: TierIssue[] = [];

  if (!t.intervals.includes(p.interval)) {
    issues.push({
      path: ["interval"],
      message: `The ${p.interval} interval isn't available on ${t.label}. Included: ${t.intervals.join(", ")}.`,
      upgrade: true,
    });
  }

  if (!t.graphMethods.includes(p.graph_method)) {
    issues.push({
      path: ["graph_method"],
      message: `The "${p.graph_method}" method isn't available on ${t.label}. Included: ${t.graphMethods.join(", ")}.`,
      upgrade: true,
    });
  }

  // A fixed metric set means EXACTLY that set — not a subset, not a superset. Enforced here so a
  // hand-crafted request can't quietly pick its own; the form's locked chips are only the UI half.
  if (t.fixedMetrics) {
    const want = new Set<string>(t.fixedMetrics);
    const got = new Set<string>(p.metrics);
    const same = want.size === got.size && [...want].every((m) => got.has(m));
    if (!same) {
      issues.push({
        path: ["metrics"],
        message: `${t.label} runs a fixed set of metrics and they can't be changed. Upgrade to choose which to compute.`,
        upgrade: true,
      });
    }
  }

  if (p.lookback > t.lookbackMax) {
    issues.push({
      path: ["lookback"],
      message: `${t.label} allows a lookback up to ${t.lookbackMax} bars.`,
      upgrade: true,
    });
  }

  if (p.periods > t.periodsMax) {
    issues.push({
      path: ["periods"],
      message: `${t.label} allows up to ${t.periodsMax} periods.`,
      upgrade: true,
    });
  }

  const nSyms = p.symbols?.split(",").filter(Boolean).length ?? 0;
  if (nSyms > t.symbolsMax) {
    issues.push({
      path: ["symbols"],
      message: `${t.label} allows up to ${t.symbolsMax} symbols.`,
      upgrade: true,
    });
  }

  return issues;
}

/**
 * NOTE ON COST — measured, not guessed.
 *
 * Graph method and metric count barely matter at this universe size: `complete` (every pair,
 * 1,176 edges) over 60 periods with all 5 metrics runs in ~9s. 49 nodes is simply small.
 *
 * The ONE thing that blows up is asking for more history than exists. Data begins 2025-01-01
 * (~377 daily bars). Request 500 and the engine widens its search past the start of the data,
 * rescans the whole 1-minute table, and dies after ~75s. So the only real guard is the
 * lookback ceiling below — the backend now rejects the rest in ~2s with a clear message.
 */

/** zod / tier issues -> { field: "message" }, so each error renders beside its own input. */
export function fieldErrors(
  issues: Array<{ path: PropertyKey[]; message: string }>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = String(i.path[0] ?? "_");
    if (!out[key]) out[key] = i.message;
  }
  return out;
}
