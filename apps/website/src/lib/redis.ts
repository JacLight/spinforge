/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import Redis from 'ioredis';

// Use KeyDB/Redis for all persistence
export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:16378');

// Key patterns
export const KEYS = {
  user: (id: string) => `user:${id}`,
  userByEmail: (email: string) => `user:email:${email}`,
  session: (token: string) => `session:${token}`,
  apiToken: (token: string) => `apitoken:${token}`,
  customerDeployments: (customerId: string) => `deployments:${customerId}`,
  deployment: (id: string) => `deployment:${id}`,
  domain: (domain: string) => `domain:${domain}`,
  customerDomains: (customerId: string) => `domains:${customerId}`,
  customerUsage: (customerId: string, metric: string) => `usage:${customerId}:${metric}`,
};

// Helper functions
export async function setJson(key: string, value: any, ttl?: number) {
  const data = JSON.stringify(value);
  if (ttl) {
    await redis.setex(key, ttl, data);
  } else {
    await redis.set(key, data);
  }
}

export async function getJson<T>(key: string): Promise<T | null> {
  const data = await redis.get(key);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}