/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Key, AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function EnvVarsPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Environment Variables</h1>
      <p className="text-lg text-gray-600 mb-8">
        Environment variables are set on <strong>container</strong> and <strong>node</strong> site
        types via the <code>containerConfig.env</code> object. Static sites and proxies do not receive
        env — there is no process to hand them to.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Set env at create time</h2>
      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`curl -X POST https://api.spinforge.dev/_api/customer/sites \\
  -H "Authorization: Bearer sfc_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "domain": "api.example.com",
    "type": "container",
    "containerConfig": {
      "image": "ghcr.io/me/api:1.4.0",
      "port": 8080,
      "env": {
        "NODE_ENV": "production",
        "DATABASE_URL": "postgres://user:pass@host/db",
        "LOG_LEVEL": "info"
      },
      "memoryLimit": "512M",
      "cpuLimit": 0.5
    }
  }'`}</code></pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Update env after create</h2>
      <p className="mb-4">
        Send a <code>PUT</code> with the full <code>containerConfig</code> you want. Any change to
        <code>containerConfig</code> triggers a Nomad redeploy — the new allocation starts with the
        new env, traffic cuts over when it is healthy, and the old allocation is stopped.
      </p>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`curl -X PUT https://api.spinforge.dev/_api/customer/sites/api.example.com \\
  -H "Authorization: Bearer sfc_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "containerConfig": {
      "image": "ghcr.io/me/api:1.4.0",
      "port": 8080,
      "env": {
        "NODE_ENV": "production",
        "DATABASE_URL": "postgres://user:pass@newhost/db",
        "LOG_LEVEL": "debug"
      },
      "memoryLimit": "512M",
      "cpuLimit": 0.5
    }
  }'`}</code></pre>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8 not-prose">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-amber-700 mr-2 mt-0.5 flex-shrink-0" />
          <p className="text-amber-800 text-sm mb-0">
            <code>env</code> is replaced wholesale on update — send the complete map each time. A key
            you omit will not be present in the new container.
          </p>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Supported fields in containerConfig</h2>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-8 not-prose">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3 font-semibold">Field</th>
              <th className="p-3 font-semibold">Type</th>
              <th className="p-3 font-semibold">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            <tr><td className="p-3"><code>image</code></td><td className="p-3">string</td><td className="p-3">Docker image with tag</td></tr>
            <tr><td className="p-3"><code>port</code></td><td className="p-3">number</td><td className="p-3">Container port the app listens on</td></tr>
            <tr><td className="p-3"><code>env</code></td><td className="p-3">object</td><td className="p-3">String keys to string values</td></tr>
            <tr><td className="p-3"><code>memoryLimit</code></td><td className="p-3">string</td><td className="p-3"><code>&quot;512M&quot;</code>, <code>&quot;1G&quot;</code>, etc.</td></tr>
            <tr><td className="p-3"><code>cpuLimit</code></td><td className="p-3">number</td><td className="p-3">Fraction of a CPU core (<code>0.5</code> = half)</td></tr>
            <tr><td className="p-3"><code>restartPolicy</code></td><td className="p-3">string</td><td className="p-3"><code>&quot;unless-stopped&quot;</code> (default), <code>&quot;always&quot;</code>, <code>&quot;no&quot;</code></td></tr>
            <tr><td className="p-3"><code>entrypoint</code></td><td className="p-3">string</td><td className="p-3">Override the image entrypoint (node-type sites)</td></tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Secrets</h2>
      <div className="bg-white p-6 rounded-lg border border-gray-200 mb-8 not-prose">
        <div className="flex items-start">
          <Key className="h-5 w-5 text-indigo-600 mr-2 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-gray-600 mb-2">
              Values you set in <code>env</code> are stored in the site record. They are not visible
              in the admin UI except when listed on the site config page, and they are sent to the
              container as normal env vars.
            </p>
            <p className="text-sm text-gray-600 mb-0">
              For rotating secrets, issue the <code>PUT</code> with the new value — the container
              redeploys with the new env. No restart coordination needed.
            </p>
          </div>
        </div>
      </div>

      <Link href="/docs/deployment/containers" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 not-prose inline-block">
        <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
          Container deploy guide <ArrowRight className="h-4 w-4 ml-2" />
        </h3>
        <p className="text-sm text-gray-600 mb-0">Full container lifecycle walkthrough.</p>
      </Link>
    </div>
  );
}
