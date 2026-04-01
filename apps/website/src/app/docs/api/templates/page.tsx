/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Rocket } from "lucide-react";

export default function TemplatesAPIPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <div className="flex items-center mb-6">
        <Rocket className="h-8 w-8 text-pink-600 mr-3" />
        <h1 className="text-3xl font-bold text-gray-900 mb-0">Templates API</h1>
      </div>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Overview</h2>
        <p className="text-gray-600 mb-4">
          Deploy from pre-configured templates, clone existing sites, and save configurations as reusable templates.
        </p>
      </section>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 not-prose mb-8">
        <p className="text-yellow-900">
          <strong>Note:</strong> Template functionality is currently available through the clone and deployment endpoints.
          Full template library API is under development.
        </p>
      </div>

      <hr className="my-8 border-gray-200" />

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Clone Site</h2>
        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">POST /api/clone</code></h3>
        <p className="text-gray-600 mb-4">Clone an existing site to a new domain.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Request Body</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`{
  "sourceDomain": "original.example.com",
  "targetDomain": "clone.example.com",
  "includeFiles": true,
  "includeConfig": true,
  "customerId": "customer_123"
}`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`{
  "message": "Site cloned successfully",
  "sourceDomain": "original.example.com",
  "targetDomain": "clone.example.com"
}`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Deploy from Template</h2>
        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">POST /api/deploy-template</code></h3>
        <p className="text-gray-600 mb-4">Deploy a site from a saved template.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Request Body</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`{
  "templateId": "template_abc123",
  "domain": "new-site.example.com",
  "customerId": "customer_123",
  "variables": {
    "APP_NAME": "My New App",
    "API_URL": "https://api.example.com"
  }
}`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Planned Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 not-prose">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-2">Template Library</h4>
            <p className="text-sm text-gray-600">Browse and deploy from a library of pre-built application templates</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-2">Save as Template</h4>
            <p className="text-sm text-gray-600">Save any site configuration as a reusable template</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-2">Template Variables</h4>
            <p className="text-sm text-gray-600">Parameterize templates with environment variables</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-2">Version Control</h4>
            <p className="text-sm text-gray-600">Manage multiple versions of templates</p>
          </div>
        </div>
      </section>
    </div>
  );
}
