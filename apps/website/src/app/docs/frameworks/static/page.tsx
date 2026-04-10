/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Terminal, CheckCircle, ArrowRight, FileArchive } from "lucide-react";
import Link from "next/link";

export default function StaticFrameworkPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Deploying Static Sites</h1>
      <p className="text-lg text-gray-600 mb-8">
        Static sites are the simplest and cheapest thing to host on SpinForge. Build your site locally, zip the
        output, upload it. SpinForge extracts the archive and serves the files from an edge-cached path.
      </p>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8 not-prose">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">What counts as static?</h3>
        <ul className="space-y-2 text-blue-800 text-sm">
          <li className="flex items-start">
            <CheckCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            <span>Single-page apps built with Vite, Create React App, Angular, Vue, Svelte, SolidJS, Qwik</span>
          </li>
          <li className="flex items-start">
            <CheckCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            <span>Static site generators: Astro, Hugo, Jekyll, 11ty, Docusaurus, MkDocs</span>
          </li>
          <li className="flex items-start">
            <CheckCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            <span>Next.js or Nuxt configured for static export</span>
          </li>
          <li className="flex items-start">
            <CheckCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            <span>Plain HTML, CSS, and JS — no build step at all</span>
          </li>
        </ul>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Build your site</h2>
      <p className="mb-4">Use whatever build command your framework provides:</p>

      <div className="bg-gray-900 rounded-lg p-6 mb-6 not-prose">
        <div className="flex items-center mb-3">
          <Terminal className="h-5 w-5 text-gray-400 mr-2" />
          <span className="text-gray-400 text-sm">Terminal</span>
        </div>
        <pre className="text-gray-100 overflow-x-auto"><code className="language-bash">{`# Vite / React / Vue / Svelte
npm run build   # → dist/

# Create React App
npm run build   # → build/

# Next.js (static export, output: "export")
npm run build   # → out/

# Astro
npm run build   # → dist/

# Hugo
hugo            # → public/`}</code></pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Package as a ZIP</h2>
      <p className="mb-4">
        ZIP the <em>contents</em> of the build folder, not the folder itself. The archive must contain your
        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">index.html</code> at the root.
      </p>

      <div className="bg-gray-900 rounded-lg p-6 mb-6 not-prose">
        <pre className="text-gray-100 overflow-x-auto"><code className="language-bash">{`# From inside your build output directory
cd dist          # or build/, out/, public/
zip -r ../site.zip .`}</code></pre>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-8 not-prose">
        <h4 className="font-semibold text-amber-900 mb-1">File size limit</h4>
        <p className="text-amber-800 text-sm">
          ZIP uploads are capped at <strong>100 MB</strong>. If you are over the limit, optimize your images, strip
          source maps, or split large assets out to object storage and reference them by URL.
        </p>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Upload via the dashboard</h2>
      <ol className="list-decimal list-inside mb-4 space-y-2 text-gray-700">
        <li>Open <Link href="/dashboard/deploy" className="text-indigo-600 hover:underline">Dashboard → Deploy</Link></li>
        <li>Choose <strong>Static Site</strong></li>
        <li>Set the domain (or subdomain) you want to host at</li>
        <li>Leave <strong>Index file</strong> as <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">index.html</code></li>
        <li>Set <strong>Error file</strong> to <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">index.html</code> if you are deploying an SPA (so client routing works on hard refresh), otherwise <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">404.html</code></li>
        <li>Drop your ZIP into the upload area and click <strong>Deploy</strong></li>
      </ol>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">SPA client routing</h2>
      <p className="mb-4">
        For React Router, Vue Router, or any client-side router, setting the <strong>Error file</strong> to
        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs"> index.html</code> causes SpinForge to serve
        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs"> index.html</code> for any path that does not
        match a file in the archive. This is the standard fallback that makes deep-linking work.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Scripted uploads via the API</h2>
      <p className="mb-4">For CI/CD, skip the dashboard and upload directly:</p>

      <div className="bg-gray-900 rounded-lg p-6 mb-6 not-prose">
        <pre className="text-gray-100 overflow-x-auto"><code className="language-bash">{`# Create the site (once)
curl -X POST https://api.spinforge.com/_api/customer/sites \\
  -H "Authorization: Bearer $SPINFORGE_TOKEN" \\
  -H "X-Customer-ID: $SPINFORGE_CUSTOMER_ID" \\
  -H "Content-Type: application/json" \\
  -d '{
    "domain": "my-site.example.com",
    "type": "static",
    "enabled": true,
    "index_file": "index.html",
    "error_file": "index.html",
    "pending_upload": true
  }'

# Upload the ZIP (every deploy)
curl -X POST https://api.spinforge.com/_api/customer/sites/my-site.example.com/upload \\
  -H "Authorization: Bearer $SPINFORGE_TOKEN" \\
  -H "X-Customer-ID: $SPINFORGE_CUSTOMER_ID" \\
  -F "zipfile=@site.zip"`}</code></pre>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 not-prose mb-8">
        <Link href="/docs/deployment/static-sites" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
            <FileArchive className="h-5 w-5 mr-2" /> Static sites deep-dive
          </h3>
          <p className="text-gray-600 text-sm">Caching, redirects, custom headers, and more.</p>
        </Link>
        <Link href="/docs/deployment/custom-domains" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
            Custom domains <ArrowRight className="h-4 w-4 ml-2" />
          </h3>
          <p className="text-gray-600 text-sm">Point your own domain at a static site and provision SSL.</p>
        </Link>
      </div>
    </div>
  );
}
