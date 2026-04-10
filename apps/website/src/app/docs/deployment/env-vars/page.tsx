/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Key, AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function EnvVarsGuidePage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Environment Variables</h1>
      <p className="text-lg text-gray-600 mb-8">
        Environment variables are the recommended way to configure runtime behavior, inject secrets, and switch
        between environments (staging / production) without rebuilding your image.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">How env vars get into your container</h2>
      <ol className="list-decimal list-inside mb-8 space-y-2 text-gray-700">
        <li>You add variables in the SpinForge dashboard (or via the API)</li>
        <li>SpinForge stores them encrypted</li>
        <li>When the container starts, the variables are injected into its process environment</li>
        <li>Your app reads them via <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">process.env</code>, <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">os.environ</code>, <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">ENV[&apos;FOO&apos;]</code>, etc.</li>
      </ol>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Adding variables from the dashboard</h2>
      <p className="mb-4">
        During deployment, the container config has an <em>Environment Variables</em> text area. Add one per
        line, in <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">KEY=value</code> format:
      </p>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto"><code>{`NODE_ENV=production
DATABASE_URL=postgres://user:pass@db.example.com/app
REDIS_URL=redis://cache.example.com:6379
JWT_SECRET=change-me-please
LOG_LEVEL=info
FEATURE_NEW_DASHBOARD=true`}</code></pre>
      </div>

      <p className="mb-8 text-sm text-gray-600">
        Values can contain <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">=</code> signs — only the
        first <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">=</code> splits the key from the value.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Updating variables</h2>
      <p className="mb-4">
        Changing an env var on an existing site triggers a rolling restart of the container. New connections
        land on the new container immediately; the old one drains and shuts down cleanly.
      </p>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-8 not-prose">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-amber-900 mb-1">Build-time vs runtime</h4>
            <p className="text-amber-800 text-sm">
              SpinForge env vars are runtime only. Build-time variables (like{" "}
              <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_*</code> in Next.js or{" "}
              <code className="bg-amber-100 px-1 rounded">VITE_*</code> in Vite) get baked into your build and
              cannot be changed by SpinForge. Pass those when you <code className="bg-amber-100 px-1 rounded">docker build</code>.
            </p>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Variables SpinForge sets for you</h2>
      <div className="overflow-x-auto mb-8 not-prose">
        <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-gray-700">Variable</th>
              <th className="text-left px-4 py-2 font-semibold text-gray-700">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            <tr>
              <td className="px-4 py-2 font-mono text-xs">PORT</td>
              <td className="px-4 py-2 text-gray-600">The port your app should bind to inside the container. Always read this — never hardcode.</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">SPINFORGE_DOMAIN</td>
              <td className="px-4 py-2 text-gray-600">The primary domain your site is serving.</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">SPINFORGE_DEPLOY_ID</td>
              <td className="px-4 py-2 text-gray-600">A unique ID for the current deploy. Useful for log correlation.</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">SPINFORGE_REGION</td>
              <td className="px-4 py-2 text-gray-600">The region the container is running in.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Secrets best practices</h2>
      <ul className="list-disc list-inside mb-8 space-y-2 text-gray-700">
        <li>Never commit secrets to your git repository. Never bake them into a Docker image.</li>
        <li>Use separate env var sets for staging and production, even if the values happen to be equal.</li>
        <li>Rotate long-lived secrets periodically. Triggering a rolling restart picks up new values with zero downtime.</li>
        <li>Use short, unambiguous names. Prefer <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">DATABASE_URL</code> over <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">DB</code>.</li>
      </ul>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 not-prose mb-8">
        <Link href="/docs/deployment/nodejs" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
            <Key className="h-5 w-5 mr-2" /> Node.js deployment
          </h3>
          <p className="text-gray-600 text-sm">See env vars in a complete deployment example.</p>
        </Link>
        <Link href="/docs/deployment/docker-compose" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
            Docker Compose <ArrowRight className="h-4 w-4 ml-2" />
          </h3>
          <p className="text-gray-600 text-sm">Variable substitution in compose files.</p>
        </Link>
      </div>
    </div>
  );
}
