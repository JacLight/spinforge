/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Terminal, CheckCircle, ArrowRight, Upload } from "lucide-react";
import Link from "next/link";

export default function QuickStartPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Quick Start</h1>
      <p className="text-lg text-gray-600 mb-8">
        Deploy a static site to SpinForge in under five minutes. No CLI. No build step on our side.
        Zip your pre-built files, POST the zip, open the URL.
      </p>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8 not-prose">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">Prerequisites</h3>
        <ul className="space-y-2 text-blue-800">
          <li className="flex items-start">
            <CheckCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            <span>A SpinForge customer account (sign up at <Link href="/signup" className="underline">spinforge.dev/signup</Link>)</span>
          </li>
          <li className="flex items-start">
            <CheckCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            <span>A pre-built static site in a folder (e.g. <code>./dist</code>)</span>
          </li>
          <li className="flex items-start">
            <CheckCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            <span><code>curl</code> and <code>zip</code> installed locally</span>
          </li>
        </ul>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Step 1: Get a customer API token</h2>

      <p className="mb-4">
        Log in at <a href="https://admin.spinforge.dev" className="text-indigo-600 underline">admin.spinforge.dev</a>,
        open the <strong>API Tokens</strong> tab, and mint a new token. The plaintext value (prefixed{" "}
        <code>sfc_</code>) is shown once. Copy it.
      </p>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <div className="flex items-center mb-4">
          <Terminal className="h-5 w-5 text-gray-400 mr-2" />
          <span className="text-gray-400 text-sm">Terminal</span>
        </div>
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`export SF_TOKEN="sfc_your_token_here"`}</code></pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Step 2: Create the site</h2>

      <p className="mb-4">
        Pick a subdomain under <code>spinforge.dev</code> (it is always available — we manage DNS and
        SSL for you) or specify a custom domain you own. HTTPS is automatic.
      </p>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`curl -X POST https://api.spinforge.dev/_api/customer/sites \\
  -H "Authorization: Bearer $SF_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "domain": "hello-world.spinforge.dev",
    "type": "static"
  }'`}</code></pre>
      </div>

      <p className="mb-4">Response:</p>
      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`{
  "domain": "hello-world.spinforge.dev",
  "type": "static",
  "ssl_enabled": true,
  "customerId": "cus_01H...",
  "aliases": [],
  "createdAt": "2026-04-15T12:00:00.000Z"
}`}</code></pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Step 3: Zip your build output</h2>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`cd ./dist
zip -r ../site.zip .
cd ..`}</code></pre>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-8 not-prose">
        <div className="flex items-start">
          <Upload className="h-5 w-5 text-amber-700 mr-2 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-amber-900 mb-1">Pre-built artifacts only</h4>
            <p className="text-amber-800 text-sm mb-0">
              SpinForge does not run <code>npm install</code> or your build command. Ship the finished
              files. Max upload is 500&nbsp;MB per call.
            </p>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Step 4: Upload the zip</h2>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`curl -X POST https://api.spinforge.dev/_api/customer/sites/hello-world.spinforge.dev/upload \\
  -H "Authorization: Bearer $SF_TOKEN" \\
  -F "zipfile=@site.zip"`}</code></pre>
      </div>

      <p className="mb-4">
        The previous contents (if any) are wiped and replaced. The zip is extracted into the site&apos;s
        content root and served from the edge immediately.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Step 5: Open it</h2>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`open https://hello-world.spinforge.dev`}</code></pre>
      </div>

      <p className="mb-8">
        Let&apos;s Encrypt issues the cert on the first HTTPS hit (typically 5 to 10 seconds). After
        that it is cached and renewed automatically.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">What&apos;s next?</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 not-prose mb-8">
        <Link href="/docs/deployment/containers" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
            Deploy a container
            <ArrowRight className="h-4 w-4 ml-2" />
          </h3>
          <p className="text-gray-600 text-sm">Run a Docker image instead of serving static files.</p>
        </Link>

        <Link href="/docs/deployment/custom-domains" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
            Custom domains
            <ArrowRight className="h-4 w-4 ml-2" />
          </h3>
          <p className="text-gray-600 text-sm">Point your own domain at the site with automatic HTTPS.</p>
        </Link>

        <Link href="/docs/deployment/env-vars" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
            Environment variables
            <ArrowRight className="h-4 w-4 ml-2" />
          </h3>
          <p className="text-gray-600 text-sm">Configure container runtime env through the API.</p>
        </Link>

        <Link href="/docs/api/sites" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
            Full Sites API
            <ArrowRight className="h-4 w-4 ml-2" />
          </h3>
          <p className="text-gray-600 text-sm">Every endpoint for creating, updating, and managing sites.</p>
        </Link>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-6 not-prose">
        <h3 className="text-lg font-semibold text-green-900 mb-2">Something went wrong?</h3>
        <p className="text-green-800 mb-0 text-sm">
          See <Link href="/docs/troubleshooting" className="underline">Troubleshooting</Link> for common
          502, 503, and 404 causes.
        </p>
      </div>
    </div>
  );
}
