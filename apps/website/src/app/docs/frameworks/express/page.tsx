/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Terminal, ArrowRight, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function ExpressFrameworkPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Deploying Express</h1>
      <p className="text-lg text-gray-600 mb-8">
        Express apps ship to SpinForge as a Docker container. The workflow is the same as any Node server: write a
        Dockerfile, push to a registry, deploy from the dashboard.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Minimal Express server</h2>
      <p className="mb-4">
        SpinForge injects a <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">PORT</code> environment
        variable at runtime. Your app must read it:
      </p>

      <div className="bg-gray-900 rounded-lg p-6 mb-6 not-prose">
        <pre className="text-gray-100 overflow-x-auto"><code className="language-js">{`// server.js
const express = require("express");
const app = express();

app.get("/", (_req, res) => res.send("Hello from SpinForge"));
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(\`API listening on :\${port}\`));`}</code></pre>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-8 not-prose">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-amber-900 mb-1">Expose a /healthz endpoint</h4>
            <p className="text-amber-800 text-sm">
              SpinForge hits a health endpoint to decide when your container is ready and whether to restart it.
              Return <code className="bg-amber-100 px-1 rounded">200</code> as soon as your app is able to serve
              real traffic.
            </p>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Dockerfile</h2>
      <div className="bg-gray-900 rounded-lg p-6 mb-6 not-prose">
        <pre className="text-gray-100 overflow-x-auto"><code className="language-dockerfile">{`FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]`}</code></pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Build, push, deploy</h2>
      <div className="bg-gray-900 rounded-lg p-6 mb-6 not-prose">
        <div className="flex items-center mb-3">
          <Terminal className="h-5 w-5 text-gray-400 mr-2" />
          <span className="text-gray-400 text-sm">Terminal</span>
        </div>
        <pre className="text-gray-100 overflow-x-auto"><code className="language-bash">{`docker build -t your-registry/my-api:latest .
docker push your-registry/my-api:latest`}</code></pre>
      </div>

      <p className="mb-8">
        Open <Link href="/dashboard/deploy" className="text-indigo-600 hover:underline">Dashboard → Deploy</Link>,
        choose <strong>Docker Container</strong>, enter the image, set port <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">3000</code>,
        and add any env vars your app reads (<code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">DATABASE_URL</code>,
        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">JWT_SECRET</code>, etc.).
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Behind the proxy</h2>
      <p className="mb-4">
        SpinForge terminates TLS at the edge and forwards HTTP to your container with the original client IP in
        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">X-Forwarded-For</code>. If you use Express
        middleware that relies on <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">req.ip</code> (rate
        limiters, audit logs), trust the first proxy:
      </p>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto"><code className="language-js">{`app.set("trust proxy", 1);`}</code></pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">WebSockets</h2>
      <p className="mb-8">
        WebSocket upgrades work out of the box for container deployments. If you are using the <strong>Reverse
        Proxy</strong> type instead, tick <em>WebSocket Support</em> in the proxy config.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 not-prose mb-8">
        <Link href="/docs/deployment/nodejs" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
            Node.js deployment <ArrowRight className="h-4 w-4 ml-2" />
          </h3>
          <p className="text-gray-600 text-sm">General Node.js deployment guide with deeper Docker tips.</p>
        </Link>
        <Link href="/docs/troubleshooting" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
            Troubleshooting <ArrowRight className="h-4 w-4 ml-2" />
          </h3>
          <p className="text-gray-600 text-sm">Crash loops, 502s, missing env vars, and other gotchas.</p>
        </Link>
      </div>
    </div>
  );
}
