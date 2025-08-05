/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { createUser, getUserByEmail } from "@/lib/auth-spinhub";
import { redis, KEYS, setJson, getJson } from "@/lib/redis";
import { nanoid } from "nanoid";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      new URL(`/login?error=${error || "no_code"}`, process.env.APP_URL!)
    );
  }

  try {
    // Exchange code for access token
    const tokenResponse = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    const { access_token } = tokenResponse.data;

    if (!access_token) {
      throw new Error("No access token received");
    }

    // Get user info from GitHub
    const userResponse = await axios.get("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: "application/json",
      },
    });

    // Get user emails (in case primary email is private)
    const emailsResponse = await axios.get("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: "application/json",
      },
    });

    const githubUser = userResponse.data;
    const emails = emailsResponse.data;
    
    // Find primary email
    const primaryEmail = emails.find((e: any) => e.primary)?.email || githubUser.email;

    if (!primaryEmail) {
      throw new Error("No email found in GitHub account");
    }

    // Check if user exists
    let user = await getUserByEmail(primaryEmail);

    if (!user) {
      // Create new user
      user = await createUser({
        email: primaryEmail,
        password: nanoid(32), // Random password for OAuth users
        name: githubUser.name || githubUser.login,
        company: githubUser.company,
      });

      // Store GitHub connection
      await setJson(`github:${githubUser.id}`, {
        userId: user.id,
        email: primaryEmail,
        githubId: githubUser.id,
        login: githubUser.login,
        avatarUrl: githubUser.avatar_url,
      });
    }

    // Create session
    const token = nanoid(32);
    const session = {
      userId: user.id,
      customerId: user.customerId,
      email: user.email,
      role: user.role,
      token,
    };

    // Save session
    await setJson(KEYS.session(token), session, 7 * 24 * 60 * 60);

    // Set cookie and redirect
    const response = NextResponse.redirect(new URL("/dashboard", process.env.APP_URL!));
    response.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error: any) {
    console.error("GitHub OAuth error:", error);
    return NextResponse.redirect(
      new URL(`/login?error=oauth_failed`, process.env.APP_URL!)
    );
  }
}