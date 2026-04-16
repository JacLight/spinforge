# OpenResty cache TTLs — multi-node staleness contract

Each SpinForge node runs its own OpenResty process. Caches are
**per-process, not shared** — two nodes may briefly disagree on routing
or cert state. This document lists every cache, its TTL, and the
maximum staleness window an operator should expect after a change.

## Cache inventory

| Cache | Dict | TTL | Max staleness | What triggers a miss |
|---|---|---|---|---|
| **Site routing** (`routes_cache`) | `routes_cache 50m` | **60s** | 60s after `site:<domain>` changes in Redis | Any request for a domain whose cached entry expired |
| **Consul upstream** (`consul_upstreams`) | `consul_upstreams 10m` | **5s** | 5s after a Nomad allocation becomes (un)healthy | Next request for that service after TTL |
| **Auth gateway config** (`auth_cache`) | `auth_cache 10m` | **60s** (auth enabled), **300s** (auth disabled/no-auth) | Up to 5 min for "no auth → has auth" flip | Request to the domain |
| **Auth gateway routes** (`auth_cache`) | Same dict | **60s** | 60s after route-auth rules change | Request hitting auth middleware |
| **DNS resolver** (`dns_resolver.lua`) | In-memory table | **60s** | 60s after DNS changes (e.g. upstream IP rotated) | Next DNS lookup |
| **SSL certs** (`ssl_certs`) | `ssl_certs 10m` | **varies — populated on first TLS handshake, evicted by LRU** | A new cert in Redis may take 1 request to appear (cold cache miss) | First TLS handshake for a domain, or LRU eviction |
| **Metrics / request data** | `metrics 10m`, `request_data 10m` | N/A — counters, not cache | Not applicable — these are write-only from the request path | N/A |
| **Rate limit** | `rate_limit 10m` | N/A — per-node counters | Rate limits are per-node, not cluster-wide. A user hitting node A and node B gets 2× the limit. | N/A |

## What this means in practice

### Site create / update / delete
- **Worst case:** a request arriving within 60s after the change lands on a
  node whose `routes_cache` still has the old entry. Static sites serve
  stale content; proxies route to the old target; deleted sites still serve.
- **Typical case:** most requests miss cache within seconds because the
  5-minute idle TTL means lightly-trafficked sites aren't cached at all.
- **Force flush:** restart the OpenResty process on the node
  (`docker restart spinforge-openresty`). No data loss — caches repopulate
  from Redis on next request.

### Container deploy / stop
- **Consul upstream cache is 5s.** A Nomad redeploy that changes the healthy
  allocation set takes at most 5s to propagate to the routing layer. During
  that window, requests may hit the old allocation (which Nomad keeps
  running briefly for exactly this reason — rolling deploys overlap old and
  new).

### SSL cert issuance
- Cold miss: the very first TLS handshake for a domain loads the cert from
  Redis (or disk). No delay beyond the TLS round-trip.
- Hot miss after renewal: the old cert stays cached until LRU evicts it or
  OpenResty restarts. In practice, renewed certs have identical CN/SAN so
  the only visible difference is the new expiry date, which clients don't
  check in real-time.

### Auth changes
- Flipping a domain from "no auth" to "auth enabled" takes up to **5
  minutes** to propagate because the negative cache TTL for "no auth" is
  300s. Restart OpenResty for immediate effect.

### Rate limiting
- Rate limit counters are per-OpenResty-process, not cluster-wide. A
  brute-force attacker round-robining across N nodes gets N× the configured
  limit. For login protection (5/min/IP) this is acceptable — an attacker
  gets 5×N attempts/min, where N is a small single-digit number.
- If this becomes a problem, move rate-limit state to Redis (already wired
  for the Express-level rate limiter in `utils/rate-limit.js`; the Lua-level
  one would need similar treatment).
