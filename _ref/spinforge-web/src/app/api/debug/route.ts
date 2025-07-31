import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const cookieStore = cookies();
  
  const debugInfo = {
    headers: Object.fromEntries(request.headers.entries()),
    cookies: {
      "auth-token": cookieStore.get("auth-token")?.value || null,
      "customer-id": cookieStore.get("customer-id")?.value || null,
    },
    url: request.url,
    method: request.method,
  };
  
  return NextResponse.json(debugInfo);
}