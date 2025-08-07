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

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const cookieStore = await cookies();
    const authToken =
      request.headers.get("authorization")?.replace("Bearer ", "") ||
      request.headers.get("x-auth-token") ||
      cookieStore.get("auth-token")?.value;

    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiUrl = process.env.SPINHUB_API_URL;

    // Forward the request to the SpinForge API
    const response = await axios.get(`${apiUrl}/_admin/spinlets/${params.id}`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        "X-Admin-Token": authToken,
      },
    });

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error("Error fetching spinlet:", error);

    if (error.response?.status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (error.response?.status === 404) {
      return NextResponse.json({ error: "Spinlet not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to fetch spinlet" },
      { status: 500 }
    );
  }
}
