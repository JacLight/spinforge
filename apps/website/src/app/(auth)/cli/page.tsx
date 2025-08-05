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
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Terminal, Copy, Check, ArrowLeft, Key } from "lucide-react";
import axios from "axios";

export default function CLIAuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [token, setToken] = useState("");
  const [copied, setCopied] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string>("");

  const returnUrl = searchParams.get("return_url");
  const cliCallback = searchParams.get("callback") === "true";

  useEffect(() => {
    // Check if user is authenticated
    const authToken = localStorage.getItem("auth-token");
    if (authToken) {
      setIsAuthenticated(true);
      // Auto-generate token if authenticated
      generateToken();
    }
  }, []);

  const generateToken = async () => {
    setIsLoading(true);
    setError(""); // Clear any previous errors
    try {
      const response = await axios.post(
        "/api/tokens/generate",
        {
          name: `CLI Token - ${new Date().toLocaleString()}`,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("auth-token")}`,
          },
        }
      );

      setToken(response.data.token);

      // If callback URL provided, redirect with token
      if (cliCallback && returnUrl) {
        const callbackUrl = new URL(returnUrl);
        callbackUrl.searchParams.set("token", response.data.token);
        callbackUrl.searchParams.set(
          "customerId",
          response.data.user.customerId
        );
        if (response.data.user.email) {
          callbackUrl.searchParams.set("email", response.data.user.email);
        }

        // Redirect to CLI callback
        window.location.href = callbackUrl.toString();
      }
    } catch (error: any) {
      setError(
        error.response?.data?.error ||
          "Failed to generate token. Please try again."
      );
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

  const handleLogin = () => {
    // Store the current URL to return after login
    sessionStorage.setItem("cli-auth-return", window.location.href);
    router.push("/login");
  };

  // Check if returning from login
  useEffect(() => {
    const returnPath = sessionStorage.getItem("cli-auth-return");
    if (returnPath && isAuthenticated) {
      sessionStorage.removeItem("cli-auth-return");
      // Auto-generate token after login
      generateToken();
    }
  }, [isAuthenticated]);

  // Show loading state if callback mode
  if (cliCallback && isAuthenticated && !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-lg text-gray-600">Completing authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="w-full max-w-2xl">
        <div className="bg-white shadow-xl rounded-2xl p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <Link
              href="/"
              className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to SpinForge
            </Link>
            <div className="flex items-center space-x-2">
              <Terminal className="h-6 w-6 text-indigo-600" />
              <span className="text-lg font-semibold">CLI Authentication</span>
            </div>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Authenticate SpinForge CLI
            </h1>
            <p className="text-gray-600">
              Generate an access token for the SpinForge CLI
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600 text-center">{error}</p>
            </div>
          )}

          {!isAuthenticated ? (
            <div className="space-y-6">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-800">
                  You need to be logged in to generate a CLI token
                </p>
              </div>

              <button
                onClick={handleLogin}
                className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
              >
                Login to Generate Token
              </button>

              <div className="text-center">
                <p className="text-sm text-gray-600">
                  Don't have an account?{" "}
                  <Link
                    href="/signup"
                    className="text-indigo-600 hover:text-indigo-500"
                  >
                    Sign up
                  </Link>
                </p>
              </div>
            </div>
          ) : (
            <>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                  <span className="ml-3 text-gray-600">
                    Generating token...
                  </span>
                </div>
              ) : token ? (
                <div className="space-y-6">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <Check className="h-5 w-5 text-green-600 mt-0.5 mr-3" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-green-800">
                          Token generated successfully!
                        </p>
                        <p className="text-xs text-green-700 mt-1">
                          This token will only be shown once. Make sure to copy
                          it.
                        </p>
                      </div>
                    </div>
                  </div>

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

                  <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                    <h3 className="font-medium text-gray-900 flex items-center">
                      <Terminal className="h-5 w-5 mr-2" />
                      Use this token with SpinForge CLI:
                    </h3>

                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">
                          Option 1: Interactive login
                        </p>
                        <code className="block bg-gray-900 text-green-400 p-3 rounded text-sm">
                          spin login --token {token.substring(0, 20)}...
                        </code>
                      </div>

                      <div>
                        <p className="text-sm text-gray-600 mb-1">
                          Option 2: Environment variable
                        </p>
                        <code className="block bg-gray-900 text-green-400 p-3 rounded text-sm">
                          export SPINFORGE_TOKEN="{token.substring(0, 20)}..."
                        </code>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-4">
                    <button
                      onClick={generateToken}
                      className="text-sm text-indigo-600 hover:text-indigo-500 flex items-center"
                    >
                      <Key className="h-4 w-4 mr-1" />
                      Generate New Token
                    </button>

                    <Link
                      href="/dashboard/settings"
                      className="text-sm text-gray-600 hover:text-gray-900"
                    >
                      Manage all tokens →
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <button
                    onClick={generateToken}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                  >
                    Generate CLI Token
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Help text */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>
            Need help? Check out our{" "}
            <Link
              href="/docs/cli/auth"
              className="text-indigo-600 hover:text-indigo-500"
            >
              CLI authentication docs
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
