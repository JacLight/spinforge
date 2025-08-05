/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Copy, Check, Terminal } from "lucide-react";
import axios from "axios";

export default function CLIAuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callbackSuccess, setCallbackSuccess] = useState(false);

  const returnUrl = searchParams.get("return_url");
  const isCallback = searchParams.get("callback") === "true";

  useEffect(() => {
    // Check if user is authenticated
    const authToken = localStorage.getItem("auth-token");
    
    if (!authToken) {
      // Not logged in - redirect to CLI-specific login page
      const currentUrl = encodeURIComponent(window.location.href);
      router.push(`/auth/cli-login?return=${currentUrl}`);
      return;
    }

    // User is logged in - generate token immediately
    generateToken();
  }, []);

  const generateToken = async () => {
    const authToken = localStorage.getItem("auth-token");
    
    // Don't even try if no auth token
    if (!authToken) {
      console.log("No auth token found, redirecting to login");
      sessionStorage.setItem("cli-auth-return", window.location.href);
      router.push("/login");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log("Auth token exists:", authToken);
      console.log("Sending request with token:", authToken.substring(0, 20) + "...");
      
      const response = await axios.post("/api/tokens/generate", {
        name: `CLI Token - ${new Date().toLocaleString()}`
      }, {
        headers: {
          'x-auth-token': authToken
        },
        withCredentials: true // Include cookies
      });

      setToken(response.data.token);
      
      // If callback URL provided, send token to CLI in background
      if (isCallback && returnUrl) {
        // Send callback in background without redirecting
        try {
          const callbackUrl = new URL(returnUrl);
          callbackUrl.searchParams.set('token', response.data.token);
          callbackUrl.searchParams.set('customerId', response.data.user.customerId);
          if (response.data.user.email) {
            callbackUrl.searchParams.set('email', response.data.user.email);
          }
          
          // Make callback request in background
          fetch(callbackUrl.toString(), {
            method: 'GET',
            mode: 'no-cors' // Allow cross-origin to localhost
          })
            .then(() => {
              setCallbackSuccess(true);
              // No toast needed - we'll show success state in UI
            })
            .catch((err) => {
              console.error("Callback failed:", err);
              // No toast for failure either - user can still copy token
            });
        } catch (err) {
          console.error("Invalid callback URL:", err);
        }
      }
    } catch (error: any) {
      console.error("Token generation error:", error);
      console.error("Error response:", error.response);
      console.error("Error data:", error.response?.data);
      
      if (error.response?.status === 401) {
        // Session invalid - just redirect to login, no error messages
        localStorage.removeItem("auth-token");
        sessionStorage.setItem("cli-auth-return", window.location.href);
        router.push("/login");
        return; // Don't set error state
      } else if (error.response?.status === 403) {
        const errorMessage = "You don't have permission to generate tokens.";
        setError(errorMessage);
        
        toast.error("Permission Denied", {
          description: errorMessage,
          duration: 5000
        });
      } else if (error.response?.status === 500) {
        const errorMessage = "Server error. Please try again later.";
        setError(errorMessage);
        
        toast.error("Server Error", {
          description: errorMessage,
          duration: 5000
        });
      } else {
        // Other errors
        const errorMessage = error.response?.data?.error || 
                           error.response?.data?.message || 
                           error.message || 
                           "An unexpected error occurred";
        
        console.error("Setting error to:", errorMessage);
        setError(errorMessage);
        
        const errorTitle = error.response?.status >= 400 && error.response?.status < 500 
          ? "Request Error" 
          : "Connection Error";
        
        toast.error(errorTitle, {
          description: errorMessage,
          duration: 5000
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const copyToken = async () => {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    toast.success("Token copied to clipboard!");
    setTimeout(() => setCopied(false), 3000);
  };

  // Still loading/redirecting
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-lg text-gray-600">Generating your CLI token...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    const isAuthError = error.includes("session") || error.includes("log in");
    const errorTitle = isAuthError ? "Authentication Error" : "Error";
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-8">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-red-600 text-2xl">!</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{errorTitle}</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            {!isAuthError && (
              <button
                onClick={generateToken}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Try Again
              </button>
            )}
            {isAuthError && (
              <p className="text-sm text-gray-500">Redirecting to login...</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Success - show token
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-2xl w-full bg-white shadow-xl rounded-2xl p-8">
        <div className="text-center mb-6">
          <div className="mx-auto h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {callbackSuccess ? "Authentication Successful!" : "CLI Token Generated!"}
          </h1>
          {isCallback && (
            <div className="space-y-2">
              {callbackSuccess ? (
                <>
                  <p className="text-sm text-gray-600">
                    Your CLI has been authenticated successfully.
                  </p>
                  <p className="text-xs text-gray-500">
                    You can now close this window.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-600">
                    Sending token to your CLI...
                  </p>
                  <p className="text-xs text-gray-500">
                    Keep this window open or copy the token below.
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your CLI Access Token
            </label>
            <div className="relative">
              <input
                type="text"
                value={token}
                readOnly
                className="w-full px-4 py-3 pr-12 bg-gray-50 border border-gray-300 rounded-lg font-mono text-sm"
              />
              <button
                onClick={copyToken}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                {copied ? (
                  <Check className="h-5 w-5 text-green-600" />
                ) : (
                  <Copy className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 flex items-center mb-2">
              <Terminal className="h-5 w-5 mr-2" />
              Use with SpinForge CLI:
            </h3>
            <code className="block bg-gray-900 text-green-400 p-3 rounded text-sm">
              spinforge login --token {token.substring(0, 20)}...
            </code>
          </div>

          {callbackSuccess && isCallback ? (
            <div className="text-center pt-4">
              <button
                onClick={() => window.close()}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Close Window
              </button>
            </div>
          ) : !isCallback ? (
            <div className="text-center pt-4">
              <a
                href="/dashboard"
                className="text-sm text-indigo-600 hover:text-indigo-500"
              >
                Back to Dashboard
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}