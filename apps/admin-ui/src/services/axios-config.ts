/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { config } from "../config/environment";

// Create a configured axios instance
const apiClient = axios.create({
  baseURL: config.API_BASE_URL || "",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// True when the URL targets an endpoint that requires admin authentication.
// Matches both /_admin/* and /api/* (the latter was previously unauthenticated
// and is now protected by the admin middleware on the server).
function isAdminUrl(url: string | undefined): boolean {
  if (!url) return false;
  if (url.includes("/_admin/")) return true;
  // Match /api/... but not /_api/customer/... which has its own auth.
  return /(^|\/)api\//.test(url) && !url.includes("/_api/customer/");
}

// Add request interceptor
apiClient.interceptors.request.use(
  (requestConfig: InternalAxiosRequestConfig) => {
    console.log(`[API] ${requestConfig.method?.toUpperCase()} ${requestConfig.url}`);

    // Logged-in admin user → send the session JWT as Authorization: Bearer.
    // The browser NEVER sends machine API keys (X-API-Key); those are for
    // CI/CD and scripts only. If there is no JWT in localStorage the request
    // goes out anonymous and the server returns 401, which the response
    // interceptor below catches and redirects to login.
    if (isAdminUrl(requestConfig.url)) {
      const sessionToken = localStorage.getItem("adminToken");
      if (sessionToken) {
        requestConfig.headers.set("Authorization", `Bearer ${sessionToken}`);
      }
    }

    // Customer dashboard requests use a separate header set against the
    // customer auth middleware. Unaffected by the admin changes above.
    if (requestConfig.url?.includes("/_api/customer/")) {
      const customerId = localStorage.getItem("customerId");
      const authToken = localStorage.getItem("authToken");

      if (customerId) {
        requestConfig.headers.set("X-Customer-ID", customerId);
      }
      if (authToken) {
        requestConfig.headers.set("Authorization", `Bearer ${authToken}`);
      }
    }

    return requestConfig;
  },
  (error) => {
    console.error("[API] Request error:", error);
    return Promise.reject(error);
  }
);

// Add response interceptor
apiClient.interceptors.response.use(
  (response) => {
    console.log(
      `[API] Response ${response.status} from ${response.config.url}`
    );
    return response;
  },
  (error: AxiosError) => {
    console.error("[API] Response error:", {
      url: error.config?.url,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
    });

    // Handle authentication errors: /api/* is admin-gated too, so a 401 from
    // either /_admin/* or /api/* means the stored session JWT is invalid or
    // missing — drop it and force re-login.
    if (error.response?.status === 401) {
      const isAdminRequest = isAdminUrl(error.config?.url);

      if (isAdminRequest) {
        // Clear admin token and reload page to force re-authentication
        localStorage.removeItem("adminToken");
        window.location.href = "/";
        return Promise.reject(
          new Error("Session expired. Please log in again.")
        );
      }
    }

    // Enhance error messages
    let enhancedMessage = error.message;
    if (error.response?.status === 502) {
      enhancedMessage =
        "Cannot connect to SpinHub API (502 Bad Gateway). Please check if the service is running.";
    } else if (error.response?.status === 404) {
      enhancedMessage = `API endpoint not found: ${error.config?.url}`;
    } else if (error.response?.status === 500) {
      const errorData = error.response.data as any;
      enhancedMessage = errorData?.error || "Internal server error";
    } else if (!error.response) {
      enhancedMessage = "Network error: Cannot reach the server";
    }

    const enhancedError = new Error(enhancedMessage);
    (enhancedError as any).originalError = error;
    (enhancedError as any).status = error.response?.status;
    return Promise.reject(enhancedError);
  }
);

export default apiClient;
