/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Server } from "lucide-react";

export default function HealthAPIPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <div className="flex items-center mb-6">
        <Server className="h-8 w-8 text-gray-600 mr-3" />
        <h1 className="text-3xl font-bold text-gray-900 mb-0">Health & Diagnostics API</h1>
      </div>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Overview</h2>
        <p className="text-gray-600 mb-4">
          System health checks and diagnostic endpoints for monitoring SpinForge platform status.
        </p>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">System Health Check</h2>
        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">GET /api/health</code></h3>
        <p className="text-gray-600 mb-4">Check overall system health status.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response - Healthy</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`{
  "status": "healthy",
  "timestamp": "2025-01-10T10:00:00Z",
  "services": {
    "api": "healthy",
    "redis": "healthy",
    "docker": "healthy",
    "nginx": "healthy"
  },
  "uptime": 12345678
}`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response - Degraded</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`{
  "status": "degraded",
  "timestamp": "2025-01-10T10:00:00Z",
  "services": {
    "api": "healthy",
    "redis": "healthy",
    "docker": "degraded",
    "nginx": "healthy"
  },
  "issues": [
    {
      "service": "docker",
      "message": "High container restart rate"
    }
  ]
}`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Service-Specific Health</h2>

        <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">Redis Health</h3>
        <code className="bg-gray-100 px-2 py-1 rounded text-sm mb-4 block">GET /api/health/redis</code>
        <p className="text-gray-600 mb-4">Check Redis (KeyDB) connection and performance.</p>

        <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">Docker Health</h3>
        <code className="bg-gray-100 px-2 py-1 rounded text-sm mb-4 block">GET /api/health/docker</code>
        <p className="text-gray-600 mb-4">Check Docker daemon status and container health.</p>

        <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">Nginx Health</h3>
        <code className="bg-gray-100 px-2 py-1 rounded text-sm mb-4 block">GET /api/health/nginx</code>
        <p className="text-gray-600 mb-4">Check OpenResty/Nginx status and configuration.</p>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Diagnostics</h2>

        <h3 className="text-xl font-semibold text-gray-900 mb-3">System Info</h3>
        <code className="bg-gray-100 px-2 py-1 rounded text-sm mb-4 block">GET /api/diagnostics/system</code>
        <p className="text-gray-600 mb-4">Get detailed system information.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`{
  "version": "2.0.0",
  "platform": "linux",
  "node": "v18.19.0",
  "memory": {
    "total": "16GB",
    "free": "8GB",
    "used": "8GB"
  },
  "cpu": {
    "model": "Intel Xeon",
    "cores": 8,
    "usage": "45%"
  },
  "disk": {
    "total": "500GB",
    "free": "310GB",
    "used": "190GB"
  }
}`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Additional Checks</h2>
        <div className="grid grid-cols-1 gap-3 not-prose">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <code className="text-sm font-mono text-indigo-600">GET /api/health/liveness</code>
            <p className="text-sm text-gray-600 mt-2">Simple liveness probe (returns 200 OK)</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <code className="text-sm font-mono text-indigo-600">GET /api/health/readiness</code>
            <p className="text-sm text-gray-600 mt-2">Readiness probe (checks all dependencies)</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <code className="text-sm font-mono text-indigo-600">GET /api/version</code>
            <p className="text-sm text-gray-600 mt-2">Get API version information</p>
          </div>
        </div>
      </section>
    </div>
  );
}
