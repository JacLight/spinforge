# Edge integration for building-api

Intentionally **not yet wired** into `hosting/openresty/nginx.conf`. This
doc captures the change to make when we're ready, so the OpenResty edit
can land as its own reviewable diff.

## Current state

`building-api` runs in docker-compose at `172.18.0.16:8090` and also binds
host port `8090` directly. That is fine for dev + internal cluster access.
It is NOT appropriate for public traffic.

## Target state

Public clients (Vibe Studio, CLI, partner webhooks) hit a stable build
subdomain over HTTPS and the edge routes to `building-api`:

```
https://build.spinforge.dev/api/jobs          →  building-api :8090
https://build.spinforge.dev/api/jobs/:id      →  building-api :8090
https://build.spinforge.dev/api/jobs/:id/stream  (SSE)
```

## Change sketch (apply under `hosting/openresty/nginx.conf`)

```nginx
# In the HTTPS server block for spinforge.dev:
location ~ ^/(api|_api|_admin|_auth|_partners|_metrics)/  {
    # existing hosting-api proxy_pass
}

# New: route the build subdomain to building-api.
# Preferred form — separate server block by SNI:
server {
    listen 443 ssl http2;
    server_name build.spinforge.dev;

    ssl_certificate     /etc/letsencrypt/live/build.spinforge.dev/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/build.spinforge.dev/privkey.pem;

    # SSE needs proxy buffering off + long read timeout.
    location / {
        proxy_pass http://172.18.0.16:8090;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_buffering off;             # SSE — flush as events arrive
        proxy_cache off;
        proxy_read_timeout 3600s;        # long-lived streams
        proxy_send_timeout 3600s;
        chunked_transfer_encoding on;
    }
}
```

## DNS + cert

- Add `build.spinforge.dev` A/AAAA → the SpinForge edge IP.
- SpinForge's in-API ACME (`AcmeService`) will issue and renew the cert
  automatically once the domain resolves.

## Auth

**Do NOT expose building-api publicly without auth wired.** Blocking
until PLATFORM_PLAN.md open decision O4 is resolved. Options being
considered:

1. Reuse hosting's admin JWT (`auth_gateway.lua`) — fast, but ties build
   clients to admin tokens.
2. A separate build-scoped token exchanged via `_partners` flow — cleaner
   but needs a new token service.
3. Customer JWT via SpinForge gateway + per-request customer scope check
   against `job.customerId` — the target for public access.

Pick one before flipping the edge route on.
