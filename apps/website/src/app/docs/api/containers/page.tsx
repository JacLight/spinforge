/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Container, Play, Square, RotateCcw, Terminal } from "lucide-react";
import Link from "next/link";

export default function ContainersAPIPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <div className="flex items-center mb-6">
        <Container className="h-8 w-8 text-indigo-600 mr-3" />
        <h1 className="text-3xl font-bold text-gray-900 mb-0">Containers API</h1>
      </div>

      <p className="text-lg text-gray-600 mb-8">
        Container endpoints live under the sites namespace because a container is a property of a
        site (one site, one Nomad job). All require <code>Authorization: Bearer sfc_...</code>.
      </p>

      <hr className="my-8 border-gray-200" />

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Readiness</h2>
      <p className="mb-2"><code>GET /_api/customer/sites/:domain/readiness</code></p>
      <p className="mb-4 text-sm text-gray-600">
        Poll this after a create or redeploy to know when the new allocation is healthy enough to
        receive traffic.
      </p>
      <div className="bg-gray-900 rounded-lg p-6 mb-4 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`curl https://api.spinforge.dev/_api/customer/sites/api.example.com/readiness \\
  -H "Authorization: Bearer sfc_..."`}</code></pre>
      </div>
      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <span className="text-gray-400 text-sm">Response 200</span>
        <pre className="text-gray-100 overflow-x-auto text-sm mt-2"><code>{`{
  "ready": true,
  "status": "running",
  "allocations": [
    { "id": "alloc-abc123", "status": "running", "healthy": true }
  ]
}`}</code></pre>
      </div>

      <hr className="my-8 border-gray-200" />

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Describe containers</h2>
      <p className="mb-2"><code>GET /_api/customer/sites/:domain/containers</code></p>
      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <span className="text-gray-400 text-sm">Response 200</span>
        <pre className="text-gray-100 overflow-x-auto text-sm mt-2"><code>{`{
  "jobId": "site-api-example-com",
  "status": "running",
  "allocations": [
    {
      "id": "alloc-abc123",
      "node": "nomad-worker-1",
      "status": "running",
      "createdAt": "2026-04-15T12:00:00Z"
    }
  ]
}`}</code></pre>
      </div>

      <hr className="my-8 border-gray-200" />

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Lifecycle actions</h2>
      <p className="mb-2"><code>POST /_api/customer/sites/:domain/container/:action</code></p>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6 not-prose">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3 font-semibold">Action</th>
              <th className="p-3 font-semibold">Effect</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            <tr>
              <td className="p-3"><Play className="inline h-4 w-4 text-green-600 mr-1" /><code>start</code></td>
              <td className="p-3">Start a stopped job; no-op if already running</td>
            </tr>
            <tr>
              <td className="p-3"><Square className="inline h-4 w-4 text-red-600 mr-1" /><code>stop</code></td>
              <td className="p-3">Gracefully stop all allocations</td>
            </tr>
            <tr>
              <td className="p-3"><RotateCcw className="inline h-4 w-4 text-indigo-600 mr-1" /><code>restart</code></td>
              <td className="p-3">Signal Nomad to restart the running allocation</td>
            </tr>
            <tr>
              <td className="p-3"><RotateCcw className="inline h-4 w-4 text-indigo-600 mr-1" /><code>rebuild</code></td>
              <td className="p-3">Re-pull the image and start fresh allocations</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bg-gray-900 rounded-lg p-6 mb-4 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`curl -X POST https://api.spinforge.dev/_api/customer/sites/api.example.com/container/restart \\
  -H "Authorization: Bearer sfc_..."`}</code></pre>
      </div>
      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <span className="text-gray-400 text-sm">Response 200</span>
        <pre className="text-gray-100 overflow-x-auto text-sm mt-2"><code>{`{ "success": true, "action": "restart", "jobId": "site-api-example-com" }`}</code></pre>
      </div>

      <hr className="my-8 border-gray-200" />

      <h2 className="text-2xl font-bold text-gray-900 mb-4">
        <Terminal className="inline h-6 w-6 mr-1" /> Logs
      </h2>
      <p className="mb-2"><code>GET /_api/customer/sites/:domain/logs?lines=200&amp;stream=stdout</code></p>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6 not-prose">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3 font-semibold">Query param</th>
              <th className="p-3 font-semibold">Default</th>
              <th className="p-3 font-semibold">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            <tr><td className="p-3"><code>lines</code></td><td className="p-3">100</td><td className="p-3">Number of log lines to return</td></tr>
            <tr><td className="p-3"><code>stream</code></td><td className="p-3"><code>stdout</code></td><td className="p-3"><code>stdout</code> or <code>stderr</code></td></tr>
          </tbody>
        </table>
      </div>

      <div className="bg-gray-900 rounded-lg p-6 mb-4 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`curl "https://api.spinforge.dev/_api/customer/sites/api.example.com/logs?lines=200&stream=stderr" \\
  -H "Authorization: Bearer sfc_..."`}</code></pre>
      </div>
      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <span className="text-gray-400 text-sm">Response 200</span>
        <pre className="text-gray-100 overflow-x-auto text-sm mt-2"><code>{`{
  "allocationId": "alloc-abc123",
  "stream": "stderr",
  "lines": [
    "2026-04-15T12:00:01Z server listening on 0.0.0.0:8080",
    "2026-04-15T12:00:05Z GET /health 200"
  ]
}`}</code></pre>
      </div>

      <hr className="my-8 border-gray-200" />

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Errors</h2>
      <ul className="list-disc list-inside text-sm text-gray-600 mb-8">
        <li><strong>404</strong> — site does not exist or is not a container/node type</li>
        <li><strong>409</strong> — no running allocation to read logs from</li>
        <li><strong>502</strong> — Nomad/Consul unreachable</li>
      </ul>

      <Link href="/docs/deployment/containers" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 not-prose inline-block">
        <h3 className="font-semibold text-gray-900 mb-2">Deploy guide</h3>
        <p className="text-sm text-gray-600 mb-0">Walkthrough from <code>docker push</code> to traffic.</p>
      </Link>
    </div>
  );
}
