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
    // Get notification preferences from backend API
    const response = await fetch(`${SPINHUB_API_URL}/_api/customer/notifications`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${session.token}`,
        "X-Customer-ID": session.customerId || "",
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      // Return default preferences if API doesn't have them yet
      return NextResponse.json({
        emailNotifications: true,
        deploymentAlerts: true,
        usageAlerts: true,
        weeklyReports: false,
      });
    }

    const preferences = await response.json();
    return NextResponse.json(preferences);
  } catch (error) {
    console.error("Error fetching notification preferences:", error);
    // Return defaults on error
    return NextResponse.json({
      emailNotifications: true,
      deploymentAlerts: true,
      usageAlerts: true,
      weeklyReports: false,
    });
  }
}

export async function PUT(request: NextRequest) {
  const session = await getAuthenticatedUser(request);
  
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const preferences = await request.json();

    // Save notification preferences via backend API
    const response = await fetch(`${SPINHUB_API_URL}/_api/customer/notifications`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${session.token}`,
        "X-Customer-ID": session.customerId || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        emailNotifications: preferences.emailNotifications ?? true,
        deploymentAlerts: preferences.deploymentAlerts ?? true,
        usageAlerts: preferences.usageAlerts ?? true,
        weeklyReports: preferences.weeklyReports ?? false,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update preferences");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating notification preferences:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update preferences" },
      { status: 500 }
    );
  }
}