/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { BarChart, Activity, Play, Square, Zap, FileText, TrendingUp, Webhook } from "lucide-react";
import Link from "next/link";

export default function MonitoringAPIPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <div className="flex items-center mb-6">
        <BarChart className="h-8 w-8 text-orange-600 mr-3" />
        <h1 className="text-3xl font-bold text-gray-900 mb-0">Monitoring & Metrics API</h1>
      </div>
      
      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Overview</h2>
        <p className="text-gray-600 mb-4">
          Monitor application performance, resource usage, and access real-time logs for your deployments.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Base URL</h2>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto"><code>Production: https://api.spinforge.app
Development: http://localhost:3000</code></pre>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Authentication</h2>
        <p className="text-gray-600 mb-4">All endpoints require authentication via:</p>
        <ul className="list-disc list-inside text-gray-600 space-y-1">
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">Authorization: Bearer &lt;token&gt;</code></li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">X-Auth-Token: &lt;token&gt;</code></li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">Cookie: auth-token=&lt;token&gt;</code></li>
        </ul>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-8">
        <div className="flex items-center mb-4">
          <Zap className="h-6 w-6 text-blue-600 mr-2" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-0">1. Spinlets Overview</h2>
        </div>
        
        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">GET /api/spinlets</code></h3>
        <p className="text-gray-600 mb-4">Get overview of all spinlets (serverless functions) and their metrics.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <p className="text-gray-600 mb-2"><strong>Success (200 OK)</strong></p>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "spinlets": {
    "total": 5,
    "active": 3,
    "idle": 2,
    "instances": [
      {
        "id": "spinlet_abc123",
        "name": "auth-service",
        "status": "active",
        "region": "us-east-1",
        "runtime": "nodejs18",
        "memory": "128MB",
        "timeout": 30,
        "invocations": 1543,
        "errors": 2,
        "avgDuration": "45ms",
        "lastInvoked": "2025-01-15T15:30:00Z"
      },
      {
        "id": "spinlet_xyz789",
        "name": "image-processor",
        "status": "idle",
        "region": "us-east-1",
        "runtime": "python39",
        "memory": "256MB",
        "timeout": 60,
        "invocations": 234,
        "errors": 0,
        "avgDuration": "230ms",
        "lastInvoked": "2025-01-15T10:15:00Z"
      }
    ]
  }
}`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Example - Axios</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-javascript">{`import axios from 'axios';

