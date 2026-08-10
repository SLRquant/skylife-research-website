---
title: Welcome to Skylife Research
category:
  uri: /branches/1.0/categories/guides/Getting Started
content:
  excerpt: 'Per-stock network-centrality analytics for the NIFTY-50 — start here.'
---

The **Skylife Research Graph API** turns the Indian **NIFTY-50** into a live
**correlation graph** and gives you five per-stock **network-centrality** metrics every
session — a quantitative read on which stocks are hubs, which are bridges, and which sit
on the periphery of the market's co-movement structure.

<Cards>
  <Card title="Quick Start" href="/docs/01-getting-started" icon="fa-duotone fa-rocket-launch">Make your first call in 60 seconds — no token required.</Card>

  <Card title="API Reference" href="/reference/getdemochart" icon="fa-duotone fa-code-simple">Explore every endpoint with a live Try It explorer.</Card>

  <Card title="Authentication" href="/docs/02-authentication" icon="fa-duotone fa-key">Generate a Bearer token and call the live endpoint.</Card>
</Cards>

<br />

## What you can call

<Cards>
  <Card kind="tile" title="Demo snapshot — no auth" href="/reference/getdemochart" icon="fa-duotone fa-bolt">Fixed sample data in the exact shape of the live response.</Card>

  <Card kind="tile" title="Live centrality" href="/reference/getgraphstatschart" icon="fa-duotone fa-chart-network">A snapshot or rolling series for the full NIFTY-50.</Card>

  <Card kind="tile" title="Health check" href="/reference/getdemohealth" icon="fa-duotone fa-heart-pulse">Public liveness probe for uptime monitoring.</Card>
</Cards>

<br />

## The guides

<Cards>
  <Card kind="tile" title="Getting Started" href="/docs/01-getting-started" icon="fa-duotone fa-flag-checkered">The mental model plus a 60-second quickstart.</Card>

  <Card kind="tile" title="Authentication" href="/docs/02-authentication" icon="fa-duotone fa-key">Obtaining and using your 24-hour Bearer token.</Card>

  <Card kind="tile" title="Rate Limits" href="/docs/03-rate-limits" icon="fa-duotone fa-gauge-high">1 request/minute, 30/day, and the headers to watch.</Card>

  <Card kind="tile" title="Errors" href="/docs/04-errors" icon="fa-duotone fa-triangle-exclamation">The response envelope and every error code.</Card>
</Cards>

<br />

<Callout icon="🔑" theme="info">
  **Ready to build?** [Generate your API token](https://skyliferesearch.com/dashboard/api) —
  sign in with Google, click **Generate token**, and call the live endpoint. The base URL
  for every request is `https://graph-api.skyliferesearch.com`.
</Callout>
