import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from "axios";

class ApiClient {
  private client: AxiosInstance;
  private isRefreshing = false;
  private refreshPromise: Promise<any> | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: "/api",
      timeout: 30000,
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem("auth-token");
        const user = localStorage.getItem("user");
        
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        
        if (user) {
          try {
            const userData = JSON.parse(user);
            if (userData.customerId) {
              config.headers["X-Customer-ID"] = userData.customerId;
            }
          } catch (e) {
            console.error("Error parsing user data:", e);
          }
        }
        
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle 401s
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & {
          _retry?: boolean;
        };

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          // If already refreshing, wait for it
          if (this.isRefreshing) {
            try {
              await this.refreshPromise;
              return this.client(originalRequest);
            } catch (refreshError) {
              this.redirectToLogin();
              return Promise.reject(refreshError);
            }
          }

          this.isRefreshing = true;
          this.refreshPromise = this.refreshToken();

          try {
            const { token } = await this.refreshPromise;
            localStorage.setItem("auth-token", token);
            
            // Retry original request with new token
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return this.client(originalRequest);
          } catch (refreshError) {
            this.redirectToLogin();
            return Promise.reject(refreshError);
          } finally {
            this.isRefreshing = false;
            this.refreshPromise = null;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private async refreshToken() {
    const refreshToken = localStorage.getItem("refresh-token");
    
    if (!refreshToken) {
      throw new Error("No refresh token available");
    }

    try {
      const response = await axios.post("/api/auth/refresh", {
        refreshToken,
      });
      
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  private redirectToLogin() {
    // Clear auth data
    localStorage.removeItem("auth-token");
    localStorage.removeItem("refresh-token");
    localStorage.removeItem("user");
    
    // Redirect to login
    window.location.href = "/login";
  }

  // Convenience methods
  get(url: string, config?: any) {
    return this.client.get(url, config);
  }

  post(url: string, data?: any, config?: any) {
    return this.client.post(url, data, config);
  }

  put(url: string, data?: any, config?: any) {
    return this.client.put(url, data, config);
  }

  delete(url: string, config?: any) {
    return this.client.delete(url, config);
  }
}

// Export singleton instance
export const apiClient = new ApiClient();