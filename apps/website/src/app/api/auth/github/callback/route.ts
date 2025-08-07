/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

const SPINHUB_API_URL = process.env.SPINHUB_API_URL || "http://api:8080";

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

    // Handle GitHub OAuth via backend API
    const authResponse = await fetch(`${SPINHUB_API_URL}/_auth/customer/github`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: primaryEmail,
        githubId: githubUser.id,
        name: githubUser.name || githubUser.login,
        company: githubUser.company,
        login: githubUser.login,
        avatarUrl: githubUser.avatar_url,
      }),
    });

    if (!authResponse.ok) {
      const error = await authResponse.json();
      throw new Error(error.error || "Authentication failed");
    }

    const authData = await authResponse.json();

    // Set cookie and redirect
    const response = NextResponse.redirect(new URL("/dashboard", process.env.APP_URL!));
    response.cookies.set("auth-token", authData.token, {
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