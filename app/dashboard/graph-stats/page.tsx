import type { Metadata } from "next";
import { GraphStatsTool } from "./GraphStatsTool";

export const metadata: Metadata = {
  title: "Graph Stats · Skylife Research",
  description:
    "Per-stock network centrality tracked over time — eigenvector, PageRank, betweenness, closeness and degree strength across a rolling correlation graph of the NIFTY-50.",
};

export default function Page() {
  return <GraphStatsTool />;
}
