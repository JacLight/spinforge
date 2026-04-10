/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

class AdminService {
  constructor(redis, tokenSecret = 'spinforge-admin-secret', sessionTimeout = 86400) {
    this.redis = redis;
    this.tokenSecret = process.env.ADMIN_TOKEN_SECRET || tokenSecret;
    this.sessionTimeout = sessionTimeout; // 24 hours
  }

  /**
   * On first boot only (no admins in Redis), seed a single super-admin from
   * the arguments passed in — which in production come from the env file
   * (ADMIN_USERNAME / ADMIN_PASSWORD / ADMIN_EMAIL). If any of those are
   * missing we fall back to safe defaults so the bootstrap never silently
   * fails, but a warning is logged. Once an admin exists in Redis, this
   * function becomes a no-op — subsequent login and token validation go
   * through the database, not the env file.
   */
  async initializeDefaultAdmin(username, password, email) {
    const admins = await this.getAllAdmins();
    if (admins.length > 0) {
      // Admin already exists in the database — never overwrite from env.
      return;
    }

    const seedUsername = username || 'admin';
    const seedPassword = password || 'admin123';
    const seedEmail = email || 'admin@spinforge.local';

    if (!username || !password) {
      console.warn(
        '[AdminService] No ADMIN_USERNAME/ADMIN_PASSWORD in env — seeding with insecure defaults. Set them in .env before exposing this instance.'
      );
    }

    await this.createAdmin({
      username: seedUsername,
      password: seedPassword,
      email: seedEmail,
      isSuperAdmin: true,
    });
    console.log(`[AdminService] Bootstrap admin created from env: ${seedUsername}`);
  }

  async createAdmin(data) {
    const id = 'admin_' + crypto.randomBytes(16).toString('hex');
    const hashedPassword = await bcrypt.hash(data.password, 10);
    
    const admin = {
      id,
      username: data.username,
      password: hashedPassword,
      email: data.email,
      createdAt: new Date().toISOString(),
      isActive: true,
      isSuperAdmin: data.isSuperAdmin || false,
    };

    await this.redis.set(`admin:${id}`, JSON.stringify(admin));
    await this.redis.sAdd('admins', id);
    await this.redis.set(`admin:username:${data.username}`, id);

    return { ...admin, password: undefined }; // Don't return hashed password
  }

  async login(username, password) {
    const adminId = await this.redis.get(`admin:username:${username}`);
    if (!adminId) return null;

    const adminData = await this.redis.get(`admin:${adminId}`);
    if (!adminData) return null;

    const admin = JSON.parse(adminData);
    if (!admin.isActive) return null;

    const isValid = await bcrypt.compare(password, admin.password);
    if (!isValid) return null;

    // Update last login
    admin.lastLogin = new Date().toISOString();
    await this.redis.set(`admin:${adminId}`, JSON.stringify(admin));

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: admin.id, 
        username: admin.username,
        isSuperAdmin: admin.isSuperAdmin 
      },
      this.tokenSecret,
      { expiresIn: this.sessionTimeout }
    );

    // Store session
    await this.redis.setEx(
      `admin:session:${token}`,
      this.sessionTimeout,
      JSON.stringify({ adminId: admin.id, createdAt: new Date().toISOString() })
    );

    return { 
      token, 
      admin: { ...admin, password: undefined } 
    };
  }

  /**
   * Validate a session token issued by /_admin/login.
   * Checks the Redis session record AND verifies the JWT signature.
   * Returns the admin record (without password) on success, or null.
   *
   * NOTE: this method is for HUMAN USER sessions only. The static
   * process.env.ADMIN_TOKEN env-bypass and the multi-token API keys
   * (sfa_*) live elsewhere — see utils/admin-auth.js. They are not
   * accepted here so that callers can enforce a clean separation
   * between user sessions and machine API keys.
   */
  async validateSessionToken(token) {
    try {
      // The session record is the authoritative gate — even a still-valid
      // JWT becomes useless once the session is deleted (logout).
      const session = await this.redis.get(`admin:session:${token}`);
      if (!session) return null;

      // Verify JWT signature + expiry
      const decoded = jwt.verify(token, this.tokenSecret);

      const adminData = await this.redis.get(`admin:${decoded.id}`);
      if (!adminData) return null;

      const admin = JSON.parse(adminData);
      return { ...admin, password: undefined };
    } catch (error) {
      return null;
    }
  }

  /**
   * @deprecated kept for callers that haven't migrated yet. Prefer
   * validateSessionToken + the env/API-key paths in utils/admin-auth.js.
   */
  async validateToken(token) {
    return this.validateSessionToken(token);
  }

  async logout(token) {
    await this.redis.del(`admin:session:${token}`);
  }

  async getAllAdmins() {
    const adminIds = await this.redis.sMembers('admins');
    const admins = [];

    for (const id of adminIds) {
      const adminData = await this.redis.get(`admin:${id}`);
      if (adminData) {
        const admin = JSON.parse(adminData);
        admins.push({ ...admin, password: undefined });
      }
    }

    return admins;
  }

  async getAdmin(id) {
    const adminData = await this.redis.get(`admin:${id}`);
    if (!adminData) return null;

    const admin = JSON.parse(adminData);
    return { ...admin, password: undefined };
  }

  async updateAdmin(id, updates) {
    const adminData = await this.redis.get(`admin:${id}`);
    if (!adminData) return null;

    const admin = JSON.parse(adminData);
    
    // Handle username change
    if (updates.username && updates.username !== admin.username) {
      await this.redis.del(`admin:username:${admin.username}`);
      await this.redis.set(`admin:username:${updates.username}`, id);
    }

    // Handle password change
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }

    const updatedAdmin = { 
      ...admin, 
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    await this.redis.set(`admin:${id}`, JSON.stringify(updatedAdmin));

    return { ...updatedAdmin, password: undefined };
  }

  async deleteAdmin(id) {
    const adminData = await this.redis.get(`admin:${id}`);
    if (!adminData) return false;

    const admin = JSON.parse(adminData);
    
    // Don't allow deleting the last super admin
    if (admin.isSuperAdmin) {
      const allAdmins = await this.getAllAdmins();
      const superAdmins = allAdmins.filter(a => a.isSuperAdmin && a.id !== id);
      if (superAdmins.length === 0) {
        throw new Error('Cannot delete the last super admin');
      }
    }
    
    await this.redis.del(`admin:${id}`);
    await this.redis.del(`admin:username:${admin.username}`);
    await this.redis.sRem('admins', id);
    
    return true;
  }

  async verifyPassword(id, password) {
    const adminData = await this.redis.get(`admin:${id}`);
    if (!adminData) return false;

    const admin = JSON.parse(adminData);
    return await bcrypt.compare(password, admin.password);
  }
}

module.exports = AdminService;