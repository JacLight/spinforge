import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import axios from "axios";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { domain: string } }
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

    const apiUrl = process.env.SPINHUB_API_URL;

    // Forward the request to the SpinForge API
    const response = await axios.delete(
      `${apiUrl}/_admin/routes/${params.domain}`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          "X-Admin-Token": authToken,
        },
      }
    );

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error("Error deleting route:", error);

    if (error.response?.status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (error.response?.status === 404) {
      return NextResponse.json({ error: "Route not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to delete route" },
      { status: 500 }
    );
  }
}
