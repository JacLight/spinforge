/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */

// Type definitions only - no Redis or database access
// All auth operations should go through auth-spinhub.ts which uses the backend API

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