# Vault for SpinBuild

Handles per-customer signing material: iOS certs + provisioning profiles,
Android upload keystores + service-account JSONs.

## Bring-up (operator, once per cluster)

```
# Start Vault (dev mode — don't use for real data):
docker compose -f docker-compose.yml -f docker-compose.building.yml up -d vault

# Or production mode with file backend:
# edit vault/config.hcl, unseal manually, then:
# docker compose ... up -d vault

# Initial unseal + root token:
docker exec -it spinforge-vault vault operator init -key-shares=1 -key-threshold=1
docker exec -it spinforge-vault vault operator unseal <key>

# Enable KV v2 at `secret/`:
docker exec -it spinforge-vault vault secrets enable -path=secret kv-v2

# Load the per-job policy:
docker cp vault/signing-profile.hcl spinforge-vault:/tmp/signing-profile.hcl
docker exec -it spinforge-vault vault policy write signing-profile /tmp/signing-profile.hcl

# Issue a long-lived api token with write perms (until we tighten this
# with a "spinbuild-api" policy):
docker exec -it spinforge-vault vault token create -policy=root -no-default-policy
# Put that token in .env as VAULT_TOKEN for building-api.
```

## Integration

- `building-api` uses `VAULT_TOKEN` (root-ish during bootstrap; a scoped
  `spinbuild-api` policy later) to write signing material on behalf of
  customers via `POST /api/signing-profiles`.
- On each dispatch of a signed build, `DispatchService` mints a child
  token with the `signing-profile` policy + customer metadata, passes it
  to the runner over the command channel (Mac) or env (Nomad).
- Runner reads its single secret, uses it to sign, then drops the token
  (or waits for TTL).
- Runner never logs secret material; `FastlaneRunner` wraps fastlane
  output through a redactor.

## TODO before real-customer use

- Replace the permissive `path "secret/data/signing/*"` grant with
  identity-templated paths so tokens scope to one profile's directory.
- Rotate the api's write token off of root-equivalent.
- Wire Vault's audit log into `platform:events` for operator visibility.
- Seal/unseal automation — manual unseal on restart is painful.
