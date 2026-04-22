# Vault policy for per-job runner tokens.
#
# Attached to short-lived tokens minted by VaultService.mintJobToken().
# Each token carries metadata (customer_id, platform, profile_id) set at
# creation time; future tightening should template the path with
# identity.entity.metadata.* to scope strictly to one profile's secret.
#
# For v1 this grants read on the whole signing tree — mitigated by the
# 30-minute TTL on tokens and Vault's audit log. Tighten before moving
# customer signing material off a single team.

path "secret/data/signing/*" {
  capabilities = ["read"]
}

# Tokens should not be able to renew themselves or create children.
path "auth/token/renew-self" {
  capabilities = ["deny"]
}

path "auth/token/create*" {
  capabilities = ["deny"]
}

path "sys/wrapping/*" {
  capabilities = ["deny"]
}
