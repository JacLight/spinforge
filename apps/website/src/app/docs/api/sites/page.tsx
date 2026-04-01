/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Globe, Upload, Container, Plus, Edit, Trash2, CheckCircle, Shield, Key, Play, Square, RotateCcw, Terminal, Activity } from "lucide-react";

export default function SitesAPIPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <div className="flex items-center mb-6">
        <Globe className="h-8 w-8 text-indigo-600 mr-3" />
        <h1 className="text-3xl font-bold text-gray-900 mb-0">Sites Management API</h1>
      </div>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Overview</h2>
        <p className="text-gray-600 mb-4">
          The Sites API provides comprehensive management for all deployment types: static sites, proxy sites, Docker containers, load balancers, and Docker Compose projects.
          It includes container management, authentication/authorization, SSL configuration, and monitoring capabilities.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Site Types</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 not-prose mb-6">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-2">static</h4>
            <p className="text-sm text-gray-600">Serve static HTML/CSS/JS files with ZIP/TAR upload support</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-2">proxy</h4>
            <p className="text-sm text-gray-600">Reverse proxy to another URL or service</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-2">container</h4>
            <p className="text-sm text-gray-600">Deploy and manage Docker containers with full lifecycle control</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-2">loadbalancer</h4>
            <p className="text-sm text-gray-600">Load balance across multiple backends with health checks</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-2">compose</h4>
            <p className="text-sm text-gray-600">Deploy Docker Compose multi-container applications</p>
          </div>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      {/* TABLE OF CONTENTS */}
      <section className="mb-12 bg-gray-50 p-6 rounded-lg not-prose">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Navigation</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <a href="#list-sites" className="text-indigo-600 hover:text-indigo-800">List Sites</a>
          <a href="#get-site" className="text-indigo-600 hover:text-indigo-800">Get Site Details</a>
          <a href="#create-static" className="text-indigo-600 hover:text-indigo-800">Create Static Site</a>
          <a href="#upload" className="text-indigo-600 hover:text-indigo-800">Upload Files</a>
          <a href="#create-container" className="text-indigo-600 hover:text-indigo-800">Deploy Container</a>
          <a href="#create-compose" className="text-indigo-600 hover:text-indigo-800">Deploy Compose</a>
          <a href="#create-proxy" className="text-indigo-600 hover:text-indigo-800">Create Proxy</a>
          <a href="#create-loadbalancer" className="text-indigo-600 hover:text-indigo-800">Create Load Balancer</a>
          <a href="#update-site" className="text-indigo-600 hover:text-indigo-800">Update Site</a>
          <a href="#delete-site" className="text-indigo-600 hover:text-indigo-800">Delete Site</a>
          <a href="#readiness" className="text-indigo-600 hover:text-indigo-800">Check Readiness</a>
          <a href="#container-management" className="text-indigo-600 hover:text-indigo-800">Container Management</a>
          <a href="#container-exec" className="text-indigo-600 hover:text-indigo-800">Execute Commands</a>
          <a href="#container-logs" className="text-indigo-600 hover:text-indigo-800">Container Logs</a>
          <a href="#container-stats" className="text-indigo-600 hover:text-indigo-800">Container Stats</a>
          <a href="#compose-management" className="text-indigo-600 hover:text-indigo-800">Compose Management</a>
          <a href="#authentication" className="text-indigo-600 hover:text-indigo-800">Authentication & API Keys</a>
          <a href="#additional-endpoints" className="text-indigo-600 hover:text-indigo-800">Additional Endpoints</a>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      {/* LIST SITES */}
      <section id="list-sites" className="mb-12">
        <div className="flex items-center mb-4">
          <Globe className="h-6 w-6 text-blue-600 mr-2" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-0">List Sites</h2>
        </div>

        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">GET /api/sites</code></h3>
        <p className="text-gray-600 mb-4">List all sites with optional filtering and pagination.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Query Parameters</h4>
        <ul className="list-disc list-inside text-gray-600 space-y-1 mb-6">
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">search</code> - Search in domain or customer ID</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">customer</code> - Filter by customer ID</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">type</code> - Filter by site type (static, proxy, container, loadbalancer, compose)</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">limit</code> - Number of results per page</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">offset</code> - Offset for pagination</li>
        </ul>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`{
  "data": [
    {
      "domain": "example.com",
      "type": "static",
      "enabled": true,
      "ssl_enabled": true,
      "customerId": "customer_123",
      "aliases": ["www.example.com"],
      "createdAt": "2025-01-10T10:00:00Z",
      "updatedAt": "2025-01-10T10:00:00Z"
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0,
  "hasMore": true
}`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Example</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`// List all container sites
const sites = await fetch('https://api.spinforge.dev/api/sites?type=container&limit=20', {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  }
});

const data = await sites.json();
console.log(\`Found \${data.total} container sites\`);`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      {/* GET SITE */}
      <section id="get-site" className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Get Site Details</h2>

        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">GET /api/sites/:domain</code></h3>
        <p className="text-gray-600 mb-4">Get detailed information about a specific site.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`{
  "domain": "example.com",
  "type": "container",
  "enabled": true,
  "ssl_enabled": true,
  "customerId": "customer_123",
  "containerName": "spinforge-example-com",
  "containerId": "abc123",
  "target": "http://spinforge-example-com:3000",
  "containerConfig": {
    "image": "nginx:alpine",
    "port": 3000,
    "env": {"NODE_ENV": "production"}
  },
  "createdAt": "2025-01-10T10:00:00Z"
}`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      {/* CREATE STATIC SITE */}
      <section id="create-static" className="mb-12">
        <div className="flex items-center mb-4">
          <Plus className="h-6 w-6 text-green-600 mr-2" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-0">Create Static Site</h2>
        </div>

        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">POST /api/sites</code></h3>
        <p className="text-gray-600 mb-4">Create a new static site for serving HTML/CSS/JS files.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Request Body</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`{
  "domain": "mysite.com",
  "type": "static",
  "enabled": true,
  "ssl_enabled": true,
  "aliases": ["www.mysite.com"],
  "customerId": "customer_123"
}`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`{
  "message": "Site created",
  "domain": "mysite.com"
}`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      {/* UPLOAD TO STATIC SITE */}
      <section id="upload" className="mb-12">
        <div className="flex items-center mb-4">
          <Upload className="h-6 w-6 text-purple-600 mr-2" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-0">Upload Static Files</h2>
        </div>

        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">POST /api/sites/:domain/upload</code></h3>
        <p className="text-gray-600 mb-4">
          Upload a ZIP or TAR file containing your static site files. Supports automatic directory flattening.
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 not-prose mb-4">
          <p className="text-sm text-blue-900">
            <strong>Supported formats:</strong> .zip, .tar, .tar.gz, .tgz (max 100MB)
          </p>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Form Data</h4>
        <ul className="list-disc list-inside text-gray-600 space-y-1 mb-6">
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">zipfile</code> - The file to upload (multipart/form-data)</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">replaceMode</code> - "replace" or "merge" (default: merge)</li>
        </ul>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Upload Modes</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 not-prose mb-6">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h5 className="font-semibold text-gray-900 mb-2">Merge Mode (default)</h5>
            <p className="text-sm text-gray-600">New files overwrite existing ones, but unaffected files remain</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h5 className="font-semibold text-gray-900 mb-2">Replace Mode</h5>
            <p className="text-sm text-gray-600">Completely clears existing content before extracting</p>
          </div>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Example - JavaScript</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-4">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`const formData = new FormData();
