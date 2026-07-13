"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { PlotterGraph, type PFrame } from "@/components/PlotterGraph";
import { clusterInk, clusterSwatch, hatchAngle } from "@/components/graph-stats/colors";

type Payload = {
  universe: string;
  method: string;
  metric: string;
  frames: PFrame[];
  live: boolean;
};

const fetcher = (u: string) => fetch(u).then((r) => r.json());

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "2-digit" }) : "—";

/**
 * /network-graph — Fig. 2, full plate.
 *
 * Same real graph series as Fig. 1 (six genuinely recomputed MSTs, one per estimation window),
 * given the whole page and a sidebar that reads out what the current frame actually contains.
 */
export function NetworkGraphTool() {
  const { data, isLoading } = useSWR<Payload>("/api/public/graph-series", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 600_000,
  });

  const frames = useMemo(() => data?.frames ?? [], [data]);
  const [i, setI] = useState(2); // the 60-bar window — the engine's default
  const [selected, setSelected] = useState<string | null>(null);

  const f = frames[Math.min(i, Math.max(frames.length - 1, 0))];

  const clusters = useMemo(() => {
    if (!f) return [];
    const m = new Map<number, { id: number; members: Array<{ id: string; centrality: number }> }>();
    for (const n of f.nodes) {
      if (!m.has(n.community)) m.set(n.community, { id: n.community, members: [] });
      m.get(n.community)!.members.push({ id: n.id, centrality: n.centrality });
    }
    return [...m.values()]
      .map((c) => ({
        ...c,
        members: c.members.sort((a, b) => b.centrality - a.centrality),
      }))
      .sort((a, b) => b.members.length - a.members.length);
  }, [f]);

  const node = useMemo(
    () => (selected && f ? f.nodes.find((n) => n.id === selected) ?? null : null),
    [selected, f]
  );

  const neighbours = useMemo(() => {
    if (!selected || !f) return [];
    const out: Array<{ id: string; rho: number; community: number }> = [];
    const comm = new Map(f.nodes.map((n) => [n.id, n.community]));
    for (const e of f.edges) {
      const other =
        e.source === selected ? e.target : e.target === selected ? e.source : null;
      if (other) out.push({ id: other, rho: e.rho, community: comm.get(other) ?? 0 });
    }
    return out.sort((a, b) => Math.abs(b.rho) - Math.abs(a.rho));
  }, [selected, f]);

  return (
    <>
      <Navbar />
      <main className="tool-page">
        <div className="wrap">
          <div className="tool-head">
            <div>
              <div className="label">Fig. 2 — Full plate</div>
              <h1>The correlation network</h1>
              <p>
                The NIFTY-50 drawn by correlation structure: a Mantegna minimum spanning tree over
                the daily-return correlation matrix, communities by Louvain, node radius by
                eigenvector centrality. Hover a stock to trace its neighbourhood hop by hop. Drag
                the scrubber to change the estimation window and watch what moves.
              </p>
            </div>
            <Link href="/" className="btn btn-quiet">
              ← Back to the paper
            </Link>
          </div>

          <div className="tool-layout">
            <div className="plate">
              {isLoading && <div className="overlay">Recomputing six graphs — this is live</div>}
              {!isLoading && !frames.length && (
                <div className="overlay">
                  Live graph unavailable. We would rather show nothing than something invented.
                </div>
              )}

              {frames.length > 0 && (
                <>
                  <PlotterGraph
                    frames={frames}
                    frame={i}
                    height={640}
                    selected={selected}
                    onSelect={setSelected}
                    labelTopK={14}
                  />

                  <div className="scrub">
                    <span className="scrub-label">
                      WINDOW <b>{f?.lookback}</b> bars
                    </span>
                    <div className="scrub-track" role="group" aria-label="Estimation window">
                      {frames.map((fr, k) => (
                        <button
                          key={fr.lookback}
                          type="button"
                          className={`scrub-step${k === i ? " on" : ""}`}
                          onClick={() => setI(k)}
                          aria-label={`${fr.lookback}-bar window`}
                          aria-pressed={k === i}
                        />
                      ))}
                    </div>
                    <span className="scrub-label">
                      μ <b>{f?.modularity?.toFixed(3) ?? "—"}</b> · {f?.nCommunities} comm.
                    </span>
                  </div>

                  <div className="legend">
                    {clusters.map((c) => (
                      <span className="legend-item" key={c.id}>
                        <span
                          className="legend-key"
                          style={{
                            color: clusterInk(c.id),
                            backgroundImage: `repeating-linear-gradient(${hatchAngle(
                              c.id
                            )}deg, ${clusterInk(c.id)} 0 1px, transparent 1px 4px)`,
                          }}
                        />
                        C{c.id} <span className="dim">({c.members.length})</span>
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>

            <aside className="side">
              {!node && (
                <>
                  <div className="side-head">
                    <span className="label">Communities</span>
                    <span className="label">{clusters.length}</span>
                  </div>
                  {clusters.map((c) => (
                    <div className="cluster-row" key={c.id}>
                      <div className="cluster-top">
                        <span className="swatch" style={clusterSwatch(c.id)} />
                        <span className="cluster-name">C{c.id}</span>
                        <span className="cluster-n">{c.members.length} stocks</span>
                      </div>
                      <button
                        type="button"
                        className="cluster-lead"
                        onClick={() => setSelected(c.members[0].id)}
                      >
                        <span>most central</span>
                        <b>
                          {c.members[0].id} · {c.members[0].centrality.toFixed(3)}
                        </b>
                      </button>
                    </div>
                  ))}
                  <p className="hint" style={{ marginTop: "var(--space-3)" }}>
                    Click any node to inspect it. Centrality is normalised within the frame, so the
                    most central stock in each window reads 1.000.
                  </p>
                </>
              )}

              {node && (
                <>
                  <button type="button" className="cluster-lead" onClick={() => setSelected(null)}>
                    ← back to communities
                  </button>
                  <div className="side-head" style={{ marginTop: "var(--space-2)" }}>
                    <span className="cluster-name">{node.id}</span>
                    <span className="swatch" style={clusterSwatch(node.community)} />
                  </div>
                  <div className="stat-grid">
                    <div className="stat">
                      <div className="label">Community</div>
                      <div className="stat-v">C{node.community}</div>
                    </div>
                    <div className="stat">
                      <div className="label">Eigenvector</div>
                      <div className="stat-v" style={{ color: "var(--signal)" }}>
                        {node.centrality.toFixed(3)}
                      </div>
                    </div>
                    <div className="stat">
                      <div className="label">Degree</div>
                      <div className="stat-v">{neighbours.length}</div>
                    </div>
                    <div className="stat">
                      <div className="label">Window</div>
                      <div className="stat-v">{f?.lookback}</div>
                    </div>
                  </div>

                  <div className="side-head">
                    <span className="label">Tree neighbours</span>
                    <span className="label">ρ</span>
                  </div>
                  {neighbours.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      className="cluster-lead"
                      onClick={() => setSelected(n.id)}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span className="swatch" style={clusterSwatch(n.community)} />
                        {n.id}
                      </span>
                      <b>{n.rho.toFixed(3)}</b>
                    </button>
                  ))}
                  {!neighbours.length && <p className="hint">No tree edges in this frame.</p>}
                </>
              )}
            </aside>
          </div>

          <p className="fig-caption">
            <b>Fig. 2</b> — NIFTY-50 correlation network, MST over Pearson daily-return
            correlations, <b>n={f?.nodes.length ?? 49}</b>, <b>{f?.edges.length ?? 48}</b> edges, as
            of <b>{fmtDate(f?.asOf ?? null)}</b>. Estimation window <b>{f?.lookback ?? 60}</b> bars.
            Louvain communities <b>{f?.nCommunities ?? "—"}</b>, modularity{" "}
            <b>{f?.modularity?.toFixed(3) ?? "—"}</b>. Edges are undirected — Skylife&apos;s own
            lead-lag study finds no directed pair surviving an FDR-10% null, so this figure draws
            none.
          </p>
        </div>
      </main>
    </>
  );
}
