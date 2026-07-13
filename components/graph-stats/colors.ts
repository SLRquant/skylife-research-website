/** Cluster palette — matches the existing network-graph tool so the two read as one system. */
const PALETTE = [
  "#4dd4ac",
  "#6ea8fe",
  "#e879f9",
  "#fbbf24",
  "#fb7185",
  "#818cf8",
  "#34d399",
  "#f97316",
];

/** Community ids from the API are 1-based; anything missing falls back to a neutral blue. */
export function clusterColor(community?: number | null): string {
  if (!community || community < 1) return "#7dd3fc";
  return PALETTE[(community - 1) % PALETTE.length];
}
