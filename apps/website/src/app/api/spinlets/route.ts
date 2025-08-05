/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import axios from "axios";

export async function GET(request: NextRequest) {
  try {
    const authToken =
      request.headers.get("authorization")?.replace("Bearer ", "") ||
      request.headers.get("x-auth-token") ||
      request.cookies.get("auth-token")?.value;

    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the SpinForge API URL from environment
    const apiUrl = process.env.SPINHUB_API_URL;

    // Forward the request to the SpinForge API
    const response = await axios.get(`${apiUrl}/_metrics`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        "X-Admin-Token": authToken,
      },
    });

    // Transform metrics response to spinlets format
    const spinlets = response.data.spinlets || {};
    return NextResponse.json(spinlets);
  } catch (error: any) {
    console.error("Error fetching spinlets:", error);

    if (error.response?.status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to fetch spinlets" },
      { status: 500 }
    );
  }
}
