---
title: Errors
category:
  uri: /branches/1.0/categories/guides/Getting Started
content:
  excerpt: The response envelope and every error code the Graph API returns.
---

# Errors

## The response envelope

**Every** response — success or failure — uses the same envelope:

```json
{
  "success": true,
  "errors": null,
  "data": { "...": "..." },
  "meta": { "generated_at": "2026-07-15T09:32:11Z" }
}
```

| Field | On success | On error |
|---|---|---|
| `success` | `true` | `false` |
| `errors` | `null` | array of `{ "code", "message" }` |
| `data` | the payload | `null` |
| `meta` | metadata (`generated_at`, `params`, `diagnostics`) | `{ "generated_at": … }` |

Always branch on `success` (or the HTTP status), then read `errors[0].code` for a
machine-readable reason.

## Error codes

| HTTP | `code` | When it happens |
|---|---|---|
| 400 | `BAD_REQUEST` | Malformed parameter — e.g. `asof` not `YYYY-MM-DD`, an unknown metric or interval, or `periods` out of the `1–250` range. |
| 401 | `UNAUTHORIZED` | Missing, malformed, or **expired** Bearer token. |
| 403 | `FORBIDDEN` | Token is valid but not permitted for this resource. |
| 404 | `NOT_FOUND` | Unknown route or resource. |
| 429 | `RATE_LIMITED` | Per-minute limit hit (1 request/minute). See [Rate Limits](03-rate-limits.md). |
| 429 | `DAILY_QUOTA_EXCEEDED` | Daily quota hit (30 requests/day). |
| 500 | `INTERNAL_ERROR` | Unexpected server error. Retry later; contact support if it persists. |

## Examples

### 400 — Bad request

```json
{
  "success": false,
  "errors": [
    { "code": "BAD_REQUEST", "message": "asof must be YYYY-MM-DD, got '14-07-2026'" }
  ],
  "data": null,
  "meta": { "generated_at": "2026-07-15T09:32:11Z" }
}
```

### 401 — Unauthorized

```json
{
  "success": false,
  "errors": [
    { "code": "UNAUTHORIZED", "message": "token expired — obtain a new one from Dashboard → API access" }
  ],
  "data": null,
  "meta": { "generated_at": "2026-07-15T09:32:11Z" }
}
```

### 403 — Forbidden

```json
{
  "success": false,
  "errors": [
    { "code": "FORBIDDEN", "message": "guest tokens are not permitted" }
  ],
  "data": null,
  "meta": { "generated_at": "2026-07-15T09:32:11Z" }
}
```

### 404 — Not found

```json
{
  "success": false,
  "errors": [
    { "code": "NOT_FOUND", "message": "no resolvable symbols for universe 'foo'" }
  ],
  "data": null,
  "meta": { "generated_at": "2026-07-15T09:32:11Z" }
}
```

### 429 — Rate limited

```json
{
  "success": false,
  "errors": [
    { "code": "RATE_LIMITED", "message": "rate limit exceeded: 1 request/minute. Retry in 47s." }
  ],
  "data": null,
  "meta": { "generated_at": "2026-07-15T09:32:11Z" }
}
```

### 429 — Daily quota exceeded

```json
{
  "success": false,
  "errors": [
    { "code": "DAILY_QUOTA_EXCEEDED", "message": "daily quota exceeded: 30 requests/day" }
  ],
  "data": null,
  "meta": { "generated_at": "2026-07-15T09:32:11Z" }
}
```

### 500 — Internal error

```json
{
  "success": false,
  "errors": [
    { "code": "INTERNAL_ERROR", "message": "RuntimeError: no data fetched" }
  ],
  "data": null,
  "meta": { "generated_at": "2026-07-15T09:32:11Z" }
}
```
