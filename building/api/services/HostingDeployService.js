/**
 * Takes a completed build and makes it actually serve at the customer's
 * domain. Three modes:
 *   static    — extract artifact into /data/static/<folder>/, write site record
 *   container — submit Nomad service job, Consul register, write site record
 *   mobile    — stash signed binary at /data/artifacts/<depId>/ and surface download URL
 *
 * KeyDB site records follow the hosting/ convention (type: static | container | proxy).
 * openresty's router reads `site:<domain>` and serves accordingly, with a 60s
 * cache TTL, so a freshly-written record becomes live within a minute.
 *
 * Folder-slug convention matches hosting/openresty/lua/utils.lua
 * `domain_to_folder()` — dots to underscores, nothing else. The lua
 * router falls back to `<STATIC_ROOT>/<domain_to_folder>` if the record
 * doesn't include `static_path`, so we just write the explicit path.
 */

const fs = require('fs');
const path = require('path');
const child = require('child_process');
const util = require('util');
const execFile = util.promisify(child.execFile);

class HostingDeployService {
  constructor(redis, { logger, events, vault, nomadAddr, registryAddr, datacenter } = {}) {
    this.redis = redis;
    this.logger = logger || console;
    this.events = events;
    this.vault = vault || null;
    this.nomadAddr = nomadAddr || process.env.NOMAD_ADDR || 'http://127.0.0.1:4646';
    this.datacenter = datacenter || process.env.NOMAD_DATACENTER || 'spinforge-dc1';
    this.registryAddr = registryAddr || process.env.REGISTRY_ADDR || '192.168.88.170:5000';
    this.dataRoot = process.env.DATA_ROOT || '/data';
    this.staticRoot = process.env.STATIC_ROOT || path.join(this.dataRoot, 'static');
    this.vaultPublicAddr = process.env.VAULT_PUBLIC_ADDR || 'https://vault.spinforge.dev';
  }

