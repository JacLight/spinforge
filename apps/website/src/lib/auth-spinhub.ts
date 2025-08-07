/**
 * SpinForge - Customer Authentication via API
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Session, User } from "./auth-simple";

const SPINHUB_API_URL = process.env.SPINHUB_API_URL || "http://api:8080";

// Create customer via API
export async function createUser(data: {
  email: string;
  password: string;
  name?: string;
  company?: string;
}): Promise<User> {
  try {
    const response = await fetch(`${SPINHUB_API_URL}/_auth/customer/register`, {
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
      id: result.user.id,
      email: result.user.email,
      password: "", // Don't store password locally
      name: result.user.name,
      company: data.company,
      customerId: result.user.customerId,
      role: "customer",
      emailVerified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return user;
  } catch (error: any) {
    throw new Error(error.message || "Failed to create user");
  }
}

// Login customer via API
export async function loginUser(
  email: string,
  password: string
): Promise<Session> {
  try {
    const response = await fetch(`${SPINHUB_API_URL}/_auth/customer/login`, {
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

    // Create session object
    const session: Session = {
      userId: result.user.customerId, // Use customerId as userId for compatibility
      customerId: result.user.customerId,
      email: result.user.email,
      role: result.user.role || "customer",
      token: result.token,
    };

    return session;
  } catch (error: any) {
    throw new Error(error.message || "Login failed");
  }
}

// Get customer by email via API
export async function getUserByEmail(email: string): Promise<User | null> {
  try {
    const response = await fetch(`${SPINHUB_API_URL}/_auth/customer/${email}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    const user = await response.json();
    return user;
  } catch (error) {
    return null;
  }
}

// Verify session via API
export async function verifySession(token: string): Promise<Session | null> {
  try {
    const response = await fetch(`${SPINHUB_API_URL}/_auth/customer/verify`, {
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
      userId: result.user.userId,
      customerId: result.user.customerId,
      email: result.user.email,
      role: result.user.role,
      token: token,
    };
  } catch {
    return null;
  }
}

// Verify API token via API
export async function verifyApiToken(token: string): Promise<{
  userId: string;
  customerId: string;
  role: string;
} | null> {
  try {
    const response = await fetch(`${SPINHUB_API_URL}/_auth/customer/verify`, {
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
      userId: result.user.userId,
      customerId: result.user.customerId,
      role: result.user.role || "customer",
    };
  } catch {
    return null;
  }
}

// Magic link functions - not implemented yet
export async function createMagicLink(email: string): Promise<string> {
  // TODO: Implement magic link via API
  throw new Error("Magic link not implemented yet");
}

export async function verifyMagicLink(token: string): Promise<Session | null> {
  // TODO: Implement magic link verification via API
  return null;
}

// Generate API token - handled by server
export async function generateApiToken(
  userId: string,
  name: string
): Promise<string> {
  // API tokens are generated server-side during login/register
  throw new Error("API token generation is handled server-side");
}
