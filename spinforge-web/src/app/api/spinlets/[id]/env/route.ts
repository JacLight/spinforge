import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import axios from "axios";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = cookies();
    const authToken =
      request.headers.get("authorization")?.replace("Bearer ", "") ||
      request.headers.get("x-auth-token") ||
      cookieStore.get("auth-token")?.value;

    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const apiUrl = process.env.SPINHUB_API_URL;

    // Forward the request to the SpinForge API
    const response = await axios.put(
      `${apiUrl}/_admin/spinlets/${params.id}/env`,
      body,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          "X-Admin-Token": authToken,
        },
      }
    );

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error("Error updating spinlet env:", error);

    if (error.response?.status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (error.response?.status === 404) {
      return NextResponse.json({ error: "Spinlet not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to update environment variables" },
      { status: 500 }
    );
  }
}
