/**
 * COLOUR IS COMPUTED, NOT CHOSEN.
 *
 * Both palettes below were produced by an OKLCH hill-climb gated on the dataviz validator
 * (`validate_palette.js --mode dark --surface "#0b0f19" --pairs all`) and both PASS all four
 * checks. The full report is in `design/artifacts/palette-validation.txt`.
 *
 *   CLUSTER (n=6)  worst all-pairs CVD ΔE 19.3  (deutan)   — colour alone must carry it
 *   SERIES  (n=8)  worst all-pairs CVD ΔE 14.7  (deutan)   — also direct-labelled
 *
 * The ONE signal colour, sodium amber #ff9e2c, is OKLCH h 64. A 48° hue guard around it is
 * excluded from BOTH palettes, so a data category can never be mistaken for a live measured
 * value. That is the whole colour language of this design.
 *
 * ENCODING (FOUNDATION §5.2) — this is the fix for DEFECT 1:
 *   line / node colour -> the STOCK   (what the user actually tracks)
 *   cluster            -> a DOT beside the label + the HULL the node sits in
 */

/** ≤6 hues. Used for hulls + label dots. NEVER for a line. */
export const CLUSTER_PALETTE = [
  "#759a41", // olive
  "#009c85", // viridian
  "#009fc1", // cyan
  "#536fbd", // indigo
  "#924a87", // plum
  "#a94a55", // brick
] as const;

/** Exactly 8 hues, one per highlighted STOCK (TOP_N = 8). */
export const SERIES_PALETTE = [
  "#ba4555",
  "#6e8e00",
  "#009675",
  "#00a9b3",
  "#0095cc",
  "#718ef1",
  "#85459f",
  "#b04a88",
] as const;

/** Anything beyond the 6th community, and any unknown community. */
export const OTHER_COLOR = "#5c6373";

export const MAX_CLUSTERS = CLUSTER_PALETTE.length;

/**
 * FOUNDATION §5.1 is a gamut FACT: you cannot encode 7 categories by colour alone on a dark
 * surface. Louvain routinely returns 7–8 here. So we rank communities by size, give the six
 * largest a validated hue, and merge the rest into a single neutral "Other".
 *
 * Returns a stable id->slot map. Build it ONCE per graph and pass it down; deriving colour from
 * a raw community id alone is what produced the old 8-hue palette that failed CVD.
 */
export type ClusterScale = {
  /** hex for a raw community id */
  color: (community?: number | null) => string;
  /** "C3" for a mapped community, "OTHER" for a merged one */
  label: (community?: number | null) => string;
  /** the raw ids that got a hue, largest community first */
  ranked: number[];
  /** true if at least one community was merged away */
  merged: boolean;
};

export function buildClusterScale(communities: Iterable<number | null | undefined>): ClusterScale {
  const counts = new Map<number, number>();
  for (const c of communities) {
    if (typeof c !== "number") continue;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  // largest first; ties broken by id so the mapping is deterministic across re-renders
  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .map(([id]) => id);

  const slot = new Map<number, number>();
  ranked.slice(0, MAX_CLUSTERS).forEach((id, i) => slot.set(id, i));

  return {
    ranked: ranked.slice(0, MAX_CLUSTERS),
    merged: ranked.length > MAX_CLUSTERS,
    color: (c) => {
      if (typeof c !== "number") return OTHER_COLOR;
      const i = slot.get(c);
      return i === undefined ? OTHER_COLOR : CLUSTER_PALETTE[i];
    },
    label: (c) => {
      if (typeof c !== "number") return "OTHER";
      return slot.has(c) ? `C${c}` : "OTHER";
    },
  };
}

/**
 * Colour for a highlighted STOCK. `order` is the stable list of highlighted symbols — the
 * index into it, not the community, picks the hue. This is the fix for DEFECT 1: previously
 * eight highlighted series were stroked with `clusterColor(s.community)` and collapsed into
 * four colours (three identical magenta lines).
 */
export function seriesColor(symbol: string, order: readonly string[]): string {
  const i = order.indexOf(symbol);
  if (i < 0) return OTHER_COLOR;
  return SERIES_PALETTE[i % SERIES_PALETTE.length];
}

/** A stable, sorted highlight order, so a stock keeps its hue as others are toggled. */
export function stableOrder(highlighted: Iterable<string>): string[] {
  return [...highlighted].sort();
}
