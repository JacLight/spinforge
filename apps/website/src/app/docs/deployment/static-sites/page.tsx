/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Terminal, FileArchive, CheckCircle, AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function StaticSitesPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Static Sites</h1>
      <p className="text-lg text-gray-600 mb-8">
        Zip your pre-built site, POST it to the upload endpoint, and it is served from the edge. Works
        for any framework that produces HTML/CSS/JS files.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Create the site</h2>
      <p className="mb-4">
        Send a <code>POST /_api/customer/sites</code> with <code>type: &quot;static&quot;</code>. The
        domain can be any available subdomain of <code>spinforge.dev</code> or a custom domain you
        own. HTTPS is automatic — do not pass <code>ssl_enabled</code>.
      </p>

      <div className="bg-gray-900 rounded-lg p-6 mb-6 not-prose">
        <div className="flex items-center mb-3">
          <Terminal className="h-5 w-5 text-gray-400 mr-2" />
          <span className="text-gray-400 text-sm">Request</span>
        </div>
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`curl -X POST https://api.spinforge.dev/_api/customer/sites \\
  -H "Authorization: Bearer sfc_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "domain": "docs.example.com",
    "type": "static",
    "aliases": ["www.example.com"]
  }'`}</code></pre>
      </div>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <span className="text-gray-400 text-sm">Response 201</span>
        <pre className="text-gray-100 overflow-x-auto text-sm mt-2"><code>{`{
  "domain": "docs.example.com",
  "type": "static",
  "ssl_enabled": true,
  "aliases": ["www.example.com"],
  "customerId": "cus_01H...",
  "createdAt": "2026-04-15T12:00:00.000Z"
}`}</code></pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Prepare the zip</h2>
      <p className="mb-4">
        The zip should contain the files as they are meant to be served at the site root. If your
        build emits <code>./dist/index.html</code>, zip the contents of <code>./dist</code>, not the
        parent directory.
      </p>

      <div className="bg-gray-900 rounded-lg p-6 mb-6 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`cd dist
zip -r ../site.zip .
cd ..`}</code></pre>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8 not-prose">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-amber-700 mr-2 mt-0.5 flex-shrink-0" />
          <p className="text-amber-800 text-sm mb-0">
            Max zip size is <strong>500&nbsp;MB</strong>. The extractor understands standard zip format
            only. An <code>index.html</code> at the archive root is served at the site root.
          </p>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Upload</h2>
      <p className="mb-4">
        <code>POST /_api/customer/sites/:domain/upload</code> with
        <code>Content-Type: multipart/form-data</code> and the zip attached as the
        <code>zipfile</code> field. Each upload replaces the site&apos;s entire content — the previous
        files are wiped before extraction.
      </p>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`curl -X POST https://api.spinforge.dev/_api/customer/sites/docs.example.com/upload \\
  -H "Authorization: Bearer sfc_..." \\
  -F "zipfile=@site.zip"`}</code></pre>
      </div>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <span className="text-gray-400 text-sm">Response 200</span>
        <pre className="text-gray-100 overflow-x-auto text-sm mt-2"><code>{`{
  "success": true,
  "domain": "docs.example.com",
  "files": 142,
  "bytes": 8743201
}`}</code></pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Iterate</h2>
      <p className="mb-4">
        To deploy a new version, just upload a new zip. There is no release management on our side —
        the upload is atomic-ish (wipe + extract), and the edge serves whatever is on disk after the
        call returns.
      </p>

      <div className="bg-white p-6 rounded-lg border border-gray-200 mb-8 not-prose">
        <div className="flex items-center mb-2">
          <FileArchive className="h-5 w-5 text-indigo-600 mr-2" />
          <h3 className="font-semibold text-gray-900 mb-0">SPA routing</h3>
        </div>
        <p className="text-sm text-gray-600 mb-0">
          For single-page apps, include an <code>index.html</code> at the root. Unknown paths fall back
          to it so client-side routing works.
        </p>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Checklist before you ship</h2>
      <div className="bg-white p-6 rounded-lg border border-gray-200 not-prose mb-8">
        <ul className="space-y-2 text-sm">
          <li className="flex items-start"><CheckCircle className="h-4 w-4 text-green-600 mr-2 mt-0.5" /> Zip contents, not the parent folder</li>
          <li className="flex items-start"><CheckCircle className="h-4 w-4 text-green-600 mr-2 mt-0.5" /><code className="mr-1">index.html</code> sits at archive root</li>
          <li className="flex items-start"><CheckCircle className="h-4 w-4 text-green-600 mr-2 mt-0.5" /> Total size under 500&nbsp;MB</li>
          <li className="flex items-start"><CheckCircle className="h-4 w-4 text-green-600 mr-2 mt-0.5" /> Asset URLs use relative or absolute-from-root paths, not <code>file://</code></li>
        </ul>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 not-prose">
        <Link href="/docs/deployment/custom-domains" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
            Custom domains <ArrowRight className="h-4 w-4 ml-2" />
          </h3>
          <p className="text-sm text-gray-600 mb-0">Bring your own domain and aliases.</p>
        </Link>
        <Link href="/docs/api/sites" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
            Sites API reference <ArrowRight className="h-4 w-4 ml-2" />
          </h3>
          <p className="text-sm text-gray-600 mb-0">All endpoints with payloads and responses.</p>
        </Link>
      </div>
    </div>
  );
}
