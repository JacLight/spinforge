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
    // Get user profile from backend API
    const response = await fetch(`${SPINHUB_API_URL}/_api/customer/profile`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${session.token}`,
        "X-Customer-ID": session.customerId || "",
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch profile");
    }

    const profile = await response.json();
    return NextResponse.json(profile);
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const session = await getAuthenticatedUser(request);
  
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name, company } = await request.json();

    // Update profile via backend API
    const response = await fetch(`${SPINHUB_API_URL}/_api/customer/profile`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${session.token}`,
        "X-Customer-ID": session.customerId || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        company,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update profile");
    }

    const updatedProfile = await response.json();
    return NextResponse.json({
      success: true,
      user: updatedProfile,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update profile" },
      { status: 500 }
    );
  }
}