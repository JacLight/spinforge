/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Users, Shield } from "lucide-react";

export default function AdminAPIPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <div className="flex items-center mb-6">
        <Users className="h-8 w-8 text-red-600 mr-3" />
        <h1 className="text-3xl font-bold text-gray-900 mb-0">Admin Operations API</h1>
      </div>

      <div className="bg-red-50 border border-red-200 rounded-lg p-6 not-prose mb-8">
        <p className="text-red-900">
          <strong>⚠️ Admin Only:</strong> These endpoints require admin authentication and should only be used by platform administrators.
        </p>
      </div>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Overview</h2>
        <p className="text-gray-600 mb-4">
          Admin operations for managing customers, system settings, and platform-wide configurations.
        </p>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-12">
        <div className="flex items-center mb-4">
          <Shield className="h-6 w-6 text-blue-600 mr-2" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-0">Authentication</h2>
        </div>

        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">POST /api/_admin/login</code></h3>
        <p className="text-gray-600 mb-4">Admin authentication endpoint.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Request Body</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`{
  "email": "admin@spinforge.com",
  "password": "AdminPassword123!"
}`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`{
  "message": "Login successful",
  "admin": {
    "id": "admin_abc123",
    "email": "admin@spinforge.com",
    "name": "Admin User",
    "role": "admin"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Customer Management</h2>

        <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">List Customers</h3>
        <code className="bg-gray-100 px-2 py-1 rounded text-sm mb-4 block">GET /api/_admin/customers</code>
        <p className="text-gray-600 mb-4">List all customers with pagination.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Query Parameters</h4>
        <ul className="list-disc list-inside text-gray-600 space-y-1 mb-6">
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">limit</code> - Number of results per page</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">offset</code> - Offset for pagination</li>
        </ul>

        <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">Get Customer</h3>
        <code className="bg-gray-100 px-2 py-1 rounded text-sm mb-4 block">GET /api/_admin/customers/:customerId</code>
        <p className="text-gray-600 mb-4">Get detailed information about a specific customer.</p>

        <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">Create Customer</h3>
        <code className="bg-gray-100 px-2 py-1 rounded text-sm mb-4 block">POST /api/_admin/customers</code>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`{
  "email": "customer@example.com",
  "name": "John Doe",
  "password": "SecurePassword123!",
  "plan": "pro"
}`}</code></pre>
        </div>

        <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">Update Customer</h3>
        <code className="bg-gray-100 px-2 py-1 rounded text-sm mb-4 block">PUT /api/_admin/customers/:customerId</code>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`{
  "name": "John Doe Updated",
  "plan": "enterprise",
  "enabled": true
}`}</code></pre>
        </div>

        <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">Delete Customer</h3>
        <code className="bg-gray-100 px-2 py-1 rounded text-sm mb-4 block">DELETE /api/_admin/customers/:customerId</code>
        <p className="text-gray-600 mb-4">Delete a customer and all associated sites.</p>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">System Operations</h2>

        <h3 className="text-xl font-semibold text-gray-900 mb-3">Get System Stats</h3>
        <code className="bg-gray-100 px-2 py-1 rounded text-sm mb-4 block">GET /api/_admin/stats</code>
        <p className="text-gray-600 mb-4">Get platform-wide statistics.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`{
  "totalCustomers": 152,
  "totalSites": 487,
  "totalContainers": 231,
  "systemResources": {
    "cpuUsage": "45%",
    "memoryUsage": "62%",
    "diskUsage": "38%"
  }
}`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Additional Operations</h2>
        <div className="grid grid-cols-1 gap-3 not-prose">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <code className="text-sm font-mono text-indigo-600">GET /api/_admin/sites</code>
            <p className="text-sm text-gray-600 mt-2">List all sites across all customers</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <code className="text-sm font-mono text-indigo-600">POST /api/_admin/system/reload-nginx</code>
            <p className="text-sm text-gray-600 mt-2">Reload OpenResty/Nginx configuration</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <code className="text-sm font-mono text-indigo-600">GET /api/_admin/logs</code>
            <p className="text-sm text-gray-600 mt-2">Access system logs</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <code className="text-sm font-mono text-indigo-600">POST /api/_admin/backup</code>
            <p className="text-sm text-gray-600 mt-2">Trigger system backup</p>
          </div>
        </div>
      </section>
    </div>
  );
}
