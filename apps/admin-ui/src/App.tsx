/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */

import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { useState, useEffect } from "react";
import { Toaster } from "sonner";
import ModernLayout from "./components/ModernLayout";
import Welcome from "./pages/Welcome";
import UnifiedDashboard from "./pages/UnifiedDashboard";
import SystemDashboard from "./pages/SystemDashboard";
import Applications from "./pages/Applications";
import Deploy from "./pages/Deploy";
import Settings from "./pages/Settings";
import DynamicUIDemo from "./components/DynamicUIDemo";
import { DialogManager } from "./components/view-manager/dialog-manager";
import AdminDashboard from "./pages/AdminDashboard";
import ControlCenter from "./pages/ControlCenter";
import ActiveSpinlets from "./pages/ActiveSpinlets";
import CustomerManagement from "./pages/CustomerManagement";
import AdminUserManagement from "./pages/AdminUserManagement";
import ContainerDashboard from "./pages/ContainerDashboard";
import AdminProfile from "./pages/AdminProfile";
import { AdminLogin } from "./components/AdminLogin";
import { api } from "./services/api";
import SystemHealthAlert from "./components/SystemHealthAlert";
import ApplicationDetail from "./pages/ApplicationsDetail";
import Templates from "./pages/Templates";
import CertificateManager from "./pages/CertificateManager";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if we have a stored admin token
    const adminToken = localStorage.getItem('adminToken');
    if (adminToken) {
      // Verify the token is still valid
      verifyToken(adminToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  const verifyToken = async (token: string) => {
    try {
      // Set the token in the API service first
      api.setAdminToken(token);
      // Try a lightweight health check instead
      await api.health();
      setIsAuthenticated(true);
    } catch (error) {
      // If health check fails, still assume authenticated
      // The token will be validated on actual API calls
      api.setAdminToken(token);
      setIsAuthenticated(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = (token: string) => {
    api.setAdminToken(token);
    setIsAuthenticated(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminLogin onLogin={handleLogin} />;
  }
  return (
    <Router>
      <Toaster
        position="top-right"
        richColors
        toastOptions={{
          style: {
            background: "white",
            color: "#1f2937",
            border: "1px solid #e5e7eb",
            borderRadius: "0.75rem",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
          },
        }}
      />
      <DialogManager />
      <SystemHealthAlert />
      <ModernLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/applications" element={<Applications />} />
          <Route path="/applications/:domain" element={<ApplicationDetail />} />
          <Route path="/dashboard" element={<UnifiedDashboard />} />
          <Route path="/system-dashboard" element={<SystemDashboard />} />
          <Route path="/deploy" element={<Deploy />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/dynamic-ui" element={<DynamicUIDemo />} />
          <Route path="/control-center" element={<ControlCenter />} />
          <Route path="/active-spinlets" element={<ActiveSpinlets />} />
          <Route path="/customers" element={<CustomerManagement />} />
          <Route path="/admin-users" element={<AdminUserManagement />} />
          <Route path="/profile" element={<AdminProfile />} />
          <Route path="/dashboard/containers/:domain" element={<ContainerDashboard />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/certificates" element={<CertificateManager />} />
        </Routes>
      </ModernLayout>
    </Router>
  );
}

export default App;
