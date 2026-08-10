---
title: Rate Limits
category:
  uri: /branches/1.0/categories/guides/Getting Started
content:
  excerpt: '1 request/minute, 30 requests/day, the X-RateLimit headers, and backoff.'
---

# Rate Limits

The live endpoint `GET /v1/graph-stats/chart` is metered **per user**:

| Window | Limit |
|---|---|
| Per minute | **1 request** |
| Per day | **30 requests** |

The public **demo** (`/v1/demo/chart`) and **health** (`/health`) endpoints are
**unmetered** — use the demo endpoint freely while developing.

## Rate-limit headers

Every response on the live endpoint (both `200` and `429`) carries these headers:

| Header | Meaning |
|---|---|
| `X-RateLimit-Limit` | Per-minute request ceiling (`1`). |
| `X-RateLimit-Remaining` | Requests left in the current minute window. |
| `X-RateLimit-Daily-Limit` | Per-day request ceiling (`30`). |
| `X-RateLimit-Daily-Remaining` | Requests left today. |
| `X-RateLimit-Reset` | Unix epoch seconds when the current minute window resets. |

On a `429`, an additional **`Retry-After`** header tells you how many **seconds** to
wait before retrying.

## The 429 body

A throttled request returns the standard error envelope. The per-minute limit uses code
`RATE_LIMITED`; exhausting the daily quota uses `DAILY_QUOTA_EXCEEDED`:

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

## Retry / backoff example

Respect `Retry-After`; stop retrying once the daily quota is exhausted (there is no
point waiting seconds for a limit that resets tomorrow):

```python
import time
import requests

URL = "https://graph-api.skyliferesearch.com/v1/graph-stats/chart"

def get_graph_stats(token, params=None, max_retries=5):
    headers = {"Authorization": f"Bearer {token}"}
    for _ in range(max_retries):
        r = requests.get(URL, headers=headers, params=params)
        if r.status_code != 429:
            r.raise_for_status()
            return r.json()

        code = (r.json().get("errors") or [{}])[0].get("code")
        if code == "DAILY_QUOTA_EXCEEDED":
            raise RuntimeError("daily quota exhausted — try again tomorrow")

        wait = int(r.headers.get("Retry-After", "60"))
        time.sleep(wait)
    raise RuntimeError("still rate-limited after retries")
```

## Tips

- Because the live endpoint allows only **one request per minute**, batch your needs
  into a single call: request all metrics at once, or use `periods>1` to pull a rolling
  time series in one shot instead of polling.
- Develop and test against `/v1/demo/chart` (unmetered), then switch to the live
  endpoint for real data.
