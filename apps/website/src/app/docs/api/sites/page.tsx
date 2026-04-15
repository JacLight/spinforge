/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Globe, Upload, Container, Plus, Edit, Trash2, Shield } from "lucide-react";

export default function SitesAPIPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <div className="flex items-center mb-6">
        <Globe className="h-8 w-8 text-indigo-600 mr-3" />
        <h1 className="text-3xl font-bold text-gray-900 mb-0">Sites API</h1>
      </div>

      <p className="text-lg text-gray-600 mb-8">
        Every customer-facing site endpoint lives under <code>/_api/customer/*</code> and requires
        <code>Authorization: Bearer sfc_...</code>.
      </p>

      <section className="mb-8 bg-gray-50 p-6 rounded-lg not-prose">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">Quick navigation</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <a href="#list-sites" className="text-indigo-600 hover:text-indigo-800">List sites</a>
          <a href="#get-site" className="text-indigo-600 hover:text-indigo-800">Get one site</a>
          <a href="#create-site" className="text-indigo-600 hover:text-indigo-800">Create a site</a>
          <a href="#upload" className="text-indigo-600 hover:text-indigo-800">Upload static files</a>
          <a href="#update-site" className="text-indigo-600 hover:text-indigo-800">Update a site</a>
          <a href="#delete-site" className="text-indigo-600 hover:text-indigo-800">Delete a site</a>
          <a href="#readiness" className="text-indigo-600 hover:text-indigo-800">Readiness</a>
          <a href="#containers" className="text-indigo-600 hover:text-indigo-800">Container state</a>
          <a href="#lifecycle" className="text-indigo-600 hover:text-indigo-800">Start / stop / restart / rebuild</a>
          <a href="#logs" className="text-indigo-600 hover:text-indigo-800">Logs</a>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Site types</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 not-prose mb-8">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-1">static</h4>
          <p className="text-sm text-gray-600 mb-0">Upload a zip, serve files directly.</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-1">proxy</h4>
          <p className="text-sm text-gray-600 mb-0">Reverse proxy to <code>target</code> URL.</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-1">container</h4>
          <p className="text-sm text-gray-600 mb-0">Docker image scheduled on Nomad.</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-1">node</h4>
          <p className="text-sm text-gray-600 mb-0">Raw binary scheduled on Nomad via <code>entrypoint</code>.</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-1">loadbalancer</h4>
          <p className="text-sm text-gray-600 mb-0">Weighted pool of external <code>backends</code>.</p>
        </div>
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-8 not-prose">
        <div className="flex items-start">
          <Shield className="h-5 w-5 text-indigo-700 mr-2 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-indigo-900 mb-0">
            Every site is HTTPS. <code>ssl_enabled</code> is stored on the record but cannot be
            disabled.
          </p>
        </div>
      </div>

      <hr className="my-8 border-gray-200" />

      <h2 id="list-sites" className="text-2xl font-bold text-gray-900 mb-4">List sites</h2>
      <p className="mb-2"><code>GET /_api/customer/sites</code></p>
      <div className="bg-gray-900 rounded-lg p-6 mb-4 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`curl https://api.spinforge.dev/_api/customer/sites \\
  -H "Authorization: Bearer sfc_..."`}</code></pre>
      </div>
      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <span className="text-gray-400 text-sm">Response 200</span>
        <pre className="text-gray-100 overflow-x-auto text-sm mt-2"><code>{`[
  {
    "domain": "docs.example.com",
    "type": "static",
    "ssl_enabled": true,
    "aliases": ["www.example.com"],
    "createdAt": "2026-04-01T12:00:00Z"
  },
  {
    "domain": "api.example.com",
    "type": "container",
    "ssl_enabled": true,
    "aliases": [],
    "nomadJobId": "site-api-example-com",
    "containerConfig": { "image": "ghcr.io/me/api:1.0.0", "port": 8080 },
    "createdAt": "2026-04-05T09:30:00Z"
  }
]`}</code></pre>
      </div>

      <hr className="my-8 border-gray-200" />

      <h2 id="get-site" className="text-2xl font-bold text-gray-900 mb-4">Get one site</h2>
      <p className="mb-2"><code>GET /_api/customer/sites/:domain</code></p>
      <div className="bg-gray-900 rounded-lg p-6 mb-4 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`curl https://api.spinforge.dev/_api/customer/sites/api.example.com \\
  -H "Authorization: Bearer sfc_..."`}</code></pre>
      </div>
      <p className="mb-8 text-sm text-gray-600">Returns a single site record. <strong>404</strong> if not found.</p>

      <hr className="my-8 border-gray-200" />

      <h2 id="create-site" className="text-2xl font-bold text-gray-900 mb-4">
        <Plus className="inline h-5 w-5 mr-1" /> Create a site
      </h2>
      <p className="mb-2"><code>POST /_api/customer/sites</code></p>
      <p className="mb-4 text-sm text-gray-600">Fields vary by <code>type</code>.</p>

      <h3 className="text-lg font-semibold text-gray-900 mb-2">Request body</h3>
      <div className="bg-gray-900 rounded-lg p-6 mb-6 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`{
  "domain": "myapp.example.com",
  "type": "static" | "proxy" | "container" | "node" | "loadbalancer",
  "aliases": ["alt.example.com"],              // optional, full list each call
  "target": "https://upstream.com",            // proxy / node only
  "containerConfig": {                          // container / node only
    "image": "ghcr.io/me/app:1.0",
    "port": 3000,
    "env": { "NODE_ENV": "production" },
    "memoryLimit": "512M",
    "cpuLimit": 0.5,
    "restartPolicy": "unless-stopped"
  },
  "backends": [                                  // loadbalancer only
    { "url": "https://a.example.com", "weight": 1, "enabled": true }
  ]
}`}</code></pre>
      </div>

      <h3 className="text-lg font-semibold text-gray-900 mb-2">Response 201</h3>
      <div className="bg-gray-900 rounded-lg p-6 mb-6 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`{
  "domain": "myapp.example.com",
  "type": "container",
  "ssl_enabled": true,
  "customerId": "cus_01H...",
  "aliases": ["alt.example.com"],
  "nomadJobId": "site-myapp-example-com",
  "containerConfig": { ... },
  "createdAt": "2026-04-15T12:00:00Z"
}`}</code></pre>
      </div>

      <h3 className="text-lg font-semibold text-gray-900 mb-2">Errors</h3>
      <ul className="list-disc list-inside text-sm text-gray-600 mb-8">
        <li><strong>400</strong> — invalid or missing required fields for the chosen <code>type</code></li>
        <li><strong>401</strong> — missing/invalid <code>sfc_</code> token</li>
        <li><strong>409</strong> — domain is already registered</li>
      </ul>

      <hr className="my-8 border-gray-200" />

      <h2 id="upload" className="text-2xl font-bold text-gray-900 mb-4">
        <Upload className="inline h-5 w-5 mr-1" /> Upload static files
      </h2>
      <p className="mb-2"><code>POST /_api/customer/sites/:domain/upload</code></p>
      <p className="mb-4 text-sm text-gray-600">
        <code>Content-Type: multipart/form-data</code>, field name <code>zipfile</code>. Existing
        content is wiped before extraction. Max 500 MB.
      </p>
      <div className="bg-gray-900 rounded-lg p-6 mb-4 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`curl -X POST https://api.spinforge.dev/_api/customer/sites/docs.example.com/upload \\
  -H "Authorization: Bearer sfc_..." \\
  -F "zipfile=@site.zip"`}</code></pre>
      </div>
      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <span className="text-gray-400 text-sm">Response 200</span>
        <pre className="text-gray-100 overflow-x-auto text-sm mt-2"><code>{`{ "success": true, "domain": "docs.example.com", "files": 142, "bytes": 8743201 }`}</code></pre>
      </div>

      <hr className="my-8 border-gray-200" />

      <h2 id="update-site" className="text-2xl font-bold text-gray-900 mb-4">
        <Edit className="inline h-5 w-5 mr-1" /> Update a site
      </h2>
      <p className="mb-2"><code>PUT /_api/customer/sites/:domain</code></p>
      <p className="mb-4 text-sm text-gray-600">
        Partial update. <code>domain</code> and <code>customerId</code> are locked. <code>aliases</code>
        is reconciled — send the full list each call; diff is applied. Changes to
        <code>containerConfig</code> trigger a Nomad redeploy.
      </p>
      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`curl -X PUT https://api.spinforge.dev/_api/customer/sites/api.example.com \\
  -H "Authorization: Bearer sfc_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "aliases": ["www.example.com"],
    "containerConfig": {
      "image": "ghcr.io/me/api:1.0.1",
      "port": 8080,
      "env": { "NODE_ENV": "production" },
      "memoryLimit": "512M",
      "cpuLimit": 0.5
    }
  }'`}</code></pre>
      </div>

      <hr className="my-8 border-gray-200" />

      <h2 id="delete-site" className="text-2xl font-bold text-gray-900 mb-4">
        <Trash2 className="inline h-5 w-5 mr-1" /> Delete a site
      </h2>
      <p className="mb-2"><code>DELETE /_api/customer/sites/:domain</code></p>
      <p className="mb-4 text-sm text-gray-600">
        Tears down the Nomad job (if any), wipes static files, removes all aliases, and unregisters
        the hostname from routing.
      </p>
      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`curl -X DELETE https://api.spinforge.dev/_api/customer/sites/api.example.com \\
  -H "Authorization: Bearer sfc_..."`}</code></pre>
      </div>

      <hr className="my-8 border-gray-200" />

      <h2 id="readiness" className="text-2xl font-bold text-gray-900 mb-4">
        <Container className="inline h-5 w-5 mr-1" /> Readiness
      </h2>
      <p className="mb-2"><code>GET /_api/customer/sites/:domain/readiness</code></p>
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

      <hr className="my-8 border-gray-200" />

      <h2 id="containers" className="text-2xl font-bold text-gray-900 mb-4">Container state</h2>
      <p className="mb-2"><code>GET /_api/customer/sites/:domain/containers</code></p>
      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`{
  "jobId": "site-api-example-com",
  "status": "running",
  "allocations": [
    { "id": "alloc-abc123", "node": "nomad-worker-1", "status": "running" }
  ]
}`}</code></pre>
      </div>

      <hr className="my-8 border-gray-200" />

      <h2 id="lifecycle" className="text-2xl font-bold text-gray-900 mb-4">Lifecycle actions</h2>
      <p className="mb-2"><code>POST /_api/customer/sites/:domain/container/:action</code></p>
      <p className="mb-4 text-sm text-gray-600"><code>:action</code> is one of <code>start</code>, <code>stop</code>, <code>restart</code>, <code>rebuild</code>.</p>
      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`curl -X POST https://api.spinforge.dev/_api/customer/sites/api.example.com/container/restart \\
  -H "Authorization: Bearer sfc_..."`}</code></pre>
      </div>

      <hr className="my-8 border-gray-200" />

      <h2 id="logs" className="text-2xl font-bold text-gray-900 mb-4">Logs</h2>
      <p className="mb-2"><code>GET /_api/customer/sites/:domain/logs?lines=200&amp;stream=stdout</code></p>
      <p className="mb-4 text-sm text-gray-600">
        Tails the first running allocation. <code>lines</code> defaults to 100.
        <code>stream</code> is <code>stdout</code> or <code>stderr</code>.
      </p>
      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`curl "https://api.spinforge.dev/_api/customer/sites/api.example.com/logs?lines=200&stream=stderr" \\
  -H "Authorization: Bearer sfc_..."`}</code></pre>
      </div>
    </div>
  );
}
