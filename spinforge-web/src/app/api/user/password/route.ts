import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { getJson, setJson, KEYS } from "@/lib/redis";
import type { User } from "@/lib/auth-simple"; // TODO: Migrate to SpinHub API
import bcrypt from "bcryptjs";

export async function PUT(request: NextRequest) {
  const session = await getAuthenticatedUser(request);
  
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current and new passwords required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Get current user
    const user = await getJson<User>(KEYS.user(session.userId));
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user
    const updatedUser = {
      ...user,
      password: hashedPassword,
      updatedAt: new Date().toISOString(),
    };

    // Save updated user
    await setJson(KEYS.user(session.userId), updatedUser);
    await setJson(KEYS.userByEmail(user.email), updatedUser);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating password:", error);
    return NextResponse.json(
      { error: "Failed to update password" },
      { status: 500 }
    );
  }
}