import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { generateApiToken } from "@/lib/auth-spinhub";
import { setJson } from "@/lib/redis";
import { nanoid } from "nanoid";
import { z } from "zod";

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

    // Generate the API token
    const token = await generateApiToken(session.userId, name);
    const tokenId = nanoid();

    // Store token metadata
    await setJson(`apitoken:${session.userId}:${tokenId}`, {
      id: tokenId,
      name,
      createdAt: new Date().toISOString(),
      lastUsed: null,
    });

    return NextResponse.json({
      id: tokenId,
      name,
      token, // Only sent once
      createdAt: new Date().toISOString(),
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
      { error: "Failed to generate token" },
      { status: 500 }
    );
  }
}