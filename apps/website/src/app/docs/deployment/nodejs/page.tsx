/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Terminal, AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function NodeJsGuidePage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Node.js Deployment Guide</h1>
      <p className="text-lg text-gray-600 mb-8">
        Any Node.js application — Express, Fastify, Koa, Hono, Next.js SSR, Remix, NestJS, custom servers — can
        be deployed to SpinForge as a Docker container. This guide walks through the whole flow end-to-end.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Anatomy of a SpinForge-ready Node app</h2>
      <ol className="list-decimal list-inside mb-8 space-y-2 text-gray-700">
        <li>Reads its port from <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">process.env.PORT</code></li>
        <li>Reads secrets and config from environment variables, not from files</li>
        <li>Exposes a health endpoint (we recommend <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">/healthz</code>) that returns 200 when ready</li>
        <li>Runs as a single long-lived process (let SpinForge handle restarts)</li>
        <li>Logs to stdout/stderr — never to local files</li>
      </ol>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Writing the Dockerfile</h2>
      <p className="mb-4">A good Node.js Dockerfile uses multi-stage builds to keep the final image small:</p>

      <div className="bg-gray-900 rounded-lg p-6 mb-6 not-prose">
        <pre className="text-gray-100 overflow-x-auto"><code className="language-dockerfile">{`# syntax=docker/dockerfile:1.6

# ---- Build stage ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Runtime stage ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Create non-root user
RUN addgroup -S app && adduser -S app -G app
USER app

COPY --from=builder --chown=app:app /app/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder --chown=app:app /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/server.js"]`}</code></pre>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-8 not-prose">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-amber-900 mb-1">Do not run as root</h4>
            <p className="text-amber-800 text-sm">
              SpinForge does not block root containers, but it is a security best practice to drop privileges.
              Every example in our docs uses a non-root user.
            </p>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">2. .dockerignore</h2>
      <p className="mb-4">Keep your image small and your builds fast:</p>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto"><code>{`node_modules
npm-debug.log
.git
.gitignore
.env
.env.*
coverage
.vscode
.idea
*.md`}</code></pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Build and push the image</h2>
      <div className="bg-gray-900 rounded-lg p-6 mb-6 not-prose">
        <div className="flex items-center mb-3">
          <Terminal className="h-5 w-5 text-gray-400 mr-2" />
          <span className="text-gray-400 text-sm">Terminal</span>
        </div>
        <pre className="text-gray-100 overflow-x-auto"><code className="language-bash">{`# Log in to your registry first
docker login your-registry.example.com

# Tag and push
docker build -t your-registry.example.com/team/my-api:v1.0.0 .
docker push your-registry.example.com/team/my-api:v1.0.0`}</code></pre>
      </div>

      <p className="mb-8 text-sm text-gray-600">
        SpinForge supports Docker Hub, GitHub Container Registry (ghcr.io), GitLab, and any registry reachable
        over HTTPS. For private registries, store credentials in{" "}
        <Link href="/dashboard/settings" className="text-indigo-600 hover:underline">Settings → Registry Credentials</Link>.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Deploy from the dashboard</h2>
      <p className="mb-4">
        Open <Link href="/dashboard/deploy" className="text-indigo-600 hover:underline">Dashboard → Deploy</Link>,
        pick <strong>Docker Container</strong>, and fill in:
      </p>

      <div className="overflow-x-auto mb-8 not-prose">
        <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-gray-700">Field</th>
              <th className="text-left px-4 py-2 font-semibold text-gray-700">Example</th>
              <th className="text-left px-4 py-2 font-semibold text-gray-700">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            <tr>
              <td className="px-4 py-2 font-medium">Domain</td>
              <td className="px-4 py-2 font-mono text-xs">api.example.com</td>
              <td className="px-4 py-2 text-gray-600">The public hostname visitors will use</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-medium">Image</td>
              <td className="px-4 py-2 font-mono text-xs">your-reg/api:v1.0.0</td>
              <td className="px-4 py-2 text-gray-600">Always pin a tag; avoid :latest in prod</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-medium">Port</td>
              <td className="px-4 py-2 font-mono text-xs">3000</td>
              <td className="px-4 py-2 text-gray-600">Whatever your app listens on inside the container</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-medium">Env vars</td>
              <td className="px-4 py-2 font-mono text-xs">DATABASE_URL=…</td>
              <td className="px-4 py-2 text-gray-600">One per line, KEY=value format</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-medium">SSL</td>
              <td className="px-4 py-2 font-mono text-xs">Enabled</td>
              <td className="px-4 py-2 text-gray-600">Let&apos;s Encrypt is issued automatically once DNS resolves</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Watch it come up</h2>
      <p className="mb-4">
        After clicking <strong>Deploy</strong>, SpinForge pulls the image, starts the container, waits for your
        health endpoint, and flips traffic over. You can watch the whole thing from{" "}
        <Link href="/dashboard/applications" className="text-indigo-600 hover:underline">Dashboard → Applications</Link> → your site → <em>Logs</em>.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Updating your deployment</h2>
      <p className="mb-4">
        To ship a new version, push a new image tag and update the image field on the site. SpinForge pulls the
        new image, starts a new container, waits for it to become healthy, then swaps traffic over. The old
        container is stopped only after the new one is ready — so you get zero-downtime deploys for free.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 not-prose mb-8">
        <Link href="/docs/deployment/env-vars" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
            Environment variables <ArrowRight className="h-4 w-4 ml-2" />
          </h3>
          <p className="text-gray-600 text-sm">How runtime env vars get into your container.</p>
        </Link>
        <Link href="/docs/deployment/docker-compose" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
            Docker Compose <ArrowRight className="h-4 w-4 ml-2" />
          </h3>
          <p className="text-gray-600 text-sm">For apps with a database, queue, or sidecars.</p>
        </Link>
      </div>
    </div>
  );
}
