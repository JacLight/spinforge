import { AdminUser } from '../config';
import { Redis } from 'ioredis';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';

export class AdminService {
  private redis: Redis;
  private tokenSecret: string;
  private sessionTimeout: number;

  constructor(redis: Redis, tokenSecret: string, sessionTimeout: number) {
    this.redis = redis;
    this.tokenSecret = tokenSecret;
    this.sessionTimeout = sessionTimeout;
  }

  async initializeDefaultAdmin(username: string, password: string): Promise<void> {
    const admins = await this.getAllAdmins();
    if (admins.length === 0) {
      // Create default admin user
      await this.createAdmin({
        username,
        password,
        email: 'admin@spinforge.local',
        isSuperAdmin: true,
      });
      console.log('Default admin user created');
    }
  }

  async createAdmin(data: {
    username: string;
    password: string;
    email?: string;
    isSuperAdmin?: boolean;
  }): Promise<AdminUser> {
    const id = 'admin_' + randomBytes(16).toString('hex');
    const hashedPassword = await bcrypt.hash(data.password, 10);
    
    const admin: AdminUser = {
      id,
      username: data.username,
      password: hashedPassword,
      email: data.email,
      createdAt: new Date(),
      isActive: true,
      isSuperAdmin: data.isSuperAdmin || false,
    };

    await this.redis.set(`admin:${id}`, JSON.stringify(admin));
    await this.redis.sadd('admins', id);
    await this.redis.set(`admin:username:${data.username}`, id);

    return { ...admin, password: '' }; // Don't return hashed password
  }

  async login(username: string, password: string): Promise<{ token: string; admin: AdminUser } | null> {
    const adminId = await this.redis.get(`admin:username:${username}`);
    if (!adminId) return null;

    const adminData = await this.redis.get(`admin:${adminId}`);
    if (!adminData) return null;

    const admin = JSON.parse(adminData) as AdminUser;
    if (!admin.isActive) return null;

    const isValid = await bcrypt.compare(password, admin.password);
    if (!isValid) return null;

    // Update last login
    admin.lastLogin = new Date();
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
    await this.redis.setex(
      `admin:session:${token}`,
      this.sessionTimeout,
      JSON.stringify({ adminId: admin.id, createdAt: new Date() })
    );

    return { 
      token, 
      admin: { ...admin, password: '' } 
    };
  }

  async validateToken(token: string): Promise<AdminUser | null> {
    try {
      // Check if it's the static ADMIN_TOKEN for development/testing
      if (process.env.ADMIN_TOKEN && token === process.env.ADMIN_TOKEN) {
        // Return a default admin user for static token
        return {
          id: 'static-admin',
          username: 'admin',
          password: '',
          createdAt: new Date(),
          isActive: true,
          isSuperAdmin: true,
        };
      }

      // Check if session exists
      const session = await this.redis.get(`admin:session:${token}`);
      if (!session) return null;

      // Verify JWT
      const decoded = jwt.verify(token, this.tokenSecret) as any;
      
      // Get admin data
      const adminData = await this.redis.get(`admin:${decoded.id}`);
      if (!adminData) return null;

      const admin = JSON.parse(adminData) as AdminUser;
      return { ...admin, password: '' };
    } catch (error) {
      return null;
    }
  }

  async logout(token: string): Promise<void> {
    await this.redis.del(`admin:session:${token}`);
  }

  async getAllAdmins(): Promise<AdminUser[]> {
    const adminIds = await this.redis.smembers('admins');
    const admins: AdminUser[] = [];

    for (const id of adminIds) {
      const adminData = await this.redis.get(`admin:${id}`);
      if (adminData) {
        const admin = JSON.parse(adminData) as AdminUser;
        admins.push({ ...admin, password: '' });
      }
    }

    return admins;
  }

  async getAdmin(id: string): Promise<AdminUser | null> {
    const adminData = await this.redis.get(`admin:${id}`);
    if (!adminData) return null;

    const admin = JSON.parse(adminData) as AdminUser;
    return { ...admin, password: '' };
  }

  async updateAdmin(id: string, updates: Partial<AdminUser>): Promise<AdminUser | null> {
    const adminData = await this.redis.get(`admin:${id}`);
    if (!adminData) return null;

    const admin = JSON.parse(adminData) as AdminUser;
    
    // Handle username change
    if (updates.username && updates.username !== admin.username) {
      await this.redis.del(`admin:username:${admin.username}`);
      await this.redis.set(`admin:username:${updates.username}`, id);
    }

    // Handle password change
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }

    const updatedAdmin = { ...admin, ...updates };
    await this.redis.set(`admin:${id}`, JSON.stringify(updatedAdmin));

    return { ...updatedAdmin, password: '' };
  }

  async deleteAdmin(id: string): Promise<boolean> {
    const adminData = await this.redis.get(`admin:${id}`);
    if (!adminData) return false;

    const admin = JSON.parse(adminData) as AdminUser;
    
    await this.redis.del(`admin:${id}`);
    await this.redis.srem('admins', id);
    await this.redis.del(`admin:username:${admin.username}`);

    // Delete all sessions for this admin
    const sessions = await this.redis.keys(`admin:session:*`);
    for (const sessionKey of sessions) {
      const sessionData = await this.redis.get(sessionKey);
      if (sessionData) {
        const session = JSON.parse(sessionData);
        if (session.adminId === id) {
          await this.redis.del(sessionKey);
        }
      }
    }

    return true;
  }
}