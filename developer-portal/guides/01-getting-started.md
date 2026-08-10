---
title: Getting Started
category:
  uri: /branches/1.0/categories/guides/Getting Started
content:
  excerpt: 'What the Skylife Research Graph API is, and a 60-second quickstart.'
---

# Getting Started

The **Skylife Research Graph API** gives you per-stock **network-centrality** statistics
over the Indian **NIFTY-50**.

> 🔑 **[→ Generate your API token](https://skyliferesearch.com/dashboard/api)** — sign in
> with Google, click **Generate token**, and you're ready to call the live endpoint.

## The mental model

Every trading session we take the recent price candles of the NIFTY-50 and build a
**correlation graph**: each stock is a **node**, and an **edge** joins two stocks whose
returns move together. That graph is rebuilt from scratch each session, so it always
reflects *current* market structure. On top of it we compute five classic
**centrality** metrics — each one a different way of measuring *where a stock sits* in
the web of co-movement: is it a hub, a bridge, or out on the periphery?

The five metrics (all computed on the correlation graph):

| Metric | Meaning |
|---|---|
| `degree_strength` | Normalized weighted degree — how strongly connected the stock is. |
| `eigenvector_centrality` | Influence via well-connected neighbours. |
| `betweenness_centrality` | How often the stock bridges shortest paths between others. |
| `closeness_centrality` | Inverse mean distance to every other stock. |
| `pagerank` | Random-walk importance (weight-biased PageRank). |

## 60-second quickstart

### 1. See the shape — no token needed

The public **demo** endpoint returns fixed sample data in the exact shape of the live
response. Hit it with `curl` (or click **Try It** on the reference page):

```bash
curl https://graph-api.skyliferesearch.com/v1/demo/chart
```

You get the standard envelope:

```json
{
  "success": true,
  "errors": null,
  "data": {
    "type": "snapshot",
    "asof_date": "2026-07-14T15:30:00",
    "metrics": ["degree_strength", "eigenvector_centrality", "betweenness_centrality", "closeness_centrality", "pagerank"],
    "graph": { "nodes": 5, "edges": 4, "method": "mst" },
    "stocks": [
      { "symbol": "ICICIBANK", "degree_strength": 1.0, "pagerank": 0.244902 }
    ]
  },
  "meta": { "generated_at": "2026-07-15T09:32:11Z" }
}
```

### 2. Get a token, then call the live endpoint

1. Sign in with Google at **[skyliferesearch.com](https://skyliferesearch.com)**.
2. Open **Dashboard → API access → Generate token** and copy the 24-hour Bearer token.
3. Call the live endpoint:

```bash
curl https://graph-api.skyliferesearch.com/v1/graph-stats/chart \
  -H "Authorization: Bearer $SLR_TOKEN"
```

That returns a live **snapshot** for the full NIFTY-50. Add query params to change the
window, graph method, or metrics — or set `periods>1` for a rolling time series. See the
[API reference](../reference) for every parameter.

## Next steps

- **[Authentication](02-authentication.md)** — obtaining and using your Bearer token.
- **[Rate Limits](03-rate-limits.md)** — 1 request/minute, 30/day, and the headers.
- **[Errors](04-errors.md)** — the envelope and every error code.
