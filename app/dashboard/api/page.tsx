import type { Metadata } from "next";
import { ApiAccessTool } from "./ApiAccessTool";

export const metadata: Metadata = {
  title: "API Access · Skylife Research",
  description:
    "Generate a 24-hour developer token and call the graph-stats API directly — per-stock network centrality over the NIFTY-50 correlation graph.",
};

export default function Page() {
  return <ApiAccessTool />;
}
