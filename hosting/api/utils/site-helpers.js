/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
const fs = require('fs');
const path = require('path');
const { STATIC_ROOT } = require('./constants');

// Check if static files exist for a site
function checkStaticFiles(site) {
  if (site.type === 'static') {
    // Use filesystem-friendly folder name (dots replaced with underscores)
    const folderName = site.domain.replace(/\./g, '_');
    const staticPath = site.static_path || path.join(STATIC_ROOT, folderName);
    site.files_exist = false;
    site.actual_domain = null;
    site.static_path = staticPath; // Container path
    
    // Calculate host path based on the docker-compose volume mount
    // In docker-compose.yml: ./hosting/data/static:/data/static
    // Use environment variable if set, otherwise use relative path
    const hostBasePath = process.env.HOST_STATIC_PATH || './hosting/data/static';
    site.host_static_path = path.join(hostBasePath, folderName);
    
    try {
      // Check if directory exists
      if (fs.existsSync(staticPath)) {
        site.files_exist = true;
        
        // Check for deploy.json to get actual domain
        const deployJsonPath = path.join(staticPath, 'deploy.json');
        if (fs.existsSync(deployJsonPath)) {
          try {
            const deployData = JSON.parse(fs.readFileSync(deployJsonPath, 'utf8'));
            site.actual_domain = deployData.domain || null;
          } catch (e) {
            console.error(`Error reading deploy.json for ${site.domain}:`, e);
          }
        }
      }
    } catch (e) {
      console.error(`Error checking files for ${site.domain}:`, e);
    }
  }
  return site;
}

// Format bytes into human readable format
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Parse bytes from Docker format (e.g., "1.2kB", "3.4MB")
function parseBytes(str) {
  if (!str) return 0;
  const match = str.match(/^([\d.]+)([A-Za-z]+)$/);
  if (!match) return 0;
  
  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  
  const multipliers = {
    'b': 1,
    'kb': 1024,
    'mb': 1024 * 1024,
    'gb': 1024 * 1024 * 1024
  };
  
  return value * (multipliers[unit] || 1);
}

module.exports = {
  checkStaticFiles,
  formatBytes,
  parseBytes
};