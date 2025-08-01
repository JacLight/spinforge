import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import { redis, KEYS, setJson, getJson } from "./redis";

export interface User {
  id: string;
  email: string;
  password: string;
  name?: string;
  company?: string;
  customerId: string;
  role: "admin" | "customer";
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  userId: string;
  customerId: string;
  email: string;
  role: string;
  token: string;
}

// Create user
export async function createUser(data: {
  email: string;
  password: string;
  name?: string;
  company?: string;
}): Promise<User> {
  const existingUser = await getJson<User>(KEYS.userByEmail(data.email));
  if (existingUser) {
    throw new Error("User already exists");
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);
  const user: User = {
    id: nanoid(),
    email: data.email,
    password: hashedPassword,
    name: data.name,
    company: data.company,
    customerId: `cust_${nanoid(10)}`,
    role: "customer",
    emailVerified: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Save user
  await setJson(KEYS.user(user.id), user);
  await setJson(KEYS.userByEmail(user.email), user);

  return user;
}

// Get user by email
export async function getUserByEmail(email: string): Promise<User | null> {
  return await getJson<User>(KEYS.userByEmail(email));
}

// Login user
export async function loginUser(email: string, password: string): Promise<Session> {
  const user = await getJson<User>(KEYS.userByEmail(email));
  if (!user) {
    throw new Error("Invalid credentials");
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    throw new Error("Invalid credentials");
  }

  // Create session
  const token = nanoid(32);
  const session: Session = {
    userId: user.id,
    customerId: user.customerId,
    email: user.email,
    role: user.role,
    token,
  };

  // Save session (expire in 7 days)
  await setJson(KEYS.session(token), session, 7 * 24 * 60 * 60);

  return session;
}

// Verify session
export async function verifySession(token: string): Promise<Session | null> {
  return await getJson<Session>(KEYS.session(token));
}

// Generate API token
export async function generateApiToken(userId: string, name: string): Promise<string> {
  const user = await getJson<User>(KEYS.user(userId));
  if (!user) {
    throw new Error("User not found");
  }

  const payload = {
    userId: user.id,
    customerId: user.customerId,
    role: user.role,
    type: "api",
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: "90d",
  });

  // Save API token reference
  await setJson(KEYS.apiToken(token), {
    userId: user.id,
    customerId: user.customerId,
    name,
    createdAt: new Date().toISOString(),
  });

  return token;
}

// Verify API token
export async function verifyApiToken(token: string): Promise<{
  userId: string;
  customerId: string;
  role: string;
} | null> {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const tokenData = await getJson(KEYS.apiToken(token));
    
    if (!tokenData) {
      return null;
    }

    return {
      userId: decoded.userId,
      customerId: decoded.customerId,
      role: decoded.role,
    };
  } catch {
    return null;
  }
}

// Magic link login
export async function createMagicLink(email: string): Promise<string> {
  const user = await getJson<User>(KEYS.userByEmail(email));
  if (!user) {
    // Create user if doesn't exist
    const newUser = await createUser({
      email,
      password: nanoid(32), // Random password
    });
    user.id = newUser.id;
    user.customerId = newUser.customerId;
  }

  const token = nanoid(32);
  
  // Store magic link token (expire in 1 hour)
  await setJson(`magiclink:${token}`, {
    email,
    userId: user.id,
    customerId: user.customerId,
  }, 3600);

  return token;
}

// Verify magic link
export async function verifyMagicLink(token: string): Promise<Session | null> {
  const data = await getJson<any>(`magiclink:${token}`);
  if (!data) {
    return null;
  }

  // Create session
  const sessionToken = nanoid(32);
  const session: Session = {
    userId: data.userId,
    customerId: data.customerId,
    email: data.email,
    role: "customer",
    token: sessionToken,
  };

  // Save session
  await setJson(KEYS.session(sessionToken), session, 7 * 24 * 60 * 60);
  
  // Delete magic link token
  await redis.del(`magiclink:${token}`);

  return session;
}