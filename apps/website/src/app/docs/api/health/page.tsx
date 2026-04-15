/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Activity } from "lucide-react";

export default function HealthAPIPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <div className="flex items-center mb-6">
        <Activity className="h-8 w-8 text-indigo-600 mr-3" />
        <h1 className="text-3xl font-bold text-gray-900 mb-0">Health</h1>
      </div>

      <p className="text-lg text-gray-600 mb-8">
        A single unauthenticated liveness probe for uptime checks and load balancers in front of the
        API itself.
      </p>

      <hr className="my-8 border-gray-200" />

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Health check</h2>
      <p className="mb-2"><code>GET /health</code></p>
      <p className="mb-4 text-sm text-gray-600">
        No authentication required. Returns 200 if the API process is up and its critical dependencies
        (Redis) are reachable.
      </p>

      <div className="bg-gray-900 rounded-lg p-6 mb-4 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`curl https://api.spinforge.dev/health`}</code></pre>
      </div>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <span className="text-gray-400 text-sm">Response 200</span>
        <pre className="text-gray-100 overflow-x-auto text-sm mt-2"><code>{`{
  "status": "healthy",
  "timestamp": "2026-04-15T12:00:00.000Z"
}`}</code></pre>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200 not-prose">
        <h3 className="font-semibold text-gray-900 mb-2">Use this for</h3>
        <ul className="text-sm text-gray-600 list-disc list-inside mb-0">
          <li>External uptime monitors (Pingdom, Better Stack, etc.)</li>
          <li>Load balancer health probes</li>
          <li>Smoke tests in a CI deploy pipeline</li>
        </ul>
      </div>
    </div>
  );
}
