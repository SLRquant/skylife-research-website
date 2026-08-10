# SLR Developer API Portal — source

Docs for the **Skylife Research — Graph API**, ready to import into a
[ReadMe.com](https://readme.com) project (free / Starter plan).

## Contents

```
developer-portal/
├── openapi.yaml              # OpenAPI 3.1 spec (the API reference)
├── README.md                 # this file (operator guide — do NOT publish)
└── guides/
    ├── 01-getting-started.md
    ├── 02-authentication.md
    ├── 03-rate-limits.md
    └── 04-errors.md
```

## What the API is

A per-stock **network-centrality** service over the NIFTY-50. Each session we build a
correlation graph of the universe and compute five centrality metrics per stock. Three
endpoints:

- `GET /health` — public liveness probe.
- `GET /v1/demo/chart` — public, **no auth**, fixed sample snapshot (powers zero-auth
  Try It).
- `GET /v1/graph-stats/chart` — Bearer-JWT protected live data (snapshot or rolling).

Base URL: `https://graph-api.skyliferesearch.com`

## Import into ReadMe

1. In your ReadMe project, go to **API Reference → Add / Import → Upload OpenAPI file**
   and upload `openapi.yaml`. ReadMe generates one reference page per path with a **Try
   It** explorer.
2. The spec sets `x-readme: { explorer-enabled: true, proxy-enabled: true }`, so Try It
   runs through ReadMe's proxy — no CORS setup needed.
3. Add the guide pages: **Guides → New Page**, then paste each file from `guides/` (they
   carry ReadMe front-matter — `title` / `excerpt`). Suggested order:
   Getting Started → Authentication → Rate Limits → Errors.
4. Re-upload `openapi.yaml` whenever the spec changes; ReadMe re-syncs the reference.

## Public docs, enforced auth

On the free plan the ReadMe project (guides + reference) is **public** — anyone can read
it. That is fine: **the docs are public, the API is not.** The live endpoint still
enforces the Bearer JWT and per-user rate limits server-side. Nothing secret lives in
these files.

**Try It** against `GET /v1/demo/chart` needs **no token** — it returns canned data of
the same shape as the live snapshot, so visitors can exercise the API immediately. Try
It against `GET /v1/graph-stats/chart` requires the reader to paste their own 24-hour
token into the **Bearer** field.

## Styling

Modelled on the smallcase Gateway reference
(`https://developers.gateway.smallcase.com/reference/fetch-holdings`): a clean OpenAPI
reference with rich response examples plus short, task-focused guide pages.
