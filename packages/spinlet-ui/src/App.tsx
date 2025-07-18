import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import ModernLayout from './components/ModernLayout';
import Welcome from './pages/Welcome';
import Dashboard from './pages/Dashboard';
import ModernDashboard from './pages/ModernDashboard';
import SystemDashboard from './pages/SystemDashboard';
import Applications from './pages/Applications';
import DeployForm from './pages/DeployForm';
import Metrics from './pages/Metrics';
import Settings from './pages/Settings';

function App() {
  // Check if we're in view manager mode
  const isViewManagerMode = window.location.pathname === '/control-center';

  if (isViewManagerMode) {
    return (
      <Router>
        <Toaster 
          position="top-right" 
          richColors 
          toastOptions={{
            style: {
              background: 'white',
              color: '#1f2937',
              border: '1px solid #e5e7eb',
              borderRadius: '0.75rem',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            },
          }}
        />
        <Routes>
        </Routes>
      </Router>
    );
  }

  return (
    <Router>
      <Toaster 
        position="top-right" 
        richColors 
        toastOptions={{
          style: {
            background: 'white',
            color: '#1f2937',
            border: '1px solid #e5e7eb',
            borderRadius: '0.75rem',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          },
        }}
      />
      <ModernLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/welcome" replace />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/modern-dashboard" element={<ModernDashboard />} />
          <Route path="/system-dashboard" element={<SystemDashboard />} />
          <Route path="/applications" element={<Applications />} />
          <Route path="/deploy" element={<DeployForm />} />
          <Route path="/metrics" element={<Metrics />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </ModernLayout>
    </Router>
  );
}

export default App;