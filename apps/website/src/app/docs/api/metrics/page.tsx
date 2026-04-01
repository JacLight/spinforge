/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { BarChart } from "lucide-react";

export default function MetricsAPIPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <div className="flex items-center mb-6">
        <BarChart className="h-8 w-8 text-orange-600 mr-3" />
        <h1 className="text-3xl font-bold text-gray-900 mb-0">Metrics & Monitoring API</h1>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 not-prose mb-8">
        <p className="text-yellow-900">
          <strong>Coming Soon:</strong> Comprehensive metrics and monitoring endpoints are under development.
          Basic container statistics are available in the Sites API.
        </p>
      </div>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Current Capabilities</h2>
        <p className="text-gray-600 mb-4">
          Basic monitoring is available through:
        </p>
        <ul className="list-disc list-inside text-gray-600 space-y-2">
          <li><strong>Container Stats:</strong> <code className="bg-gray-100 px-2 py-1 rounded text-sm">GET /api/sites/:domain/container/stats</code></li>
          <li><strong>Container Health:</strong> <code className="bg-gray-100 px-2 py-1 rounded text-sm">GET /api/sites/:domain/container/health</code></li>
          <li><strong>Container Logs:</strong> <code className="bg-gray-100 px-2 py-1 rounded text-sm">GET /api/sites/:domain/container/logs</code></li>
          <li><strong>Site Readiness:</strong> <code className="bg-gray-100 px-2 py-1 rounded text-sm">GET /api/sites/:domain/readiness</code></li>
        </ul>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Planned Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 not-prose">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-2">System Metrics</h4>
            <p className="text-sm text-gray-600">CPU, memory, disk, and network usage across the platform</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-2">Application Metrics</h4>
            <p className="text-sm text-gray-600">Request rates, response times, and error rates per site</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-2">Custom Metrics</h4>
            <p className="text-sm text-gray-600">Send and query custom application metrics</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-2">Alerting</h4>
            <p className="text-sm text-gray-600">Configure alerts based on metric thresholds</p>
          </div>
        </div>
      </section>
    </div>
  );
}
