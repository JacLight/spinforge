import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("auth-token")?.value;
  
  // For protected routes, ensure auth token exists
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Pass the token in headers for API routes to verify
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-auth-token", token);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/deployments/:path*",
    "/api/domains/:path*",
    "/api/tokens/:path*",
    "/api/usage/:path*",
  ],
};