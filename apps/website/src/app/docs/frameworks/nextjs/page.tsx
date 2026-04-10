/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Terminal, CheckCircle, AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function NextjsFrameworkPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Deploying Next.js</h1>
      <p className="text-lg text-gray-600 mb-8">
        Next.js works on SpinForge in two flavours: <strong>static export</strong> for purely static sites, and
        <strong> container</strong> deployment for apps that need a Node server (SSR, API routes, middleware).
      </p>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8 not-prose">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">Which mode should I pick?</h3>
        <ul className="space-y-2 text-blue-800 text-sm">
          <li className="flex items-start">
            <CheckCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            <span><strong>Static export</strong> — marketing sites, blogs, docs, apps without API routes or SSR. Cheapest and fastest.</span>
          </li>
          <li className="flex items-start">
            <CheckCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            <span><strong>Container</strong> — anything that needs SSR, ISR, API routes, middleware, or server actions.</span>
          </li>
        </ul>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Option A — Static Export</h2>
      <p className="mb-4">Configure Next.js for static output:</p>

      <div className="bg-gray-900 rounded-lg p-6 mb-6 not-prose">
        <pre className="text-gray-100 overflow-x-auto"><code className="language-js">{`// next.config.js
module.exports = {
  output: "export",
  images: { unoptimized: true }, // static export cannot use the image optimizer
};`}</code></pre>
      </div>

      <p className="mb-4">Build your app. Next.js will emit an <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">out/</code> directory:</p>

      <div className="bg-gray-900 rounded-lg p-6 mb-6 not-prose">
        <div className="flex items-center mb-3">
          <Terminal className="h-5 w-5 text-gray-400 mr-2" />
          <span className="text-gray-400 text-sm">Terminal</span>
        </div>
        <pre className="text-gray-100 overflow-x-auto"><code className="language-bash">{`npm run build
cd out && zip -r ../site.zip . && cd ..`}</code></pre>
      </div>

      <p className="mb-4">
        Upload <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">site.zip</code> via{" "}
        <Link href="/dashboard/deploy" className="text-indigo-600 hover:underline">Dashboard → Deploy</Link>,
        pick <strong>Static Site</strong>, and set the index file to <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">index.html</code>.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Option B — Container (SSR / API routes)</h2>
      <p className="mb-4">Use the official Next.js standalone output for the smallest container image:</p>

      <div className="bg-gray-900 rounded-lg p-6 mb-6 not-prose">
        <pre className="text-gray-100 overflow-x-auto"><code className="language-js">{`// next.config.js
module.exports = {
  output: "standalone",
};`}</code></pre>
      </div>

      <p className="mb-4">Create a <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">Dockerfile</code>:</p>

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
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]`}</code></pre>
      </div>

      <p className="mb-4">Build and push to a registry your SpinForge instance can reach:</p>

      <div className="bg-gray-900 rounded-lg p-6 mb-6 not-prose">
        <pre className="text-gray-100 overflow-x-auto"><code className="language-bash">{`docker build -t your-registry/my-next-app:latest .
docker push your-registry/my-next-app:latest`}</code></pre>
      </div>

      <p className="mb-4">
        Then deploy via <Link href="/dashboard/deploy" className="text-indigo-600 hover:underline">Dashboard → Deploy</Link>,
        pick <strong>Docker Container</strong>, and fill in:
      </p>

      <ul className="list-disc list-inside mb-8 space-y-1 text-gray-700">
        <li><strong>Image:</strong> <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">your-registry/my-next-app:latest</code></li>
        <li><strong>Port:</strong> <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">3000</code></li>
        <li><strong>Env vars:</strong> anything your app needs at runtime (for example <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">DATABASE_URL</code>)</li>
      </ul>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-8 not-prose">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-amber-900 mb-1">Build-time vs runtime env vars</h4>
            <p className="text-amber-800 text-sm">
              Next.js inlines <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_*</code> variables at build time,
              not runtime. You must bake them into the image when you <code className="bg-amber-100 px-1 rounded">docker build</code>,
              not pass them via SpinForge env vars.
            </p>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Image Optimization</h2>
      <p className="mb-4">
        If you use <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">next/image</code> in container mode,
        the Next.js image optimizer runs inside your container. It works out of the box, but you will want to set a
        higher memory limit for image-heavy pages. You can do this in the container config on the dashboard.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Custom Domain</h2>
      <p className="mb-8">
        Point your DNS (A or CNAME record) at the SpinForge edge, then add the domain from{" "}
        <Link href="/dashboard/domains" className="text-indigo-600 hover:underline">Dashboard → Domains</Link>.
        SSL is issued automatically via Let&apos;s Encrypt. See the{" "}
        <Link href="/docs/deployment/custom-domains" className="text-indigo-600 hover:underline">custom domains guide</Link>.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 not-prose mb-8">
        <Link href="/docs/deployment/nodejs" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
            Node.js deployment <ArrowRight className="h-4 w-4 ml-2" />
          </h3>
          <p className="text-gray-600 text-sm">General Node.js deployment guide (Express, Remix, custom servers).</p>
        </Link>
        <Link href="/docs/troubleshooting" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
            Troubleshooting <ArrowRight className="h-4 w-4 ml-2" />
          </h3>
          <p className="text-gray-600 text-sm">Fixes for the most common Next.js deployment errors.</p>
        </Link>
      </div>
    </div>
  );
}
