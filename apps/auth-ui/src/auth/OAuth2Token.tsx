import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import appConfig from "@/config";
import { getResourcePath } from "@/request";
import { appEndpoints } from "@/request/api-endpoints";

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  org_id?: string;
  site_name?: string;
  dev_environment?: string;
  api_key?: string;
}

export function OAuth2Token() {
  const [searchParams] = useSearchParams();
  const [tokenData, setTokenData] = useState<TokenResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    handleTokenExchange();
  }, [searchParams]);

  const handleTokenExchange = async () => {
    const grantType = searchParams.get("grant_type");
    const code = searchParams.get("code");
    const clientId = searchParams.get("client_id");
    const clientSecret = searchParams.get("client_secret");
    const redirectUri = searchParams.get("redirect_uri");
    const codeVerifier = searchParams.get("code_verifier");
    const refreshToken = searchParams.get("refresh_token");
    
    // Additional parameters
    const orgId = searchParams.get("org_id") || searchParams.get("orgId");
    const siteName = searchParams.get("site_name") || searchParams.get("siteName");
    const devEnvironment = searchParams.get("dev_environment") || searchParams.get("devEnvironment");
    const apiKey = searchParams.get("api_key") || searchParams.get("apiKey");

    // Validate required parameters based on grant type
    if (!grantType) {
      setError("Missing required parameter: grant_type");
      setLoading(false);
      return;
    }

    if (!clientId) {
      setError("Missing required parameter: client_id");
      setLoading(false);
      return;
    }

    try {
      let response;
      
      if (grantType === "authorization_code") {
        if (!code) {
          setError("Missing required parameter: code");
          setLoading(false);
          return;
        }

        response = await axios.post(
          getResourcePath(appEndpoints.oauth2_token.name),
          {
            grant_type: grantType,
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier,
            org_id: orgId,
            site_name: siteName,
            dev_environment: devEnvironment,
            api_key: apiKey,
          },
          {
            headers: {
              "Content-Type": "application/json",
              "X-Org-Id": orgId || "",
              "X-Site-Name": siteName || "",
              "X-Dev-Environment": devEnvironment || "",
              "X-API-Key": apiKey || "",
            },
          }
        );
      } else if (grantType === "refresh_token") {
        if (!refreshToken) {
          setError("Missing required parameter: refresh_token");
          setLoading(false);
          return;
        }

        response = await axios.post(
          getResourcePath(appEndpoints.oauth2_token.name),
          {
            grant_type: grantType,
            refresh_token: refreshToken,
            client_id: clientId,
            client_secret: clientSecret,
            org_id: orgId,
            site_name: siteName,
            dev_environment: devEnvironment,
            api_key: apiKey,
          },
          {
            headers: {
              "Content-Type": "application/json",
              "X-Org-Id": orgId || "",
              "X-Site-Name": siteName || "",
              "X-Dev-Environment": devEnvironment || "",
              "X-API-Key": apiKey || "",
            },
          }
        );
      } else if (grantType === "client_credentials") {
        if (!clientSecret) {
          setError("Missing required parameter: client_secret");
          setLoading(false);
          return;
        }

        response = await axios.post(
          getResourcePath(appEndpoints.oauth2_token.name),
          {
            grant_type: grantType,
            client_id: clientId,
            client_secret: clientSecret,
            scope: searchParams.get("scope"),
            org_id: orgId,
            site_name: siteName,
            dev_environment: devEnvironment,
            api_key: apiKey,
          },
          {
            headers: {
              "Content-Type": "application/json",
              "X-Org-Id": orgId || "",
              "X-Site-Name": siteName || "",
              "X-Dev-Environment": devEnvironment || "",
              "X-API-Key": apiKey || "",
            },
          }
        );
      } else {
        setError(`Unsupported grant_type: ${grantType}`);
        setLoading(false);
        return;
      }

      const tokenResponse: TokenResponse = response.data;
      setTokenData(tokenResponse);
      setLoading(false);

      // If this is being called from an iframe or popup, post message to parent
      if (window.opener || window.parent !== window) {
        const target = window.opener || window.parent;
        target.postMessage(
          {
            type: "oauth2_token",
            data: tokenResponse,
          },
          "*"
        );
      }

    } catch (err: any) {
      const errorMessage = err.response?.data?.error_description || 
                          err.response?.data?.message || 
                          "Token exchange failed";
      setError(errorMessage);
      setLoading(false);

      // Send error to parent if in iframe/popup
      if (window.opener || window.parent !== window) {
        const target = window.opener || window.parent;
        target.postMessage(
          {
            type: "oauth2_error",
            error: err.response?.data?.error || "invalid_request",
            error_description: errorMessage,
          },
          "*"
        );
      }
    }
  };

  // Render JSON response (this endpoint typically returns JSON, not HTML)
  if (!loading && tokenData) {
    return (
      <pre>{JSON.stringify(tokenData, null, 2)}</pre>
    );
  }

  if (!loading && error) {
    return (
      <pre>{JSON.stringify({
        error: "invalid_request",
        error_description: error,
      }, null, 2)}</pre>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
    </div>
  );
}