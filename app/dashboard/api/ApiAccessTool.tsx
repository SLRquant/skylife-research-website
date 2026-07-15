"use client";

import { useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Plate } from "@/components/Plate";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { authedFetch } from "@/lib/firebase/client";
import { useAuth } from "@/lib/firebase/AuthProvider";

const DOCS_URL = "https://developers.skyliferesearch.com";
const CHART_URL =
  "https://graph-api.skyliferesearch.com/v1/graph-stats/chart" +
  "?interval=1d&lookback=60&periods=1&metrics=eigenvector_centrality" +
  "&graph_method=knn&knn_k=4&include_graph=true";

type TokenResult = {
  access_token: string;
  token_type: string;
  expires_in_hours: number;
  email: string;
  limits: { perMinute: number; perDay: number };
};

/**
 * Read a response as JSON without ever throwing a parser error at the user.
 *
 * Our routes answer in JSON on every path they control — but a platform-level failure (a crashed
 * handler, a gateway timeout, a bad rewrite) returns an HTML error page, and a bare res.json() on
 * that surfaces as `Unexpected token '<', "<!DOCTYPE "...` — a message about our parser, not the
 * user's problem. Translate it into something true and actionable.
 */
async function readJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      res.status >= 500
        ? "The token service is temporarily unavailable. Please try again in a moment."
        : `The server returned an unreadable response (${res.status}).`
    );
  }
}

/** 24h from `mintedAt`, rendered in the viewer's locale. */
function expiryLabel(mintedAt: number, hours: number): string {
  const d = new Date(mintedAt + hours * 3_600_000);
  return d.toLocaleString();
}

