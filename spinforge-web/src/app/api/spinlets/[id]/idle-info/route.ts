import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import axios from "axios";

export async function GET(
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

    const apiUrl = process.env.SPINHUB_API_URL;

    // Get idle info from the metrics endpoint
    const response = await axios.get(`${apiUrl}/_metrics/idle/${params.id}`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    // Transform the response to match the expected format
    const idleData = response.data;
    return NextResponse.json({
      idleMinutes: Math.floor(idleData.timeRemaining / 60000),
      lastActivity: new Date(Date.now() - idleData.timeRemaining).toISOString(),
      willShutdownAt: idleData.willExpireAt,
    });
  } catch (error: any) {
    console.error("Error fetching idle info:", error);

    if (error.response?.status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (error.response?.status === 404) {
      return NextResponse.json({ error: "Spinlet not idle" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to fetch idle info" },
      { status: 500 }
    );
  }
}
