const fs = require('fs').promises;
const path = require('path');

class SSLMappingService {
  constructor(redisClient) {
    this.redisClient = redisClient;
    this.sslMapFile = '/data/nginx/ssl_mappings.conf';
  }

  async generateSSLMappings() {
    // Get all sites with SSL enabled
    const sites = await this.getAllSitesWithSSL();
    
    let mappings = '# Auto-generated SSL certificate mappings\n';
    mappings += 'map $ssl_server_name $ssl_cert_path {\n';
    mappings += '    default /etc/letsencrypt/live/default/fullchain.pem;\n';
    
    for (const site of sites) {
      const certPath = `/etc/letsencrypt/live/${site.domain}/fullchain.pem`;
      // Check if cert exists
      try {
        await fs.access(certPath);
        mappings += `    ${site.domain} ${certPath};\n`;
        // Add aliases
        if (site.aliases) {
          for (const alias of site.aliases) {
            mappings += `    ${alias} ${certPath};\n`;
          }
        }
      } catch (e) {
        // Certificate doesn't exist yet
      }
    }
    
    mappings += '}\n\n';
    mappings += 'map $ssl_server_name $ssl_key_path {\n';
    mappings += '    default /etc/letsencrypt/live/default/privkey.pem;\n';
    
    for (const site of sites) {
      const keyPath = `/etc/letsencrypt/live/${site.domain}/privkey.pem`;
      try {
        await fs.access(keyPath);
        mappings += `    ${site.domain} ${keyPath};\n`;
        if (site.aliases) {
          for (const alias of site.aliases) {
            mappings += `    ${alias} ${keyPath};\n`;
          }
        }
      } catch (e) {
        // Key doesn't exist yet
      }
    }
    
    mappings += '}\n';
    
    // Write the mapping file
    await fs.mkdir(path.dirname(this.sslMapFile), { recursive: true });
    await fs.writeFile(this.sslMapFile, mappings);
    
    return mappings;
  }

  async getAllSitesWithSSL() {
    const keys = await this.redisClient.keys('site:*');
    const sites = [];
    
    for (const key of keys) {
      const siteData = await this.redisClient.get(key);
      if (siteData) {
        const site = JSON.parse(siteData);
        if (site.ssl_enabled) {
          sites.push(site);
        }
      }
    }
    
    return sites;
  }
}

module.exports = SSLMappingService;