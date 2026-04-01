/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Shield, Users, Rocket, Globe, BarChart, Container, Server, Settings, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function APIDocsPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">API Reference</h1>

      <p className="text-lg text-gray-600 mb-8">
        SpinForge provides a comprehensive REST API for managing your sites, containers, domains, and infrastructure programmatically.
      </p>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 not-prose mb-8">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">Base URL</h3>
        <div className="font-mono text-sm space-y-1">
          <div><strong>Production:</strong> https://api.spinforge.dev/api</div>
          <div><strong>Local Development:</strong> http://localhost:8080/api</div>
        </div>
      </div>

      <h2 id="authentication" className="text-2xl font-semibold text-gray-900 mt-12 mb-4">Authentication</h2>

      <p className="text-gray-600 mb-4">
        SpinForge has two separate authentication systems:
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 not-prose mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-2">Admin Authentication</h4>
          <p className="text-sm text-gray-600 mb-2">For platform administrators</p>
          <code className="text-xs bg-gray-100 px-2 py-1 rounded block">POST /api/_admin/login</code>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-2">Customer Authentication</h4>
          <p className="text-sm text-gray-600 mb-2">For end users/customers</p>
          <code className="text-xs bg-gray-100 px-2 py-1 rounded block">POST /api/_auth/customer/login</code>
        </div>
      </div>

      <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Authentication Methods</h3>
      <ul className="list-disc list-inside text-gray-600 space-y-1 mb-6">
        <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">Authorization: Bearer &lt;token&gt;</code> - Standard Bearer token</li>
        <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">Cookie: auth-token=&lt;token&gt;</code> - Cookie-based auth</li>
      </ul>

      <h2 id="api-categories" className="text-2xl font-semibold text-gray-900 mt-12 mb-6">API Categories</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 not-prose mb-8">
        <Link href="/docs/api/sites" className="group bg-white p-6 rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-lg transition-all">
          <div className="flex items-start">
            <Globe className="h-6 w-6 text-indigo-600 mr-3 mt-1 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">
                Sites Management
                <ArrowRight className="inline-block ml-2 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p className="text-gray-600 text-sm">
                Create and manage static sites, proxy sites, containers, and load balancers
              </p>
            </div>
          </div>
        </Link>

        <Link href="/docs/api/containers" className="group bg-white p-6 rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-lg transition-all">
          <div className="flex items-start">
            <Container className="h-6 w-6 text-blue-600 mr-3 mt-1 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">
                Container Management
                <ArrowRight className="inline-block ml-2 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p className="text-gray-600 text-sm">
                Control, monitor, and execute commands in Docker containers
              </p>
            </div>
          </div>
        </Link>

        <Link href="/docs/api/certificates" className="group bg-white p-6 rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-lg transition-all">
          <div className="flex items-start">
            <Shield className="h-6 w-6 text-green-600 mr-3 mt-1 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">
                SSL Certificates
                <ArrowRight className="inline-block ml-2 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p className="text-gray-600 text-sm">
                Manage SSL/TLS certificates with Let's Encrypt integration
              </p>
            </div>
          </div>
        </Link>

        <Link href="/docs/api/metrics" className="group bg-white p-6 rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-lg transition-all">
          <div className="flex items-start">
            <BarChart className="h-6 w-6 text-orange-600 mr-3 mt-1 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">
                Metrics & Monitoring
                <ArrowRight className="inline-block ml-2 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p className="text-gray-600 text-sm">
                Access real-time metrics, logs, and usage statistics
              </p>
            </div>
          </div>
        </Link>

        <Link href="/docs/api/authentication" className="group bg-white p-6 rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-lg transition-all">
          <div className="flex items-start">
            <Shield className="h-6 w-6 text-purple-600 mr-3 mt-1 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">
                Authentication
                <ArrowRight className="inline-block ml-2 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p className="text-gray-600 text-sm">
                Admin and customer authentication, session management
              </p>
            </div>
          </div>
        </Link>

        <Link href="/docs/api/admin" className="group bg-white p-6 rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-lg transition-all">
          <div className="flex items-start">
            <Users className="h-6 w-6 text-red-600 mr-3 mt-1 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">
                Admin Operations
                <ArrowRight className="inline-block ml-2 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p className="text-gray-600 text-sm">
                Customer management, system settings, and admin operations
              </p>
            </div>
          </div>
        </Link>

        <Link href="/docs/api/templates" className="group bg-white p-6 rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-lg transition-all">
          <div className="flex items-start">
            <Rocket className="h-6 w-6 text-pink-600 mr-3 mt-1 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">
                Templates
                <ArrowRight className="inline-block ml-2 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p className="text-gray-600 text-sm">
                Deploy from templates, clone sites, and save configurations
              </p>
            </div>
          </div>
        </Link>

        <Link href="/docs/api/health" className="group bg-white p-6 rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-lg transition-all">
          <div className="flex items-start">
            <Server className="h-6 w-6 text-gray-600 mr-3 mt-1 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">
                Health & Diagnostics
                <ArrowRight className="inline-block ml-2 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p className="text-gray-600 text-sm">
                System health checks and diagnostic endpoints
              </p>
            </div>
          </div>
        </Link>
      </div>

      <h2 id="common-patterns" className="text-2xl font-semibold text-gray-900 mt-12 mb-4">Common Patterns</h2>

      <h3 id="error-handling" className="text-xl font-semibold text-gray-900 mt-8 mb-3">Error Handling</h3>
      <p className="text-gray-600 mb-3">All errors follow a consistent format:</p>

      <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
        <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "error": "Error message",
  "message": "Detailed error description",
  "statusCode": 400
}`}</code></pre>
      </div>

      <h3 id="pagination" className="text-xl font-semibold text-gray-900 mt-8 mb-3">Pagination</h3>
      <p className="text-gray-600 mb-3">List endpoints support pagination parameters:</p>

      <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
        <pre className="text-gray-100 overflow-x-auto"><code>GET /api/sites?limit=20&offset=40</code></pre>
      </div>

      <h3 id="filtering" className="text-xl font-semibold text-gray-900 mt-8 mb-3">Filtering</h3>
      <p className="text-gray-600 mb-3">Filter results using query parameters:</p>

      <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
        <pre className="text-gray-100 overflow-x-auto"><code>GET /api/sites?type=container&customerId=customer123</code></pre>
      </div>

      <h2 id="status-codes" className="text-2xl font-semibold text-gray-900 mt-12 mb-4">HTTP Status Codes</h2>

      <div className="overflow-x-auto not-prose">
        <table className="min-w-full bg-white border border-gray-200 rounded-lg overflow-hidden">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            <tr>
              <td className="px-6 py-4 text-sm font-mono text-gray-900">200</td>
              <td className="px-6 py-4 text-sm text-gray-600">Success - Request completed successfully</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="px-6 py-4 text-sm font-mono text-gray-900">201</td>
              <td className="px-6 py-4 text-sm text-gray-600">Created - Resource created successfully</td>
            </tr>
            <tr>
              <td className="px-6 py-4 text-sm font-mono text-gray-900">400</td>
              <td className="px-6 py-4 text-sm text-gray-600">Bad Request - Invalid parameters or request body</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="px-6 py-4 text-sm font-mono text-gray-900">401</td>
              <td className="px-6 py-4 text-sm text-gray-600">Unauthorized - Missing or invalid authentication token</td>
            </tr>
            <tr>
              <td className="px-6 py-4 text-sm font-mono text-gray-900">403</td>
              <td className="px-6 py-4 text-sm text-gray-600">Forbidden - Insufficient permissions</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="px-6 py-4 text-sm font-mono text-gray-900">404</td>
              <td className="px-6 py-4 text-sm text-gray-600">Not Found - Resource does not exist</td>
            </tr>
            <tr>
              <td className="px-6 py-4 text-sm font-mono text-gray-900">500</td>
              <td className="px-6 py-4 text-sm text-gray-600">Internal Server Error - Server error, please retry</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="next-steps" className="text-2xl font-semibold text-gray-900 mt-12 mb-4">Next Steps</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 not-prose">
        <Link href="/docs/api/sites" className="bg-gradient-to-br from-indigo-50 to-blue-50 p-4 rounded-lg border border-indigo-200 hover:shadow-md transition-all">
          <h4 className="font-semibold text-gray-900 mb-2">Create Your First Site</h4>
          <p className="text-sm text-gray-600">Learn how to deploy sites via the API</p>
        </Link>

        <Link href="/docs/api/authentication" className="bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-200 hover:shadow-md transition-all">
          <h4 className="font-semibold text-gray-900 mb-2">Authentication Guide</h4>
          <p className="text-sm text-gray-600">Set up authentication for API access</p>
        </Link>

        <Link href="/docs/api/containers" className="bg-gradient-to-br from-green-50 to-teal-50 p-4 rounded-lg border border-green-200 hover:shadow-md transition-all">
          <h4 className="font-semibold text-gray-900 mb-2">Manage Containers</h4>
          <p className="text-sm text-gray-600">Control Docker containers programmatically</p>
        </Link>
      </div>
    </div>
  );
}
