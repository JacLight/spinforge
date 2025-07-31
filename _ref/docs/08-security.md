# SpinForge Security Guide

## Table of Contents
1. [Security Overview](#security-overview)
2. [Infrastructure Security](#infrastructure-security)
3. [Application Security](#application-security)
4. [Authentication & Authorization](#authentication--authorization)
5. [Data Security](#data-security)
6. [Network Security](#network-security)
7. [Container Security](#container-security)
8. [Security Monitoring](#security-monitoring)
9. [Incident Response](#incident-response)
10. [Compliance](#compliance)

## Security Overview

### Security Principles

1. **Defense in Depth**: Multiple layers of security controls
2. **Least Privilege**: Minimal access rights for users and services
3. **Zero Trust**: Verify everything, trust nothing
4. **Secure by Default**: Security enabled out of the box
5. **Continuous Monitoring**: Real-time threat detection

### Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    External Traffic                          │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                     WAF / DDoS Protection                    │
│                    (Cloudflare/AWS Shield)                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                      Load Balancer                           │
│                    (SSL Termination)                         │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                         NGINX                                │
│              (Rate Limiting, Security Headers)               │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                       SpinHub                                │
│          (Authentication, Authorization, Validation)         │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                   Isolated Spinlets                          │
│              (Sandboxed Application Runtime)                 │
└─────────────────────────────────────────────────────────────┘
```

## Infrastructure Security

### Host Security

#### 1. OS Hardening

```bash
#!/bin/bash
# Ubuntu/Debian hardening script

# Update system
apt-get update && apt-get upgrade -y

# Install security tools
apt-get install -y \
    fail2ban \
    ufw \
    aide \
    rkhunter \
    lynis \
    auditd

# Configure firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp  # SSH
ufw allow 80/tcp  # HTTP
ufw allow 443/tcp # HTTPS
ufw --force enable

# SSH hardening
cat >> /etc/ssh/sshd_config << EOF
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
MaxSessions 2
ClientAliveInterval 300
ClientAliveCountMax 2
AllowUsers spinforge admin
Protocol 2
EOF

systemctl restart sshd

# Kernel hardening
cat >> /etc/sysctl.conf << EOF
# IP Spoofing protection
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1

# Ignore ICMP redirects
net.ipv4.conf.all.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0

# Ignore send redirects
net.ipv4.conf.all.send_redirects = 0

# Disable source packet routing
net.ipv4.conf.all.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0

# Log Martians
net.ipv4.conf.all.log_martians = 1

# Ignore ICMP ping requests
net.ipv4.icmp_echo_ignore_broadcasts = 1

# Syn flood protection
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 2048
net.ipv4.tcp_synack_retries = 2
net.ipv4.tcp_syn_retries = 5

# Time-wait assassination hazards protection
net.ipv4.tcp_rfc1337 = 1
EOF

sysctl -p

# File integrity monitoring
aide --init
mv /var/lib/aide/aide.db.new /var/lib/aide/aide.db

# Configure fail2ban
cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = 22
filter = sshd
logpath = /var/log/auth.log

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log

[nginx-noscript]
enabled = true
port = http,https
filter = nginx-noscript
logpath = /var/log/nginx/access.log
EOF

systemctl enable fail2ban
systemctl start fail2ban

# Audit configuration
cat > /etc/audit/rules.d/spinforge.rules << EOF
# Monitor user/group modifications
-w /etc/passwd -p wa -k passwd_changes
-w /etc/group -p wa -k group_changes
-w /etc/shadow -p wa -k shadow_changes

# Monitor sudo usage
-w /etc/sudoers -p wa -k sudoers_changes
-w /var/log/sudo.log -p wa -k sudo_usage

# Monitor SSH
-w /etc/ssh/sshd_config -p wa -k sshd_config

# Monitor system calls
-a always,exit -F arch=b64 -S execve -k exec_tracking
-a always,exit -F arch=b64 -S socket -S connect -k network_tracking
EOF

systemctl enable auditd
systemctl start auditd
```

#### 2. User Management

```bash
# Create restricted user for SpinForge
useradd -m -s /bin/bash -G docker spinforge
usermod -L spinforge  # Lock password

# Setup sudo rules
cat > /etc/sudoers.d/spinforge << EOF
# SpinForge service account
spinforge ALL=(ALL) NOPASSWD: /usr/bin/docker, /usr/bin/docker-compose
spinforge ALL=(ALL) NOPASSWD: /bin/systemctl restart spinforge
spinforge ALL=(ALL) NOPASSWD: /bin/systemctl stop spinforge
spinforge ALL=(ALL) NOPASSWD: /bin/systemctl start spinforge
EOF

# Regular security updates
cat > /etc/cron.daily/security-updates << 'EOF'
#!/bin/bash
apt-get update
apt-get upgrade -y
apt-get autoremove -y
apt-get autoclean

# Update security tools
freshclam  # ClamAV
rkhunter --update
EOF

chmod +x /etc/cron.daily/security-updates
```

### Docker Security

#### 1. Docker Daemon Configuration

```json
// /etc/docker/daemon.json
{
  "icc": false,
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "userland-proxy": false,
  "no-new-privileges": true,
  "selinux-enabled": true,
  "userns-remap": "default",
  "live-restore": true,
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Hard": 64000,
      "Soft": 64000
    }
  },
  "seccomp-profile": "/etc/docker/seccomp.json"
}
```

#### 2. Docker Compose Security

```yaml
version: '3.8'

services:
  spinhub:
    image: spinforge/hub:latest
    
    # Security options
    security_opt:
      - no-new-privileges:true
      - apparmor:docker-default
      - seccomp:seccomp-profile.json
    
    # Read-only root filesystem
    read_only: true
    tmpfs:
      - /tmp
      - /var/run
    
    # Drop capabilities
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
    
    # User namespace
    user: "1000:1000"
    
    # Resource limits
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          memory: 1G
    
    # Health check
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

#### 3. Image Security

```dockerfile
# Secure Dockerfile example
FROM node:20-alpine AS builder

# Install security updates
RUN apk update && apk upgrade

# Create non-root user
RUN addgroup -g 1001 app && \
    adduser -u 1001 -G app -s /bin/sh -D app

# Copy and build as root
WORKDIR /build
COPY package*.json ./
RUN npm ci --only=production && \
    npm audit fix

COPY --chown=app:app . .

# Final stage
FROM node:20-alpine

# Security updates
RUN apk update && \
    apk upgrade && \
    apk add --no-cache dumb-init && \
    rm -rf /var/cache/apk/*

# Create app user
RUN addgroup -g 1001 app && \
    adduser -u 1001 -G app -s /bin/sh -D app

# Copy from builder
WORKDIR /app
COPY --from=builder --chown=app:app /build/node_modules ./node_modules
COPY --from=builder --chown=app:app /build/dist ./dist

# Security settings
USER app
EXPOSE 3000

# Use dumb-init to handle signals
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
```

## Application Security

### Input Validation

```javascript
const validator = require('validator');
const xss = require('xss');

// Input validation middleware
const validateInput = (rules) => {
  return (req, res, next) => {
    const errors = {};
    
    for (const [field, rule] of Object.entries(rules)) {
      const value = req.body[field] || req.query[field] || req.params[field];
      
      // Required check
      if (rule.required && !value) {
        errors[field] = `${field} is required`;
        continue;
      }
      
      if (!value) continue;
      
      // Type validation
      if (rule.type === 'email' && !validator.isEmail(value)) {
        errors[field] = 'Invalid email format';
      }
      
      if (rule.type === 'url' && !validator.isURL(value, { require_protocol: true })) {
        errors[field] = 'Invalid URL format';
      }
      
      if (rule.type === 'uuid' && !validator.isUUID(value)) {
        errors[field] = 'Invalid UUID format';
      }
      
      // Length validation
      if (rule.minLength && value.length < rule.minLength) {
        errors[field] = `Minimum length is ${rule.minLength}`;
      }
      
      if (rule.maxLength && value.length > rule.maxLength) {
        errors[field] = `Maximum length is ${rule.maxLength}`;
      }
      
      // Pattern validation
      if (rule.pattern && !new RegExp(rule.pattern).test(value)) {
        errors[field] = `Invalid format for ${field}`;
      }
      
      // Sanitization
      if (rule.sanitize) {
        req.body[field] = xss(value);
      }
    }
    
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ errors });
    }
    
    next();
  };
};

// Usage
app.post('/api/deploy', 
  validateInput({
    domain: {
      required: true,
      type: 'domain',
      pattern: /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/,
      maxLength: 255
    },
    gitUrl: {
      required: false,
      type: 'url',
      pattern: /^https?:\/\/.+\.git$/
    },
    customerId: {
      required: true,
      type: 'uuid'
    }
  }),
  deployHandler
);
```

### SQL Injection Prevention

```javascript
// Use parameterized queries
const { Pool } = require('pg');
const pool = new Pool();

// Bad - SQL injection vulnerable
app.get('/users', async (req, res) => {
  const query = `SELECT * FROM users WHERE email = '${req.query.email}'`;
  const result = await pool.query(query);
  res.json(result.rows);
});

// Good - Parameterized query
app.get('/users', async (req, res) => {
  const query = 'SELECT * FROM users WHERE email = $1';
  const values = [req.query.email];
  const result = await pool.query(query, values);
  res.json(result.rows);
});

// Using query builder (Knex.js)
const knex = require('knex')({ client: 'pg', connection });

app.get('/users', async (req, res) => {
  const users = await knex('users')
    .where('email', req.query.email)
    .select('id', 'name', 'email');
  res.json(users);
});
```

### XSS Prevention

```javascript
// Content Security Policy
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' wss: https:; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self';"
  );
  next();
});

// HTML encoding
const escapeHtml = (text) => {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
};

// React (automatic escaping)
const UserProfile = ({ user }) => {
  return (
    <div>
      <h1>{user.name}</h1> {/* Automatically escaped */}
      <div dangerouslySetInnerHTML={{ __html: user.bio }} /> {/* Dangerous! */}
    </div>
  );
};
```

### CSRF Protection

```javascript
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });

// Apply CSRF protection
app.use(csrfProtection);

// Provide token to frontend
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Frontend usage
async function makeRequest(url, data) {
  const { csrfToken } = await fetch('/api/csrf-token').then(r => r.json());
  
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken
    },
    body: JSON.stringify(data),
    credentials: 'include'
  });
}
```

## Authentication & Authorization

### JWT Implementation

```javascript
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

class AuthService {
  constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET;
    this.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
  }
  
  async generateTokens(userId) {
    const accessToken = jwt.sign(
      { userId, type: 'access' },
      this.JWT_SECRET,
      { expiresIn: '15m' }
    );
    
    const refreshToken = jwt.sign(
      { userId, type: 'refresh' },
      this.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );
    
    // Store refresh token hash in database
    const hashedToken = await bcrypt.hash(refreshToken, 10);
    await this.storeRefreshToken(userId, hashedToken);
    
    return { accessToken, refreshToken };
  }
  
  async verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET);
      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }
      return decoded;
    } catch (error) {
      throw new Error('Invalid access token');
    }
  }
  
  async refreshTokens(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, this.JWT_REFRESH_SECRET);
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }
      
      // Verify token exists in database
      const isValid = await this.verifyRefreshToken(decoded.userId, refreshToken);
      if (!isValid) {
        throw new Error('Invalid refresh token');
      }
      
      // Generate new tokens
      return this.generateTokens(decoded.userId);
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }
  
  async revokeRefreshToken(userId, token) {
    await this.removeRefreshToken(userId, token);
  }
}

// Authentication middleware
const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = await authService.verifyAccessToken(token);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
```

### Role-Based Access Control (RBAC)

```javascript
class RBACService {
  constructor() {
    this.roles = {
      admin: {
        permissions: ['*']
      },
      developer: {
        permissions: [
          'apps:create',
          'apps:read:own',
          'apps:update:own',
          'apps:delete:own',
          'metrics:read:own'
        ]
      },
      viewer: {
        permissions: [
          'apps:read',
          'metrics:read'
        ]
      }
    };
  }
  
  hasPermission(userRole, permission, context = {}) {
    const role = this.roles[userRole];
    if (!role) return false;
    
    // Admin has all permissions
    if (role.permissions.includes('*')) return true;
    
    // Check exact permission
    if (role.permissions.includes(permission)) return true;
    
    // Check ownership-based permissions
    const ownPermission = permission.replace(':own', '');
    if (role.permissions.includes(`${ownPermission}:own`)) {
      return context.userId === context.resourceOwnerId;
    }
    
    // Check wildcard permissions
    const [resource, action] = permission.split(':');
    if (role.permissions.includes(`${resource}:*`)) return true;
    
    return false;
  }
}

// Authorization middleware
const authorize = (permission) => {
  return async (req, res, next) => {
    const user = await getUserById(req.userId);
    
    const context = {
      userId: req.userId,
      resourceOwnerId: req.params.ownerId || req.body.ownerId
    };
    
    if (!rbac.hasPermission(user.role, permission, context)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
};

// Usage
app.get('/api/apps', authenticate, authorize('apps:read'), getApps);
app.post('/api/apps', authenticate, authorize('apps:create'), createApp);
app.delete('/api/apps/:id', authenticate, authorize('apps:delete:own'), deleteApp);
```

### OAuth2 Integration

```javascript
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;

// Google OAuth
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await findUserByEmail(profile.emails[0].value);
    
    if (!user) {
      user = await createUser({
        email: profile.emails[0].value,
        name: profile.displayName,
        provider: 'google',
        providerId: profile.id
      });
    }
    
    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
}));

// GitHub OAuth
passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: "/auth/github/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await findUserByEmail(profile.emails[0].value);
    
    if (!user) {
      user = await createUser({
        email: profile.emails[0].value,
        name: profile.displayName,
        provider: 'github',
        providerId: profile.id,
        githubToken: accessToken // Store for API access
      });
    }
    
    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
}));

// Routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }));

app.get('/auth/:provider/callback', (req, res, next) => {
  passport.authenticate(req.params.provider, async (err, user) => {
    if (err || !user) {
      return res.redirect('/login?error=auth_failed');
    }
    
    // Generate JWT tokens
    const { accessToken, refreshToken } = await authService.generateTokens(user.id);
    
    // Set secure cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });
    
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    res.redirect('/dashboard');
  })(req, res, next);
});
```

## Data Security

### Encryption at Rest

```javascript
const crypto = require('crypto');

class EncryptionService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  }
  
  encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }
  
  decrypt(encryptedData) {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(encryptedData.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

// Encrypt sensitive data before storage
const storeSecret = async (name, value) => {
  const encrypted = encryptionService.encrypt(value);
  await db.query(
    'INSERT INTO secrets (name, encrypted_value, iv, auth_tag) VALUES ($1, $2, $3, $4)',
    [name, encrypted.encrypted, encrypted.iv, encrypted.authTag]
  );
};

// Decrypt on retrieval
const getSecret = async (name) => {
  const result = await db.query(
    'SELECT encrypted_value, iv, auth_tag FROM secrets WHERE name = $1',
    [name]
  );
  
  if (result.rows.length === 0) return null;
  
  const { encrypted_value, iv, auth_tag } = result.rows[0];
  return encryptionService.decrypt({
    encrypted: encrypted_value,
    iv,
    authTag: auth_tag
  });
};
```

### Secrets Management

```javascript
// Vault integration
const Vault = require('node-vault');

class SecretsManager {
  constructor() {
    this.vault = Vault({
      endpoint: process.env.VAULT_ADDR,
      token: process.env.VAULT_TOKEN
    });
  }
  
  async getSecret(path) {
    try {
      const result = await this.vault.read(`secret/data/${path}`);
      return result.data.data;
    } catch (error) {
      console.error(`Failed to retrieve secret: ${path}`);
      throw error;
    }
  }
  
  async setSecret(path, data) {
    try {
      await this.vault.write(`secret/data/${path}`, { data });
    } catch (error) {
      console.error(`Failed to store secret: ${path}`);
      throw error;
    }
  }
  
  async rotateSecret(path, generator) {
    const newSecret = await generator();
    await this.setSecret(path, newSecret);
    return newSecret;
  }
}

// Environment variable injection
const injectSecrets = async () => {
  const secrets = await secretsManager.getSecret('spinforge/env');
  
  Object.entries(secrets).forEach(([key, value]) => {
    process.env[key] = value;
  });
};

// Kubernetes secrets
apiVersion: v1
kind: Secret
metadata:
  name: spinforge-secrets
type: Opaque
data:
  jwt-secret: <base64-encoded-secret>
  db-password: <base64-encoded-password>
  encryption-key: <base64-encoded-key>
```

### Data Privacy

```javascript
// PII anonymization
class PIIService {
  anonymizeEmail(email) {
    const [local, domain] = email.split('@');
    const anonymized = local.substring(0, 2) + '***' + local.slice(-1);
    return `${anonymized}@${domain}`;
  }
  
  anonymizeIP(ip) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      // IPv4
      return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
    } else {
      // IPv6
      const parts = ip.split(':');
      return parts.slice(0, 4).join(':') + '::';
    }
  }
  
  hashUserId(userId) {
    return crypto
      .createHash('sha256')
      .update(userId + process.env.USER_SALT)
      .digest('hex');
  }
}

// GDPR compliance
class GDPRService {
  async exportUserData(userId) {
    const userData = {
      profile: await this.getProfile(userId),
      applications: await this.getApplications(userId),
      logs: await this.getLogs(userId),
      metrics: await this.getMetrics(userId)
    };
    
    return {
      data: userData,
      exportDate: new Date().toISOString(),
      format: 'json'
    };
  }
  
  async deleteUserData(userId) {
    // Start transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Delete in correct order (foreign key constraints)
      await client.query('DELETE FROM logs WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM metrics WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM applications WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM users WHERE id = $1', [userId]);
      
      await client.query('COMMIT');
      
      // Also remove from cache
      await redis.del(`user:${userId}:*`);
      
      return { success: true, deletedAt: new Date().toISOString() };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
```

## Network Security

### TLS Configuration

```nginx
# NGINX SSL configuration
server {
    listen 443 ssl http2;
    server_name spinforge.example.com;
    
    # SSL certificates
    ssl_certificate /etc/ssl/certs/spinforge.crt;
    ssl_certificate_key /etc/ssl/private/spinforge.key;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # OCSP stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/ssl/certs/spinforge-ca.crt;
    
    # SSL session
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
}
```

### API Gateway Security

```javascript
// Rate limiting by IP and API key
const RateLimiter = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');

const createRateLimiter = (options) => {
  return new RateLimiter({
    store: new RedisStore({
      client: redis,
      prefix: 'rl:'
    }),
    keyGenerator: (req) => {
      // Rate limit by API key if present, otherwise by IP
      if (req.headers['x-api-key']) {
        return `apikey:${req.headers['x-api-key']}`;
      }
      return req.ip;
    },
    handler: (req, res) => {
      res.status(429).json({
        error: 'Too many requests',
        retryAfter: req.rateLimit.resetTime
      });
    },
    ...options
  });
};

// Different limits for different endpoints
app.use('/api/auth', createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5 // 5 requests per window
}));

app.use('/api/', createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100 // 100 requests per minute
}));

// DDoS protection
const ddosProtection = (req, res, next) => {
  const requestSize = parseInt(req.headers['content-length'] || '0');
  
  // Block suspiciously large requests
  if (requestSize > 10 * 1024 * 1024) { // 10MB
    return res.status(413).json({ error: 'Request too large' });
  }
  
  // Block requests with too many headers
  if (Object.keys(req.headers).length > 50) {
    return res.status(400).json({ error: 'Too many headers' });
  }
  
  next();
};
```

### Firewall Rules

```bash
#!/bin/bash
# iptables configuration

# Flush existing rules
iptables -F
iptables -X

# Default policies
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT ACCEPT

# Allow loopback
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

# Allow established connections
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow SSH (restrict to specific IPs in production)
iptables -A INPUT -p tcp --dport 22 -s 10.0.0.0/8 -j ACCEPT

# Allow HTTP/HTTPS
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Rate limiting
iptables -A INPUT -p tcp --dport 80 -m state --state NEW -m limit --limit 50/minute --limit-burst 200 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -m state --state NEW -m limit --limit 50/minute --limit-burst 200 -j ACCEPT

# DDoS protection
iptables -A INPUT -p tcp --dport 80 -m connlimit --connlimit-above 20 -j REJECT
iptables -A INPUT -p tcp --dport 443 -m connlimit --connlimit-above 20 -j REJECT

# SYN flood protection
iptables -A INPUT -p tcp --syn -m limit --limit 1/s --limit-burst 3 -j RETURN

# Port scanning protection
iptables -N PORT_SCANNING
iptables -A PORT_SCANNING -p tcp --tcp-flags SYN,ACK,FIN,RST RST -m limit --limit 1/s --limit-burst 2 -j RETURN
iptables -A PORT_SCANNING -j DROP

# Save rules
iptables-save > /etc/iptables/rules.v4
```

## Container Security

### Runtime Security

```javascript
// Seccomp profile
{
  "defaultAction": "SCMP_ACT_ERRNO",
  "architectures": [
    "SCMP_ARCH_X86_64",
    "SCMP_ARCH_X86",
    "SCMP_ARCH_X32"
  ],
  "syscalls": [
    {
      "names": [
        "accept",
        "accept4",
        "access",
        "bind",
        "brk",
        "capget",
        "capset",
        "chdir",
        "chmod",
        "chown",
        "clock_getres",
        "clock_gettime",
        "clock_nanosleep",
        "close",
        "connect",
        "copy_file_range",
        "creat",
        "dup",
        "dup2",
        "dup3",
        "epoll_create",
        "epoll_create1",
        "epoll_ctl",
        "epoll_ctl_old",
        "epoll_pwait",
        "epoll_wait",
        "epoll_wait_old",
        "eventfd",
        "eventfd2",
        "execve",
        "execveat",
        "exit",
        "exit_group",
        "faccessat",
        "fadvise64",
        "fallocate",
        "fanotify_mark",
        "fchdir",
        "fchmod",
        "fchmodat",
        "fchown",
        "fchown32",
        "fchownat",
        "fcntl",
        "fcntl64",
        "fdatasync",
        "fgetxattr",
        "flistxattr",
        "flock",
        "fork",
        "fremovexattr",
        "fsetxattr",
        "fstat",
        "fstat64",
        "fstatat64",
        "fstatfs",
        "fstatfs64",
        "fsync",
        "ftruncate",
        "ftruncate64",
        "futex",
        "futimesat",
        "get_robust_list",
        "get_thread_area",
        "getcpu",
        "getcwd",
        "getdents",
        "getdents64",
        "getegid",
        "getegid32",
        "geteuid",
        "geteuid32",
        "getgid",
        "getgid32",
        "getgroups",
        "getgroups32",
        "getitimer",
        "getpeername",
        "getpgid",
        "getpgrp",
        "getpid",
        "getppid",
        "getpriority",
        "getrandom",
        "getresgid",
        "getresgid32",
        "getresuid",
        "getresuid32",
        "getrlimit",
        "getrusage",
        "getsid",
        "getsockname",
        "getsockopt",
        "gettid",
        "gettimeofday",
        "getuid",
        "getuid32",
        "getxattr",
        "inotify_add_watch",
        "inotify_init",
        "inotify_init1",
        "inotify_rm_watch",
        "io_cancel",
        "io_destroy",
        "io_getevents",
        "io_setup",
        "io_submit",
        "ioctl",
        "ioprio_get",
        "ioprio_set",
        "ipc",
        "kill",
        "lchown",
        "lchown32",
        "lgetxattr",
        "link",
        "linkat",
        "listen",
        "listxattr",
        "llistxattr",
        "lremovexattr",
        "lseek",
        "lsetxattr",
        "lstat",
        "lstat64",
        "madvise",
        "memfd_create",
        "mincore",
        "mkdir",
        "mkdirat",
        "mknod",
        "mknodat",
        "mlock",
        "mlock2",
        "mlockall",
        "mmap",
        "mmap2",
        "mprotect",
        "mq_getsetattr",
        "mq_notify",
        "mq_open",
        "mq_timedreceive",
        "mq_timedsend",
        "mq_unlink",
        "mremap",
        "msgctl",
        "msgget",
        "msgrcv",
        "msgsnd",
        "msync",
        "munlock",
        "munlockall",
        "munmap",
        "nanosleep",
        "newfstatat",
        "open",
        "openat",
        "pause",
        "pipe",
        "pipe2",
        "poll",
        "ppoll",
        "prctl",
        "pread64",
        "preadv",
        "preadv2",
        "prlimit64",
        "pselect6",
        "pwrite64",
        "pwritev",
        "pwritev2",
        "read",
        "readahead",
        "readlink",
        "readlinkat",
        "readv",
        "recv",
        "recvfrom",
        "recvmmsg",
        "recvmsg",
        "remap_file_pages",
        "removexattr",
        "rename",
        "renameat",
        "renameat2",
        "restart_syscall",
        "rmdir",
        "rt_sigaction",
        "rt_sigpending",
        "rt_sigprocmask",
        "rt_sigqueueinfo",
        "rt_sigreturn",
        "rt_sigsuspend",
        "rt_sigtimedwait",
        "rt_tgsigqueueinfo",
        "sched_get_priority_max",
        "sched_get_priority_min",
        "sched_getaffinity",
        "sched_getattr",
        "sched_getparam",
        "sched_getscheduler",
        "sched_rr_get_interval",
        "sched_setaffinity",
        "sched_setattr",
        "sched_setparam",
        "sched_setscheduler",
        "sched_yield",
        "seccomp",
        "select",
        "semctl",
        "semget",
        "semop",
        "semtimedop",
        "send",
        "sendfile",
        "sendfile64",
        "sendmmsg",
        "sendmsg",
        "sendto",
        "set_robust_list",
        "set_thread_area",
        "set_tid_address",
        "setdomainname",
        "setfsgid",
        "setfsgid32",
        "setfsuid",
        "setfsuid32",
        "setgid",
        "setgid32",
        "setgroups",
        "setgroups32",
        "sethostname",
        "setitimer",
        "setpgid",
        "setpriority",
        "setregid",
        "setregid32",
        "setresgid",
        "setresgid32",
        "setresuid",
        "setresuid32",
        "setreuid",
        "setreuid32",
        "setrlimit",
        "setsid",
        "setsockopt",
        "setuid",
        "setuid32",
        "setxattr",
        "shmat",
        "shmctl",
        "shmdt",
        "shmget",
        "shutdown",
        "sigaltstack",
        "signalfd",
        "signalfd4",
        "sigreturn",
        "socket",
        "socketcall",
        "socketpair",
        "splice",
        "stat",
        "stat64",
        "statfs",
        "statfs64",
        "statx",
        "symlink",
        "symlinkat",
        "sync",
        "sync_file_range",
        "syncfs",
        "sysinfo",
        "syslog",
        "tee",
        "tgkill",
        "time",
        "timer_create",
        "timer_delete",
        "timer_getoverrun",
        "timer_gettime",
        "timer_settime",
        "timerfd_create",
        "timerfd_gettime",
        "timerfd_settime",
        "times",
        "tkill",
        "truncate",
        "truncate64",
        "ugetrlimit",
        "umask",
        "uname",
        "unlink",
        "unlinkat",
        "utime",
        "utimensat",
        "utimes",
        "vfork",
        "vmsplice",
        "wait4",
        "waitid",
        "waitpid",
        "write",
        "writev"
      ],
      "action": "SCMP_ACT_ALLOW"
    }
  ]
}
```

### Image Scanning

```yaml
# GitLab CI/CD with container scanning
stages:
  - build
  - scan
  - deploy

variables:
  DOCKER_DRIVER: overlay2
  DOCKER_TLS_CERTDIR: ""

build:
  stage: build
  script:
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA

container_scanning:
  stage: scan
  image: registry.gitlab.com/gitlab-org/security-products/analyzers/klar:latest
  variables:
    CLAIR_DB_IMAGE_TAG: "latest"
    CLAIR_DB_IMAGE: "arminc/clair-db"
    DOCKERFILE_PATH: "Dockerfile"
    GIT_STRATEGY: fetch
  script:
    - /analyzer run
  artifacts:
    reports:
      container_scanning: gl-container-scanning-report.json

trivy_scan:
  stage: scan
  image: aquasec/trivy:latest
  script:
    - trivy image --exit-code 1 --severity HIGH,CRITICAL $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
  allow_failure: false

deploy:
  stage: deploy
  script:
    - docker pull $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
    - docker tag $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA $CI_REGISTRY_IMAGE:latest
    - docker push $CI_REGISTRY_IMAGE:latest
  only:
    - main
```

## Security Monitoring

### Audit Logging

```javascript
class AuditLogger {
  constructor(elasticsearch) {
    this.es = elasticsearch;
    this.index = 'spinforge-audit';
  }
  
  async log(event) {
    const auditEvent = {
      timestamp: new Date().toISOString(),
      eventType: event.type,
      userId: event.userId,
      userEmail: event.userEmail,
      userRole: event.userRole,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      resource: event.resource,
      action: event.action,
      result: event.result,
      metadata: event.metadata,
      requestId: event.requestId,
      sessionId: event.sessionId,
      ...event
    };
    
    // Log to Elasticsearch
    await this.es.index({
      index: this.index,
      body: auditEvent
    });
    
    // Also log critical events to separate system
    if (this.isCriticalEvent(event)) {
      await this.logCriticalEvent(auditEvent);
    }
  }
  
  isCriticalEvent(event) {
    const criticalEvents = [
      'auth.failed',
      'auth.suspicious',
      'permission.denied',
      'data.export',
      'data.delete',
      'config.change',
      'security.alert'
    ];
    
    return criticalEvents.includes(event.type);
  }
  
  async query(filters, options = {}) {
    const query = {
      bool: {
        must: []
      }
    };
    
    if (filters.userId) {
      query.bool.must.push({ term: { userId: filters.userId } });
    }
    
    if (filters.eventType) {
      query.bool.must.push({ term: { eventType: filters.eventType } });
    }
    
    if (filters.dateRange) {
      query.bool.must.push({
        range: {
          timestamp: {
            gte: filters.dateRange.from,
            lte: filters.dateRange.to
          }
        }
      });
    }
    
    const response = await this.es.search({
      index: this.index,
      body: {
        query,
        sort: [{ timestamp: { order: 'desc' } }],
        size: options.limit || 100,
        from: options.offset || 0
      }
    });
    
    return response.hits;
  }
}

// Audit middleware
const audit = (action, resource) => {
  return async (req, res, next) => {
    const auditEvent = {
      type: `${resource}.${action}`,
      userId: req.userId,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      resource,
      action,
      requestId: req.id,
      sessionId: req.sessionId,
      metadata: {
        method: req.method,
        path: req.path,
        query: req.query,
        body: sanitizeBody(req.body)
      }
    };
    
    // Log before action
    auditEvent.result = 'pending';
    await auditLogger.log(auditEvent);
    
    // Capture response
    const originalSend = res.send;
    res.send = function(data) {
      auditEvent.result = res.statusCode < 400 ? 'success' : 'failure';
      auditEvent.responseCode = res.statusCode;
      auditLogger.log(auditEvent);
      
      originalSend.call(this, data);
    };
    
    next();
  };
};
```

### Intrusion Detection

```javascript
class IntrusionDetector {
  constructor() {
    this.patterns = {
      sqlInjection: [
        /(\b(union|select|insert|update|delete|drop|create)\b.*\b(from|where|table)\b)/i,
        /(';|';|--|\\x27|\\x22|\\x5c)/,
        /(\b(or|and)\b\s*\d+\s*=\s*\d+)/i
      ],
      xss: [
        /<script[^>]*>.*?<\/script>/gi,
        /(javascript|vbscript|onload|onerror|onclick|onmouseover):/i,
        /<iframe|<object|<embed/i
      ],
      pathTraversal: [
        /\.\.[\/\\]/,
        /%2e%2e[\/\\]/i,
        /\.\.%2f|\.\.%5c/i
      ],
      commandInjection: [
        /(\||;|&|`|\$\(|\))/,
        /(nc|netcat|bash|sh|cmd|powershell)\s/i
      ]
    };
    
    this.thresholds = {
      failedLogins: { count: 5, window: 300 }, // 5 in 5 minutes
      requestRate: { count: 1000, window: 60 }, // 1000 in 1 minute
      errorRate: { count: 50, window: 60 } // 50 errors in 1 minute
    };
  }
  
  async checkRequest(req) {
    const threats = [];
    
    // Check patterns
    const input = JSON.stringify({
      body: req.body,
      query: req.query,
      params: req.params,
      headers: req.headers
    });
    
    for (const [type, patterns] of Object.entries(this.patterns)) {
      for (const pattern of patterns) {
        if (pattern.test(input)) {
          threats.push({
            type,
            pattern: pattern.toString(),
            matched: input.match(pattern)[0]
          });
        }
      }
    }
    
    // Check behavior
    const behaviorThreats = await this.checkBehavior(req);
    threats.push(...behaviorThreats);
    
    if (threats.length > 0) {
      await this.handleThreats(req, threats);
    }
    
    return threats;
  }
  
  async checkBehavior(req) {
    const threats = [];
    const key = `behavior:${req.ip}`;
    
    // Check failed login attempts
    if (req.path === '/login' && req.method === 'POST') {
      const attempts = await redis.incr(`${key}:failed_logins`);
      await redis.expire(`${key}:failed_logins`, this.thresholds.failedLogins.window);
      
      if (attempts > this.thresholds.failedLogins.count) {
        threats.push({
          type: 'brute_force',
          details: `${attempts} failed login attempts`
        });
      }
    }
    
    // Check request rate
    const requests = await redis.incr(`${key}:requests`);
    await redis.expire(`${key}:requests`, this.thresholds.requestRate.window);
    
    if (requests > this.thresholds.requestRate.count) {
      threats.push({
        type: 'rate_limit_abuse',
        details: `${requests} requests in ${this.thresholds.requestRate.window}s`
      });
    }
    
    return threats;
  }
  
  async handleThreats(req, threats) {
    // Log threat
    await auditLogger.log({
      type: 'security.threat_detected',
      threats,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      path: req.path,
      method: req.method
    });
    
    // Block IP for severe threats
    const severeThreats = ['sql_injection', 'command_injection', 'brute_force'];
    if (threats.some(t => severeThreats.includes(t.type))) {
      await this.blockIP(req.ip, 3600); // 1 hour
    }
    
    // Alert security team
    if (threats.length > 3 || threats.some(t => t.type === 'brute_force')) {
      await this.alertSecurityTeam(req, threats);
    }
  }
  
  async blockIP(ip, duration) {
    await redis.setex(`blocked:${ip}`, duration, 'true');
    
    // Add to firewall
    exec(`iptables -A INPUT -s ${ip} -j DROP`, (error) => {
      if (error) console.error('Failed to block IP:', error);
    });
    
    // Schedule unblock
    setTimeout(() => {
      exec(`iptables -D INPUT -s ${ip} -j DROP`, (error) => {
        if (error) console.error('Failed to unblock IP:', error);
      });
    }, duration * 1000);
  }
}

// IDS middleware
const ids = async (req, res, next) => {
  // Check if IP is blocked
  const blocked = await redis.get(`blocked:${req.ip}`);
  if (blocked) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  // Check for threats
  const threats = await intrusionDetector.checkRequest(req);
  
  if (threats.length > 0) {
    // Log and potentially block
    return res.status(400).json({ error: 'Suspicious request detected' });
  }
  
  next();
};
```

## Incident Response

### Incident Response Plan

```javascript
class IncidentResponse {
  constructor() {
    this.severity = {
      CRITICAL: 1, // Data breach, system compromise
      HIGH: 2,     // Failed intrusion attempt, vulnerabilities
      MEDIUM: 3,   // Policy violations, suspicious activity
      LOW: 4       // Minor issues, false positives
    };
    
    this.responseTeam = {
      security: ['security@spinforge.io'],
      engineering: ['engineering@spinforge.io'],
      management: ['cto@spinforge.io', 'ciso@spinforge.io']
    };
  }
  
  async handleIncident(incident) {
    // 1. Identification
    const severity = this.assessSeverity(incident);
    const incidentId = await this.createIncident(incident, severity);
    
    // 2. Containment
    if (severity <= this.severity.HIGH) {
      await this.containThreat(incident);
    }
    
    // 3. Notification
    await this.notifyTeam(incident, severity);
    
    // 4. Investigation
    const investigation = await this.investigate(incident);
    
    // 5. Eradication
    if (investigation.threatConfirmed) {
      await this.eradicateThreat(investigation);
    }
    
    // 6. Recovery
    await this.recover(incident);
    
    // 7. Lessons Learned
    await this.documentIncident(incidentId, investigation);
    
    return incidentId;
  }
  
  assessSeverity(incident) {
    if (incident.type === 'data_breach' || incident.type === 'system_compromise') {
      return this.severity.CRITICAL;
    }
    
    if (incident.type === 'intrusion_attempt' || incident.type === 'vulnerability_exploit') {
      return this.severity.HIGH;
    }
    
    if (incident.type === 'policy_violation' || incident.type === 'suspicious_activity') {
      return this.severity.MEDIUM;
    }
    
    return this.severity.LOW;
  }
  
  async containThreat(incident) {
    const actions = [];
    
    // Block source IPs
    if (incident.sourceIPs) {
      for (const ip of incident.sourceIPs) {
        await this.blockIP(ip);
        actions.push(`Blocked IP: ${ip}`);
      }
    }
    
    // Disable compromised accounts
    if (incident.compromisedUsers) {
      for (const userId of incident.compromisedUsers) {
        await this.disableUser(userId);
        actions.push(`Disabled user: ${userId}`);
      }
    }
    
    // Isolate affected systems
    if (incident.affectedSystems) {
      for (const system of incident.affectedSystems) {
        await this.isolateSystem(system);
        actions.push(`Isolated system: ${system}`);
      }
    }
    
    return actions;
  }
  
  async notifyTeam(incident, severity) {
    const teams = [];
    
    if (severity <= this.severity.HIGH) {
      teams.push(...this.responseTeam.security);
      teams.push(...this.responseTeam.management);
    }
    
    if (severity <= this.severity.MEDIUM) {
      teams.push(...this.responseTeam.engineering);
    }
    
    const notification = {
      subject: `[${this.getSeverityName(severity)}] Security Incident: ${incident.type}`,
      body: this.formatIncidentNotification(incident, severity),
      priority: severity <= this.severity.HIGH ? 'urgent' : 'normal'
    };
    
    // Send notifications
    await this.sendNotifications(teams, notification);
    
    // Create incident ticket
    await this.createTicket(incident, severity);
  }
  
  async investigate(incident) {
    const investigation = {
      logs: await this.collectLogs(incident),
      forensics: await this.collectForensics(incident),
      timeline: await this.buildTimeline(incident),
      indicators: await this.extractIOCs(incident),
      impact: await this.assessImpact(incident)
    };
    
    // Analyze data
    investigation.analysis = await this.analyzeIncident(investigation);
    investigation.threatConfirmed = investigation.analysis.confidence > 0.8;
    
    return investigation;
  }
  
  async collectLogs(incident) {
    const timeRange = {
      from: new Date(incident.detectedAt - 3600000), // 1 hour before
      to: new Date(incident.detectedAt + 3600000)    // 1 hour after
    };
    
    return {
      application: await this.getApplicationLogs(timeRange),
      system: await this.getSystemLogs(timeRange),
      security: await this.getSecurityLogs(timeRange),
      network: await this.getNetworkLogs(timeRange)
    };
  }
}

// Automated response
const automatedResponse = async (threat) => {
  const response = new IncidentResponse();
  
  // Immediate actions
  if (threat.type === 'active_attack') {
    // Enable emergency mode
    await redis.set('emergency_mode', 'true');
    
    // Increase security measures
    await redis.set('rate_limit_multiplier', '0.1'); // 10x stricter
    
    // Alert team immediately
    await response.notifyTeam(threat, response.severity.CRITICAL);
  }
  
  // Start incident response
  const incidentId = await response.handleIncident(threat);
  
  return incidentId;
};
```

## Compliance

### GDPR Compliance

```javascript
class GDPRCompliance {
  constructor() {
    this.consentTypes = {
      NECESSARY: 'necessary',
      FUNCTIONAL: 'functional',
      ANALYTICS: 'analytics',
      MARKETING: 'marketing'
    };
  }
  
  async recordConsent(userId, consents) {
    const record = {
      userId,
      timestamp: new Date().toISOString(),
      consents,
      ipAddress: this.anonymizeIP(req.ip),
      userAgent: req.headers['user-agent']
    };
    
    await db.query(
      'INSERT INTO consent_records (user_id, consents, metadata) VALUES ($1, $2, $3)',
      [userId, JSON.stringify(consents), JSON.stringify(record)]
    );
    
    // Update user preferences
    await this.updateUserPreferences(userId, consents);
  }
  
  async checkConsent(userId, consentType) {
    const result = await db.query(
      'SELECT consents FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) return false;
    
    const consents = result.rows[0].consents || {};
    return consents[consentType] === true;
  }
  
  async exportUserData(userId) {
    const data = {};
    
    // Profile data
    data.profile = await db.query(
      'SELECT id, email, name, created_at FROM users WHERE id = $1',
      [userId]
    );
    
    // Application data
    data.applications = await db.query(
      'SELECT * FROM applications WHERE user_id = $1',
      [userId]
    );
    
    // Activity logs (anonymized)
    data.activity = await db.query(
      'SELECT timestamp, action, metadata FROM activity_logs WHERE user_id = $1',
      [userId]
    );
    
    // Consent records
    data.consents = await db.query(
      'SELECT * FROM consent_records WHERE user_id = $1',
      [userId]
    );
    
    return {
      exportDate: new Date().toISOString(),
      data: this.sanitizeExport(data),
      format: 'json',
      checksum: this.calculateChecksum(data)
    };
  }
  
  async deleteUserData(userId) {
    const transaction = await db.beginTransaction();
    
    try {
      // Delete in order (foreign key constraints)
      await transaction.query('DELETE FROM activity_logs WHERE user_id = $1', [userId]);
      await transaction.query('DELETE FROM applications WHERE user_id = $1', [userId]);
      await transaction.query('DELETE FROM consent_records WHERE user_id = $1', [userId]);
      await transaction.query('DELETE FROM users WHERE id = $1', [userId]);
      
      await transaction.commit();
      
      // Audit log
      await auditLogger.log({
        type: 'gdpr.data_deletion',
        userId,
        timestamp: new Date().toISOString(),
        result: 'success'
      });
      
      return { success: true };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

// GDPR middleware
const gdprCompliant = (consentType) => {
  return async (req, res, next) => {
    if (!req.userId) return next();
    
    const hasConsent = await gdprCompliance.checkConsent(req.userId, consentType);
    
    if (!hasConsent && consentType !== gdprCompliance.consentTypes.NECESSARY) {
      return res.status(451).json({
        error: 'Consent required',
        consentType,
        message: 'This feature requires your consent'
      });
    }
    
    next();
  };
};
```

### Security Headers

```javascript
// Comprehensive security headers
app.use((req, res, next) => {
  // HSTS
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );
  
  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "connect-src 'self' wss: https:; " +
    "media-src 'self'; " +
    "object-src 'none'; " +
    "frame-src 'self'; " +
    "base-uri 'self'; " +
    "form-action 'self'; " +
    "frame-ancestors 'none'; " +
    "upgrade-insecure-requests;"
  );
  
  // Other security headers
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
  );
  
  // Remove fingerprinting headers
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  
  next();
});
```

## Security Checklist

### Development
- [ ] Input validation on all endpoints
- [ ] Output encoding for XSS prevention
- [ ] Parameterized queries for database access
- [ ] Strong authentication mechanisms
- [ ] Proper authorization checks
- [ ] Secure session management
- [ ] CSRF protection
- [ ] Security headers implemented
- [ ] Error handling without information leakage
- [ ] Secure configuration management

### Infrastructure
- [ ] OS hardening applied
- [ ] Firewall rules configured
- [ ] SSL/TLS properly configured
- [ ] Regular security updates
- [ ] Intrusion detection system
- [ ] Log aggregation and monitoring
- [ ] Backup and recovery procedures
- [ ] Incident response plan
- [ ] Access control and audit logs
- [ ] Network segmentation

### Container Security
- [ ] Base images scanned and updated
- [ ] Non-root user in containers
- [ ] Read-only root filesystem
- [ ] Capabilities dropped
- [ ] Seccomp profiles applied
- [ ] Resource limits set
- [ ] Health checks implemented
- [ ] Secrets management
- [ ] Image signing
- [ ] Runtime protection

### Compliance
- [ ] GDPR compliance measures
- [ ] Data encryption at rest and in transit
- [ ] Privacy policy implemented
- [ ] Consent management
- [ ] Data retention policies
- [ ] Right to erasure functionality
- [ ] Data portability features
- [ ] Breach notification procedures
- [ ] Regular compliance audits
- [ ] Security training for team

Remember: Security is not a one-time task but an ongoing process. Regular reviews, updates, and training are essential for maintaining a secure platform.