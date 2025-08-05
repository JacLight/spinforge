/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
const crypto = require('crypto');

class CustomerService {
  constructor(redis) {
    this.redis = redis;
  }

  async createCustomer(data) {
    const id = 'cust_' + crypto.randomBytes(16).toString('hex');
    
    const customer = {
      id,
      name: data.name,
      email: data.email,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
      metadata: data.metadata || {},
      limits: data.limits || {},
    };

    await this.redis.set(`customer:${id}`, JSON.stringify(customer));
    await this.redis.sAdd('customers', id);
    await this.redis.set(`customer:email:${data.email}`, id);

    return customer;
  }

  async getAllCustomers(filter = {}) {
    const customers = [];

    // Get all customer IDs
    const customerIds = await this.redis.sMembers('customers');
    
    for (const id of customerIds) {
      const customerData = await this.redis.get(`customer:${id}`);
      if (customerData) {
        const customer = JSON.parse(customerData);
        
        if (!filter.isActive || customer.isActive === filter.isActive) {
          customers.push(customer);
        }
      }
    }

    // Also check for users from spinforge-web format
    const userEmailKeys = await this.redis.keys('user:email:*');
    
    for (const emailKey of userEmailKeys) {
      const userData = await this.redis.get(emailKey);
      if (userData) {
        const user = JSON.parse(userData);
        
        // Convert user to customer format
        const customer = {
          id: user.customerId || user.id,
          name: user.name || user.email.split('@')[0],
          email: user.email,
          createdAt: user.createdAt || new Date().toISOString(),
          updatedAt: user.updatedAt || new Date().toISOString(),
          isActive: true,
          metadata: {
            userId: user.id,
            company: user.company,
            role: user.role
          },
          limits: {}
        };
        
        if (!filter.isActive || customer.isActive === filter.isActive) {
          customers.push(customer);
        }
      }
    }

    // Remove duplicates by ID
    const uniqueCustomers = Array.from(
      new Map(customers.map(c => [c.id, c])).values()
    );

    // Sort by creation date (newest first)
    uniqueCustomers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Apply pagination
    const total = uniqueCustomers.length;
    const offset = filter.offset || 0;
    const limit = filter.limit || 50;
    const paginatedCustomers = uniqueCustomers.slice(offset, offset + limit);

    return { customers: paginatedCustomers, total };
  }

  async getCustomer(id) {
    // Check direct customer record
    const customerData = await this.redis.get(`customer:${id}`);
    if (customerData) {
      return JSON.parse(customerData);
    }

    // Check if this customer exists as a user from spinforge-web
    const userEmailKeys = await this.redis.keys('user:email:*');
    
    for (const emailKey of userEmailKeys) {
      const userData = await this.redis.get(emailKey);
      if (userData) {
        const user = JSON.parse(userData);
        if (user.customerId === id || user.id === id) {
          // Convert user to customer format
          return {
            id: user.customerId || user.id,
            name: user.name || user.email.split('@')[0],
            email: user.email,
            createdAt: user.createdAt || new Date().toISOString(),
            updatedAt: user.updatedAt || new Date().toISOString(),
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

  async updateCustomer(id, updates) {
    const customer = await this.getCustomer(id);
    if (!customer) return null;
    
    // Handle email change
    if (updates.email && updates.email !== customer.email) {
      await this.redis.del(`customer:email:${customer.email}`);
      await this.redis.set(`customer:email:${updates.email}`, id);
    }

    const updatedCustomer = { 
      ...customer, 
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    await this.redis.set(`customer:${id}`, JSON.stringify(updatedCustomer));

    return updatedCustomer;
  }

  async deleteCustomer(id) {
    const customer = await this.getCustomer(id);
    if (!customer) return false;
    
    // Soft delete - just mark as inactive
    customer.isActive = false;
    customer.updatedAt = new Date().toISOString();
    
    await this.redis.set(`customer:${id}`, JSON.stringify(customer));
    
    return true;
  }
}

module.exports = CustomerService;