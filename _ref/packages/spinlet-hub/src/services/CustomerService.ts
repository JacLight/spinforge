import { Customer } from '../config';
import { Redis } from 'ioredis';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';

export class CustomerService {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async ensureCustomerExists(customerId: string): Promise<Customer> {
    // Check if customer already exists
    const existingData = await this.redis.get(`customer:${customerId}`);
    if (existingData) {
      return JSON.parse(existingData) as Customer;
    }

    // Create a basic customer entry for legacy customer IDs
    const customer: Customer = {
      id: customerId,
      name: `Customer ${customerId}`,
      email: `${customerId}@spinforge.local`,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      metadata: {
        legacy: true,
        autoCreated: true
      },
      limits: {},
    };

    await this.redis.set(`customer:${customerId}`, JSON.stringify(customer));
    await this.redis.sadd('customers', customerId);
    
    return customer;
  }

  async createCustomer(data: {
    name: string;
    email: string;
    metadata?: Record<string, any>;
    limits?: {
      maxSpinlets?: number;
      maxMemory?: string;
      maxDomains?: number;
    };
  }): Promise<Customer> {
    const id = 'cust_' + randomBytes(16).toString('hex');
    
    const customer: Customer = {
      id,
      name: data.name,
      email: data.email,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      metadata: data.metadata || {},
      limits: data.limits || {},
    };

    await this.redis.set(`customer:${id}`, JSON.stringify(customer));
    await this.redis.sadd('customers', id);
    await this.redis.set(`customer:email:${data.email}`, id);

    return customer;
  }

