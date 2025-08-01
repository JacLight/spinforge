import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = process.env.GITHUB_CALLBACK_URL;
  
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "GitHub OAuth not configured" },
      { status: 500 }
    );
  }

  // GitHub OAuth authorization URL
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "user:email",
    allow_signup: "true",
  });

  const authUrl = `https://github.com/login/oauth/authorize?${params}`;
  
  return NextResponse.redirect(authUrl);
}