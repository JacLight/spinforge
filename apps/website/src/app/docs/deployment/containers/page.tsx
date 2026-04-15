/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Container, Play, Square, RotateCcw, Terminal, ArrowRight, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function ContainersDeploymentPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Deploy a Container</h1>
      <p className="text-lg text-gray-600 mb-8">
        Push an image to a registry, create a site with <code>type: &quot;container&quot;</code>, and
        SpinForge schedules it on Nomad. Traffic is routed to a healthy allocation via Consul.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Push your image</h2>
      <p className="mb-4">
        Use any registry Nomad&apos;s Docker driver can pull from — Docker Hub, GHCR, ECR, a private
        registry with pull credentials configured on the cluster. Tag it with a version.
      </p>
      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`docker build -t ghcr.io/me/myapi:1.0.0 .
docker push ghcr.io/me/myapi:1.0.0`}</code></pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Create the site</h2>
      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`curl -X POST https://api.spinforge.dev/_api/customer/sites \\
  -H "Authorization: Bearer sfc_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "domain": "api.example.com",
    "type": "container",
    "containerConfig": {
      "image": "ghcr.io/me/myapi:1.0.0",
      "port": 8080,
      "env": { "NODE_ENV": "production" },
      "memoryLimit": "512M",
      "cpuLimit": 0.5,
      "restartPolicy": "unless-stopped"
    }
  }'`}</code></pre>
      </div>
      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <span className="text-gray-400 text-sm">Response 201</span>
        <pre className="text-gray-100 overflow-x-auto text-sm mt-2"><code>{`{
  "domain": "api.example.com",
  "type": "container",
  "ssl_enabled": true,
  "nomadJobId": "site-api-example-com",
  "containerConfig": {
    "image": "ghcr.io/me/myapi:1.0.0",
    "port": 8080,
    "memoryLimit": "512M",
    "cpuLimit": 0.5,
    "restartPolicy": "unless-stopped"
  },
  "createdAt": "2026-04-15T12:00:00.000Z"
}`}</code></pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Wait for readiness</h2>
      <p className="mb-4">
        The job submits instantly, but the container needs a moment to pull, start, and pass health
        checks. Poll the readiness endpoint:
      </p>
      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`curl https://api.spinforge.dev/_api/customer/sites/api.example.com/readiness \\
  -H "Authorization: Bearer sfc_..."`}</code></pre>
      </div>
      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <span className="text-gray-400 text-sm">Response</span>
        <pre className="text-gray-100 overflow-x-auto text-sm mt-2"><code>{`{
  "ready": true,
  "status": "running",
  "allocations": [
    { "id": "alloc-abc123", "status": "running", "healthy": true }
  ]
}`}</code></pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Manage the lifecycle</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 not-prose mb-8">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center mb-2">
            <Play className="h-4 w-4 text-green-600 mr-2" />
            <code className="text-sm">POST .../container/start</code>
          </div>
          <p className="text-sm text-gray-600 mb-0">Start a stopped container.</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center mb-2">
            <Square className="h-4 w-4 text-red-600 mr-2" />
            <code className="text-sm">POST .../container/stop</code>
          </div>
          <p className="text-sm text-gray-600 mb-0">Gracefully stop the container.</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center mb-2">
            <RotateCcw className="h-4 w-4 text-indigo-600 mr-2" />
            <code className="text-sm">POST .../container/restart</code>
          </div>
          <p className="text-sm text-gray-600 mb-0">Restart the running allocation.</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center mb-2">
            <RotateCcw className="h-4 w-4 text-indigo-600 mr-2" />
            <code className="text-sm">POST .../container/rebuild</code>
          </div>
          <p className="text-sm text-gray-600 mb-0">Re-pull the image and start fresh.</p>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Tail logs</h2>
      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`curl "https://api.spinforge.dev/_api/customer/sites/api.example.com/logs?lines=200&stream=stdout" \\
  -H "Authorization: Bearer sfc_..."`}</code></pre>
      </div>
      <p className="mb-8 text-sm text-gray-600">
        <code>stream</code> can be <code>stdout</code> or <code>stderr</code>. <code>lines</code>{" "}
        defaults to 100. Logs come from the first running allocation.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Redeploys</h2>
      <p className="mb-4">
        A <code>PUT</code> on the site with any change under <code>containerConfig</code> triggers a
        redeploy. Nomad rolls out a new allocation with the new spec. Traffic shifts when the new
        allocation is healthy.
      </p>
      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`curl -X PUT https://api.spinforge.dev/_api/customer/sites/api.example.com \\
  -H "Authorization: Bearer sfc_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "containerConfig": {
      "image": "ghcr.io/me/myapi:1.0.1",
      "port": 8080,
      "env": { "NODE_ENV": "production" },
      "memoryLimit": "512M",
      "cpuLimit": 0.5
    }
  }'`}</code></pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Node-type sites</h2>
      <p className="mb-4">
        <code>type: &quot;node&quot;</code> runs a raw binary on the Nomad cluster using
        <code>containerConfig.entrypoint</code>. It uses the same lifecycle endpoints as containers.
        Use it when a container image is overkill.
      </p>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8 not-prose">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-amber-700 mr-2 mt-0.5 flex-shrink-0" />
          <p className="text-amber-800 text-sm mb-0">
            The container must listen on the <code>port</code> you configured, on
            <code>0.0.0.0</code>, over plain HTTP. TLS is terminated at our edge — do not bind TLS
            inside the container.
          </p>
        </div>
      </div>

      <Link href="/docs/api/containers" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 not-prose inline-block">
        <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
          Container API reference <ArrowRight className="h-4 w-4 ml-2" />
        </h3>
        <p className="text-sm text-gray-600 mb-0">All container lifecycle endpoints.</p>
      </Link>
    </div>
  );
}
