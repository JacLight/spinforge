import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { getJson, setJson, KEYS } from "@/lib/redis";
import type { User } from "@/lib/auth-simple"; // TODO: Migrate to SpinHub API

export async function PUT(request: NextRequest) {
  const session = await getAuthenticatedUser(request);
  
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name, company } = await request.json();

    // Get current user
    const user = await getJson<User>(KEYS.user(session.userId));
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Update user
    const updatedUser = {
      ...user,
      name: name || user.name,
      company: company || user.company,
      updatedAt: new Date().toISOString(),
    };

    // Save updated user
    await setJson(KEYS.user(session.userId), updatedUser);
    await setJson(KEYS.userByEmail(user.email), updatedUser);

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        company: updatedUser.company,
        customerId: updatedUser.customerId,
      },
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}