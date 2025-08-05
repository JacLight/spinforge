/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import jwt from "jsonwebtoken";

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { refreshToken } = refreshSchema.parse(body);

    // Verify the refresh token
    const jwtSecret = process.env.JWT_SECRET || "spinforge-secret-key";
    const decoded = jwt.verify(refreshToken, jwtSecret) as any;
    
    if (!decoded.customerId) {
      throw new Error("Invalid token");
    }

    // Generate new access token
    const newToken = jwt.sign(
      {
        email: decoded.email,
        customerId: decoded.customerId,
        role: decoded.role || "customer",
        sub: decoded.customerId,
      },
      jwtSecret,
      { expiresIn: "1h" }
    );

    const response = NextResponse.json({
      success: true,
      token: newToken,
    });

    // Update auth cookie with new token
    response.cookies.set("auth-token", newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: "Invalid or expired refresh token" },
      { status: 401 }
    );
  }
}