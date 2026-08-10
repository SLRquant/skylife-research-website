---
title: Authentication
category:
  uri: /branches/1.0/categories/guides/Getting Started
content:
  excerpt: Obtain a 24-hour Bearer JWT and send it on the live endpoint.
---

# Authentication

The live endpoint — `GET /v1/graph-stats/chart` — is protected with an
**HTTP Bearer JWT**. The `/health` and `/v1/demo/chart` endpoints are public and need
no token.

> 🔑 **[→ Generate your API token](https://skyliferesearch.com/dashboard/api)**
>
> The one-click token page. Sign in with Google, click **Generate token**, copy the
> 24-hour Bearer JWT.

## Get a token

1. Open the **[token generator →](https://skyliferesearch.com/dashboard/api)** and **sign
   in with Google**.
2. Click **Generate token**.
3. Copy it, and paste it into the **Bearer** field of any "Try It" panel — or send it as
   an `Authorization: Bearer` header from your own code.

Tokens are **per-user** and valid for **24 hours**. When a token expires, generate a new
one the same way — the live endpoint returns `401 UNAUTHORIZED` with a
`token expired` message once it lapses.

> Keep your token secret. Anyone holding it can call the API as you and consume your
> daily quota.

## Use the token

Send it in the `Authorization` header:

```
Authorization: Bearer <your-token>
```

### curl

```bash
export SLR_TOKEN="paste-your-token-here"

curl https://graph-api.skyliferesearch.com/v1/graph-stats/chart \
  -H "Authorization: Bearer $SLR_TOKEN"
```

### Python

```python
import requests

token = "paste-your-token-here"
r = requests.get(
    "https://graph-api.skyliferesearch.com/v1/graph-stats/chart",
    headers={"Authorization": f"Bearer {token}"},
    params={"interval": "1d", "lookback": 60},
)
r.raise_for_status()
print(r.json()["data"]["stocks"][:3])
```

### JavaScript

```javascript
const token = "paste-your-token-here";
const res = await fetch(
  "https://graph-api.skyliferesearch.com/v1/graph-stats/chart?interval=1d&lookback=60",
  { headers: { Authorization: `Bearer ${token}` } }
);
const body = await res.json();
console.log(body.data.stocks.slice(0, 3));
```

## Using Try It in these docs

On the [API reference](../reference) page, open
`GET /v1/graph-stats/chart` and paste your token into the **Bearer** field in the
**Authentication** panel. Requests are proxied by ReadMe, so there is nothing to
configure for CORS — just paste the token and click **Try It**.

For a zero-auth taste, try `GET /v1/demo/chart` instead; it ignores the Bearer field.

## Token lifetime at a glance

| Property | Value |
|---|---|
| Type | HTTP Bearer, JWT (HS256) |
| Lifetime | 24 hours |
| Scope | Per user |
| Header | `Authorization: Bearer <token>` |
| Renewal | Dashboard → API access → Generate token |
