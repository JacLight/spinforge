/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 *
 * customer-ui is a literal fork of admin-ui. Auth is swapped to CustomerLogin
 * (POST /_auth/customer/login) and the session token is mirrored into
 * `adminToken` so the existing axios interceptor in services/axios-config.ts
 * keeps sending Authorization on /_admin/* requests. Admin-only routes
 * (/admin, /system-dashboard, /customers, /admin-users, /partners,
 * /email-templates, /platform/*, /templates, /certificates, /activity,
 * /dynamic-ui) are removed — a customer never sees those.
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
import Applications from "./pages/Applications";
import Deploy from "./pages/Deploy";
import Settings from "./pages/Settings";
import { DialogManager } from "./components/view-manager/dialog-manager";
import ActiveSpinlets from "./pages/ActiveSpinlets";
import ContainerDashboard from "./pages/ContainerDashboard";
import AdminProfile from "./pages/AdminProfile";
import { CustomerLogin } from "./components/CustomerLogin";
import { api } from "./services/api";
import SystemHealthAlert from "./components/SystemHealthAlert";
import ApplicationDetail from "./pages/ApplicationsDetail";
import Templates from "./pages/Templates";
import AdminActivity from "./pages/AdminActivity";
import BuildJobs from "./pages/build/Jobs";
import BuildJobDetail from "./pages/build/JobDetail";
import BuildSigning from "./pages/build/Signing";
import BuildSessions from "./pages/build/Sessions";
import BuildRunners from "./pages/build/Runners";
import BuildSubmitJob from "./pages/build/SubmitJob";
import BuildDeployments from "./pages/build/Deployments";
import BuildDeploymentDetail from "./pages/build/DeploymentDetail";
import BuildNewDeployment from "./pages/build/NewDeployment";
import Pipelines from "./pages/pipelines/Pipelines";
import PipelineBuilds from "./pages/pipelines/Builds";
import PipelineArtifacts from "./pages/pipelines/Artifacts";
import PipelineActions from "./pages/pipelines/Actions";
import { ConfirmProvider } from "./components/ConfirmModal";
import CommandPalette from "./components/CommandPalette";
import { persistSession, type CustomerSession } from "./services/customerAuth";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // An emailed sign-in or reset link always wins over whatever session is
    // in storage — otherwise clicking the link on a device that's still
    // "logged in" silently drops the token on the floor, and someone
    // resetting a password because they're locked out never sees the form.
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    if (mode === "magic" || mode === "reset" || mode === "forgot") {
      setIsLoading(false);
      return;
    }

    const stored = localStorage.getItem("authToken") || localStorage.getItem("adminToken");
    // Sessions written by the old handleLogin stored the string "undefined".
    const sessionToken = stored && stored !== "undefined" && stored !== "null" ? stored : null;
    if (sessionToken) {
      localStorage.setItem("adminToken", sessionToken);
      api.setAdminToken(sessionToken);
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  // `session.token` — not `authToken`, which this used to read. That field
  // doesn't exist on CustomerSession, so every login stored the literal
  // string "undefined" as the bearer token and the dashboard 401'd on every
  // request until a page reload picked the real token back out of storage.
  const handleLogin = (session: CustomerSession) => {
    persistSession(session);
    localStorage.setItem("adminToken", session.token);
    api.setAdminToken(session.token);
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
    return (
      <>
        <CustomerLogin onLogin={handleLogin} />
        <Toaster position="top-right" richColors />
      </>
    );
  }
  return (
    <ConfirmProvider>
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
        <CommandPalette />
        <ModernLayout>
          <Routes>
            <Route path="/" element={<Navigate to="/applications" replace />} />
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/applications" element={<Applications />} />
            <Route path="/applications/:domain" element={<ApplicationDetail />} />
            <Route path="/dashboard" element={<UnifiedDashboard />} />
            <Route path="/deploy" element={<Deploy />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/active-spinlets" element={<ActiveSpinlets />} />
            <Route path="/profile" element={<AdminProfile />} />
            <Route path="/dashboard/containers/:domain" element={<ContainerDashboard />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/activity" element={<AdminActivity />} />
            <Route path="/build" element={<Navigate to="/build/deployments" replace />} />
            <Route path="/build/deployments" element={<BuildDeployments />} />
            <Route path="/build/deployments/:id" element={<BuildDeploymentDetail />} />
            <Route path="/build/new" element={<BuildNewDeployment />} />
            <Route path="/build/jobs" element={<BuildJobs />} />
            <Route path="/build/jobs/:id" element={<BuildJobDetail />} />
            <Route path="/build/signing" element={<BuildSigning />} />
            <Route path="/build/sessions" element={<BuildSessions />} />
            <Route path="/build/runners" element={<BuildRunners />} />
            <Route path="/build/submit" element={<BuildSubmitJob />} />
            <Route path="/pipelines" element={<Pipelines />} />
            <Route path="/pipelines/builds" element={<PipelineBuilds />} />
            <Route path="/pipelines/artifacts" element={<PipelineArtifacts />} />
            <Route path="/pipelines/actions" element={<PipelineActions />} />
            <Route path="*" element={<Navigate to="/applications" replace />} />
          </Routes>
        </ModernLayout>
      </Router>
    </ConfirmProvider>
  );
}

export default App;
