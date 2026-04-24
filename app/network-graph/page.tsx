import { Metadata } from "next";
import { NetworkGraphTool } from "./NetworkGraphTool";

export const metadata: Metadata = {
  title: "Network Graph · Skylife Research",
  description:
    "Interactive NIFTY momentum network — clusters, eigenvector centrality, and daily leaders mapped as a force-directed graph.",
};

export default function Page() {
  return <NetworkGraphTool />;
}
