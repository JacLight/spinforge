/**
 * VaultService — thin wrapper over HashiCorp Vault HTTP API.
 *
 * Responsibilities:
 *   - Write / read / delete signing secrets under `secret/signing/<customerId>/<platform>/<profileId>`.
 *   - Mint short-lived child tokens scoped to a specific profile's path for
 *     runners to use during a build.
 *   - Never log secret values.
 *
 * Assumes:
 *   - KV v2 secrets engine mounted at `secret/`.
 *   - A policy named `signing-profile` (see building/vault/signing-profile.hcl)
 *     already loaded at Vault bootstrap. The policy is templated with
 *     `{{customer_id}}` + `{{profile_id}}` so tokens scope narrowly.
 *   - The api process has a token (via VAULT_TOKEN env) that can write
 *     secrets and create child tokens — should be a dedicated
 *     `spinbuild-api` policy, not root, once operators are comfortable.
 */

const axios = require('axios');

const DEFAULT_ADDR = process.env.VAULT_ADDR || 'http://spinforge-vault:8200';
const MOUNT = process.env.VAULT_KV_MOUNT || 'secret';

class VaultService {
  constructor({ addr, token, mount, logger } = {}) {
    this.addr = addr || DEFAULT_ADDR;
    this.token = token || process.env.VAULT_TOKEN || null;
    this.mount = mount || MOUNT;
    this.logger = logger || console;

    this.http = axios.create({
      baseURL: this.addr,
      timeout: 20_000,
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { 'X-Vault-Token': this.token } : {}),
      },
      validateStatus: (s) => s < 500,
    });
  }

  isConfigured() {
    return Boolean(this.token);
  }

  _secretPath(customerId, platform, profileId) {
    return `signing/${customerId}/${platform}/${profileId}`;
  }

  // ─── CRUD on secrets ───────────────────────────────────────────────────

  async writeSecret(customerId, platform, profileId, data) {
    this._assertConfigured();
    const p = this._secretPath(customerId, platform, profileId);
    const res = await this.http.post(`/v1/${this.mount}/data/${p}`, { data });
    if (res.status >= 400) {
      throw new Error(`vault write failed (${res.status}): ${JSON.stringify(res.data)}`);
    }
    return { path: p, version: res.data?.data?.version };
  }

  async readSecret(customerId, platform, profileId) {
    this._assertConfigured();
    const p = this._secretPath(customerId, platform, profileId);
    const res = await this.http.get(`/v1/${this.mount}/data/${p}`);
    if (res.status === 404) return null;
    if (res.status >= 400) {
      throw new Error(`vault read failed (${res.status})`);
    }
    return res.data?.data?.data || null;
  }

  async deleteSecret(customerId, platform, profileId) {
    this._assertConfigured();
    const p = this._secretPath(customerId, platform, profileId);
    const res = await this.http.delete(`/v1/${this.mount}/metadata/${p}`);
    if (res.status >= 400 && res.status !== 404) {
      throw new Error(`vault delete failed (${res.status})`);
    }
    return true;
  }

  // ─── Per-job child tokens ──────────────────────────────────────────────

  /**
   * Mint a child token scoped to a single profile's secret path. Runner
   * uses this token to read its signing material, then discards it. TTL
   * should cover the expected build duration + a short grace window.
   */
  async mintJobToken({ customerId, platform, profileId, ttlSeconds = 1800 }) {
    this._assertConfigured();
    const body = {
      policies: ['signing-profile'],
      ttl: `${ttlSeconds}s`,
      explicit_max_ttl: `${ttlSeconds}s`,
      meta: {
        customer_id: customerId,
        platform,
        profile_id: profileId,
      },
      renewable: false,
      no_parent: false,
    };
    const res = await this.http.post('/v1/auth/token/create', body);
    if (res.status >= 400) {
      throw new Error(`vault token create failed (${res.status}): ${JSON.stringify(res.data)}`);
    }
    const auth = res.data?.auth || {};
    return {
      token: auth.client_token,
      accessor: auth.accessor,
      policies: auth.policies,
      leaseDurationSec: auth.lease_duration,
    };
  }

  async revokeToken(accessor) {
    if (!accessor) return;
    this._assertConfigured();
    await this.http.post('/v1/auth/token/revoke-accessor', { accessor });
  }

  // ─── Platform secrets CRUD (secret/platform/*) ─────────────────────
  // Used by the admin UI's Platform → Secrets page. Read/write go via
  // the api's own VAULT_TOKEN (spinbuild-service policy). Individual
  // services read through the platform-service token they're handed at
  // task start.

  async listPlatformKeys() {
    this._assertConfigured();
    // OpenBao's LIST verb is method=LIST; axios needs explicit config.
    const res = await this.http.request({
      method: 'LIST',
      url: `/v1/${this.mount}/metadata/platform`,
    });
    if (res.status === 404) return [];
    if (res.status >= 400) {
      throw new Error(`vault list platform failed (${res.status}): ${JSON.stringify(res.data)}`);
    }
    return res.data?.data?.keys || [];
  }

  async readPlatformSecret(key) {
    this._assertConfigured();
    const res = await this.http.get(`/v1/${this.mount}/data/platform/${encodeURIComponent(key)}`);
    if (res.status === 404) return null;
    if (res.status >= 400) {
      throw new Error(`vault read platform failed (${res.status}): ${JSON.stringify(res.data)}`);
    }
    return {
      data: res.data?.data?.data || {},
      metadata: res.data?.data?.metadata || {},
    };
  }

  async writePlatformSecret(key, data) {
    this._assertConfigured();
    const res = await this.http.post(
      `/v1/${this.mount}/data/platform/${encodeURIComponent(key)}`,
      { data },
    );
    if (res.status >= 400) {
      throw new Error(`vault write platform failed (${res.status}): ${JSON.stringify(res.data)}`);
    }
    return { key, version: res.data?.data?.version };
  }

  async deletePlatformSecret(key) {
    this._assertConfigured();
    const res = await this.http.delete(`/v1/${this.mount}/metadata/platform/${encodeURIComponent(key)}`);
    if (res.status >= 400 && res.status !== 404) {
      throw new Error(`vault delete platform failed (${res.status}): ${JSON.stringify(res.data)}`);
    }
    return true;
  }

  // ─── Customer-scoped secrets (secret/customer/<id>/*) ───────────────
  // Admin uses these via the api's own token (broad). Customers use
  // their own scoped token read from KeyDB.

  async listCustomerKeys(customerId) {
    this._assertConfigured();
    const res = await this.http.request({
      method: 'LIST',
      url: `/v1/${this.mount}/metadata/customer/${encodeURIComponent(customerId)}`,
    });
    if (res.status === 404) return [];
    if (res.status >= 400) {
      throw new Error(`vault list customer failed (${res.status}): ${JSON.stringify(res.data)}`);
    }
    return res.data?.data?.keys || [];
  }

  async readCustomerSecret(customerId, key) {
    this._assertConfigured();
    const res = await this.http.get(
      `/v1/${this.mount}/data/customer/${encodeURIComponent(customerId)}/${encodeURIComponent(key)}`,
    );
    if (res.status === 404) return null;
    if (res.status >= 400) {
      throw new Error(`vault read customer failed (${res.status}): ${JSON.stringify(res.data)}`);
    }
    return {
      data: res.data?.data?.data || {},
      metadata: res.data?.data?.metadata || {},
    };
  }

  async writeCustomerSecret(customerId, key, data) {
    this._assertConfigured();
    const res = await this.http.post(
      `/v1/${this.mount}/data/customer/${encodeURIComponent(customerId)}/${encodeURIComponent(key)}`,
      { data },
    );
    if (res.status >= 400) {
      throw new Error(`vault write customer failed (${res.status}): ${JSON.stringify(res.data)}`);
    }
    return { customerId, key, version: res.data?.data?.version };
  }

  async deleteCustomerSecret(customerId, key) {
    this._assertConfigured();
    const res = await this.http.delete(
      `/v1/${this.mount}/metadata/customer/${encodeURIComponent(customerId)}/${encodeURIComponent(key)}`,
    );
    if (res.status >= 400 && res.status !== 404) {
      throw new Error(`vault delete customer failed (${res.status}): ${JSON.stringify(res.data)}`);
    }
    return true;
  }

  // ─── Per-customer policy + periodic token ───────────────────────────
  // Called the first time deployContainer fires for a customer. After
  // that the token is cached in KeyDB (customer:<id>:vault_token). Admin
  // can force rotation via ?rotate=true.

  _customerPolicyName(customerId) {
    return `customer-${customerId}`;
  }

  async ensureCustomerPolicy(customerId) {
    this._assertConfigured();
    const name = this._customerPolicyName(customerId);
    const policy = [
      `path "${this.mount}/data/customer/${customerId}/*" { capabilities = ["create","read","update","delete","list"] }`,
      `path "${this.mount}/metadata/customer/${customerId}/*" { capabilities = ["list","read","delete"] }`,
      `path "${this.mount}/metadata/customer/${customerId}" { capabilities = ["list"] }`,
    ].join('\n');
    const res = await this.http.put(`/v1/sys/policies/acl/${name}`, { policy });
    if (res.status >= 400) {
      throw new Error(`vault policy put failed (${res.status}): ${JSON.stringify(res.data)}`);
    }
    return name;
  }

  async mintCustomerToken(customerId, { ttlSeconds = 168 * 3600 } = {}) {
    this._assertConfigured();
    const policyName = await this.ensureCustomerPolicy(customerId);
    const body = {
      policies: [policyName],
      period: `${ttlSeconds}s`,
      renewable: true,
      display_name: `customer-${customerId}`,
      no_parent: true,
      meta: { customer_id: customerId },
    };
    const res = await this.http.post('/v1/auth/token/create', body);
    if (res.status >= 400) {
      throw new Error(`vault customer token create failed (${res.status}): ${JSON.stringify(res.data)}`);
    }
    const auth = res.data?.auth || {};
    return {
      token: auth.client_token,
      accessor: auth.accessor,
      policies: auth.policies,
      leaseDurationSec: auth.lease_duration,
      policyName,
    };
  }

  _assertConfigured() {
    if (!this.isConfigured()) {
      throw Object.assign(new Error('VaultService not configured (VAULT_TOKEN missing)'), {
        status: 503,
        expose: true,
      });
    }
  }
}

module.exports = VaultService;