  async getAllCustomers(filter?: {
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ customers: Customer[]; total: number }> {
    const customers: Customer[] = [];

    console.log('[CustomerService] Getting all customers...');
    
    // Read users from spinforge-web format
    const userEmailKeys = await this.redis.keys('user:email:*');
    console.log('[CustomerService] Found user email keys:', userEmailKeys.length);
    
    for (const emailKey of userEmailKeys) {
      const userData = await this.redis.get(emailKey);
      if (userData) {
        const user = JSON.parse(userData);
        console.log('[CustomerService] Found user:', user.email, 'customerId:', user.customerId);
        
        // Convert user to customer format
        const customer: Customer = {
          id: user.customerId,
          name: user.name || user.email.split('@')[0],
          email: user.email,
          createdAt: user.createdAt || new Date(),
          updatedAt: user.updatedAt || new Date(),
          isActive: true,
          metadata: {
            userId: user.id,
            company: user.company,
            role: user.role
          },
          limits: {}
        };
        
        if (!filter?.isActive || customer.isActive === filter.isActive) {
          customers.push(customer);
        }
      }
    }

    console.log('[CustomerService] Total customers found:', customers.length);

    // Sort by creation date (newest first)
    customers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Apply pagination
    const total = customers.length;
    const offset = filter?.offset || 0;
    const limit = filter?.limit || 50;
    const paginatedCustomers = customers.slice(offset, offset + limit);

    return { customers: paginatedCustomers, total };
  }

  async getCustomer(id: string): Promise<Customer | null> {
    // Check if this customer exists as a user from spinforge-web
    const userEmailKeys = await this.redis.keys('user:email:*');
    
    for (const emailKey of userEmailKeys) {
      const userData = await this.redis.get(emailKey);
      if (userData) {
        const user = JSON.parse(userData);
        if (user.customerId === id) {
          // Convert user to customer format
          return {
            id: user.customerId,
            name: user.name || user.email.split('@')[0],
            email: user.email,
            createdAt: user.createdAt || new Date(),
            updatedAt: user.updatedAt || new Date(),
            isActive: true,
            metadata: {
              userId: user.id,
              company: user.company,
              role: user.role
            },
            limits: {}
          };
        }
      }
    }

    return null;
  }

  async getCustomerByEmail(email: string): Promise<Customer | null> {
    // Check if this email exists as a user from spinforge-web
    const userData = await this.redis.get(`user:email:${email}`);
    if (userData) {
      const user = JSON.parse(userData);
      if (user.customerId) {
        return this.getCustomer(user.customerId);
      }
    }

    return null;
  }

  async updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer | null> {
    const customerData = await this.redis.get(`customer:${id}`);
    if (!customerData) return null;

    const customer = JSON.parse(customerData) as Customer;
    
    // Handle email change
    if (updates.email && updates.email !== customer.email) {
      await this.redis.del(`customer:email:${customer.email}`);
      await this.redis.set(`customer:email:${updates.email}`, id);
    }

    const updatedCustomer = { 
      ...customer, 
      ...updates,
      updatedAt: new Date()
    };
    
    await this.redis.set(`customer:${id}`, JSON.stringify(updatedCustomer));

    return updatedCustomer;
  }

  async deleteCustomer(id: string): Promise<boolean> {
    const customerData = await this.redis.get(`customer:${id}`);
    if (!customerData) return false;

    const customer = JSON.parse(customerData) as Customer;
    
    // Soft delete - just mark as inactive
    customer.isActive = false;
    customer.updatedAt = new Date();
    
    await this.redis.set(`customer:${id}`, JSON.stringify(customer));

    return true;
  }

  async getCustomerStats(customerId: string): Promise<{
    totalSpinlets: number;
    activeSpinlets: number;
    totalDomains: number;
    totalMemoryUsed: number;
    limits: any;
  }> {
    const customer = await this.getCustomer(customerId);
    if (!customer) throw new Error('Customer not found');

    // Get all routes for this customer
    const allRoutes = await this.redis.keys('route:*');
    let totalSpinlets = new Set<string>();
    let activeSpinlets = 0;
    let totalDomains = 0;
    let totalMemoryUsed = 0;

    for (const routeKey of allRoutes) {
      const routeData = await this.redis.get(routeKey);
      if (routeData) {
        const route = JSON.parse(routeData);
        if (route.customerId === customerId) {
          totalSpinlets.add(route.spinletId);
          totalDomains += route.allDomains?.length || 1;
          
          // Check if spinlet is active
          const spinletData = await this.redis.get(`spinlet:${route.spinletId}`);
          if (spinletData) {
            const spinlet = JSON.parse(spinletData);
            if (spinlet.state === 'running') {
              activeSpinlets++;
              // Parse memory (e.g., "512MB" -> 512)
              const memory = parseInt(route.config?.memory || '512MB');
              totalMemoryUsed += memory;
            }
          }
        }
      }
    }

    return {
      totalSpinlets: totalSpinlets.size,
      activeSpinlets,
      totalDomains,
      totalMemoryUsed,
      limits: customer.limits || {},
    };
  }

  async checkCustomerLimits(customerId: string, resource: 'spinlets' | 'memory' | 'domains', requestedAmount: number): Promise<{
    allowed: boolean;
    current: number;
    limit?: number;
    reason?: string;
  }> {
    const stats = await this.getCustomerStats(customerId);
    const customer = await this.getCustomer(customerId);
    if (!customer) {
      return { allowed: false, current: 0, reason: 'Customer not found' };
    }

    switch (resource) {
      case 'spinlets':
        const spinletLimit = customer.limits?.maxSpinlets;
        if (spinletLimit && stats.totalSpinlets + requestedAmount > spinletLimit) {
          return {
            allowed: false,
            current: stats.totalSpinlets,
            limit: spinletLimit,
            reason: `Spinlet limit exceeded. Current: ${stats.totalSpinlets}, Limit: ${spinletLimit}`,
          };
        }
        return { allowed: true, current: stats.totalSpinlets, limit: spinletLimit };

      case 'memory':
        const memoryLimit = parseInt(customer.limits?.maxMemory || '0');
        if (memoryLimit && stats.totalMemoryUsed + requestedAmount > memoryLimit) {
          return {
            allowed: false,
            current: stats.totalMemoryUsed,
            limit: memoryLimit,
            reason: `Memory limit exceeded. Current: ${stats.totalMemoryUsed}MB, Limit: ${memoryLimit}MB`,
          };
        }
        return { allowed: true, current: stats.totalMemoryUsed, limit: memoryLimit };

      case 'domains':
        const domainLimit = customer.limits?.maxDomains;
        if (domainLimit && stats.totalDomains + requestedAmount > domainLimit) {
          return {
            allowed: false,
            current: stats.totalDomains,
            limit: domainLimit,
            reason: `Domain limit exceeded. Current: ${stats.totalDomains}, Limit: ${domainLimit}`,
          };
        }
        return { allowed: true, current: stats.totalDomains, limit: domainLimit };

      default:
        return { allowed: false, current: 0, reason: 'Invalid resource type' };
    }
  }

  async createWebCustomer(data: {
    email: string;
    password: string;
    name: string;
    company?: string;
  }): Promise<{ customer: Customer; userId: string }> {
    // Generate IDs in spinforge-web format
    const userId = this.generateNanoid(21); // spinforge-web uses 21 char nanoid
    const customerId = `cust_${this.generateNanoid(10)}`;
    
    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);
    
    // Create user in spinforge-web format
    const user = {
      id: userId,
      email: data.email,
      password: hashedPassword,
      name: data.name,
      company: data.company || '',
      customerId: customerId,
      role: 'customer',
      emailVerified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Save user in spinforge-web format
    await this.redis.set(`user:${userId}`, JSON.stringify(user));
    await this.redis.set(`user:email:${data.email}`, JSON.stringify(user));
    
    // Create customer object for SpinHub
    const customer: Customer = {
      id: customerId,
      name: data.name,
      email: data.email,
      createdAt: new Date(user.createdAt),
      updatedAt: new Date(user.updatedAt),
      isActive: true,
      metadata: {
        userId: userId,
        company: data.company,
        role: 'customer',
        createdVia: 'spinhub-auth'
      },
      limits: {}
    };
    
    return { customer, userId };
  }
  
  async authenticateWebCustomer(email: string, password: string): Promise<Customer | null> {
    // Get user by email
    const userData = await this.redis.get(`user:email:${email}`);
    if (!userData) {
      return null;
    }
    
    const user = JSON.parse(userData);
    
    // Verify password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return null;
    }
    
    // Return customer object
    return {
      id: user.customerId,
      name: user.name || user.email.split('@')[0],
      email: user.email,
      createdAt: new Date(user.createdAt),
      updatedAt: new Date(user.updatedAt),
      isActive: true,
      metadata: {
        userId: user.id,
        company: user.company,
        role: user.role
      },
      limits: {}
    };
  }
  
  private generateNanoid(length: number): string {
    const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_';
    let id = '';
    const bytes = randomBytes(length);
    
    for (let i = 0; i < length; i++) {
      id += alphabet[bytes[i] % alphabet.length];
    }
    
    return id;
  }
}