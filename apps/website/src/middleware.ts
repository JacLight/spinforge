/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CUSTOMER_PORTAL_ORIGIN = "https://app.spinforge.dev";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const target = new URL(
    pathname.replace(/^\/dashboard/, "") + search || "/",
    CUSTOMER_PORTAL_ORIGIN,
  );
  return NextResponse.redirect(target, 308);
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
