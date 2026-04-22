# spinbuild-service — building-api writes/reads customer signing
# material. Grants access to both the current path layout
# (secret/data/signing/<customer>/<platform>/<profile>) and the
# forward-looking customer-scoped layout
# (secret/data/customer/<customer>/...). Narrow via namespaces once
# multi-tenant hardening lands.
#
# Mounted on the long-lived periodic token baked into building-api.
# Per-runner tokens get the narrower `signing-profile` policy.

path "secret/data/signing/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
path "secret/metadata/signing/*" {
  capabilities = ["list", "read", "delete"]
}
path "secret/data/customer/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
path "secret/metadata/customer/*" {
  capabilities = ["list", "read", "delete"]
}

# Mint short-lived child tokens with the signing-profile policy for runners.
path "auth/token/create" {
  capabilities = ["update"]
}
path "auth/token/revoke-accessor" {
  capabilities = ["update"]
}

# Health for self-check
path "sys/health" {
  capabilities = ["read"]
}