formData.append('zipfile', fileInput.files[0]);
formData.append('replaceMode', 'replace');

const response = await fetch('https://api.spinforge.dev/api/sites/mysite.com/upload', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: formData
});

const result = await response.json();
console.log(\`Uploaded: \${result.filesExtracted} files\`);`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Example - cURL</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`curl -X POST https://api.spinforge.dev/api/sites/mysite.com/upload \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -F "zipfile=@/path/to/site.zip" \\
  -F "replaceMode=replace"`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3 mt-6">Response</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`{
  "message": "Site uploaded successfully",
  "domain": "mysite.com",
  "filesExtracted": 42,
  "commonPrefixRemoved": "dist/",
  "mode": "replace"
}`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      {/* CREATE CONTAINER */}
      <section id="create-container" className="mb-12">
        <div className="flex items-center mb-4">
          <Container className="h-6 w-6 text-blue-600 mr-2" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-0">Deploy Docker Container</h2>
        </div>

        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">POST /api/sites</code></h3>
        <p className="text-gray-600 mb-4">Deploy a Docker container with custom configuration.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Request Body</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`{
  "domain": "app.example.com",
  "type": "container",
  "enabled": true,
  "ssl_enabled": true,
  "customerId": "customer_123",
  "containerConfig": {
    "image": "node:18-alpine",
    "port": 3000,
    "command": "node server.js",
    "env": {
      "NODE_ENV": "production",
      "API_KEY": "secret"
    },
    "volumes": [
      {
        "host": "/data/app-data",
        "container": "/app/data"
      }
    ],
    "memoryLimit": "512m",
    "cpuLimit": "0.5",
    "restartPolicy": "unless-stopped"
  },
  "additionalEndpoints": [
    {
      "domain": "api.example.com",
      "port": 8080,
      "enabled": true
    }
  ]
}`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Container Configuration Fields</h4>
        <div className="overflow-x-auto not-prose mb-6">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Field</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Type</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-2 font-mono text-xs">image</td>
                <td className="px-4 py-2 text-xs">string</td>
                <td className="px-4 py-2 text-xs">Docker image (e.g., "nginx:alpine")</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-4 py-2 font-mono text-xs">port</td>
                <td className="px-4 py-2 text-xs">number</td>
                <td className="px-4 py-2 text-xs">Container port to expose</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-xs">command</td>
                <td className="px-4 py-2 text-xs">string</td>
                <td className="px-4 py-2 text-xs">Command to override container CMD</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-4 py-2 font-mono text-xs">env</td>
                <td className="px-4 py-2 text-xs">object</td>
                <td className="px-4 py-2 text-xs">Environment variables as key-value pairs</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-xs">volumes</td>
                <td className="px-4 py-2 text-xs">array</td>
                <td className="px-4 py-2 text-xs">Volume mounts with host and container paths</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-4 py-2 font-mono text-xs">memoryLimit</td>
                <td className="px-4 py-2 text-xs">string</td>
                <td className="px-4 py-2 text-xs">Memory limit (e.g., "512m", "1g")</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-xs">cpuLimit</td>
                <td className="px-4 py-2 text-xs">string</td>
                <td className="px-4 py-2 text-xs">CPU limit (e.g., "0.5", "2")</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-4 py-2 font-mono text-xs">restartPolicy</td>
                <td className="px-4 py-2 text-xs">string</td>
                <td className="px-4 py-2 text-xs">Restart policy (default: "unless-stopped")</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`{
  "message": "Site created",
  "domain": "app.example.com"
}`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      {/* DOCKER COMPOSE */}
      <section id="create-compose" className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Deploy Docker Compose Project</h2>

        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">POST /api/sites</code></h3>
        <p className="text-gray-600 mb-4">Deploy a multi-container application using Docker Compose.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Request Body</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`{
  "domain": "app.example.com",
  "type": "compose",
  "enabled": true,
  "ssl_enabled": true,
  "compose": \`version: '3.8'
services:
  web:
    image: nginx:alpine
    ports:
      - "80:80"
  api:
    image: node:18
    environment:
      - NODE_ENV=production
    volumes:
      - ./data:/app/data\`
}`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      {/* CREATE PROXY */}
      <section id="create-proxy" className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Create Proxy Site</h2>

        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">POST /api/sites</code></h3>
        <p className="text-gray-600 mb-4">Create a reverse proxy to another URL.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Request Body</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`{
  "domain": "proxy.example.com",
  "type": "proxy",
  "enabled": true,
  "ssl_enabled": true,
  "target": "http://backend-service:8080",
  "customerId": "customer_123"
}`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      {/* CREATE LOAD BALANCER */}
      <section id="create-loadbalancer" className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Create Load Balancer</h2>

        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">POST /api/sites</code></h3>
        <p className="text-gray-600 mb-4">Create a load balancer with multiple backends and health checks.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Request Body</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`{
  "domain": "lb.example.com",
  "type": "loadbalancer",
  "enabled": true,
  "ssl_enabled": true,
  "backends": [
    {
      "url": "http://backend1:8080",
      "label": "backend-1",
      "weight": 1,
      "enabled": true,
      "healthCheck": {
        "path": "/health",
        "interval": 10,
        "timeout": 5,
        "unhealthyThreshold": 3,
        "healthyThreshold": 2
      }
    },
    {
      "url": "http://backend2:8080",
      "label": "backend-2",
      "weight": 1,
      "enabled": true
    }
  ],
  "stickySessionDuration": 3600
}`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      {/* UPDATE SITE */}
      <section id="update-site" className="mb-12">
        <div className="flex items-center mb-4">
          <Edit className="h-6 w-6 text-orange-600 mr-2" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-0">Update Site</h2>
        </div>

        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">PUT /api/sites/:domain</code></h3>
        <p className="text-gray-600 mb-4">Update site configuration. For containers, changes trigger automatic rebuild.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Example - Update Container</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`{
  "containerConfig": {
    "image": "node:20-alpine",
    "port": 3000,
    "env": {
      "NODE_ENV": "production",
      "NEW_VARIABLE": "value"
    }
  }
}`}</code></pre>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 not-prose mb-4">
          <p className="text-sm text-yellow-900">
            <strong>Note:</strong> Updating <code className="bg-yellow-100 px-1 rounded">containerConfig</code> will stop the old container and deploy a new one with the updated configuration.
          </p>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      {/* DELETE SITE */}
      <section id="delete-site" className="mb-12">
        <div className="flex items-center mb-4">
          <Trash2 className="h-6 w-6 text-red-600 mr-2" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-0">Delete Site</h2>
        </div>

        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">DELETE /api/sites/:domain</code></h3>
        <p className="text-gray-600 mb-4">Delete a site and clean up all associated resources (containers, files, etc.).</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`{
  "message": "Site deleted",
  "domain": "example.com"
}`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      {/* READINESS CHECK */}
      <section id="readiness" className="mb-12">
        <div className="flex items-center mb-4">
          <CheckCircle className="h-6 w-6 text-green-600 mr-2" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-0">Check Site Readiness</h2>
        </div>

        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">GET /api/sites/:domain/readiness</code></h3>
        <p className="text-gray-600 mb-4">Check if a site is ready to receive traffic. Especially useful for container deployments.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response - Container Ready</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-4">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`{
  "ready": true,
  "type": "container",
  "status": "ready",
  "details": "Container is responding (HTTP 200)"
}`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response - Container Starting</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`{
  "ready": false,
  "type": "container",
  "status": "starting",
  "details": "Container is starting (15s elapsed)",
  "runningSeconds": 15
}`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      {/* CONTAINER MANAGEMENT */}
      <section id="container-management" className="mb-12">
        <div className="flex items-center mb-4">
          <Activity className="h-6 w-6 text-purple-600 mr-2" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-0">Container Management</h2>
        </div>

        <p className="text-gray-600 mb-6">Control and monitor Docker containers with start, stop, restart, rebuild, and health check operations.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 not-prose mb-6">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <code className="text-sm font-mono text-indigo-600">POST /api/sites/:domain/container/start</code>
            <p className="text-sm text-gray-600 mt-2">Start a stopped container</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <code className="text-sm font-mono text-indigo-600">POST /api/sites/:domain/container/stop</code>
            <p className="text-sm text-gray-600 mt-2">Stop a running container</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <code className="text-sm font-mono text-indigo-600">POST /api/sites/:domain/container/restart</code>
            <p className="text-sm text-gray-600 mt-2">Restart a container</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <code className="text-sm font-mono text-indigo-600">POST /api/sites/:domain/container/rebuild</code>
            <p className="text-sm text-gray-600 mt-2">Rebuild container with current config</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <code className="text-sm font-mono text-indigo-600">GET /api/sites/:domain/container/health</code>
            <p className="text-sm text-gray-600 mt-2">Get container health status</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <code className="text-sm font-mono text-indigo-600">GET /api/sites/:domain/container/stats</code>
            <p className="text-sm text-gray-600 mt-2">Get container resource stats</p>
          </div>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Example - Health Check Response</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`{
  "healthy": true,
  "status": "running",
  "health": "healthy",
  "runningImage": "node:18-alpine",
  "configuredImage": "node:18-alpine"
}`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      {/* CONTAINER LOGS */}
      <section id="container-logs" className="mb-12">
        <div className="flex items-center mb-4">
          <Terminal className="h-6 w-6 text-gray-600 mr-2" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-0">Container Logs</h2>
        </div>

        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">GET /api/sites/:domain/container/logs</code></h3>
        <p className="text-gray-600 mb-4">Retrieve container logs for debugging and monitoring.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Query Parameters</h4>
        <ul className="list-disc list-inside text-gray-600 space-y-1 mb-6">
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">lines</code> - Number of log lines to retrieve (default: 100)</li>
        </ul>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Example</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`const logs = await fetch('https://api.spinforge.dev/api/sites/myapp.com/container/logs?lines=200', {
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
});

