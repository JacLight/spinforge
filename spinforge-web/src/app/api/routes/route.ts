import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import axios from "axios";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const authToken = request.headers.get("authorization")?.replace("Bearer ", "") ||
                     request.headers.get("x-auth-token") || 
                     cookieStore.get("auth-token")?.value;
    
    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Try to get customer ID from cookie first
    let customerId = request.headers.get("x-customer-id") || 
                    cookieStore.get("customer-id")?.value;
    
    // If not in cookie, extract from JWT token
    if (!customerId) {
      try {
        const tokenParts = authToken.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
          customerId = payload.customerId || payload.sub || "";
        }
      } catch (e) {
        console.error("Error decoding JWT:", e);
      }
    }
    
    if (!customerId) {
      return NextResponse.json({ error: "Customer ID not found" }, { status: 401 });
    }

    // Get the SpinForge API URL from environment
    const apiUrl = process.env.SPINFORGE_API_URL || "http://localhost:9006";
    
    // Use customer API endpoint
    const response = await axios.get(`${apiUrl}/_api/customer/domains`, {
      headers: {
        "Authorization": `Bearer ${authToken}`,
        "X-Customer-ID": customerId,
      },
    });

    return NextResponse.json(response.data);
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