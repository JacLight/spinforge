/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Layers, AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function DockerComposeGuidePage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Docker Compose Deployments</h1>
      <p className="text-lg text-gray-600 mb-8">
        Some apps need more than a single container: a web app with a Postgres database, a worker with a Redis
        queue, or a legacy stack with a sidecar. For these, SpinForge accepts a Docker Compose file and runs the
        whole stack together.
      </p>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8 not-prose">
        <div className="flex items-start">
          <Layers className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-blue-900 mb-1">When to use Compose</h4>
            <p className="text-blue-800 text-sm">
              Only use Compose if your application genuinely needs multiple coordinated services. For a single
              container, prefer the <strong>Simple</strong> container mode — it is easier to configure and easier
              to reason about. See the{" "}
              <Link href="/docs/deployment/nodejs" className="underline">Node.js guide</Link> for that path.
            </p>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Example: web + Postgres + Redis</h2>
      <p className="mb-4">
        A typical stack with a web app, a Postgres database, and a Redis cache. The web service is the one that
        SpinForge exposes to the internet — every other service stays on the internal Compose network.
      </p>

      <div className="bg-gray-900 rounded-lg p-6 mb-6 not-prose">
        <pre className="text-gray-100 overflow-x-auto"><code className="language-yaml">{`version: "3.9"

services:
  web:
    image: your-reg/web-app:v1.0.0
    restart: unless-stopped
    expose:
      - "3000"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://app:\${POSTGRES_PASSWORD}@db:5432/app
      REDIS_URL: redis://cache:6379
    depends_on:
      - db
      - cache
    labels:
      spinforge.public: "true"   # This is the service SpinForge routes traffic to
      spinforge.port: "3000"

  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: app
      POSTGRES_USER: app
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
    volumes:
      - db-data:/var/lib/postgresql/data

  cache:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - cache-data:/data

volumes:
  db-data:
  cache-data:`}</code></pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Deploying the stack</h2>
      <ol className="list-decimal list-inside mb-8 space-y-2 text-gray-700">
        <li>Open <Link href="/dashboard/deploy" className="text-indigo-600 hover:underline">Dashboard → Deploy</Link></li>
        <li>Choose <strong>Docker Container</strong>, then switch to <strong>Advanced</strong> mode</li>
        <li>Paste your full <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">docker-compose.yml</code> into the editor</li>
        <li>Set the public-facing domain at the top of the form</li>
        <li>Click <strong>Deploy</strong></li>
      </ol>

      <p className="mb-8 text-gray-600">
        SpinForge validates the YAML, pulls each image, brings services up in dependency order, and waits for the
        public service&apos;s health check before routing traffic.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Labels that matter</h2>
      <div className="overflow-x-auto mb-8 not-prose">
        <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-gray-700">Label</th>
              <th className="text-left px-4 py-2 font-semibold text-gray-700">Purpose</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            <tr>
              <td className="px-4 py-2 font-mono text-xs">spinforge.public</td>
              <td className="px-4 py-2 text-gray-600">Mark exactly one service as the entrypoint. Set to <code className="bg-gray-100 px-1 rounded">&quot;true&quot;</code>.</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">spinforge.port</td>
              <td className="px-4 py-2 text-gray-600">Which port on the public service to forward traffic to.</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">spinforge.healthcheck</td>
              <td className="px-4 py-2 text-gray-600">Override the default health check path (defaults to <code className="bg-gray-100 px-1 rounded">/healthz</code>).</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-8 not-prose">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-amber-900 mb-1">Only one public service</h4>
            <p className="text-amber-800 text-sm">
              SpinForge maps one domain to one public service. If you need multiple public entry points, deploy
              them as separate sites with separate compose files.
            </p>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Persistent data</h2>
      <p className="mb-4">
        Named volumes (like <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">db-data</code> above) are
        persisted on the SpinForge host and survive redeploys. They do not survive site deletion — always back up
        production databases before deleting a compose site.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Secrets and env vars</h2>
      <p className="mb-4">
        Do not hardcode passwords. Use the <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{"${VAR_NAME}"}</code>{" "}
        substitution syntax in your compose file and set the actual values in the SpinForge dashboard under
        <em> Environment Variables</em>. They are injected into every service in the stack.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Limits and restrictions</h2>
      <ul className="list-disc list-inside mb-8 space-y-1 text-gray-700">
        <li>Maximum 10 services per compose file</li>
        <li>No host networking (<code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">network_mode: host</code> is rejected)</li>
        <li>No privileged containers</li>
        <li>No bind mounts from the host filesystem — use named volumes instead</li>
        <li>No ports published directly to the host — use <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">expose</code> and let SpinForge handle the edge</li>
      </ul>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 not-prose mb-8">
        <Link href="/docs/deployment/nodejs" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
            Single-container Node apps <ArrowRight className="h-4 w-4 ml-2" />
          </h3>
          <p className="text-gray-600 text-sm">Simpler path for apps that do not need extra services.</p>
        </Link>
        <Link href="/docs/troubleshooting" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
            Troubleshooting <ArrowRight className="h-4 w-4 ml-2" />
          </h3>
          <p className="text-gray-600 text-sm">Debugging multi-service stacks.</p>
        </Link>
      </div>
    </div>
  );
}
