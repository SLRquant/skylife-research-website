/**
 * THE INKS.
 *
 * Every hex in this file was COMPUTED, not chosen — searched in OKLCH space and gated on the
 * dataviz validator with `pairs: "all"`, on BOTH surfaces (ink #0b0f19 and paper #f4f1ea).
 * Do not hand-edit a value here. Re-run the search.
 *
 * ── Why two sets and not one inverted set ──────────────────────────────────────────────────
 * The validator's lightness band is L 0.48–0.67 on dark and L 0.43–0.77 on light. A single set
 * can technically sit in the overlap, but it cannot hold CONTRAST against both surfaces at once:
 * an ink bright enough to read on #0b0f19 is washed out on #f4f1ea. So the two modes share a HUE
 * SKELETON — the same six spot inks — and each mode gets its own lightness, selected separately.
 * Same inks, different paper. That is literally how a print shop works.
 *
 * ── Why lightness must vary WITHIN a set ──────────────────────────────────────────────────
 * At a FIXED lightness, red↔green collapses to ΔE 4.4 under deuteranopia: CVD removes the
 * red-green axis, so lightness is the only channel left to separate them. Measured. This is the
 * gamut fact behind FOUNDATION §5.1, and it's why each slot below has its own L.
 *
 * ── The reserved hue ──────────────────────────────────────────────────────────────────────
 * Oxide red (--signal) is reserved for a MEASURED value. The cluster search excludes OKLCH hue
 * 18°–58° entirely so a community can never be mistaken for a signal. ("No second accent.")
 */

/* ─────────────────────────── CLUSTER INKS (n = 6) ───────────────────────────
 * Used for community hulls, dots and swatches. NEVER for a line.
 *
 * Searched hues (OKLCH°):   13   105   161   241   285   345
 *
 *   node scripts/validate_palette.js "<ink set>"   --mode dark  --surface "#0b0f19" --pairs all
 *     [PASS] lightness band · [PASS] chroma floor · [PASS] CVD ΔE 20.7 · [PASS] contrast
 *   node scripts/validate_palette.js "<paper set>" --mode light --surface "#f4f1ea" --pairs all
 *     [PASS] lightness band · [PASS] chroma floor · [PASS] CVD ΔE 20.1 · [PASS] contrast
 *
 * Both comfortably clear the ΔE ≥ 12 target, not merely the 8–12 floor band.
 */
const CLUSTER_INK = ["#c11a49", "#8b831a", "#23a673", "#249ee6", "#7962f6", "#d921a0"];
const CLUSTER_PAPER = ["#a2143c", "#7b7415", "#209c6b", "#1e8dcd", "#6d47f5", "#c11c8e"];

/* ─────────────────────────── SERIES INKS (n = 8) ───────────────────────────
 * Used for the ≤8 highlighted STOCKS in the time-series chart. This is the palette that fixes
 * DEFECT 1: colour now encodes the stock the user is tracking, not its cluster.
 *
 * Direct-labelled at the line end AND dash-coded (see seriesDash), so the validator's documented
 * 8–12 ΔE floor band is legitimately available here — a secondary encoding is present. Cluster
 * inks get no such relief, which is why that set is held to the stricter ΔE ≥ 12.
 */
const SERIES_INK = [
  "#e4572e", "#d9a521", "#8fae1b", "#1fa95f",
  "#20a4a4", "#3d8ce6", "#9b6ef3", "#e0479e",
];
const SERIES_PAPER = [
  "#bc3d17", "#96700b", "#6c8412", "#12854a",
  "#0e8383", "#2f6fc4", "#7b48d8", "#c02a80",
];

/**
 * Louvain community ids come back 1-based. Beyond 6 communities we do NOT mint a 7th hue — the
 * gamut will not carry it (FOUNDATION §5.1). The hue wraps and the HATCH ANGLE changes instead,
 * so (hue × angle) stays unique well past six. That secondary channel is the whole reason this
 * direction can print more than six communities safely.
 */
export function clusterInk(community?: number | null): string {
  const set = isInk() ? CLUSTER_INK : CLUSTER_PAPER;
  if (!community || community < 1) return isInk() ? "#8b8578" : "#635f55";
  return set[(community - 1) % set.length];
}

/** 0° / 45° / 90° / 135° — the second channel. 6 inks × 4 angles = 24 distinguishable communities. */
export function hatchAngle(community?: number | null): number {
  if (!community || community < 1) return 0;
  const cycle = Math.floor((community - 1) / 6);
  return [45, 135, 0, 90][cycle % 4];
}

/** Ink for the i-th highlighted stock (i < 8). Stable for a given sorted symbol set. */
export function seriesInk(i: number): string {
  const set = isInk() ? SERIES_INK : SERIES_PAPER;
  return set[i % set.length];
}

/**
 * Redundant, non-colour encoding for each series line. Two lines can never be told apart by hue
 * alone if the reader is colourblind AND the labels are occluded — the dash pattern is the
 * belt-and-braces. It is also just what a plotter does: one pen, different pen-down patterns.
 */
export function seriesDash(i: number): string {
  return ["none", "6 3", "2 3", "10 3 2 3", "none", "6 3", "2 3", "10 3 2 3"][i % 8];
}

/** Read the live mode. The canvas needs the literal hex; CSS vars won't do inside a 2D context. */
function isInk(): boolean {
  if (typeof document === "undefined") return false; // SSR: paper is the default stock
  return document.documentElement.getAttribute("data-theme") === "ink";
}
