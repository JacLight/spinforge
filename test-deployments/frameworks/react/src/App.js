import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [apiData, setApiData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [healthStatus, setHealthStatus] = useState(null);

  useEffect(() => {
    // Check health on mount
    checkHealth();
  }, []);

  const checkHealth = async () => {
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      setHealthStatus(data);
    } catch (error) {
      setHealthStatus({ status: 'error', message: error.message });
    }
  };

  const testAPI = async (endpoint) => {
    setLoading(true);
    setApiData(null);
    
    try {
      const response = await fetch(`/api/${endpoint}`);
      const data = await response.json();
      setApiData({ success: true, endpoint, data });
    } catch (error) {
      setApiData({ success: false, endpoint, error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const buildTime = new Date().toISOString();

  return (
    <div className="App">
      <header className="App-header">
        <h1>SpinForge React Test Application</h1>
        <p>Full-featured React deployment test with API endpoints</p>
      </header>
      
      <div className="App-content">
        <div className="info-grid">
          <div className="info-card">
            <h2>Deployment Information</h2>
            <p><strong>Framework:</strong> React {React.version}</p>
            <p><strong>Deployment Method:</strong> {process.env.REACT_APP_DEPLOY_METHOD || 'Unknown'}</p>
            <p><strong>Build Time:</strong> {buildTime}</p>
            <p><strong>Environment:</strong> {process.env.NODE_ENV}</p>
          </div>
          
          <div className="info-card">
            <h2>Health Check</h2>
            {healthStatus ? (
              <>
                <p>
                  <strong>Status:</strong> 
                  <span className={`status-badge ${healthStatus.status === 'healthy' ? 'success' : 'error'}`}>
                    {healthStatus.status || 'Unknown'}
                  </span>
                </p>
                {healthStatus.uptime && (
                  <p><strong>Uptime:</strong> {Math.floor(healthStatus.uptime)}s</p>
                )}
              </>
            ) : (
              <p>Checking health...</p>
            )}
          </div>
          
          <div className="info-card">
            <h2>Features</h2>
            <ul style={{ textAlign: 'left' }}>
              <li>✓ Single Page Application</li>
              <li>✓ Client-side routing</li>
              <li>✓ API integration</li>
              <li>✓ Environment variables</li>
              <li>✓ Static asset serving</li>
            </ul>
          </div>
        </div>
        
        <div className="api-test">
          <h2>API Endpoint Tests</h2>
          <p>Test the API endpoints (will work if backend is configured)</p>
          
          <div>
            <button onClick={() => testAPI('test')} disabled={loading}>
              Test /api/test
            </button>
            <button onClick={() => testAPI('info')} disabled={loading}>
              Test /api/info
            </button>
            <button onClick={() => testAPI('echo?message=Hello')} disabled={loading}>
              Test /api/echo
            </button>
          </div>
          
          {loading && <p>Loading...</p>}
          
          {apiData && (
            <div className="api-result">
              <strong>Endpoint:</strong> {apiData.endpoint}<br />
              <strong>Success:</strong> {apiData.success ? 'Yes' : 'No'}<br />
              <strong>Response:</strong>
              <pre>{JSON.stringify(apiData.data || apiData.error, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;