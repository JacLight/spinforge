/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Shield, Globe, BarChart, Container, Activity, Key, ArrowRight, Plug } from "lucide-react";
import Link from "next/link";

export default function APIOverviewPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">API Reference</h1>
      <p className="text-lg text-gray-600 mb-8">
        The SpinForge API is a JSON-over-HTTP control plane for sites, containers, certificates, and
        partner integrations. Three surfaces: <code>/_api/customer/*</code> for customer usage,
        <code>/_admin/*</code> for operators, and <code>/_partners/*</code> for server-side partner
        exchange.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Base URL</h2>
      <div className="bg-gray-900 rounded-lg p-4 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>https://api.spinforge.dev</code></pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication</h2>
      <div className="bg-white p-6 rounded-lg border border-gray-200 mb-8 not-prose">
        <p className="text-sm text-gray-600 mb-3">Three parallel token types:</p>
        <ul className="text-sm text-gray-600 space-y-2">
          <li>
            <strong>Customer session</strong> — <code>Authorization: Bearer sfc_...</code>. Used for
            all <code>/_api/customer/*</code> calls.
          </li>
          <li>
            <strong>Admin JWT / API key</strong> — <code>Authorization: Bearer &lt;jwt&gt;</code> or
            <code>X-API-Key: sfa_...</code>. Used for <code>/_admin/*</code>.
          </li>
          <li>
            <strong>Partner key</strong> — <code>X-Partner-Key: sfpk_...</code>. Used for
            <code>/_partners/*</code>.
          </li>
        </ul>
        <p className="text-sm text-gray-600 mt-3 mb-0">
          Full details on <Link href="/docs/api/authentication" className="text-indigo-600 underline">the authentication page</Link>.
        </p>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Endpoints</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 not-prose mb-8">
        <Link href="/docs/api/authentication" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300">
          <div className="flex items-center mb-2">
            <Key className="h-5 w-5 text-indigo-600 mr-2" />
            <h3 className="font-semibold text-gray-900 mb-0">Authentication</h3>
          </div>
          <p className="text-sm text-gray-600 mb-0">Login, tokens, setup bootstrap.</p>
        </Link>
        <Link href="/docs/api/sites" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300">
          <div className="flex items-center mb-2">
            <Globe className="h-5 w-5 text-indigo-600 mr-2" />
            <h3 className="font-semibold text-gray-900 mb-0">Sites</h3>
          </div>
          <p className="text-sm text-gray-600 mb-0">Create, update, list, delete sites. Upload static zips.</p>
        </Link>
        <Link href="/docs/api/containers" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300">
          <div className="flex items-center mb-2">
            <Container className="h-5 w-5 text-indigo-600 mr-2" />
            <h3 className="font-semibold text-gray-900 mb-0">Containers</h3>
          </div>
          <p className="text-sm text-gray-600 mb-0">Start/stop/restart, readiness, logs.</p>
        </Link>
        <Link href="/docs/api/certificates" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300">
          <div className="flex items-center mb-2">
            <Shield className="h-5 w-5 text-indigo-600 mr-2" />
            <h3 className="font-semibold text-gray-900 mb-0">Certificates</h3>
          </div>
          <p className="text-sm text-gray-600 mb-0">Inspect per-site TLS certificate state.</p>
        </Link>
        <Link href="/docs/api/health" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300">
          <div className="flex items-center mb-2">
            <Activity className="h-5 w-5 text-indigo-600 mr-2" />
            <h3 className="font-semibold text-gray-900 mb-0">Health</h3>
          </div>
          <p className="text-sm text-gray-600 mb-0">Platform liveness probe.</p>
        </Link>
        <Link href="/docs/api/metrics" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300">
          <div className="flex items-center mb-2">
            <BarChart className="h-5 w-5 text-indigo-600 mr-2" />
            <h3 className="font-semibold text-gray-900 mb-0">Metrics</h3>
          </div>
          <p className="text-sm text-gray-600 mb-0">Request counts, readiness rollups.</p>
        </Link>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Response conventions</h2>
      <div className="bg-white p-6 rounded-lg border border-gray-200 mb-8 not-prose">
        <ul className="text-sm text-gray-600 space-y-2">
          <li><strong>Success:</strong> JSON body with the resource or a <code>{`{ success: true }`}</code> envelope.</li>
          <li><strong>Errors:</strong> Non-2xx status with <code>{`{ error: "message", code?: "..." }`}</code>.</li>
          <li><strong>Timestamps:</strong> ISO 8601 strings in UTC.</li>
          <li><strong>Pagination:</strong> list endpoints return arrays; large collections are scoped to the authenticated customer.</li>
        </ul>
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6 not-prose">
        <div className="flex items-center mb-2">
          <Plug className="h-5 w-5 text-indigo-700 mr-2" />
          <h3 className="font-semibold text-indigo-900 mb-0">Partner integrations</h3>
        </div>
        <p className="text-sm text-indigo-900 mb-2">
          Building a platform on top of SpinForge? The partner auth exchange mints customer sessions
          and upserts sites in one call.
        </p>
        <Link href="/docs/partners" className="text-indigo-700 underline text-sm inline-flex items-center">
          Partner guide <ArrowRight className="h-3 w-3 ml-1" />
        </Link>
      </div>
    </div>
  );
}
