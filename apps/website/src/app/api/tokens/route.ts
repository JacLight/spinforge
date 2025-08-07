/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";

const SPINHUB_API_URL = process.env.SPINHUB_API_URL || "http://api:8080";

export async function GET(request: NextRequest) {
  const session = await getAuthenticatedUser(request);
  
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch API tokens from the hosting API
    const response = await fetch(`${SPINHUB_API_URL}/_api/customer/tokens`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${session.token}`,
        "X-Customer-ID": session.customerId || "",
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch tokens");
    }

    const tokens = await response.json();
    return NextResponse.json(tokens);
  } catch (error) {
    console.error("Error fetching API tokens:", error);
    return NextResponse.json(
      { error: "Failed to fetch API tokens" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getAuthenticatedUser(request);
  
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    
    // Create API token via hosting API
    const response = await fetch(`${SPINHUB_API_URL}/_api/customer/tokens`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${session.token}`,
        "X-Customer-ID": session.customerId || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create token");
    }

    const token = await response.json();
    return NextResponse.json(token);
  } catch (error: any) {
    console.error("Error creating API token:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create API token" },
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

    // Delete the token via hosting API
    const response = await fetch(`${SPINHUB_API_URL}/_api/customer/tokens/${tokenId}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${session.token}`,
        "X-Customer-ID": session.customerId || "",
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete token");
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting API token:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete API token" },
      { status: 500 }
    );
  }
}