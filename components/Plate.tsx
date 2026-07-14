"use client";

import { useEffect, useState } from "react";
import { usePulse } from "@/lib/usePulse";

/**
 * The faceplate furniture: the hairline engineering grid, the baked film grain, and the
 * lab-notebook gutter.
 *
 * GRAIN: baked ONCE to a 128px tile in a canvas at boot and used as a repeating background.
 * A live full-viewport feTurbulence filter is 10–30ms/frame and is the single most common
 * perf disaster on "designer" sites. This costs one paint, ever.
 */
function useGrainTile() {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const N = 128;
    const c = document.createElement("canvas");
    c.width = N;
    c.height = N;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(N, N);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    setUrl(c.toDataURL());
  }, []);
  return url;
}

/** The gutter carries REAL values from /api/public/pulse. Never decoration pretending to be data. */
export function Plate() {
  const grain = useGrainTile();
  const { pulse } = usePulse();

  const parts = pulse
    ? [
        `n=${pulse.stocks}`,
        `louvain k=${pulse.communities}`,
        `modularity ${pulse.modularity?.toFixed(3) ?? "—"}`,
        `${pulse.method}`,
        `edges ${pulse.edges}`,
        pulse.asOf ? `asof ${pulse.asOf.slice(0, 10)}` : null,
        pulse.live ? "link up" : "link down",
      ].filter(Boolean)
    : ["awaiting engine"];

  return (
    <>
      <div className="grid-bg" aria-hidden="true" />
      {grain && (
        <div className="grain" aria-hidden="true" style={{ backgroundImage: `url(${grain})` }} />
      )}
      <div className="gutter" aria-hidden="true">
        {parts.join("  ·  ")}
      </div>
    </>
  );
}
