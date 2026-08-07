import type { MetadataRoute } from "next";
import { researchArticles } from "@/lib/data/research-articles";

const BASE = "https://skyliferesearch.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE}/research`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/how-it-works`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/network-graph`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/dashboard`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/dashboard/graph-stats`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/auth/sign-in`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  const articleRoutes: MetadataRoute.Sitemap = researchArticles.map((a) => ({
    url: `${BASE}/research/${a.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [...staticRoutes, ...articleRoutes];
}
