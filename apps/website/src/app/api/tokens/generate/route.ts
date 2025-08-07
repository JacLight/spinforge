/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { z } from "zod";

const SPINHUB_API_URL = process.env.SPINHUB_API_URL || "http://api:8080";

const tokenSchema = z.object({
  name: z.string().min(1, "Token name is required"),
});

export async function POST(request: NextRequest) {
  const session = await getAuthenticatedUser(request);
  
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name } = tokenSchema.parse(body);

    // Generate token via the backend API
    const response = await fetch(`${SPINHUB_API_URL}/_api/customer/tokens`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${session.token}`,
        "X-Customer-ID": session.customerId || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to generate token");
    }

    const tokenData = await response.json();

    return NextResponse.json({
      id: tokenData.id,
      name: tokenData.name,
      token: tokenData.token, // Only sent once
      createdAt: tokenData.createdAt,
      user: {
        id: session.userId,
        customerId: session.customerId,
        email: session.email
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Token generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate token" },
      { status: 500 }
    );
  }
}