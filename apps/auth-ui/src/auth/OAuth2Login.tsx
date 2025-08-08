import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { LoadingIndicator } from "@/components/common/loading-indicator";
import appmintLogo from "../assets/appmint-logo.png";
import { localStorageUtils } from "@/utils/localstorage";
import appConfig from "@/config";
import { getResourcePath } from "@/request";
import { appEndpoints } from "@/request/api-endpoints";

interface OAuth2LoginProps {
  onAuthSuccess?: (authData: any) => void;
}

interface OAuth2Params {
  client_id?: string;
  redirect_uri?: string;
  response_type?: string;
  scope?: string;
  state?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  org_id?: string;
  dev_environment?: string;
  site_name?: string;
  api_key?: string;
}

export function OAuth2Login({ onAuthSuccess }: OAuth2LoginProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oauth2Params, setOAuth2Params] = useState<OAuth2Params>({});
  const [authCode, setAuthCode] = useState<string | null>(null);
  const [validating, setValidating] = useState(true);

  useEffect(() => {
    validateOAuth2Request();
  }, [searchParams]);

  const validateOAuth2Request = () => {
    const params: OAuth2Params = {
      client_id: searchParams.get("client_id") || undefined,
      redirect_uri: searchParams.get("redirect_uri") || undefined,
      response_type: searchParams.get("response_type") || undefined,
      scope: searchParams.get("scope") || undefined,
      state: searchParams.get("state") || undefined,
      code_challenge: searchParams.get("code_challenge") || undefined,
      code_challenge_method: searchParams.get("code_challenge_method") || undefined,
      org_id: searchParams.get("org_id") || searchParams.get("orgId") || undefined,
      dev_environment: searchParams.get("dev_environment") || searchParams.get("devEnvironment") || undefined,
      site_name: searchParams.get("site_name") || searchParams.get("siteName") || undefined,
      api_key: searchParams.get("api_key") || searchParams.get("apiKey") || undefined,
    };

    // Store OAuth2 params in session for later use
    sessionStorage.setItem("oauth2_params", JSON.stringify(params));
    
    // Validate required OAuth2 parameters
    if (!params.client_id) {
      setError("Missing required parameter: client_id");
      setValidating(false);
      return;
    }

    if (!params.redirect_uri) {
      setError("Missing required parameter: redirect_uri");
      setValidating(false);
      return;
    }

    if (params.response_type !== "code" && params.response_type !== "token") {
      setError("Invalid response_type. Must be 'code' or 'token'");
      setValidating(false);
      return;
    }

    setOAuth2Params(params);
    setValidating(false);
  };

  const handleLogin = async (email: string, password: string) => {
    setLoading(true);
    setError(null);

    try {
      // First authenticate the user with all OAuth2 params
      const loginResponse = await axios.post(
        getResourcePath(appEndpoints.login.name),
        { 
          email, 
          password,
          orgId: oauth2Params.org_id,
          siteName: oauth2Params.site_name,
          devEnvironment: oauth2Params.dev_environment,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "X-Client-Id": oauth2Params.client_id,
            "X-API-Key": oauth2Params.api_key || "",
            "X-Org-Id": oauth2Params.org_id || "",
            "X-Site-Name": oauth2Params.site_name || "",
            "X-Dev-Environment": oauth2Params.dev_environment || "",
            "orgid": oauth2Params.org_id || oauth2Params.site_name || "",
          },
        }
      );

      const { token, user } = loginResponse.data;

      // Generate authorization code or token based on response_type
      if (oauth2Params.response_type === "code") {
        // Exchange for authorization code with all metadata
        const codeResponse = await axios.post(
          getResourcePath(appEndpoints.oauth2_authorize.name),
          {
            client_id: oauth2Params.client_id,
            user_id: user.sk,
            scope: oauth2Params.scope,
            code_challenge: oauth2Params.code_challenge,
            code_challenge_method: oauth2Params.code_challenge_method,
            org_id: oauth2Params.org_id,
            site_name: oauth2Params.site_name,
            dev_environment: oauth2Params.dev_environment,
            api_key: oauth2Params.api_key,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        const authorizationCode = codeResponse.data.code;
        setAuthCode(authorizationCode);

        // Redirect back to client with authorization code and additional data
        const redirectUrl = new URL(oauth2Params.redirect_uri!);
        redirectUrl.searchParams.set("code", authorizationCode);
        if (oauth2Params.state) {
          redirectUrl.searchParams.set("state", oauth2Params.state);
        }
        // Include additional data in redirect
        if (oauth2Params.org_id) {
          redirectUrl.searchParams.set("org_id", oauth2Params.org_id);
        }
        if (oauth2Params.site_name) {
          redirectUrl.searchParams.set("site_name", oauth2Params.site_name);
        }
        if (oauth2Params.dev_environment) {
          redirectUrl.searchParams.set("dev_environment", oauth2Params.dev_environment);
        }

        // Call success callback if provided
        if (onAuthSuccess) {
          onAuthSuccess({
            token,
            user,
            authorizationCode,
            redirect_uri: redirectUrl.toString(),
          });
        }

        // Redirect to client application
        setTimeout(() => {
          window.location.href = redirectUrl.toString();
        }, 1000);
      } else if (oauth2Params.response_type === "token") {
        // Implicit flow - return token directly with additional data
        const redirectUrl = new URL(oauth2Params.redirect_uri!);
        
        // For implicit flow, use fragment (#) instead of query params
        const fragmentParams: any = {
          access_token: token,
          token_type: "Bearer",
          expires_in: "3600",
          ...(oauth2Params.state && { state: oauth2Params.state }),
          ...(oauth2Params.org_id && { org_id: oauth2Params.org_id }),
          ...(oauth2Params.site_name && { site_name: oauth2Params.site_name }),
          ...(oauth2Params.dev_environment && { dev_environment: oauth2Params.dev_environment }),
          ...(oauth2Params.api_key && { api_key: oauth2Params.api_key }),
        };
        
        const fragment = new URLSearchParams(fragmentParams).toString();
        redirectUrl.hash = fragment;

        if (onAuthSuccess) {
          onAuthSuccess({
            token,
            user,
            redirect_uri: redirectUrl.toString(),
          });
        }

        setTimeout(() => {
          window.location.href = redirectUrl.toString();
        }, 1000);
      }

      // Store auth data locally
      localStorageUtils.set("session", {
        token,
        user,
        oauth_client: oauth2Params.client_id,
      });

    } catch (err: any) {
      setError(err.response?.data?.message || "Authentication failed");
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    handleLogin(email, password);
  };

  if (validating) {
    return <LoadingIndicator />;
  }

  if (error && !loading) {
    return (
      <div className="fixed inset-0 bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md p-8 shadow-xl bg-white rounded-2xl">
          <div className="flex justify-center mb-6">
            <img src={appmintLogo} alt="AppMint Logo" className="h-12 w-auto" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-semibold text-red-600 mb-2">OAuth2 Error</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => navigate("/login")}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
            >
              Go to Standard Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md p-8 shadow-xl bg-white rounded-2xl">
        <div className="flex justify-center mb-6">
          <img src={appmintLogo} alt="AppMint Logo" className="h-12 w-auto" />
        </div>

        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-2">OAuth2 Authorization</h1>
          <p className="text-gray-600 text-sm mb-2">
            {oauth2Params.client_id} is requesting access to your account
          </p>
          
          <div className="mt-3 space-y-1">
            {oauth2Params.site_name && (
              <p className="text-gray-500 text-xs">
                <span className="font-semibold">Site:</span> {oauth2Params.site_name}
              </p>
            )}
            {oauth2Params.org_id && (
              <p className="text-gray-500 text-xs">
                <span className="font-semibold">Organization:</span> {oauth2Params.org_id}
              </p>
            )}
            {oauth2Params.dev_environment && (
              <p className="text-gray-500 text-xs">
                <span className="font-semibold">Environment:</span> {oauth2Params.dev_environment}
              </p>
            )}
            {oauth2Params.scope && (
              <p className="text-gray-500 text-xs">
                <span className="font-semibold">Scopes:</span> {oauth2Params.scope}
              </p>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Authorizing...</p>
          </div>
        ) : authCode ? (
          <div className="text-center py-8">
            <div className="text-green-600 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-gray-600">Authorization successful!</p>
            <p className="text-sm text-gray-500 mt-2">Redirecting...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="email"
                name="email"
                required
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-300 focus:border-purple-500 transition"
                placeholder="Email"
              />
            </div>

            <div>
              <input
                type="password"
                name="password"
                required
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-300 focus:border-purple-500 transition"
                placeholder="Password"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  // Cancel OAuth2 flow and redirect back with error
                  const redirectUrl = new URL(oauth2Params.redirect_uri!);
                  redirectUrl.searchParams.set("error", "access_denied");
                  redirectUrl.searchParams.set("error_description", "User denied access");
                  if (oauth2Params.state) {
                    redirectUrl.searchParams.set("state", oauth2Params.state);
                  }
                  window.location.href = redirectUrl.toString();
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
              >
                Authorize
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 text-center">
          <a
            href="/login"
            className="text-sm text-purple-600 hover:underline"
          >
            Use standard login instead
          </a>
        </div>
      </div>
    </div>
  );
}