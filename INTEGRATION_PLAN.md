# Graph Stats — Website Integration Plan

Plugging the **graph_stats API** (`https://graph-api.skyliferesearch.com`) into this site as a
gated, metered, per-user tool.

> **No secrets in this file.** The API key, gateway secret and service-account JSON live only in
> environment variables (Vercel) and in the private `WEB_DEVELOPER.md` handover doc.

---

## 1. Objective

| Requirement | How it's met |
|---|---|
| Only signed-in users see the feature | Firebase ID token **verified server-side** in the route handler |
| Users pick their own parameters | Validated params form → whitelisted → forwarded upstream |
| Response shown properly | **Stats-over-time is the hero**: leaderboard + time-series + rank/bump chart |
| 5 requests per email, ever | Firestore counter, **atomic** reserve + refund |

---

## 2. What the API gives us

`GET /v1/graph-stats/chart` — one endpoint. Auth: a single `x-api-key` header (server-side only).

**Rolling (`periods > 1`) — this is the product.** Returns per-stock, per-metric time series:

```jsonc
data: {
  type: "rolling",
  asof_dates: ["2026-07-06", …],
  metrics: ["eigenvector_centrality", "pagerank"],
  series: [ { symbol: "TCS", community: 3, points: [ {date, eigenvector_centrality, pagerank}, … ] } ],
  latest_graph: { asof_date, nodes, edges, method, n_communities, modularity,
                  communities: {SYM: id}, edge_list: [{source, target, weight, corr}] }
}
```

**Snapshot (`periods = 1`)** → `data.stocks: [{symbol, community, <metric>…}]` + `data.graph`.

The 5 metrics: `degree_strength`, `eigenvector_centrality`, `betweenness_centrality`,
`closeness_centrality`, `pagerank`.

### Hard constraints (measured, not guessed)

- **A live call takes ~11 s** (`periods=5`, NIFTY-50). → the route **must** set
  `export const maxDuration = 60`. Vercel's 10 s default **will time out**.
- **`offline=true` is not a fast-path.** The server's cache is wiped daily at 03:30 UTC and
  `offline` does not fall back to a live fetch — it 500s on every symbol. Do not build UI on it.
- **Data starts 2025-01-01.** `lookback` + `periods` must fit in available history → validate in
  the form, don't surface a 500.
- **NaN → `null`.** Charts must draw gaps, not zeros.
- Surface `meta.diagnostics.missing_symbols` — symbols can silently drop out.

---

## 3. Architecture

```
Browser ──► /api/graph-stats/run  ──►  graph-api.skyliferesearch.com
           (Firebase ID token)      (x-api-key, server-side only)
                   │
                   ├── verify token  → email          (firebase-admin)
                   ├── reserve quota → 429 if spent   (Firestore txn)
                   └── refund on upstream failure
```

**The API key never reaches the browser.** The browser talks to *our* route; *our server* talks to
graph-api. Server-to-server ⇒ **CORS never applies**, so no localhost whitelist is needed upstream.

🔒 **Load-bearing rule:** the user's email comes from the **verified ID token**, never from the
request body. Trusting a client-sent email would let anyone reset their own quota.

---

## 4. Phases

### Phase 0 — Backend ✅ DONE
`include_graph=true` + Louvain `community` per stock, deployed to EC2 and verified live.
(Changed in the `research_and_analysis` repo, not this one.)

### Phase 1 — Auth
- `npm i firebase-admin`
- `lib/firebase/admin.ts` — Admin app from a base64 service-account env var; `verifyRequest(req)`.
- `lib/firebase/client.ts` — add `signInWithGoogle()` (`GoogleAuthProvider` + `signInWithPopup`).
- Sign-in / sign-up pages — add a "Continue with Google" button. Email/password keeps working.
- `ProtectedRoute` stays for UX (redirect) but is **not** security — the route handler is.

### Phase 2 — Quota (5 per email)
Firestore:
```
graph_stats_usage/{email}            → { email, uid, used, limit, firstAt, lastAt }
graph_stats_usage/{email}/runs/{id}  → { params, ok, ms, at }     ← audit trail
```
- `reserve(email)` — a **transaction**: read `used`, throw if `>= 5`, else write `used+1`.
  Atomic, so two tabs racing the 5th slot can't both win.
