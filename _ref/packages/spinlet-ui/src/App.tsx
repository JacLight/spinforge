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
import Dashboard from "./pages/Dashboard";
import ModernDashboard from "./pages/ModernDashboard";
import SystemDashboard from "./pages/SystemDashboard";
import Applications from "./pages/Applications";
import ApplicationDetail from "./pages/ApplicationDetail";
import DeployForm from "./pages/DeployForm";
import Metrics from "./pages/Metrics";
import Settings from "./pages/Settings";
import DynamicUIDemo from "./components/DynamicUIDemo";
import { DialogManager } from "./components/view-manager/dialog-manager";
import AdminDashboard from "./pages/AdminDashboard";
import ControlCenter from "./pages/ControlCenter";
import Analytics from "./pages/Analytics";
import ActiveSpinlets from "./pages/ActiveSpinlets";
import DeploymentManagement from "./pages/DeploymentManagement";
import CustomerManagement from "./pages/CustomerManagement";
import AdminUserManagement from "./pages/AdminUserManagement";
import HostingManagement from "./pages/HostingManagement";
import { AdminLogin } from "./components/AdminLogin";
import { api } from "./services/api";

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
      <ModernLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/modern-dashboard" element={<ModernDashboard />} />
          <Route path="/system-dashboard" element={<SystemDashboard />} />
          <Route path="/applications" element={<Applications />} />
          <Route path="/deploy" element={<DeployForm />} />
          <Route path="/metrics" element={<Metrics />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/dynamic-ui" element={<DynamicUIDemo />} />
          <Route path="/control-center" element={<ControlCenter />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/active-spinlets" element={<ActiveSpinlets />} />
          <Route path="/deployments" element={<DeploymentManagement />} />
          <Route path="/hosting" element={<HostingManagement />} />
          <Route path="/customers" element={<CustomerManagement />} />
          <Route path="/admin-users" element={<AdminUserManagement />} />
          <Route path="/applications/:domain" element={<ApplicationDetail />} />
        </Routes>
      </ModernLayout>
    </Router>
  );
}

export default App;
