/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Terminal, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function RemixFrameworkPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Deploying Remix</h1>
      <p className="text-lg text-gray-600 mb-8">
        Remix runs on SpinForge as a Node container. Use the <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">@remix-run/node</code>
        {" "}adapter, bundle a small server, and ship it as a Docker image.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Build your Remix app</h2>
      <div className="bg-gray-900 rounded-lg p-6 mb-6 not-prose">
        <div className="flex items-center mb-3">
          <Terminal className="h-5 w-5 text-gray-400 mr-2" />
          <span className="text-gray-400 text-sm">Terminal</span>
        </div>
        <pre className="text-gray-100 overflow-x-auto"><code className="language-bash">npm run build</code></pre>
      </div>

      <p className="mb-4">
        This produces <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">build/</code> and{" "}
        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">public/build/</code>. The server entry is
        typically <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">server.js</code> or{" "}
        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">server/index.js</code>.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Create a Dockerfile</h2>
      <div className="bg-gray-900 rounded-lg p-6 mb-6 not-prose">
        <pre className="text-gray-100 overflow-x-auto"><code className="language-dockerfile">{`FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/build ./build
COPY --from=builder /app/public ./public
COPY --from=builder /app/server.js ./
EXPOSE 3000
CMD ["node", "server.js"]`}</code></pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Deploy the container</h2>
      <div className="bg-gray-900 rounded-lg p-6 mb-6 not-prose">
        <pre className="text-gray-100 overflow-x-auto"><code className="language-bash">{`docker build -t your-registry/my-remix-app:latest .
docker push your-registry/my-remix-app:latest`}</code></pre>
      </div>

      <p className="mb-4">
        Open <Link href="/dashboard/deploy" className="text-indigo-600 hover:underline">Dashboard → Deploy</Link>,
        choose <strong>Docker Container</strong>, and configure:
      </p>
      <ul className="list-disc list-inside mb-8 space-y-1 text-gray-700">
        <li><strong>Image:</strong> <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">your-registry/my-remix-app:latest</code></li>
        <li><strong>Port:</strong> <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">3000</code> (whatever your server listens on)</li>
        <li><strong>Env vars:</strong> <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">SESSION_SECRET</code>, <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">DATABASE_URL</code>, etc.</li>
      </ul>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Express adapter</h2>
      <p className="mb-4">
        If you scaffold Remix with the Express template, the server is already written for you. Just ensure it
        listens on <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">process.env.PORT ?? 3000</code> so
        SpinForge can inject the port at runtime:
      </p>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto"><code className="language-js">{`const port = process.env.PORT || 3000;
app.listen(port, () => console.log(\`Listening on \${port}\`));`}</code></pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Sessions & secrets</h2>
      <p className="mb-8">
        Do not bake secrets into the Docker image. Pass them as runtime environment variables from the SpinForge
        dashboard so you can rotate them without rebuilding.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 not-prose mb-8">
        <Link href="/docs/deployment/nodejs" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
            Node.js deployment <ArrowRight className="h-4 w-4 ml-2" />
          </h3>
          <p className="text-gray-600 text-sm">Deep-dive into deploying Node apps of any framework.</p>
        </Link>
        <Link href="/docs/deployment/env-vars" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
            Environment variables <ArrowRight className="h-4 w-4 ml-2" />
          </h3>
          <p className="text-gray-600 text-sm">How runtime env vars are injected into your container.</p>
        </Link>
      </div>
    </div>
  );
}