export function ApiAccessTool() {
  const { user } = useAuth();

  const [token, setToken] = useState<TokenResult | null>(null);
  const [mintedAt, setMintedAt] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const generate = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authedFetch("/api/dev/token", { method: "POST" });
      const json = (await readJson(res)) as Partial<TokenResult> & { message?: string; error?: string };
      if (!res.ok || !json.access_token) {
        throw new Error(json.message ?? json.error ?? `Request failed (${res.status})`);
      }
      setToken(json as TokenResult);
      setMintedAt(Date.now());
    } catch (e) {
      setToken(null);
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.setTimeout(() => setCopied((c) => (c === what ? null : c)), 1500);
    } catch {
      /* clipboard blocked — the code block is selectable as a fallback */
    }
  };

  const bearer = token?.access_token ?? "<TOKEN>";
  const curlChart = `curl '${CHART_URL}' \\\n  -H 'Authorization: Bearer ${bearer}'`;

  return (
    <>
      <Plate />
      <Navbar />
      <ProtectedRoute>
        <main className="tool-page">
          <div className="wrap tool-wrap">
            <header className="tool-header">
              <div>
                <span className="label">Developer tool / programmatic API access</span>
                <h1 className="tool-title">API Access</h1>
                <p className="tool-sub">
                  Call the graph-stats API directly from your own code. Generate a short-lived
                  developer token below, then send it as a <span className="mono">Bearer</span>{" "}
                  header to the endpoint. The same per-stock network centrality the Graph Stats
                  tool shows, as raw JSON.
                </p>
              </div>
              <Link href="/dashboard" className="btn btn-ghost tool-back">
                <span>← Dashboard</span>
              </Link>
            </header>

            {/* ---- intro / limits ---- */}
            <section className="panel panel-body">
              <span className="label">How it works</span>
              <ul style={{ margin: "var(--space-3) 0 0", paddingLeft: "1.2em", display: "grid", gap: "var(--space-2)", color: "var(--text-2)", fontSize: "var(--text-sm)" }}>
                <li>
                  A generated token is a JWT that lasts{" "}
                  <span className="sig">24 hours</span>. After it expires, come back and generate a
                  new one.
                </li>
                <li>
                  Send it on every request as the header{" "}
                  <span className="mono">Authorization: Bearer &lt;token&gt;</span>.
                </li>
                <li>
                  Rate limits per user: <span className="sig">1</span> request / minute and{" "}
                  <span className="sig">30</span> requests / day.
                </li>
                <li>
                  Keep the token secret — anyone holding it can call the API as you until it
                  expires.
                </li>
              </ul>
            </section>

            {/* ---- token ---- */}
            <section className="panel" style={{ marginTop: "var(--space-4)" }}>
              <div className="panel-head">
                <span className="label">Developer token</span>
                {token && (
                  <span className="label">
                    Expires <i className="sig">{expiryLabel(mintedAt, token.expires_in_hours)}</i>
                  </span>
                )}
              </div>
              <div className="panel-body">
                {!token && (
                  <p style={{ color: "var(--text-2)", fontSize: "var(--text-sm)", marginBottom: "var(--space-3)" }}>
                    Generate a token tied to your account{user?.email ? (
                      <>
                        {" "}(<span className="mono">{user.email}</span>)
                      </>
                    ) : null}. It is shown once here — copy it into your environment.
                  </p>
                )}

                {token && (
                  <>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "var(--space-3)",
                        flexWrap: "wrap",
                        marginBottom: "var(--space-3)",
                      }}
                    >
                      <code
                        className="sig"
                        style={{
                          flex: "1 1 320px",
                          minWidth: 0,
                          padding: "var(--space-3)",
                          border: "1px solid var(--rule-2)",
                          background: "var(--ink-900)",
                          fontSize: "var(--text-xs)",
                          overflowWrap: "anywhere",
                          wordBreak: "break-all",
                        }}
                      >
                        {token.access_token}
                      </code>
                      <button
                        className="btn"
                        onClick={() => copy(token.access_token, "token")}
                      >
                        {copied === "token" ? "Copied ✓" : "Copy"}
                      </button>
                    </div>
                    <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                      <span className="label">
                        Type <i className="sig">{token.token_type}</i>
                      </span>
                      <span className="label">
                        Limits <i className="sig">{token.limits.perMinute}</i>/min ·{" "}
                        <i className="sig">{token.limits.perDay}</i>/day
                      </span>
                    </div>
                  </>
                )}

                <div className="gs-actions" style={{ marginTop: "var(--space-4)", display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>
                  <button className="btn btn-primary" onClick={generate} disabled={loading}>
                    {loading
                      ? "Generating…"
                      : token
                        ? "Regenerate token →"
                        : "Generate API token →"}
                  </button>
                  {token && (
                    <span className="label">
                      Regenerating replaces the token shown above.
                    </span>
                  )}
                </div>

                {error && <p className="form-err" style={{ marginTop: "var(--space-3)" }}>{error}</p>}
              </div>
            </section>

            {/* ---- curl example ---- */}
            <section className="panel" style={{ marginTop: "var(--space-4)" }}>
              <div className="panel-head">
                <span className="label">Try it · curl</span>
                <button className="btn btn-ghost" onClick={() => copy(curlChart, "curl")}>
                  {copied === "curl" ? "Copied ✓" : "Copy"}
                </button>
              </div>
              <div className="panel-body">
                <pre
                  style={{
                    margin: 0,
                    padding: "var(--space-3)",
                    border: "1px solid var(--rule-2)",
                    background: "var(--ink-900)",
                    overflowX: "auto",
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--text-xs)",
                    lineHeight: 1.6,
                    color: "var(--text)",
                  }}
                >
{`curl '${CHART_URL}' \\
  -H 'Authorization: Bearer `}
                  <span className="sig">{bearer}</span>
{`'`}
                </pre>
                <p className="gs-hint" style={{ marginTop: "var(--space-2)" }}>
                  {token
                    ? "The token above is already spliced into this command — copy and run it."
                    : "Generate a token above and it will be spliced into this command automatically."}
                </p>
                <p style={{ marginTop: "var(--space-3)", color: "var(--text-2)", fontSize: "var(--text-sm)" }}>
                  Full parameter reference and endpoint docs:{" "}
                  <a href={DOCS_URL} target="_blank" rel="noopener noreferrer" className="mono">
                    developers.skyliferesearch.com →
                  </a>
                </p>
              </div>
            </section>
          </div>
        </main>
      </ProtectedRoute>
    </>
  );
}
