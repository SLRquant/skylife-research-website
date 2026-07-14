"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Plate } from "@/components/Plate";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { authedFetch } from "@/lib/firebase/client";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { Leaderboard } from "@/components/graph-stats/Leaderboard";
import { TimeSeriesChart } from "@/components/graph-stats/TimeSeriesChart";
import { GraphCanvas } from "@/components/GraphCanvas";
import { Def, DefList, InfoBox } from "@/components/InfoBox";
import { buildClusterScale } from "@/components/graph-stats/colors";
import type { LatestGraph, RollingData, Series } from "@/lib/graph-stats";
import {
  ALL_GRAPH_METHODS,
  ALL_INTERVALS,
  HARD,
  ParamsSchema,
  TIERS,
  PERIODS,
  fieldErrors,
  validateForTier,
  type Tier,
  type TierLimits,
} from "@/lib/graph-stats-schema";

const METRICS = [
  { id: "eigenvector_centrality", label: "Eigenvector", hint: "influence via well-connected peers" },
  { id: "pagerank", label: "PageRank", hint: "random-walk importance" },
  { id: "degree_strength", label: "Degree strength", hint: "total correlation to neighbours" },
  { id: "betweenness_centrality", label: "Betweenness", hint: "bridges shortest paths" },
  { id: "closeness_centrality", label: "Closeness", hint: "inverse distance to all others" },
] as const;

/** Renders a validation message directly beneath its own input. */
function FieldErr({ msg }: { msg?: string }) {
  return msg ? (
    <span className="gs-field-err" role="alert">
      {msg}
    </span>
  ) : null;
}

type Quota = { limit: number | null; used: number; remaining: number | null; admin: boolean };

type Result = {
  data: RollingData;
  interval: string;
  meta: { diagnostics?: { missing_symbols?: string[] } };
  quota: Quota;
};

const TOP_N = 8;

/**
 * Read a response as JSON without ever throwing a parser error at the user.
 *
 * Our routes answer in JSON on every path they control — but they do not control all of them. A
 * platform-level failure (a crashed handler, a gateway timeout, a 404 from a bad rewrite) returns
 * an HTML error page, and a bare `res.json()` on that surfaces as
 * `Unexpected token '<', "<!DOCTYPE "... is not valid JSON` — a message that describes our parser
 * instead of the user's problem. Translate it into something true and actionable.
 */
async function readJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      res.status >= 500
        ? "The graph service is temporarily unavailable. Please try again in a moment."
        : `The server returned an unreadable response (${res.status}).`
    );
  }
}

/** Rotating status verbs — a live-feeling message beats a static "Loading…". */
const WORKING = [
  "Computing",
  "Correlating",
  "Rebuilding graphs",
  "Measuring centrality",
  "Detecting communities",
  "Ranking hubs",
  "Tracing edges",
  "Crunching returns",
];

