/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { redis, KEYS, getJson, setJson } from "@/lib/redis";
import { nanoid } from "nanoid";

export async function GET(request: NextRequest) {
  const session = await getAuthenticatedUser(request);
  
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all API tokens for this user
    const tokenKeys = await redis.keys(`apitoken:${session.userId}:*`);
    const tokens = [];

    for (const key of tokenKeys) {
      const token = await getJson(key);
      if (token) {
        // Don't send the actual token value
        tokens.push({
          id: token.id,
          name: token.name,
          createdAt: token.createdAt,
          lastUsed: token.lastUsed,
        });
      }
    }

    return NextResponse.json(tokens);
  } catch (error) {
    console.error("Error fetching API tokens:", error);
    return NextResponse.json(
      { error: "Failed to fetch API tokens" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getAuthenticatedUser(request);
  
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const tokenId = searchParams.get("id");

    if (!tokenId) {
      return NextResponse.json({ error: "Token ID required" }, { status: 400 });
    }

    // Delete the token
    await redis.del(`apitoken:${session.userId}:${tokenId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting API token:", error);
    return NextResponse.json(
      { error: "Failed to delete API token" },
      { status: 500 }
    );
  }
}