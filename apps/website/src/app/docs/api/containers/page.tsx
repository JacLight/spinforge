/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Container } from "lucide-react";
import Link from "next/link";

export default function ContainersAPIPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <div className="flex items-center mb-6">
        <Container className="h-8 w-8 text-indigo-600 mr-3" />
        <h1 className="text-3xl font-bold text-gray-900 mb-0">Container Management API</h1>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 not-prose mb-8">
        <p className="text-blue-900">
          <strong>Note:</strong> Container management endpoints are documented in the{" "}
          <Link href="/docs/api/sites#container-management" className="text-indigo-600 hover:underline font-semibold">
            Sites Management API
          </Link>{" "}
          page under the Container Management section.
        </p>
      </div>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Overview</h2>
        <p className="text-gray-600 mb-4">
          All container operations are performed through the Sites API with the <code className="bg-gray-100 px-2 py-1 rounded">/api/sites/:domain/container/*</code> endpoints.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Available Operations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 not-prose">
          <Link href="/docs/api/sites#container-management" className="bg-white p-4 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all">
            <h4 className="font-semibold text-gray-900 mb-2">Lifecycle Management</h4>
            <p className="text-sm text-gray-600">Start, stop, restart, and rebuild containers</p>
          </Link>

          <Link href="/docs/api/sites#container-exec" className="bg-white p-4 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all">
            <h4 className="font-semibold text-gray-900 mb-2">Execute Commands</h4>
            <p className="text-sm text-gray-600">Run commands inside containers</p>
          </Link>

          <Link href="/docs/api/sites#container-logs" className="bg-white p-4 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all">
            <h4 className="font-semibold text-gray-900 mb-2">View Logs</h4>
            <p className="text-sm text-gray-600">Access container logs for debugging</p>
          </Link>

          <Link href="/docs/api/sites#container-stats" className="bg-white p-4 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all">
            <h4 className="font-semibold text-gray-900 mb-2">Resource Stats</h4>
            <p className="text-sm text-gray-600">Monitor CPU, memory, and network usage</p>
          </Link>
        </div>
      </section>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 not-prose mt-8">
        <p className="text-gray-700">
          👉 <Link href="/docs/api/sites" className="text-indigo-600 hover:underline font-semibold">
            Go to Sites Management API
          </Link> for complete container documentation
        </p>
      </div>
    </div>
  );
}
