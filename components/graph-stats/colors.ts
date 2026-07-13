import type { CSSProperties } from "react";

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
 * These two sets do NOT share a hue skeleton, and that is a measured result, not laziness: a
 * shared-hue 8-slot solution passing on BOTH surfaces does not exist. (Searched; returns nothing.)
 * Direction B requires the light palette to be SELECTED rather than inherited anyway, so each mode
 * got its own hues and its own lightness profile.
 *
 *   node scripts/validate_palette.js "<ink set>"   --mode dark  --surface "#0b0f19" --pairs all
 *     [PASS] band · [PASS] chroma · [PASS] CVD ΔE 20.0 · [PASS] contrast (min 3.04:1)
 *   node scripts/validate_palette.js "<paper set>" --mode light --surface "#f4f1ea" --pairs all
 *     [PASS] band · [PASS] chroma · [PASS] CVD ΔE 25.0 · [PASS] contrast (min 3.09:1)
 *
 * Both clear the ΔE >= 12 TARGET outright, so we are not even leaning on the 8–12 floor band that
 * the direct end-labels and dash patterns would have entitled us to. Belt, braces, and a spare.
 */
const SERIES_INK = [
  "#974b10", "#24aa5f", "#157546", "#009290",
  "#13689f", "#b021e0", "#f129d9", "#d96d1d",
];
const SERIES_PAPER = [
  "#f029d9", "#a5141f", "#c2761c", "#1f9855",
  "#008a79", "#00608c", "#2f1ff3", "#7a17b7",
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

/**
 * A community swatch, carrying BOTH channels.
 *
 * This exists because a plain colour square is a bug. With 8 live communities and only 6 inks
 * that pass the validator, C2 and C8 share a hue — on the plate they are still trivially
 * distinguishable because their HATCH ANGLES differ, but a flat square throws that away and the
 * two read as identical. The secondary encoding has to travel with the colour EVERYWHERE it is
 * shown, or it isn't an encoding, it's a decoration.
 */
export function clusterSwatch(community?: number | null): CSSProperties {
  const ink = clusterInk(community);
  return {
    border: `1px solid ${ink}`,
    backgroundColor: "transparent",
    backgroundImage: `repeating-linear-gradient(${hatchAngle(community)}deg, ${ink} 0 1.5px, transparent 1.5px 4px)`,
  };
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
