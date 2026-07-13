"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { PlotterGraph, type PFrame } from "@/components/PlotterGraph";
import { clusterInk, hatchAngle } from "@/components/graph-stats/colors";

type Payload = {
  universe: string;
  method: string;
  metric: string;
  frames: PFrame[];
  live: boolean;
};

const fetcher = (u: string) => fetch(u).then((r) => r.json());

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", { year: "numeric", month: "2-digit", day: "2-digit" })
    : "—";

/**
 * FIGURE 1 — the signature.
 *
 * Every frame is a REAL minimum spanning tree computed by the real engine on real NIFTY-50
 * returns. The scrubber advances the ESTIMATION WINDOW, not the as-of date, and that is a
 * deliberate, honest choice: the upstream API has no `as_of` parameter, so a sequence of past
 * graphs does not exist and we will not invent one.
 *
 * The window sweep turns out to be the better figure anyway, because it answers a question a
 * quant actually asks: *how much of this stock's network role is an artifact of my window?*
 * Between a 30-bar and a 120-bar window roughly half of the 48 MST edges change. Nodes are
 * warm-started and anchored to their previous position ∝ stability, so a stock whose role is
 * window-robust barely moves, and one whose role is fragile MIGRATES ACROSS THE PLATE.
 *
 * The displacement is the information.
 */
export function Figure1() {
  const { data, isLoading } = useSWR<Payload>("/api/public/graph-series", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 600_000,
  });

  const frames = useMemo(() => data?.frames ?? [], [data]);
  const [i, setI] = useState(2); // open on the 60-bar window — the engine's default
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (frames.length && i >= frames.length) setI(frames.length - 1);
  }, [frames, i]);

  const f = frames[Math.min(i, Math.max(frames.length - 1, 0))];

  /** Communities present in THIS frame, ordered by size — for the legend. */
  const legend = useMemo(() => {
    if (!f) return [];
    const n = new Map<number, number>();
    for (const nd of f.nodes) n.set(nd.community, (n.get(nd.community) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1]);
  }, [f]);

  const modRange = useMemo(() => {
    const m = frames.map((x) => x.modularity).filter((x): x is number => x != null);
    return m.length ? [Math.min(...m), Math.max(...m)] : null;
  }, [frames]);

  const commRange = useMemo(() => {
    const c = frames.map((x) => x.nCommunities).filter(Boolean);
    return c.length ? [Math.min(...c), Math.max(...c)] : null;
  }, [frames]);

  return (
    <figure className="fig" id="figure-1">
      <div className="fig-head">
        <span className="fig-n">Fig. 1</span>
        <span className="fig-title">Correlation structure of the NIFTY-50</span>
        <span className="fig-meta">
          {f ? `MST · n=${f.nodes.length} · ${f.edges.length} edges` : "loading"}
        </span>
      </div>

      <div className="plate">
        {isLoading && <div className="overlay">Rebuilding {6} graphs — this is a live computation</div>}
        {!isLoading && !frames.length && (
          <div className="overlay">Live graph unavailable. We would rather show nothing than something invented.</div>
        )}

        {frames.length > 0 && (
          <>
            <PlotterGraph
              frames={frames}
              frame={i}
              height={560}
              selected={selected}
              onSelect={setSelected}
              labelTopK={12}
            />

            {/* the scrubber — advances the estimation window */}
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

            {/* legend: hue AND hatch angle. The hatch is the secondary encoding that lets the
                figure carry more than 6 communities without a CVD failure. */}
            <div className="legend">
              {legend.map(([c, n]) => (
                <span className="legend-item" key={c}>
                  <span
                    className="legend-key"
                    style={{
                      color: clusterInk(c),
                      backgroundImage: `repeating-linear-gradient(${hatchAngle(c)}deg, ${clusterInk(
                        c
                      )} 0 1px, transparent 1px 4px)`,
                    }}
                  />
                  C{c} <span className="dim">({n})</span>
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <figcaption className="fig-caption">
        <b>Fig. 1</b> — Minimum spanning tree of the NIFTY-50 daily-return correlation matrix
        (Pearson), <b>n={f?.nodes.length ?? 49}</b> stocks, as of{" "}
        <b>{fmtDate(f?.asOf ?? null)}</b>. Communities by Louvain:{" "}
        <b>
          {commRange ? (commRange[0] === commRange[1] ? commRange[0] : `${commRange[0]}–${commRange[1]}`) : "—"}
        </b>{" "}
        across the sweep, modularity{" "}
        <b>
          {modRange
            ? modRange[0] === modRange[1]
              ? modRange[0].toFixed(3)
              : `${modRange[0].toFixed(3)}–${modRange[1].toFixed(3)}`
            : "—"}
        </b>
        . Node radius ∝ eigenvector centrality; edge length ∝ (1 − |ρ|), so a strong correlation
        draws its pair together. Community hulls are hatched at a per-community angle — the hatch,
        not the hue, is what keeps more than six communities legible under colour-vision deficiency.
        <br />
        <br />
        Drag the scrubber to widen the estimation window from <b>30</b> to <b>120</b> bars. The
        layout is never rebuilt between frames: each node warm-starts from where it just was and is
        anchored there with a strength ∝ its stability, so what you see is <em>displacement</em>.
        Roughly <span className="v">half of the 48 edges change</span> between the shortest and
        longest window. <b>A stock that migrates across the plate is one whose network role is an
        artifact of your window choice, not a property of the market.</b> That is the reading this
        figure exists to give you.
      </figcaption>

      <p style={{ marginTop: "var(--space-3)" }}>
        <Link className="btn" href="/network-graph">
          Open the graph full-size →
        </Link>{" "}
        <Link className="btn btn-solid" href="/dashboard/graph-stats">
          Run it on your own parameters →
        </Link>
      </p>
    </figure>
  );
}
