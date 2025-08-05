"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

interface User {
  email: string;
  customerId: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem("auth-token");
    const storedUser = localStorage.getItem("user");

    if (token && storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        
        // Set axios default headers
        axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        axios.defaults.headers.common["X-Customer-ID"] = userData.customerId;
      } catch (error) {
        console.error("Error parsing user data:", error);
        logout();
      }
    }
    
    setIsLoading(false);
  };

  const login = async (email: string, password: string) => {
    const response = await axios.post("/api/auth/login", { email, password });
    
    if (response.data.success) {
      const { token, refreshToken, user } = response.data;
      
      // Store auth data
      localStorage.setItem("auth-token", token);
      localStorage.setItem("refresh-token", refreshToken);
      localStorage.setItem("user", JSON.stringify(user));
      
      // Set axios default headers
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      axios.defaults.headers.common["X-Customer-ID"] = user.customerId;
      
      setUser(user);
    }
  };

  const logout = async () => {
    try {
      await axios.post("/api/auth/logout");
    } catch (error) {
      console.error("Logout error:", error);
    }
    
    localStorage.removeItem("auth-token");
    localStorage.removeItem("refresh-token");
    localStorage.removeItem("user");
    delete axios.defaults.headers.common["Authorization"];
    delete axios.defaults.headers.common["X-Customer-ID"];
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}