const data = await logs.json();
console.log(data.logs);`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      {/* EXECUTE COMMANDS */}
      <section id="container-exec" className="mb-12">
        <div className="flex items-center mb-4">
          <Terminal className="h-6 w-6 text-blue-600 mr-2" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-0">Execute Commands in Container</h2>
        </div>

        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">POST /api/sites/:domain/container/exec</code></h3>
        <p className="text-gray-600 mb-4">Execute commands inside a running container.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Request Body</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`{
  "command": "ls -la /app"
}`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`{
  "output": "total 24\\ndrwxr-xr-x    3 root     root...",
  "stdout": "total 24\\ndrwxr-xr-x    3 root...",
  "stderr": "",
  "exitCode": 0
}`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      {/* CONTAINER STATS */}
      <section id="container-stats" className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Container Statistics</h2>

        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">GET /api/sites/:domain/container/stats</code></h3>
        <p className="text-gray-600 mb-4">Get real-time resource usage statistics for a container.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`{
  "Name": "spinforge-myapp-com",
  "CPUPerc": "2.34%",
  "MemUsage": "128MiB / 512MiB",
  "MemPerc": "25.00%",
  "NetIO": "1.2MB / 850KB",
  "BlockIO": "45MB / 12MB"
}`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      {/* COMPOSE MANAGEMENT */}
      <section id="compose-management" className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Docker Compose Management</h2>

        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">POST /api/sites/:domain/compose/:action</code></h3>
        <p className="text-gray-600 mb-4">Control Docker Compose projects with various actions.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Available Actions</h4>
        <ul className="list-disc list-inside text-gray-600 space-y-1 mb-6">
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">stop</code> - Stop all containers</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">start</code> - Start all containers</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">restart</code> - Restart all containers</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">down</code> - Stop and remove containers</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">logs</code> - View logs (supports query params: tail, follow, service)</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">ps</code> - List containers</li>
        </ul>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Examples</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`// Restart compose project
