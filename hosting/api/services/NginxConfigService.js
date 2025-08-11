const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class NginxConfigService {
  constructor() {
    this.configPath = '/etc/nginx/conf.d';
    this.reloadNginx = async () => {
      try {
        await execAsync('nginx -s reload');
        console.log('Nginx reloaded successfully');
      } catch (error) {
        console.error('Failed to reload nginx:', error);
        throw error;
      }
    };
  }

  async generateSiteConfig(site) {
    const { domain, ssl } = site;
    
    // Check if certificate exists
    const certPath = `/etc/letsencrypt/live/${domain}/fullchain.pem`;
    const keyPath = `/etc/letsencrypt/live/${domain}/privkey.pem`;
    
    let sslConfig = '';
    
    try {
      await fs.access(certPath);
      await fs.access(keyPath);
      
      // Certificate exists, add SSL config
      sslConfig = `
    # SSL Configuration
    listen 443 ssl http2;
    ssl_certificate ${certPath};
    ssl_certificate_key ${keyPath};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
    ssl_prefer_server_ciphers off;
    
    # Force HTTPS redirect
    if ($scheme != "https") {
        return 301 https://$server_name$request_uri;
    }`;
    } catch (error) {
      // No certificate, HTTP only
      console.log(`No SSL certificate found for ${domain}`);
    }

    const config = `
# Auto-generated configuration for ${domain}
server {
    listen 80;
    server_name ${domain} ${site.aliases ? site.aliases.join(' ') : ''};
    ${sslConfig}
    
    # Pass to OpenResty router
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
`;

    // Write config file
    const configFile = path.join(this.configPath, `${domain}.conf`);
    await fs.writeFile(configFile, config);
    
    return configFile;
  }

  async removeSiteConfig(domain) {
    const configFile = path.join(this.configPath, `${domain}.conf`);
    try {
      await fs.unlink(configFile);
    } catch (error) {
      console.error(`Failed to remove config for ${domain}:`, error);
    }
  }

  async updateAllConfigs(sites) {
    for (const site of sites) {
      if (site.enabled && site.ssl?.enabled) {
        await this.generateSiteConfig(site);
      }
    }
    await this.reloadNginx();
  }
}

module.exports = NginxConfigService;