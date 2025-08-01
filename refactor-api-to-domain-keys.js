const fs = require('fs');
const path = require('path');

// Read the current API file
const apiFile = path.join(__dirname, 'hosting/api/server-openresty.js');
let content = fs.readFileSync(apiFile, 'utf8');

// Replace all vhost references with site
content = content.replace(/vhost/g, 'site');
content = content.replace(/Vhost/g, 'Site');
content = content.replace(/VHOST/g, 'SITE');

// Update the routes to use domain as parameter instead of id
content = content.replace(/\/api\/site\/:id'/g, "/api/sites/:domain'");
content = content.replace(/\/api\/site\/:id\//g, "/api/sites/:domain/");
content = content.replace(/req\.params\.id/g, 'req.params.domain');

// Fix the specific patterns
content = content.replace(/`site:\${req\.params\.domain}`/g, '`site:${req.params.domain}`');
content = content.replace(/`site:\${site\.id \|\| site\.subdomain}`/g, '`site:${site.domain}`');
content = content.replace(/`site:\${site\.id}`/g, '`site:${site.domain}`');
content = content.replace(/`site:\${id}`/g, '`site:${domain}`');
content = content.replace(/const id = req\.params\.domain;/g, 'const domain = req.params.domain;');

// Remove subdomain and id checks
content = content.replace(/\(!site\.id && !site\.subdomain\)/g, '!site.domain');
content = content.replace(/site\.id \|\| site\.subdomain/g, 'site.domain');

// Update static path to use domain
content = content.replace(/path\.join\(STATIC_ROOT, site\.domain\.replace\(\/\[\^a-zA-Z0-9\.-\]\/g, '-'\)\)/g, "path.join(STATIC_ROOT, site.domain.replace(/[^a-zA-Z0-9.-]/g, '-'))");

// Remove the updateDomainMappings function completely
content = content.replace(/\/\/ Helper function to update domain mappings[\s\S]*?^\}/gm, '');

// Remove calls to updateDomainMappings
content = content.replace(/\s*\/\/ Update domain mappings[\s\S]*?await updateDomainMappings[^;]*;/g, '');
content = content.replace(/\s*\/\/ Create domain mappings[\s\S]*?}\s*}/g, '}');
content = content.replace(/\s*if \(site\.domain \|\| site\.aliases\) \{[\s\S]*?await updateDomainMappings[^}]*}\s*}/g, '');

// Update search to use domain instead of id/subdomain
content = content.replace(/\(site\.id \|\| site\.subdomain\)\.toLowerCase\(\)/g, 'site.domain.toLowerCase()');

// Fix JSON response messages
content = content.replace(/json\({ message: 'Virtual host created', id: site\.id }\)/g, "json({ message: 'Site created', domain: site.domain })");
content = content.replace(/json\({ message: 'Virtual host updated', id }\)/g, "json({ message: 'Site updated', domain })");
content = content.replace(/json\({ message: 'Virtual host deleted', id }\)/g, "json({ message: 'Site deleted', domain })");

// Update error messages
content = content.replace(/'Virtual host not found'/g, "'Site not found'");
content = content.replace(/'Virtual host already exists'/g, "'Site already exists'");
content = content.replace(/'Site ID and type are required'/g, "'Domain and type are required'");

// Update the /api/site route to /api/sites
content = content.replace(/app\.(get|post|put|delete)\('\/api\/site([^s])/g, "app.$1('/api/sites$2");

// Fix stats endpoint
content = content.replace(/const keys = await redisClient\.keys\('site:\*'\);/g, "const keys = await redisClient.keys('site:*');");

// Remove references to BASE_DOMAIN
content = content.replace(/\s*\/\/ Use actual domain from deploy\.json if available[\s\S]*?site\.domain = site\.actual_domain \|\| site\.domain;/g, '');

// Write the updated file
fs.writeFileSync(apiFile, content, 'utf8');

console.log('API refactored to use domain-based keys!');