export function GraphStatsTool() {
  const { user } = useAuth();

  // params
  const [interval, setInterval] = useState<string>("1d");
  const [lookback, setLookback] = useState(60);
  const [symbols, setSymbols] = useState("");
  const [metrics, setMetrics] = useState<string[]>(["eigenvector_centrality", "pagerank"]);
  const [graphMethod, setGraphMethod] = useState<string>("mst");
  const [knnK, setKnnK] = useState(5);
  const [corrThreshold, setCorrThreshold] = useState(0.5);

  // state
  const [quota, setQuota] = useState<Quota | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [activeMetric, setActiveMetric] = useState<string>("eigenvector_centrality");
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});

  const [blocked, setBlocked] = useState<string | null>(null);
  const [tier, setTier] = useState<Tier>("free");
  const [limits, setLimits] = useState<TierLimits>(TIERS.free);
  const [upsell, setUpsell] = useState<string | null>(null);
  const [showGraph, setShowGraph] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  // quota + entitlements on load — read-only, does not consume a run
  useEffect(() => {
    if (!user) return;
    authedFetch("/api/graph-stats/quota")
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (r.status === 403) {
          setBlocked(j?.message ?? "This tool requires a Google account.");
          return;
        }
        // A deployment missing its secrets can't serve anyone. Say so on load, rather than
        // letting the user fill in the whole form and only then hit a wall.
        if (r.status === 503) {
          setBlocked(j?.message ?? "The graph service is temporarily unavailable.");
          return;
        }
        setBlocked(null);
        if (r.ok && j?.quota) {
          setQuota(j.quota);
          if (j.tier) setTier(j.tier);
          if (j.limits) setLimits(j.limits);
        }
      })
      .catch(() => {});
  }, [user]);

  /**
   * A tier with a fixed metric set doesn't get to pick. Force the state to that exact set the
   * moment the tier lands, so the form can never submit something the server will reject — the
   * chips and validateForTier() read the SAME `limits.fixedMetrics`, so they cannot disagree.
   */
  const metricsLocked = limits.fixedMetrics !== null;
  useEffect(() => {
    const fixed = limits.fixedMetrics;
    if (!fixed) return;
    setMetrics((cur) =>
      cur.length === fixed.length && fixed.every((m) => cur.includes(m)) ? cur : [...fixed]
    );
  }, [limits]);

  const allows = <T extends string>(list: readonly T[], v: string) =>
    (list as readonly string[]).includes(v);

  const [verb, setVerb] = useState(WORKING[0]);

  useEffect(() => {
    if (!loading) return;
    const t = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    // swap the verb every ~2.5s so the wait reads as progress, not a hang
    const v = window.setInterval(
      () => setVerb(WORKING[Math.floor(Math.random() * WORKING.length)]),
      2500
    );
    setVerb(WORKING[Math.floor(Math.random() * WORKING.length)]);
    return () => {
      window.clearInterval(t);
      window.clearInterval(v);
    };
  }, [loading]);

  const toggleMetric = (id: string) =>
    setMetrics((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));

  const toggleSymbol = useCallback((s: string) => {
    setHighlighted((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }, []);

  const exhausted = quota != null && !quota.admin && (quota.remaining ?? 0) <= 0;

  const run = async () => {
    if (loading || exhausted || blocked) return;

    const payload = {
      interval,
      lookback,
      periods: PERIODS,
      symbols: symbols.trim() || undefined,
      metrics,
      graph_method: graphMethod,
      knn_k: knnK,
      corr_threshold: corrThreshold,
      include_graph: true,
    };

    // Validate against the SAME schema the server uses, so a bad value is caught here and
    // reported on its own field — no wasted round trip, no bare "invalid_params".
    const check = ParamsSchema.safeParse(payload);
    if (!check.success) {
      setErrs(fieldErrors(check.error.issues));
      setError(null);
      setUpsell(null);
      return;
    }

    // Then check entitlements. (The server re-checks; this is purely so the user finds out
    // instantly and sees an upgrade path instead of a rejection.)
    const gated = validateForTier(check.data, tier);
    if (gated.length > 0) {
      setErrs(fieldErrors(gated));
      setUpsell(gated[0].message);
      setError(null);
      return;
    }

    setErrs({});
    setUpsell(null);
    setLoading(true);
    setError(null);
    setElapsed(0);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await authedFetch("/api/graph-stats/run", {
        method: "POST",
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      const json = (await readJson(res)) as any;

      if (!res.ok) {
        if (json.quota) setQuota(json.quota);
        // The server can still reject — pin those issues to their own fields too.
        if ((res.status === 400 || res.status === 403) && Array.isArray(json.issues)) {
          setErrs(fieldErrors(json.issues));
          if (json.error === "upgrade_required") setUpsell(json.message);
          return;
        }
        throw new Error(json.message ?? json.error ?? `Request failed (${res.status})`);
      }

      const data = json.data as RollingData;
      setResult({ data, interval, meta: json.meta ?? {}, quota: json.quota });
      setQuota(json.quota);

      const m = metrics.includes(activeMetric) ? activeMetric : metrics[0];
      setActiveMetric(m);

      // start with the top N by latest value — 49 lines at once is unreadable
      const top = [...data.series]
        .map((s) => ({
          symbol: s.symbol,
          v: Number(s.points[s.points.length - 1]?.[m] ?? -Infinity),
        }))
        .sort((a, b) => b.v - a.v)
        .slice(0, TOP_N)
        .map((d) => d.symbol);
      setHighlighted(new Set(top));
    } catch (e) {
      // The user cancelled — that's not an error, and the server refunded the run.
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  };

  const cancel = () => abortRef.current?.abort();

  const series: Series[] = result?.data.series ?? [];
  const graph: LatestGraph | undefined = result?.data.latest_graph;

  /** Latest value of the active metric per symbol, normalised to 0..1 for node radius. */
  const normCentrality = useMemo(() => {
    const raw: Record<string, number> = {};
    for (const s of series) {
      const v = s.points[s.points.length - 1]?.[activeMetric];
      if (typeof v === "number" && Number.isFinite(v)) raw[s.symbol] = v;
    }
    const vals = Object.values(raw);
    const hi = Math.max(...vals, 1e-9);
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw)) out[k] = v / hi;
    return out;
  }, [series, activeMetric]);

  const exportCsv = () => {
    if (!result) return;
    const cols = result.data.metrics;
    const lines = ["symbol,community,date," + cols.join(",")];
    for (const s of result.data.series) {
      for (const p of s.points) {
        lines.push(
          [s.symbol, s.community ?? "", p.date, ...cols.map((c) => p[c] ?? "")].join(",")
        );
      }
    }
    const url = URL.createObjectURL(
      new Blob([lines.join("\n")], { type: "text/csv" })
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `graph-stats_${interval}_${PERIODS}p.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const missing = result?.meta?.diagnostics?.missing_symbols ?? [];

  return (
    <>
      <Plate />
      <Navbar />
      <ProtectedRoute>
        <main className="tool-page">
          <div className="wrap tool-wrap">
            <header className="tool-header">
              <div>
                <span className="label">Members tool / graph statistics over time</span>
                <h1 className="tool-title">Graph Stats</h1>
                <p className="tool-sub">
                  Per-stock network centrality, tracked across time. One correlation graph is
                  rebuilt for every as-of day, and each stock&apos;s position in that network is
                  measured — so you can see who is <em>becoming</em> a hub.
                </p>
              </div>
              <Link href="/dashboard" className="btn btn-ghost tool-back">
                <span>← Dashboard</span>
              </Link>
            </header>

            {blocked && (
              <div className="gs-blocked">
                <div className="label">Google account required</div>
                <p>{blocked}</p>
                <p className="dim">
                  You&apos;re signed in as <span className="mono">{user?.email}</span> using
                  email/password. Sign out and use <strong>Sign in with Google</strong> to access
                  this tool.
                </p>
                <Link href="/auth/sign-in" className="btn btn-primary">
                  Go to sign in →
                </Link>
              </div>
            )}

            <InfoBox title="What these metrics mean">
              <DefList>
                <Def term="The graph">
                  For each trading day we take the trailing window of returns, correlate every pair
                  of stocks, and keep only the strongest links. That gives one{" "}
                  <strong>network of the market</strong> per day. Every number below describes a
                  stock&rsquo;s <strong>position in that network</strong> — not its price, not its
                  return.
                </Def>
                <Def term="Eigenvector">
                  <strong>Influence via influential peers.</strong> 0 to 1. Being connected to many
                  stocks scores well; being connected to <em>central</em> stocks scores far better.
                  The highest score is the market&rsquo;s main hub — a shock there travels
                  furthest. Typically <em>0.2–0.5</em> for the top names.
                </Def>
                <Def term="PageRank">
                  <strong>Where a random walk ends up.</strong> Set something loose on the network
                  and let it wander along the links; PageRank is the share of time it spends on each
                  stock. Similar in spirit to Eigenvector, but kinder to well-connected names
                  outside the core. Sums to 1 across all stocks, so values are small —{" "}
                  <em>~0.02</em> is average in a 49-stock universe.
                </Def>
                <Def term="Degree">
                  <strong>Raw connectedness.</strong> Add up the correlation strength of every link
                  a stock has. Blunt but honest: it counts the crowd, and doesn&rsquo;t care whether
                  the crowd matters.
                </Def>
                <Def term="Betweenness">
                  <strong>The bridge.</strong> How often a stock sits on the shortest path between
                  two others. A high score means it <em>connects otherwise separate parts of the
                  market</em> — it may be small, yet removing it would split the network in two.
                  Most stocks score near <em>0</em>; a handful score high. That skew is the signal.
                </Def>
                <Def term="Closeness">
                  <strong>Reach.</strong> The inverse of the average distance to every other stock.
                  High = news reaches it quickly from anywhere; low = it sits out on the rim.
                </Def>
                <Def term="Latest / Δ">
                  <strong>Latest</strong> is the metric on the most recent day. <strong>Δ</strong>{" "}
                  is how much it changed across the whole period — the number that tells you a
                  stock is <em>becoming</em> a hub rather than already being one.
                </Def>
                <Def term="Rank">
                  Its standing among all stocks on the latest day, 1 = most central. The arrow shows
                  how many places it climbed or fell.
                </Def>
                <Def term="Q">
                  <strong>Modularity</strong>, 0 to 1 — how cleanly the market splits into blocs on
                  that day. <em>Above 0.3</em> is real structure; <em>0.4–0.7</em> is a strongly
                  clustered market.
                </Def>
              </DefList>
            </InfoBox>

            {/* ---- params ---- */}
            <section className="panel panel-body" style={blocked ? { opacity: 0.35, pointerEvents: "none" } : undefined}>
              <div className="gs-params-grid">
                <label className={`gs-field${errs.interval ? " has-err" : ""}`}>
                  <span>Interval</span>
                  <select value={interval} onChange={(e) => setInterval(e.target.value)}>
                    {/* Locked options stay VISIBLE but disabled — hiding them hides the reason
                        to upgrade. The server enforces the real gate regardless. */}
                    {ALL_INTERVALS.map((i) => {
                      const ok = allows(limits.intervals, i);
                      return (
                        <option key={i} value={i} disabled={!ok}>
                          {i}
                          {ok ? "" : "  🔒 Pro"}
                        </option>
                      );
                    })}
                  </select>
                  <FieldErr msg={errs.interval} />
                </label>

                <label className={`gs-field${errs.lookback ? " has-err" : ""}`}>
                  <span>Lookback</span>
                  <input
                    type="number"
                    min={HARD.lookback.min}
                    max={limits.lookbackMax}
                    aria-invalid={!!errs.lookback}
                    value={lookback}
                    onChange={(e) => setLookback(Number(e.target.value))}
                  />
                  {/* Helper text sits BELOW the input — keeping it in the label made the label
                      wrap to two lines and knocked this field out of the row's alignment. */}
                  <span className="gs-hint">bars · max {limits.lookbackMax}</span>
                  <FieldErr msg={errs.lookback} />
                </label>

                <label className={`gs-field${errs.graph_method ? " has-err" : ""}`}>
                  <span>Graph method</span>
                  <select value={graphMethod} onChange={(e) => setGraphMethod(e.target.value)}>
                    {ALL_GRAPH_METHODS.map((m) => {
                      const ok = allows(limits.graphMethods, m);
                      return (
                        <option key={m} value={m} disabled={!ok}>
                          {m}
                          {ok ? "" : "  🔒 Pro"}
                        </option>
                      );
                    })}
                  </select>
                  <FieldErr msg={errs.graph_method} />
                </label>

                {graphMethod === "knn" && (
                  <label className="gs-field">
                    <span>k</span>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={knnK}
                      onChange={(e) => setKnnK(Number(e.target.value))}
                    />
                    <span className="gs-hint">neighbours</span>
                  </label>
                )}

                {graphMethod === "threshold" && (
                  <label className="gs-field">
                    <span>|ρ| threshold</span>
                    <input
                      type="number"
                      step={0.05}
                      min={0}
                      max={1}
                      value={corrThreshold}
                      onChange={(e) => setCorrThreshold(Number(e.target.value))}
                    />
                    <span className="gs-hint">|correlation| cutoff</span>
                  </label>
                )}

                <label className={`gs-field gs-field-wide${errs.symbols ? " has-err" : ""}`}>
                  <span>Symbols</span>
                  <input
                    type="text"
                    placeholder="TCS, INFY, RELIANCE"
                    aria-invalid={!!errs.symbols}
                    value={symbols}
                    onChange={(e) => setSymbols(e.target.value)}
                  />
                  <span className="gs-hint">blank = all NIFTY-50 · max {limits.symbolsMax}</span>
                  <FieldErr msg={errs.symbols} />
                </label>
              </div>

              <div className="gs-metrics">
                <span className="label">Metrics</span>
                {METRICS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    title={metricsLocked ? "Included on your plan — not adjustable" : m.hint}
                    className={`key${metrics.includes(m.id) ? " on" : ""}${metricsLocked ? " is-locked" : ""}`}
                    aria-disabled={metricsLocked}
                    onClick={() => !metricsLocked && toggleMetric(m.id)}
                  >
                    {m.label}
                  </button>
                ))}
                {metricsLocked ? (
                  // Every chip is ON and none can be turned off — so say why, once, instead of
                  // letting five dead buttons imply the page is broken.
                  <span className="gs-hint" style={{ flexBasis: "100%" }}>
                    All five metrics are computed on {limits.label}. Upgrade to choose which to run.
                  </span>
                ) : (
                  <FieldErr msg={errs.metrics} />
                )}
              </div>

              <div className="gs-actions">
                <button
                  className="btn btn-primary"
                  onClick={run}
                  disabled={loading || exhausted || !!blocked}
                >
                  {loading ? `${verb}… ${elapsed}s` : "Run analysis →"}
                </button>

                {loading && (
                  <button className="btn btn-ghost gs-cancel" onClick={cancel}>
                    Cancel
                  </button>
                )}

                {quota && (
                  <span className={`gs-quota${exhausted ? " out" : ""}`}>
                    {quota.admin ? (
                      <>∞ unlimited runs</>
                    ) : (
                      <>
                        <strong>{quota.remaining}</strong> of {quota.limit} runs remaining
                      </>
                    )}
                  </span>
                )}

                <span className={`gs-tier gs-tier-${tier}`}>{limits.label}</span>

                {result && (
                  <button className="btn btn-ghost" onClick={exportCsv}>
                    Export CSV
                  </button>
                )}
              </div>
              {upsell && (
                <div className="gs-upsell">
                  <div className="gs-upsell-body">
                    <span className="label">Pro feature</span>
                    <p>{upsell}</p>
                  </div>
                  <Link href="/#pricing" className="btn btn-primary">
                    See plans <span className="arr">→</span>
                  </Link>
                </div>
              )}

              {exhausted && (
                <p className="form-err">
                  You&apos;ve used all {quota?.limit} of your runs.{" "}
                  <Link href="/#contact">Contact us</Link> to raise your limit.
                </p>
              )}
              {error && <p className="form-err">{error}</p>}
              
              {missing.length > 0 && (
                <p className="form-err">
                  Not found, so excluded: {missing.join(", ")}
                </p>
              )}
            </section>

            {/* ---- results ---- */}
            {result && (
              <>
                <div className="gs-metric-tabs">
                  {result.data.metrics.map((m) => (
                    <button
                      key={m}
                      className={`key${activeMetric === m ? " on" : ""}`}
                      onClick={() => setActiveMetric(m)}
                    >
                      {METRICS.find((x) => x.id === m)?.label ?? m}
                    </button>
                  ))}
                </div>
                <section className="panel panel-body">
                  <div>
                    <TimeSeriesChart
                      series={series}
                      metric={activeMetric}
                      asofDates={result.data.asof_dates}
                      interval={result.interval}
                      highlighted={highlighted}
                      onToggle={toggleSymbol}
                    />
                    <Leaderboard
                      series={series}
                      metric={activeMetric}
                      highlighted={highlighted}
                      onToggle={toggleSymbol}
                    />
                  </div>
                </section>

                {/* The network is its own full-width surface. Crammed into a 380px sidebar it
                    was unreadable; here it has room and can be collapsed when not wanted. */}
                {graph && (
                  <section className="panel" style={{ marginTop: "var(--space-4)" }}>
                    <button
                      type="button"
                      className="panel-head"
                      onClick={() => setShowGraph((v) => !v)}
                      aria-expanded={showGraph}
                    >
                      <span className="label">
                        Latest network · <i className="sig">{graph.nodes}</i> nodes ·{" "}
                        <i className="sig">{graph.n_communities}</i> communities · Q{" "}
                        <i className="sig">{graph.modularity?.toFixed(3) ?? "—"}</i> · as of{" "}
                        {graph.asof_date.slice(0, 10)}
                      </span>
                      <span className="label">{showGraph ? "HIDE ▲" : "SHOW ▼"}</span>
                    </button>

                    {showGraph && (
                      <>
                        <GraphCanvas
                          nodes={Object.entries(graph.communities).map(([sym, c]) => ({
                            id: sym,
                            symbol: sym,
                            cluster: c,
                            centrality: normCentrality[sym] ?? 0.2,
                          }))}
                          edges={graph.edge_list}
                          selected={null}
                          onSelect={(id) => id && toggleSymbol(id)}
                          height={560}
                        />
                        <p className="label" style={{ padding: "var(--space-3)" }}>
                          Node size = {METRICS.find((x) => x.id === activeMetric)?.label}. Colour
                          = community. Click a node to cross-filter the chart above.
                        </p>
                      </>
                    )}
                  </section>
                )}
              </>
            )}

            {!result && !loading && (
              <div className="gs-empty label">
                Pick your parameters and hit <strong>Run analysis</strong>.
              </div>
            )}
          </div>
        </main>
      </ProtectedRoute>
    </>
  );
}