const getSpinlets = async () => {
  try {
    const token = localStorage.getItem('auth-token');
    const response = await axios.get('https://api.spinforge.app/api/spinlets', {
      headers: {
        'Authorization': \`Bearer \${token}\`
      }
    });
    
    console.log(\`Total spinlets: \${response.data.spinlets.total}\`);
    return response.data.spinlets;
  } catch (error) {
    console.error('Failed to fetch spinlets:', error.response?.data?.error);
  }
};`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-8">
        <div className="flex items-center mb-4">
          <Activity className="h-6 w-6 text-green-600 mr-2" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-0">2. Get Spinlet Details</h2>
        </div>
        
        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">GET /api/spinlets/[id]</code></h3>
        <p className="text-gray-600 mb-4">Get detailed information about a specific spinlet.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Path Parameters</h4>
        <ul className="list-disc list-inside text-gray-600 space-y-1 mb-6">
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">id</code>: Spinlet ID</li>
        </ul>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <p className="text-gray-600 mb-2"><strong>Success (200 OK)</strong></p>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "spinlet": {
    "id": "spinlet_abc123",
    "name": "auth-service",
    "status": "active",
    "region": "us-east-1",
    "runtime": "nodejs18",
    "handler": "index.handler",
    "memory": "128MB",
    "timeout": 30,
    "environment": {
      "NODE_ENV": "production",
      "API_KEY": "***"
    },
    "triggers": [
      {
        "type": "http",
        "method": "POST",
        "path": "/auth/verify"
      },
      {
        "type": "schedule",
        "expression": "rate(5 minutes)"
      }
    ],
    "metrics": {
      "invocations": {
        "total": 1543,
        "success": 1541,
        "errors": 2,
        "throttles": 0
      },
      "duration": {
        "avg": "45ms",
        "min": "12ms",
        "max": "320ms",
        "p50": "38ms",
        "p95": "89ms",
        "p99": "215ms"
      },
      "cost": {
        "compute": "$0.023",
        "requests": "$0.002",
        "total": "$0.025"
      }
    },
    "lastInvoked": "2025-01-15T15:30:00Z",
    "createdAt": "2025-01-10T08:00:00Z",
    "updatedAt": "2025-01-14T12:00:00Z"
  }
}`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-8">
        <div className="flex items-center mb-4">
          <FileText className="h-6 w-6 text-purple-600 mr-2" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-0">3. Get Spinlet Logs</h2>
        </div>
        
        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">GET /api/spinlets/[id]/logs</code></h3>
        <p className="text-gray-600 mb-4">Retrieve logs for a specific spinlet.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Query Parameters</h4>
        <ul className="list-disc list-inside text-gray-600 space-y-1 mb-6">
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">startTime</code> (optional): Start time (ISO 8601 format)</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">endTime</code> (optional): End time (ISO 8601 format)</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">limit</code> (optional): Number of log entries (default: 100, max: 1000)</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">filter</code> (optional): Filter logs by keyword</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">level</code> (optional): Log level (<code>info</code>, <code>warn</code>, <code>error</code>, <code>debug</code>)</li>
        </ul>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <p className="text-gray-600 mb-2"><strong>Success (200 OK)</strong></p>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "logs": [
    {
      "timestamp": "2025-01-15T15:30:45.123Z",
      "level": "info",
      "message": "Request received for user authentication",
      "requestId": "req_123abc",
      "duration": "42ms",
      "memory": "45MB"
    },
    {
      "timestamp": "2025-01-15T15:30:46.789Z",
      "level": "error",
      "message": "Database connection timeout",
      "requestId": "req_456def",
      "error": {
        "type": "TimeoutError",
        "message": "Connection timeout after 5000ms",
        "stack": "TimeoutError: Connection timeout..."
      }
    }
  ],
  "nextToken": "eyJzdGFydFRpbWUiOjE2NDI..."
}`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Example - Axios</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-javascript">{`const getSpinletLogs = async (spinletId, options = {}) => {
  try {
    const token = localStorage.getItem('auth-token');
    const params = new URLSearchParams({
      limit: options.limit || 100,
      level: options.level || 'all',
      ...(options.startTime && { startTime: options.startTime }),
      ...(options.endTime && { endTime: options.endTime }),
      ...(options.filter && { filter: options.filter })
    });
    
    const response = await axios.get(
      \`https://api.spinforge.app/api/spinlets/\${spinletId}/logs?\${params}\`,
      {
        headers: {
          'Authorization': \`Bearer \${token}\`
        }
      }
    );
    
    console.log(\`Retrieved \${response.data.logs.length} log entries\`);
    return response.data.logs;
  } catch (error) {
    console.error('Failed to fetch logs:', error.response?.data?.error);
  }
};

// Usage
getSpinletLogs('spinlet_abc123', {
  limit: 50,
  level: 'error',
  startTime: new Date(Date.now() - 3600000).toISOString() // Last hour
});`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-8">
        <div className="flex items-center mb-4">
          <Play className="h-6 w-6 text-green-600 mr-2" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-0">4. Restart Spinlet</h2>
        </div>
        
        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">POST /api/spinlets/[id]/restart</code></h3>
        <p className="text-gray-600 mb-4">Restart a spinlet instance.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <p className="text-gray-600 mb-2"><strong>Success (200 OK)</strong></p>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "success": true,
  "spinlet": {
    "id": "spinlet_abc123",
    "name": "auth-service",
    "status": "restarting",
    "message": "Spinlet restart initiated"
  }
}`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Example - Axios</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-javascript">{`const restartSpinlet = async (spinletId) => {
  try {
    const token = localStorage.getItem('auth-token');
    const response = await axios.post(
      \`https://api.spinforge.app/api/spinlets/\${spinletId}/restart\`,
      {},
      {
        headers: {
          'Authorization': \`Bearer \${token}\`
        }
      }
    );
    
    console.log('Spinlet restarting:', response.data.spinlet.name);
    return response.data.spinlet;
  } catch (error) {
    console.error('Restart failed:', error.response?.data?.error);
  }
};`}</code></pre>
        </div>
      </section>

      <section className="mb-8">
        <div className="flex items-center mb-4">
          <Square className="h-6 w-6 text-red-600 mr-2" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-0">5. Stop Spinlet</h2>
        </div>
        
        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">POST /api/spinlets/[id]/stop</code></h3>
        <p className="text-gray-600 mb-4">Stop a running spinlet.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <p className="text-gray-600 mb-2"><strong>Success (200 OK)</strong></p>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "success": true,
  "spinlet": {
    "id": "spinlet_abc123",
    "name": "auth-service",
    "status": "stopped",
    "message": "Spinlet stopped successfully"
  }
}`}</code></pre>
        </div>
      </section>

      <section className="mb-8">
        <div className="flex items-center mb-4">
          <Zap className="h-6 w-6 text-yellow-600 mr-2" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-0">6. Wake Spinlet</h2>
        </div>
        
        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">POST /api/spinlets/[id]/wake</code></h3>
        <p className="text-gray-600 mb-4">Wake an idle spinlet.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <p className="text-gray-600 mb-2"><strong>Success (200 OK)</strong></p>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "success": true,
  "spinlet": {
    "id": "spinlet_abc123",
    "name": "auth-service",
    "status": "active",
    "message": "Spinlet activated successfully",
    "startupTime": "230ms"
  }
}`}</code></pre>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Get Idle Information</h2>
        
        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">GET /api/spinlets/[id]/idle-info</code></h3>
        <p className="text-gray-600 mb-4">Get information about spinlet idle behavior and auto-sleep configuration.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <p className="text-gray-600 mb-2"><strong>Success (200 OK)</strong></p>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "idleConfig": {
    "autoSleep": true,
    "idleTimeout": 300,
    "lastActivity": "2025-01-15T15:30:00Z",
    "willSleepAt": "2025-01-15T15:35:00Z",
    "wakeOnRequest": true,
    "coldStartTime": "200-300ms"
  }
}`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-8">
        <div className="flex items-center mb-4">
          <TrendingUp className="h-6 w-6 text-indigo-600 mr-2" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-0">8. Usage Metrics</h2>
        </div>
        
        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">GET /api/usage</code></h3>
        <p className="text-gray-600 mb-4">Get usage metrics for all resources.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Query Parameters</h4>
        <ul className="list-disc list-inside text-gray-600 space-y-1 mb-6">
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">period</code> (optional): Time period (<code>day</code>, <code>week</code>, <code>month</code>, <code>year</code>)</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">startDate</code> (optional): Start date (YYYY-MM-DD)</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">endDate</code> (optional): End date (YYYY-MM-DD)</li>
        </ul>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <p className="text-gray-600 mb-2"><strong>Success (200 OK)</strong></p>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "usage": {
    "period": "month",
    "startDate": "2025-01-01",
    "endDate": "2025-01-31",
    "deployments": {
      "total": 15,
      "active": 12,
      "builds": 45,
      "failedBuilds": 2
    },
    "spinlets": {
      "invocations": 45320,
      "computeTime": "1250 GB-seconds",
      "errors": 23,
      "successRate": "99.95%"
    },
    "bandwidth": {
      "total": "125.6 GB",
      "cdn": "89.3 GB",
      "origin": "36.3 GB"
    },
    "storage": {
      "total": "15.8 GB",
      "static": "8.2 GB",
      "containers": "5.1 GB",
      "logs": "2.5 GB"
    },
    "costs": {
      "compute": "$12.45",
      "bandwidth": "$8.30",
      "storage": "$2.15",
      "total": "$22.90"
    },
    "limits": {
      "deployments": {
        "used": 15,
        "limit": 50
      },
      "bandwidth": {
        "used": "125.6 GB",
        "limit": "1 TB"
      },
      "storage": {
        "used": "15.8 GB",
        "limit": "100 GB"
      }
    }
  }
}`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Example - Axios</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-javascript">{`const getUsageMetrics = async (period = 'month') => {
  try {
    const token = localStorage.getItem('auth-token');
    const response = await axios.get(\`https://api.spinforge.app/api/usage?period=\${period}\`, {
      headers: {
        'Authorization': \`Bearer \${token}\`
      }
    });
    
    const { usage } = response.data;
    console.log(\`Total cost for \${period}: \${usage.costs.total}\`);
    console.log(\`Bandwidth used: \${usage.bandwidth.total}\`);
    
    // Check if approaching limits
    if (usage.limits.bandwidth.used / usage.limits.bandwidth.limit > 0.8) {
      console.warn('Warning: Approaching bandwidth limit');
    }
    
    return usage;
  } catch (error) {
    console.error('Failed to fetch usage:', error.response?.data?.error);
  }
};`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-8">
        <div className="flex items-center mb-4">
          <Activity className="h-6 w-6 text-red-600 mr-2" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-0">9. Real-time Metrics Stream</h2>
        </div>
        
        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">GET /api/metrics/stream</code></h3>
        <p className="text-gray-600 mb-4">Stream real-time metrics via Server-Sent Events (SSE).</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Query Parameters</h4>
        <ul className="list-disc list-inside text-gray-600 space-y-1 mb-6">
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">deployments</code> (optional): Comma-separated deployment IDs to monitor</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">metrics</code> (optional): Comma-separated metric types (<code>cpu</code>, <code>memory</code>, <code>requests</code>, <code>errors</code>)</li>
        </ul>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <p className="text-gray-600 mb-2"><strong>Success (200 OK)</strong></p>
        <div className="bg-gray-100 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-800 overflow-x-auto"><code>event: metrics
data: {"timestamp":"2025-01-15T15:30:45Z","deployments":{"my-app":{"cpu":"45%","memory":"312MB","requests":125,"errors":0}}}

event: alert
data: {"type":"high_cpu","deployment":"my-app","value":"92%","threshold":"90%"}

event: heartbeat
data: {"timestamp":"2025-01-15T15:31:00Z"}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Example - JavaScript EventSource</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-javascript">{`const streamMetrics = (deploymentIds = []) => {
  const token = localStorage.getItem('auth-token');
  const params = new URLSearchParams({
    deployments: deploymentIds.join(','),
    metrics: 'cpu,memory,requests,errors'
  });
  
  const eventSource = new EventSource(
    \`https://api.spinforge.app/api/metrics/stream?\${params}\`,
    {
      headers: {
        'Authorization': \`Bearer \${token}\`
      }
    }
  );
  
  eventSource.addEventListener('metrics', (event) => {
    const data = JSON.parse(event.data);
    console.log('Metrics update:', data);
    // Update UI with new metrics
  });
  
  eventSource.addEventListener('alert', (event) => {
    const alert = JSON.parse(event.data);
    console.warn(\`Alert: \${alert.type} for \${alert.deployment}\`);
    // Show alert notification
  });
  
  eventSource.addEventListener('error', (event) => {
    console.error('Stream error:', event);
    eventSource.close();
  });
  
  // Cleanup
  return () => eventSource.close();
};

// Usage
const stopStreaming = streamMetrics(['my-app', 'api-service']);
// Later: stopStreaming();`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Metric Types</h2>
        
        <h3 className="text-xl font-semibold text-gray-900 mb-3">Spinlet Metrics</h3>
        <ul className="list-disc list-inside text-gray-600 space-y-1 mb-6">
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">invocations</code> - Total function invocations</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">errors</code> - Number of errors</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">duration</code> - Execution duration statistics</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">memory</code> - Memory usage</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">coldStarts</code> - Number of cold starts</li>
        </ul>

        <h3 className="text-xl font-semibold text-gray-900 mb-3">Deployment Metrics</h3>
        <ul className="list-disc list-inside text-gray-600 space-y-1 mb-6">
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">cpu</code> - CPU usage percentage</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">memory</code> - Memory usage in MB/GB</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">requests</code> - Request count</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">bandwidth</code> - Bandwidth usage</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">responseTime</code> - Response time in milliseconds</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">errorRate</code> - Error rate percentage</li>
        </ul>

        <h3 className="text-xl font-semibold text-gray-900 mb-3">Cost Metrics</h3>
        <ul className="list-disc list-inside text-gray-600 space-y-1">
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">compute</code> - Compute costs</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">bandwidth</code> - Bandwidth costs</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">storage</code> - Storage costs</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">requests</code> - Request costs</li>
        </ul>
      </section>

      <section className="mb-8">
        <div className="flex items-center mb-4">
          <Webhook className="h-6 w-6 text-teal-600 mr-2" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-0">Webhook Notifications</h2>
        </div>
        
        <p className="text-gray-600 mb-4">Configure webhooks to receive real-time notifications:</p>
        
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "webhook": {
    "url": "https://your-app.com/webhooks/spinforge",
    "events": ["deployment.success", "deployment.failed", "spinlet.error", "usage.limit"],
    "secret": "your-webhook-secret"
  }
}`}</code></pre>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Rate Limiting</h2>
        <ul className="list-disc list-inside text-gray-600 space-y-1">
          <li>Metrics queries: 60 requests per minute</li>
          <li>Log queries: 30 requests per minute</li>
          <li>Real-time stream: 5 concurrent connections</li>
          <li>Webhook deliveries: 100 per hour</li>
        </ul>
      </section>
    </div>
  );
}