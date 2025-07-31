import { useState, useEffect } from 'react';

export default function Home() {
  const [apiTests, setApiTests] = useState({});
  const [loading, setLoading] = useState({});

  useEffect(() => {
    // Test health endpoint on mount
    testEndpoint('health');
  }, []);

  const testEndpoint = async (endpoint) => {
    setLoading(prev => ({ ...prev, [endpoint]: true }));
    
    try {
      const response = await fetch(`/api/${endpoint}`);
      const data = await response.json();
      setApiTests(prev => ({ ...prev, [endpoint]: { success: true, data } }));
    } catch (error) {
      setApiTests(prev => ({ ...prev, [endpoint]: { success: false, error: error.message } }));
    } finally {
      setLoading(prev => ({ ...prev, [endpoint]: false }));
    }
  };

  return (
    <div style={{ padding: '2rem', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '3rem', color: '#0070f3' }}>SpinForge Next.js Test Application</h1>
        <p style={{ fontSize: '1.2rem', color: '#666' }}>Full-stack Next.js app with SSR, API routes, and more</p>
      </header>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
        <div style={{ background: '#f5f5f5', padding: '1.5rem', borderRadius: '8px' }}>
          <h2>Deployment Info</h2>
          <p><strong>Framework:</strong> Next.js</p>
          <p><strong>Deployment Method:</strong> {process.env.NEXT_PUBLIC_DEPLOY_METHOD || 'Unknown'}</p>
          <p><strong>Build Time:</strong> {new Date().toISOString()}</p>
          <p><strong>Environment:</strong> {process.env.NODE_ENV}</p>
        </div>
        
        <div style={{ background: '#f5f5f5', padding: '1.5rem', borderRadius: '8px' }}>
          <h2>Features</h2>
          <ul>
            <li>✓ Server-Side Rendering (SSR)</li>
            <li>✓ API Routes</li>
            <li>✓ Static Generation</li>
            <li>✓ Image Optimization</li>
            <li>✓ Built-in CSS Support</li>
          </ul>
        </div>
        
        <div style={{ background: '#f5f5f5', padding: '1.5rem', borderRadius: '8px' }}>
          <h2>Health Status</h2>
          {apiTests.health ? (
            <div>
              <p style={{ color: apiTests.health.success ? '#10b981' : '#ef4444' }}>
                <strong>Status:</strong> {apiTests.health.data?.status || 'Error'}
              </p>
              {apiTests.health.data?.uptime && (
                <p><strong>Uptime:</strong> {Math.floor(apiTests.health.data.uptime)}s</p>
              )}
            </div>
          ) : (
            <p>Checking...</p>
          )}
        </div>
      </div>
      
      <div style={{ background: '#fff', border: '1px solid #e5e5e5', padding: '2rem', borderRadius: '8px' }}>
        <h2>API Endpoint Tests</h2>
        <p>Test the Next.js API routes:</p>
        
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <button 
            onClick={() => testEndpoint('test')}
            disabled={loading.test}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading.test ? 'not-allowed' : 'pointer',
              opacity: loading.test ? 0.5 : 1
            }}
          >
            Test /api/test
          </button>
          
          <button 
            onClick={() => testEndpoint('info')}
            disabled={loading.info}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading.info ? 'not-allowed' : 'pointer',
              opacity: loading.info ? 0.5 : 1
            }}
          >
            Test /api/info
          </button>
          
          <button 
            onClick={() => testEndpoint('echo?message=Hello+SpinForge')}
            disabled={loading['echo?message=Hello+SpinForge']}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading['echo?message=Hello+SpinForge'] ? 'not-allowed' : 'pointer',
              opacity: loading['echo?message=Hello+SpinForge'] ? 0.5 : 1
            }}
          >
            Test /api/echo
          </button>
        </div>
        
        <div style={{ marginTop: '2rem' }}>
          {Object.entries(apiTests).map(([endpoint, result]) => (
            endpoint !== 'health' && (
              <div key={endpoint} style={{ marginBottom: '1rem', padding: '1rem', background: '#f5f5f5', borderRadius: '4px' }}>
                <strong>Endpoint:</strong> /api/{endpoint}<br />
                <strong>Success:</strong> {result.success ? '✅' : '❌'}<br />
                <pre style={{ marginTop: '0.5rem', overflow: 'auto' }}>
                  {JSON.stringify(result.data || result.error, null, 2)}
                </pre>
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  );
}