  // Ensure the customer has a vault token, mint one if missing. Never
  // throws — if Vault is unreachable we fall through with no token so
  // the container still deploys (just without Vault env).
  async _ensureCustomerVaultToken(customerId) {
    if (!this.vault || !this.vault.isConfigured()) return null;
    try {
      const cacheKey = `customer:${customerId}:vault_token`;
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.token) return parsed;
      }
      const minted = await this.vault.mintCustomerToken(customerId, { ttlSeconds: 168 * 3600 });
      await this.redis.set(cacheKey, JSON.stringify({
        token: minted.token,
        accessor: minted.accessor,
        policyName: minted.policyName,
        leaseDurationSec: minted.leaseDurationSec,
        mintedAt: Date.now(),
      }));
      return minted;
    } catch (err) {
      this.logger.warn?.(`[hosting-deploy] customer vault bootstrap failed for ${customerId}: ${err.message}`);
      return null;
    }
  }

  async deploy({ deploymentId, customerId, domain, source, artifactDir }) {
    switch (source.type) {
      case 'static':
      case 'build-static':
        return this._deployStatic({ deploymentId, customerId, domain, artifactDir, source });
      case 'build-container':
        return this._deployContainer({ deploymentId, customerId, domain, artifactDir, source });
      case 'build-mobile':
        return this._deployMobile({ deploymentId, customerId, artifactDir, source });
      default:
        throw new Error(`unknown source.type: ${source.type}`);
    }
  }

  // ─── static / build-static ─────────────────────────────────────────────

  async _deployStatic({ deploymentId, customerId, domain, artifactDir, source }) {
    // Folder name must match hosting/openresty/lua/utils.lua domain_to_folder:
    //   dots → underscores, everything else untouched.
    const folder = domain.replace(/\./g, '_');
    const destDir = path.join(this.staticRoot, folder);

    // Atomic replace via staging + rename. Both paths are on the same Ceph
    // host_volume so rename() is a metadata-only swap.
    const staging = destDir + '.new';
    const previous = destDir + '.old';

    // Ensure parent exists (first deploy on a fresh node).
    fs.mkdirSync(this.staticRoot, { recursive: true });
    if (fs.existsSync(staging)) child.execSync(`rm -rf ${JSON.stringify(staging)}`);
    fs.mkdirSync(staging, { recursive: true });

    // Copy artifact contents into staging.
    //   - If artifactDir has workspace.zip (raw static path), unzip it.
    //   - Else if artifactDir has artifact.zip (from build runner), unzip it.
    //   - Else if artifactDir is a dir, mirror its contents.
    const workspaceZip = path.join(artifactDir, 'workspace.zip');
    const artifactZip = path.join(artifactDir, 'artifact.zip');
    if (fs.existsSync(workspaceZip)) {
      await execFile('unzip', ['-o', '-q', workspaceZip, '-d', staging]);
    } else if (fs.existsSync(artifactZip)) {
      await execFile('unzip', ['-o', '-q', artifactZip, '-d', staging]);
    } else if (fs.existsSync(artifactDir) && fs.statSync(artifactDir).isDirectory()) {
      // Copy directory contents. Trailing `/.` on src ensures cp copies
      // the contents, not the dir itself.
      await execFile('cp', ['-r', `${artifactDir}/.`, staging]);
    } else {
      throw new Error(`artifactDir not found: ${artifactDir}`);
    }

    // Swap: existing → .old, staging → final, then discard .old.
    if (fs.existsSync(destDir)) {
      if (fs.existsSync(previous)) child.execSync(`rm -rf ${JSON.stringify(previous)}`);
      fs.renameSync(destDir, previous);
    }
    fs.renameSync(staging, destDir);
    if (fs.existsSync(previous)) child.execSync(`rm -rf ${JSON.stringify(previous)}`);

    // Write KeyDB site record. Openresty caches for 60s — we accept the
    // short delay rather than invalidating the in-nginx shared dict.
    const siteKey = `site:${domain}`;
    const existing = await this._existingSite(domain);
    const siteRecord = {
      domain,
      type: 'static',
      static_path: destDir,
      indexFile: 'index.html',
      errorFile: '404.html',
      directoryListing: false,
      ssl_enabled: true,
      enabled: true,
      customerId,
      deploymentId,
      aliases: existing?.aliases || [],
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastDeployedAt: new Date().toISOString(),
    };
    await this.redis.set(siteKey, JSON.stringify(siteRecord));
    await this.redis.sAdd('sites:all', domain);
    await this.redis.sAdd(`customer:${customerId}:sites`, domain);

    if (this.events) {
      this.events.publish('site.deployed', domain, {
        context: { customerId, deploymentId, type: 'static', path: destDir },
      }).catch(() => {});
    }

    this.logger.info(`[hosting-deploy] static ${domain} → ${destDir}`);
    return { type: 'static', url: `https://${domain}/`, sitePath: destDir };
  }

  // ─── build-container ───────────────────────────────────────────────────

  async _deployContainer({ deploymentId, customerId, domain, artifactDir, source }) {
    // Container builds push an image to the registry as part of the build
    // phase. We expect a marker file so we don't submit a Nomad job that
    // would just ImagePullBackOff.
    const slug = domain.replace(/[^a-z0-9-]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    const imageRef = `${this.registryAddr}/${customerId}/${slug}:${deploymentId}`;

    const marker = path.join(artifactDir, 'IMAGE_PUSHED');
    if (!fs.existsSync(marker)) {
      throw new Error(
        `build phase did not push image for container deploy (missing IMAGE_PUSHED in ${artifactDir}). ` +
        `Expected tag ${imageRef}.`
      );
    }

    // Customer vault bootstrap — inject VAULT_TOKEN scoped to
    // secret/customer/<id>/* so the customer's app can self-serve
    // secrets without manual plumbing. If the mint fails we still
    // deploy (degraded path), the app just sees no VAULT_* env.
    const vaultCreds = await this._ensureCustomerVaultToken(customerId);

    // Submit Nomad service job.
    const consulServiceName = `site-${slug}`;
    const jobSpec = this._containerJobSpec({
      customerId, domain, slug, imageRef, consulServiceName, vaultCreds,
    });

    const resp = await fetch(`${this.nomadAddr}/v1/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Job: jobSpec }),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw new Error(`Nomad submit failed: ${resp.status} ${body}`);
    }

    // Write KeyDB site record — type: container triggers consul_upstream
    // lookup in router.lua.
    const siteKey = `site:${domain}`;
    const existing = await this._existingSite(domain);
    const siteRecord = {
      domain,
      type: 'container',
      consul_service: consulServiceName,
      ssl_enabled: true,
      enabled: true,
      customerId,
      deploymentId,
      imageRef,
      aliases: existing?.aliases || [],
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastDeployedAt: new Date().toISOString(),
    };
    await this.redis.set(siteKey, JSON.stringify(siteRecord));
    await this.redis.sAdd('sites:all', domain);
    await this.redis.sAdd(`customer:${customerId}:sites`, domain);

    if (this.events) {
      this.events.publish('site.deployed', domain, {
        context: { customerId, deploymentId, type: 'container', imageRef, consulServiceName },
      }).catch(() => {});
    }

    this.logger.info(`[hosting-deploy] container ${domain} → ${imageRef}`);
    return { type: 'container', url: `https://${domain}/`, imageRef, consulServiceName };
  }

  // ─── build-mobile ──────────────────────────────────────────────────────

  async _deployMobile({ deploymentId, customerId, artifactDir, source }) {
    // Mobile builds stash signed ipa/aab; store uploads (TestFlight / Play
    // Store) are out of scope for this cut — require Vault + Fastlane.
    const binaryExt = source.platform === 'ios' ? 'ipa' : 'aab';
    const binaryPath = path.join(artifactDir, `app.${binaryExt}`);
    if (!fs.existsSync(binaryPath)) {
      throw new Error(`signed ${binaryExt} not found at ${binaryPath}`);
    }

    const url = `https://build.spinforge.dev/api/deployments/${deploymentId}/download`;

    if (this.events) {
      this.events.publish('mobile.built', deploymentId, {
        context: { customerId, platform: source.platform, binarySize: fs.statSync(binaryPath).size },
      }).catch(() => {});
    }

    this.logger.info(`[hosting-deploy] mobile dep=${deploymentId} → ${binaryPath}`);
    return { type: 'mobile', url, binaryPath };
  }

  // ─── helpers ───────────────────────────────────────────────────────────

  _containerJobSpec({ customerId, domain, slug, imageRef, consulServiceName, vaultCreds }) {
    const env = {
      PORT: '3000',
      CUSTOMER_ID: customerId,
      DOMAIN: domain,
    };
    if (vaultCreds?.token) {
      env.VAULT_ADDR = this.vaultPublicAddr;
      env.VAULT_TOKEN = vaultCreds.token;
      env.VAULT_PATH_PREFIX = `secret/customer/${customerId}/`;
    }
    return {
      ID: `customer-${customerId}-${slug}`,
      Name: `customer-${customerId}-${slug}`,
      Type: 'service',
      Datacenters: [this.datacenter],
      TaskGroups: [{
        Name: slug,
        Count: 1,
        Networks: [{
          Mode: 'bridge',
          DynamicPorts: [{ Label: 'http', To: 3000 }],
        }],
        Services: [{
          Name: consulServiceName,
          PortLabel: 'http',
          Provider: 'consul',
          Tags: ['customer', 'spinforge'],
          Checks: [{
            Name: 'http',
            Type: 'http',
            Path: '/',
            Interval: 30_000_000_000, // 30s in ns
            Timeout: 5_000_000_000,   // 5s
            PortLabel: 'http',
          }],
        }],
        Tasks: [{
          Name: slug,
          Driver: 'docker',
          Config: {
            image: imageRef,
            ports: ['http'],
          },
          Env: env,
          Resources: { CPU: 200, MemoryMB: 256 },
        }],
        RestartPolicy: { Attempts: 3, Interval: 300_000_000_000, Delay: 15_000_000_000, Mode: 'delay' },
        ReschedulePolicy: { Attempts: 0, Unlimited: true, Delay: 10_000_000_000, DelayFunction: 'constant' },
      }],
      Meta: {
        spinforge_deployment: 'true',
        customer_id: customerId,
        domain,
      },
    };
  }

  async _existingSite(domain) {
    const raw = await this.redis.get(`site:${domain}`);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }
}

module.exports = HostingDeployService;
