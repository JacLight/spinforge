/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { getJson, setJson } from "@/lib/redis";

export async function GET(request: NextRequest) {
  const session = await getAuthenticatedUser(request);
  
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get notification preferences
    const preferences = await getJson(`notifications:${session.userId}`) || {
      emailNotifications: true,
      deploymentAlerts: true,
      usageAlerts: true,
      weeklyReports: false,
    };

    return NextResponse.json(preferences);
  } catch (error) {
    console.error("Error fetching notification preferences:", error);
    return NextResponse.json(
      { error: "Failed to fetch preferences" },
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
    const preferences = await request.json();

    // Save notification preferences
    await setJson(`notifications:${session.userId}`, {
      emailNotifications: preferences.emailNotifications ?? true,
      deploymentAlerts: preferences.deploymentAlerts ?? true,
      usageAlerts: preferences.usageAlerts ?? true,
      weeklyReports: preferences.weeklyReports ?? false,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating notification preferences:", error);
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 }
    );
  }
}