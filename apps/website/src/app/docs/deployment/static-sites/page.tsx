/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Terminal, FileArchive, CheckCircle, AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function StaticSitesGuidePage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Static Sites — Deep Dive</h1>
      <p className="text-lg text-gray-600 mb-8">
        This guide covers everything about static site hosting on SpinForge: how uploads work, how files are
        served, SPA routing, custom error pages, cache behaviour, and scripted deploys.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">How it works</h2>
      <p className="mb-4">
        When you create a static site, SpinForge provisions a named storage directory and configures the edge
        server to serve files from it. Each upload replaces the contents of that directory atomically — new
        visitors see the new site on their next request, without restart downtime.
      </p>

      <div className="bg-gray-50 rounded-lg p-6 mb-8 not-prose">
        <ol className="space-y-3">
          <li className="flex items-start">
            <span className="flex-shrink-0 w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-semibold">1</span>
            <div className="ml-3">
              <h4 className="font-semibold text-gray-900">Create the site</h4>
              <p className="text-gray-600 text-sm">POST to <code className="bg-gray-200 px-1 rounded text-xs">/_api/customer/sites</code> with <code className="bg-gray-200 px-1 rounded text-xs">type: &quot;static&quot;</code>.</p>
            </div>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-semibold">2</span>
            <div className="ml-3">
              <h4 className="font-semibold text-gray-900">Upload the ZIP</h4>
              <p className="text-gray-600 text-sm">Multipart POST to <code className="bg-gray-200 px-1 rounded text-xs">/_api/customer/sites/&#123;domain&#125;/upload</code>.</p>
            </div>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-semibold">3</span>
            <div className="ml-3">
              <h4 className="font-semibold text-gray-900">Extract &amp; swap</h4>
              <p className="text-gray-600 text-sm">SpinForge extracts the archive, validates it, and swaps it into place. New requests hit the new files.</p>
            </div>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-semibold">4</span>
            <div className="ml-3">
              <h4 className="font-semibold text-gray-900">Serve from edge</h4>
              <p className="text-gray-600 text-sm">Files are served over HTTP/2 with gzip/brotli and cache headers based on file extension.</p>
            </div>
          </li>
        </ol>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">ZIP structure requirements</h2>
      <ul className="space-y-2 mb-6 not-prose">
        <li className="flex items-start">
          <CheckCircle className="h-5 w-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
          <span className="text-gray-700"><code className="bg-gray-100 px-1 rounded text-sm">index.html</code> (or whatever you set as your index file) must be at the archive root.</span>
        </li>
        <li className="flex items-start">
          <CheckCircle className="h-5 w-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
          <span className="text-gray-700">All file paths must be relative. No absolute paths, symlinks outside the archive, or <code className="bg-gray-100 px-1 rounded text-sm">../</code> traversal.</span>
        </li>
        <li className="flex items-start">
          <CheckCircle className="h-5 w-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
          <span className="text-gray-700">Total uncompressed size under 500 MB. ZIP file itself under <strong>100 MB</strong>.</span>
        </li>
      </ul>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-8 not-prose">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-amber-900 mb-1">Common mistake</h4>
            <p className="text-amber-800 text-sm">
              Zipping the folder instead of its contents. If your archive contains{" "}
              <code className="bg-amber-100 px-1 rounded">dist/index.html</code> at the root, the upload will fail
              to find <code className="bg-amber-100 px-1 rounded">index.html</code>. Always{" "}
              <code className="bg-amber-100 px-1 rounded">cd dist &amp;&amp; zip -r ../site.zip .</code>
            </p>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Index and error files</h2>
      <p className="mb-4">Two fields control what gets served for directory requests and missing files:</p>

      <div className="overflow-x-auto mb-6 not-prose">
        <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-gray-700">Field</th>
              <th className="text-left px-4 py-2 font-semibold text-gray-700">Purpose</th>
              <th className="text-left px-4 py-2 font-semibold text-gray-700">Typical value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            <tr>
              <td className="px-4 py-2 font-mono text-xs">index_file</td>
              <td className="px-4 py-2 text-gray-600">Served when a directory is requested.</td>
              <td className="px-4 py-2 font-mono text-xs">index.html</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">error_file</td>
              <td className="px-4 py-2 text-gray-600">Served for any unmatched path. For SPAs, set this to index.html so client routing works.</td>
              <td className="px-4 py-2 font-mono text-xs">index.html or 404.html</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Caching</h2>
      <p className="mb-4">SpinForge sets sensible <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">Cache-Control</code> headers based on file extension:</p>

      <div className="overflow-x-auto mb-6 not-prose">
        <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-gray-700">File type</th>
              <th className="text-left px-4 py-2 font-semibold text-gray-700">Cache-Control</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            <tr><td className="px-4 py-2"><code className="bg-gray-100 px-1 rounded text-xs">*.html</code></td><td className="px-4 py-2 text-gray-600">no-cache, must-revalidate</td></tr>
            <tr><td className="px-4 py-2"><code className="bg-gray-100 px-1 rounded text-xs">*.js, *.css</code></td><td className="px-4 py-2 text-gray-600">public, max-age=31536000, immutable</td></tr>
            <tr><td className="px-4 py-2"><code className="bg-gray-100 px-1 rounded text-xs">*.png, *.jpg, *.webp, *.svg</code></td><td className="px-4 py-2 text-gray-600">public, max-age=2592000</td></tr>
            <tr><td className="px-4 py-2"><code className="bg-gray-100 px-1 rounded text-xs">*.woff2, *.woff</code></td><td className="px-4 py-2 text-gray-600">public, max-age=31536000, immutable</td></tr>
          </tbody>
        </table>
      </div>

      <p className="mb-8 text-sm text-gray-600">
        This assumes your build tool generates fingerprinted filenames (e.g. <code className="bg-gray-100 px-1 rounded text-xs">main.a3f2b1.js</code>),
        which Vite/webpack/Rollup/Parcel all do by default.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Scripted deploys</h2>
      <p className="mb-4">Example GitHub Actions job that builds a Vite app and uploads it on every push:</p>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto"><code className="language-yaml">{`name: Deploy site
on: { push: { branches: [main] } }
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: npm ci && npm run build
      - name: Zip dist/
        run: cd dist && zip -r ../site.zip .
      - name: Upload to SpinForge
        run: |
          curl -X POST https://api.spinforge.com/_api/customer/sites/\${{ vars.SITE_DOMAIN }}/upload \\
            -H "Authorization: Bearer \${{ secrets.SPINFORGE_TOKEN }}" \\
            -H "X-Customer-ID: \${{ secrets.SPINFORGE_CUSTOMER_ID }}" \\
            -F "zipfile=@site.zip"`}</code></pre>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 not-prose mb-8">
        <Link href="/docs/frameworks/static" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
            <FileArchive className="h-5 w-5 mr-2" />Framework quick-start
          </h3>
          <p className="text-gray-600 text-sm">Build commands for Vite, CRA, Astro, Next export, and more.</p>
        </Link>
        <Link href="/docs/deployment/custom-domains" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
            Custom domains <ArrowRight className="h-4 w-4 ml-2" />
          </h3>
          <p className="text-gray-600 text-sm">Point your domain at a static site and get HTTPS automatically.</p>
        </Link>
      </div>
    </div>
  );
}