- `refund(email)` — decrement (floor 0) when upstream fails. A timeout must not burn a run.
- Admin emails (env var) bypass and report `∞`.
- **Firestore rules: deny all client access.** Only the Admin SDK writes.

### Phase 3 — API bridge
`POST /api/graph-stats/run` — `runtime = "nodejs"`, `maxDuration = 60`
1. Verify token → email (401 if absent)
2. Zod-validate + **whitelist** params (never forward raw query)
3. `reserve(email)` → 429 if exhausted
4. Call upstream with `x-api-key`, `AbortController` @ ~45 s
5. On failure → `refund(email)`
6. Return `{ data, quota: {limit, used, remaining} }`

`GET /api/graph-stats/quota` — read-only, **does not consume a run**. UI calls it on load.

### Phase 4 — UI (`/dashboard/graph-stats`)
The dashboard stub already says *"each gets its own route under `/dashboard/*`"* and has a
**disabled "Open network graph →" button** — that's the entry point. The public `/network-graph`
stays as a teaser with a "Sign in to run your own →" CTA.

First **refactor**: lift the force-directed canvas out of `app/network-graph/NetworkGraphTool.tsx`
into `components/GraphCanvas.tsx` so both pages share one implementation.

**Primary surface — stats over time:**
1. **Leaderboard table** (the anchor) — per stock: latest value, Δ vs window start, inline
   sparkline, rank, rank change. Sortable.
2. **Multi-line time-series** — x = `asof_dates`, y = metric. 49 lines is spaghetti → default to
   top 8 by latest value, rest as dimmed ghost lines, plus a symbol picker. `d3` is already a
   dependency and currently unused.
3. **Metric tabs** — one per selected metric (different scales must not share a y-axis).
4. **Bump chart** — rank evolution. The clearest read of *who is becoming a hub*.
5. **CSV export** (long format: `symbol, date, metric, value`).

**Secondary panel — the latest graph:** network diagram from `latest_graph`, coloured by
`community`, node size = selected metric. Clicking a node **cross-filters the charts above**.

**Params form:** `interval`, `lookback`, `periods`, universe vs. `symbols`, metric checkboxes,
`graph_method` with **conditional** `knn_k` / `corr_threshold` fields. Cap `periods ≤ 30` and
≤ 50 symbols to stay inside the 60 s ceiling. Quota chip: "3 of 5 runs remaining"; Run disables at 0.

Reuse the existing design system (`.tool-page`, `.tool-layout`, `.side-pane`, `.stat-cell`,
`.mono`, `.dim`) so it looks native.

### Phase 5 — Test & ship
- Run 5× → 6th returns 429, button disables.
- Point API base at a dead host → confirm the failed run is **refunded**.
- Two tabs at `used=4` → exactly one wins.
- **Grep the built client bundle for the key prefix → must be zero hits.**
- Signed-out `curl` on the route → 401.
- Admin email → unlimited.

---

## 5. Environment variables

All **server-only**. None may be prefixed `NEXT_PUBLIC_`.

```
GRAPH_STATS_API_BASE=https://graph-api.skyliferesearch.com
GRAPH_STATS_API_KEY=…            # from WEB_DEVELOPER.md — never commit
GRAPH_STATS_FREE_LIMIT=5
GRAPH_STATS_ADMIN_EMAILS=…
FIREBASE_SERVICE_ACCOUNT_B64=…   # base64 of the service-account JSON
```

Plus the existing `NEXT_PUBLIC_FIREBASE_*` client vars.

**Also required in the Firebase console:** enable the Google sign-in provider, and add the
authorized domains (`skyliferesearch.com`, plus `*.vercel.app` for previews).

---

## 6. Note on hosting

Vercel's **Hobby plan prohibits commercial use**, and its 10 s default timeout is below our ~11 s
call. `maxDuration = 60` works on Hobby, but a **Pro** upgrade is the safe path for a commercial
product.
