import { NextResponse } from "next/server";
import { loginUser } from "@/lib/auth-simple";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = loginSchema.parse(body);

    const session = await loginUser(email, password);

    const response = NextResponse.json({
      success: true,
      token: session.token,
      user: {
        email: session.email,
        customerId: session.customerId,
        role: session.role,
      },
    });

    // Set auth cookie
    response.cookies.set("auth-token", session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Invalid credentials" },
      { status: 401 }
    );
  }
}