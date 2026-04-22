/**
 * Minimal Vault KV v2 reader for the Android runner. Mirrors
 * building/runners/macos/lib/vault-client.js — when a third consumer
 * shows up, extract to building/runners/shared/.
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

class VaultClient {
  constructor({ addr, token, mount = 'secret' }) {
    if (!addr) throw new Error('VaultClient: addr is required');
    if (!token) throw new Error('VaultClient: token is required');
    this.addr = addr;
    this.token = token;
    this.mount = mount;
  }

  async read(path) {
    const url = new URL(`/v1/${this.mount}/data/${path}`, this.addr);
    return new Promise((resolve, reject) => {
      const lib = url.protocol === 'https:' ? https : http;
      const req = lib.request(url, {
        method: 'GET',
        headers: { 'X-Vault-Token': this.token },
      }, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { body += c; });
        res.on('end', () => {
          if (res.statusCode === 404) return resolve(null);
          if (res.statusCode >= 400) {
            return reject(new Error(`vault read ${res.statusCode}: ${body.slice(0, 300)}`));
          }
          try {
            const parsed = JSON.parse(body);
            resolve(parsed?.data?.data || null);
          } catch (err) { reject(err); }
        });
      });
      req.on('error', reject);
      req.end();
    });
  }
}

module.exports = { VaultClient };
