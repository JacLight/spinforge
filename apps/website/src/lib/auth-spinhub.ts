/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Session, User } from "./auth-simple";
import { nanoid } from "nanoid";
import { setJson, getJson, KEYS, redis } from "./redis";

const SPINHUB_API_URL = process.env.SPINHUB_API_URL;

// Create user via SpinHub API
export async function createUser(data: {
  email: string;
  password: string;
  name?: string;
  company?: string;
}): Promise<User> {
  try {
    const response = await fetch(`${SPINHUB_API_URL}/_auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: data.email,
        password: data.password,
        name: data.name || data.email.split("@")[0],
        company: data.company,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Registration failed");
    }

    const result = await response.json();

    // Create user object compatible with existing code
    const user: User = {
      id: result.userId,
      email: result.customer.email,
      password: "", // Don't store password locally
      name: result.customer.name,
      company: data.company,
      customerId: result.customer.id,
      role: "customer",
      emailVerified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Store auth token for API calls
    await setJson(KEYS.apiToken(result.token), {
      userId: result.userId,
      customerId: result.customer.id,
      email: result.customer.email,
      token: result.token,
      createdAt: new Date().toISOString(),
    });

    return user;
  } catch (error: any) {
    throw new Error(error.message || "Failed to create user");
  }
}

// Login user via SpinHub API
export async function loginUser(
  email: string,
  password: string
): Promise<Session> {
  try {
    const response = await fetch(`${SPINHUB_API_URL}/_auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Login failed");
    }

    const result = await response.json();

    // Create session
    const sessionToken = nanoid(32);
    const session: Session = {
      userId: result.userId || result.customer.id,
      customerId: result.customer.id,
      email: result.customer.email,
      role: "customer",
      token: sessionToken,
    };

    // Save session (expire in 7 days)
    await setJson(KEYS.session(sessionToken), session, 7 * 24 * 60 * 60);

    // Store SpinHub auth token
    await setJson(KEYS.apiToken(result.token), {
      userId: result.userId || result.customer.id,
      customerId: result.customer.id,
      email: result.customer.email,
      token: result.token,
      createdAt: new Date().toISOString(),
    });

    return session;
  } catch (error: any) {
    throw new Error(error.message || "Login failed");
  }
}

// Get user by email (check local cache first, then SpinHub)
export async function getUserByEmail(email: string): Promise<User | null> {
  // For now, return null as we're not caching users locally
  // In a real implementation, you might want to cache user data
  return null;
}

// Verify session (local session management)
export async function verifySession(token: string): Promise<Session | null> {
  return await getJson<Session>(KEYS.session(token));
}

// Verify API token with SpinHub
export async function verifyApiToken(token: string): Promise<{
  userId: string;
  customerId: string;
  role: string;
} | null> {
  try {
    const response = await fetch(`${SPINHUB_API_URL}/_auth/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      return null;
    }

    const result = await response.json();
    if (!result.valid) {
      return null;
    }

    return {
      userId: result.customer.id,
      customerId: result.customer.id,
      role: "customer",
    };
  } catch {
    return null;
  }
}

// Magic link functions remain local for now
export async function createMagicLink(email: string): Promise<string> {
  const token = nanoid(32);

  // Store magic link token (expire in 1 hour)
  await setJson(
    `magiclink:${token}`,
    {
      email,
    },
    3600
  );

  return token;
}

export async function verifyMagicLink(token: string): Promise<Session | null> {
  const data = await getJson<any>(`magiclink:${token}`);
  if (!data) {
    return null;
  }

  // Create temporary user via SpinHub
  try {
    const tempPassword = nanoid(32);
    const response = await fetch(`${SPINHUB_API_URL}/_auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: data.email,
        password: tempPassword,
        name: data.email.split("@")[0],
      }),
    });

    if (!response.ok) {
      // If user already exists, try to login (would need a different approach in production)
      return null;
    }

    const result = await response.json();

    // Create session
    const sessionToken = nanoid(32);
    const session: Session = {
      userId: result.userId || result.customer.id,
      customerId: result.customer.id,
      email: result.customer.email,
      role: "customer",
      token: sessionToken,
    };

    // Save session
    await setJson(KEYS.session(sessionToken), session, 7 * 24 * 60 * 60);

    // Delete magic link token
    await redis.del(`magiclink:${token}`);

    return session;
  } catch {
    return null;
  }
}

// Generate API token
export async function generateApiToken(
  userId: string,
  name: string
): Promise<string> {
  // In production, this would call SpinHub to generate a proper API token
  // For now, generate a local token
  const token = nanoid(32);

  await setJson(KEYS.apiToken(token), {
    userId,
    name,
    createdAt: new Date().toISOString(),
  });

  return token;
}
