import { NextRequest } from "next/server";
import { verifySession } from "./auth-spinhub";

export async function getAuthenticatedUser(request: NextRequest) {
  const token = request.headers.get("x-auth-token") || 
                request.cookies.get("auth-token")?.value;
  
  if (!token) {
    return null;
  }

  try {
    const session = await verifySession(token);
    return session;
  } catch (error) {
    return null;
  }
}