POST /api/sites/app.example.com/compose/restart

// View logs for specific service
POST /api/sites/app.example.com/compose/logs?tail=100&service=web

// List running containers
POST /api/sites/app.example.com/compose/ps`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      {/* AUTHENTICATION */}
      <section id="authentication" className="mb-12">
        <div className="flex items-center mb-4">
          <Shield className="h-6 w-6 text-purple-600 mr-2" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-0">Authentication & Authorization</h2>
        </div>

        <p className="text-gray-600 mb-6">Protect specific routes with API key authentication or OAuth redirects.</p>

        <h3 className="text-xl font-semibold text-gray-900 mb-3">Get Auth Configuration</h3>
        <code className="bg-gray-100 px-2 py-1 rounded text-sm mb-6 block">GET /api/sites/:domain/auth</code>

        <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">Add API Key</h3>
        <code className="bg-gray-100 px-2 py-1 rounded text-sm mb-3 block">POST /api/sites/:domain/auth/keys</code>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`{
  "name": "Production API Key",
  "key": "your-secret-key-here"
}`}</code></pre>
        </div>

        <h3 className="text-xl font-semibold text-gray-900 mb-3">Add Protected Route</h3>
        <code className="bg-gray-100 px-2 py-1 rounded text-sm mb-3 block">POST /api/sites/:domain/auth/routes</code>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`{
  "pattern": "/api/*",
  "requireAuth": true,
  "redirectUrl": "https://auth.example.com/login"
}`}</code></pre>
        </div>

        <h3 className="text-xl font-semibold text-gray-900 mb-3">Delete API Key</h3>
        <code className="bg-gray-100 px-2 py-1 rounded text-sm mb-3 block">DELETE /api/sites/:domain/auth/keys/:keyId</code>

        <h3 className="text-xl font-semibold text-gray-900 mb-3">Clear All Auth</h3>
        <code className="bg-gray-100 px-2 py-1 rounded text-sm mb-3 block">DELETE /api/sites/:domain/auth/clear</code>
      </section>

      <hr className="my-8 border-gray-200" />

      {/* ADDITIONAL ENDPOINTS */}
      <section id="additional-endpoints" className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Additional Endpoints</h2>

        <p className="text-gray-600 mb-6">Expose multiple ports from a single container on different domains.</p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 not-prose mb-6">
          <p className="text-sm text-blue-900">
            <strong>Use Case:</strong> If your container exposes multiple services (e.g., web on port 3000, API on port 8080), you can map each to a separate domain.
          </p>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Example with Additional Endpoints</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`{
  "domain": "app.example.com",
  "type": "container",
  "containerConfig": {
    "image": "myapp:latest",
    "port": 3000
  },
  "additionalEndpoints": [
    {
      "domain": "api.example.com",
      "port": 8080,
      "enabled": true
    },
    {
      "domain": "admin.example.com",
      "port": 9000,
      "enabled": true
    }
  ]
}`}</code></pre>
        </div>

        <p className="text-gray-600 mt-4">
          This creates proxy routes for <code className="bg-gray-100 px-1 rounded">api.example.com</code> and{' '}
          <code className="bg-gray-100 px-1 rounded">admin.example.com</code> that point to different ports on the same container.
        </p>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Common Patterns</h2>

        <h3 className="text-xl font-semibold text-gray-900 mb-3">Complete Deployment Flow</h3>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`// 1. Create static site
const createResponse = await fetch('https://api.spinforge.dev/api/sites', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    domain: 'myapp.com',
    type: 'static',
    ssl_enabled: true
  })
});

// 2. Upload files
const formData = new FormData();
formData.append('zipfile', fileBlob);

await fetch('https://api.spinforge.dev/api/sites/myapp.com/upload', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer TOKEN' },
  body: formData
});

// 3. Verify deployment
const readiness = await fetch('https://api.spinforge.dev/api/sites/myapp.com/readiness');
const status = await readiness.json();
console.log('Site ready:', status.ready);`}</code></pre>
        </div>
      </section>
    </div>
  );
}
