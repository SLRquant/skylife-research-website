"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { authedFetch } from "@/lib/firebase/client";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { Leaderboard } from "@/components/graph-stats/Leaderboard";
import { TimeSeriesChart } from "@/components/graph-stats/TimeSeriesChart";
import { GraphCanvas } from "@/components/GraphCanvas";
import { clusterColor } from "@/components/graph-stats/colors";
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
        setBlocked(null);
        if (r.ok && j?.quota) {
          setQuota(j.quota);
          if (j.tier) setTier(j.tier);
          if (j.limits) setLimits(j.limits);
        }
      })
      .catch(() => {});
  }, [user]);

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
      const json = await res.json();

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
      <div className="grid-bg" aria-hidden="true" />
      <div className="glow" aria-hidden="true" />
      <Navbar />
      <ProtectedRoute>
        <main className="tool-page">
          <div className="wrap tool-wrap">
            <header className="tool-header">
              <div>
                <div className="eyebrow" style={{ marginBottom: 8 }}>
                  <span className="eb-primary">◉ MEMBERS TOOL</span>
                  <span className="sep">/</span>
                  <span>graph statistics over time</span>
                </div>
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
                <div className="mono dim" style={{ fontSize: 11, letterSpacing: ".2em" }}>
                  ◉ GOOGLE ACCOUNT REQUIRED
                </div>
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

            {/* ---- params ---- */}
            <section className="gs-params" style={blocked ? { opacity: 0.35, pointerEvents: "none" } : undefined}>
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
                <span className="mono dim gs-metrics-label">METRICS</span>
                {METRICS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    title={m.hint}
                    className={`gs-chip${metrics.includes(m.id) ? " on" : ""}`}
                    onClick={() => toggleMetric(m.id)}
                  >
                    {m.label}
                  </button>
                ))}
                <FieldErr msg={errs.metrics} />
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
                    <span className="gs-upsell-tag mono">🔒 PRO FEATURE</span>
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
                <p className="form-note" style={{ color: "var(--warn)" }}>
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
                      className={`gs-tab${activeMetric === m ? " on" : ""}`}
                      onClick={() => setActiveMetric(m)}
                    >
                      {METRICS.find((x) => x.id === m)?.label ?? m}
                    </button>
                  ))}
                </div>
                <section className="gs-results">
                  <div className="gs-main">
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
                  <section className="gs-network">
                    <button
                      type="button"
                      className="gs-network-head"
                      onClick={() => setShowGraph((v) => !v)}
                      aria-expanded={showGraph}
                    >
                      <span className="mono gs-network-title">
                        ◇ LATEST NETWORK
                        <span className="dim">
                          {"  "}· {graph.nodes} nodes · {graph.n_communities} clusters ·
                          modularity {graph.modularity?.toFixed(3) ?? "—"} · as of{" "}
                          {graph.asof_date.slice(0, 10)}
                        </span>
                      </span>
                      <span className="mono dim">{showGraph ? "HIDE ▲" : "SHOW ▼"}</span>
                    </button>

                    {showGraph && (
                      <>
                        <GraphCanvas
                          nodes={Object.entries(graph.communities).map(([sym, c]) => ({
                            id: sym,
                            symbol: sym,
                            cluster: c,
                            clusterColor: clusterColor(c),
                            centrality: normCentrality[sym] ?? 0.2,
                          }))}
                          edges={graph.edge_list}
                          selected={null}
                          onSelect={(id) => id && toggleSymbol(id)}
                          height={560}
                        />
                        <p className="gs-network-note dim">
                          Node size ={" "}
                          {METRICS.find((x) => x.id === activeMetric)?.label}. Click a node to
                          cross-filter the chart above.
                        </p>
                      </>
                    )}
                  </section>
                )}
              </>
            )}

            {!result && !loading && (
              <div className="gs-empty mono dim">
                Pick your parameters and hit <strong>Run analysis</strong>.
              </div>
            )}
          </div>
        </main>
      </ProtectedRoute>
    </>
  );
}
