"use client";

import useSWR from "swr";

/** Real market-structure headline numbers, from /api/public/pulse (cached 1h server-side). */
export type Pulse = {
  universe: string;
  stocks: number;
  communities: number;
  modularity: number | null;
  edges: number;
  method: string;
  asOf: string | null;
  leaders: Array<{ symbol: string; centrality: number; community: number | null }>;
  live: boolean;
};

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export function usePulse() {
  const { data, error, isLoading } = useSWR<Pulse>("/api/public/pulse", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300_000,
  });
  return { pulse: data, error, isLoading };
}
