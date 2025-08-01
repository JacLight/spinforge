import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import axios from "axios";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const authToken =
      request.headers.get("authorization")?.replace("Bearer ", "") ||
      request.headers.get("x-auth-token") ||
      cookieStore.get("auth-token")?.value;

    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get customer ID from localStorage (passed via header) or cookie
    const customerId =
      request.headers.get("x-customer-id") ||
      cookieStore.get("customer-id")?.value;

    if (!customerId) {
      // Customer ID should be in localStorage/headers after login
      return NextResponse.json(
        { error: "Customer ID not found. Please log in again." },
        { status: 401 }
      );
    }

    // Get the SpinForge API URL from environment
    const apiUrl = process.env.SPINHUB_API_URL;

    // Use customer API endpoint
    try {
      const response = await axios.get(`${apiUrl}/_api/customer/domains`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          "X-Customer-ID": customerId,
        },
      });
      return NextResponse.json(response.data);
    } catch (apiError: any) {
      // If customer API is not available, return empty array for now
      console.warn("Customer API not available, returning empty routes");
      return NextResponse.json([]);
    }
  } catch (error: any) {
    console.error("Error fetching routes:", error);

    if (error.response?.status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to fetch routes" },
      { status: 500 }
    );
  }
}
