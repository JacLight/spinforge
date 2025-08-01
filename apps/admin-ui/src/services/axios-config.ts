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

// Add request interceptor
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);

    // Add admin token to all admin requests
    if (config.url?.includes("/_admin/")) {
      const adminToken = localStorage.getItem("adminToken");
      if (adminToken) {
        config.headers.set("X-Admin-Token", adminToken);
      }
    }

    // Add customer auth headers for customer API requests
    if (config.url?.includes("/_api/customer/")) {
      const customerId = localStorage.getItem("customerId");
      const authToken = localStorage.getItem("authToken");

      if (customerId) {
        config.headers.set("X-Customer-ID", customerId);
      }
      if (authToken) {
        config.headers.set("Authorization", `Bearer ${authToken}`);
      }
    }

    return config;
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

    // Handle authentication errors
    if (error.response?.status === 401) {
      const isAdminRequest = error.config?.url?.includes("/_admin/");
      const responseData = error.response?.data as any;

      if (isAdminRequest && responseData?.error?.includes("token")) {
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
