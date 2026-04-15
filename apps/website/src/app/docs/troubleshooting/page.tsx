/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { LifeBuoy, AlertCircle, Terminal, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function TroubleshootingPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Troubleshooting</h1>
      <p className="text-lg text-gray-600 mb-8">
        Most problems fall into one of a handful of patterns. Match the symptom, follow the fix.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">404 Not Found</h2>
      <div className="bg-white p-6 rounded-lg border border-gray-200 mb-6 not-prose">
        <h3 className="font-semibold text-gray-900 mb-2">Cause: No site matches the hostname</h3>
        <p className="text-sm text-gray-600 mb-3">
          The edge looked up the hostname as both a primary <code>domain</code> and as an alias and
          found nothing.
        </p>
        <p className="text-sm text-gray-600 mb-0"><strong>Fix:</strong></p>
        <ul className="text-sm text-gray-600 list-disc list-inside mt-1">
          <li>Confirm the site exists: <code>GET /_api/customer/sites</code></li>
          <li>Check the Host header matches exactly — <code>www.example.com</code> and <code>example.com</code> are different sites unless one is an alias of the other</li>
          <li>If the hostname is an alias, verify it is on the primary site&apos;s <code>aliases</code> array</li>
        </ul>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200 mb-8 not-prose">
        <h3 className="font-semibold text-gray-900 mb-2">Cause: Static site missing index.html</h3>
        <p className="text-sm text-gray-600 mb-0">
          The site exists but the path requested does not. For SPAs, ensure <code>index.html</code>{" "}
          is at the zip root. Re-upload if the path layout inside the zip was wrong.
        </p>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">502 Bad Gateway</h2>
      <div className="bg-white p-6 rounded-lg border border-gray-200 mb-6 not-prose">
        <h3 className="font-semibold text-gray-900 mb-2">Cause: Container not listening on the configured port</h3>
        <p className="text-sm text-gray-600 mb-2">
          The allocation is running but nothing is bound to <code>containerConfig.port</code> on{" "}
          <code>0.0.0.0</code>.
        </p>
        <ul className="text-sm text-gray-600 list-disc list-inside">
          <li>Check your app binds to <code>0.0.0.0</code>, not <code>127.0.0.1</code></li>
          <li>Confirm the port in <code>containerConfig.port</code> matches what your app actually listens on</li>
          <li>Tail logs: <code>GET /_api/customer/sites/:domain/logs</code></li>
        </ul>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200 mb-6 not-prose">
        <h3 className="font-semibold text-gray-900 mb-2">Cause: Proxy target unreachable</h3>
        <p className="text-sm text-gray-600 mb-0">
          For <code>type: &quot;proxy&quot;</code> or <code>loadbalancer</code> sites, the upstream
          <code>target</code>/<code>url</code> returned a connection error. Verify the URL is publicly
          reachable and accepts the inbound IP.
        </p>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200 mb-8 not-prose">
        <h3 className="font-semibold text-gray-900 mb-2">Cause: Container crashed repeatedly</h3>
        <p className="text-sm text-gray-600 mb-0">
          Nomad will keep restarting according to <code>restartPolicy</code>, but if every allocation
          crashes on boot, traffic has no healthy target. Check logs and the readiness endpoint.
        </p>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">503 Service Unavailable</h2>
      <div className="bg-white p-6 rounded-lg border border-gray-200 mb-8 not-prose">
        <h3 className="font-semibold text-gray-900 mb-2">Cause: Container still starting</h3>
        <p className="text-sm text-gray-600 mb-2">
          The job was submitted but no allocation is passing health checks yet. This is normal for
          the first 5 to 30 seconds after a deploy, depending on image size and startup time.
        </p>
        <div className="bg-gray-900 rounded p-3 not-prose mt-2">
          <pre className="text-gray-100 text-xs overflow-x-auto"><code>{`curl https://api.spinforge.dev/_api/customer/sites/api.example.com/readiness \\
  -H "Authorization: Bearer sfc_..."`}</code></pre>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Certificate error / not trusted</h2>
      <div className="bg-white p-6 rounded-lg border border-gray-200 mb-6 not-prose">
        <h3 className="font-semibold text-gray-900 mb-2">Cause: DNS has not propagated</h3>
        <p className="text-sm text-gray-600 mb-2">
          Certificate issuance is skipped until the hostname resolves to our edge. Confirm:
        </p>
        <div className="bg-gray-900 rounded p-3 mt-2">
          <pre className="text-gray-100 text-xs overflow-x-auto"><code>{`dig +short example.com
# should return our edge IP`}</code></pre>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200 mb-8 not-prose">
        <h3 className="font-semibold text-gray-900 mb-2">Cause: CAA records block Let&apos;s Encrypt</h3>
        <p className="text-sm text-gray-600 mb-0">
          If the zone has a <code>CAA</code> record, it must include <code>letsencrypt.org</code>.
          Check with <code>dig CAA example.com</code>.
        </p>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Upload fails</h2>
      <div className="bg-white p-6 rounded-lg border border-gray-200 mb-8 not-prose">
        <ul className="text-sm text-gray-600 list-disc list-inside space-y-1 mb-0">
          <li><strong>413:</strong> zip exceeds the 500 MB cap</li>
          <li><strong>400:</strong> not a valid zip, or the <code>zipfile</code> multipart field is missing</li>
          <li><strong>401:</strong> token missing or wrong kind — upload requires a customer <code>sfc_</code> token</li>
          <li><strong>404:</strong> the site domain does not exist — create it before uploading</li>
        </ul>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">409 Conflict on site create</h2>
      <p className="mb-8 text-sm text-gray-600">
        The domain is already registered. Either choose a different hostname or
        <code>DELETE</code> the existing site first.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">401/403 on authenticated endpoints</h2>
      <div className="bg-white p-6 rounded-lg border border-gray-200 mb-8 not-prose">
        <ul className="text-sm text-gray-600 list-disc list-inside space-y-1 mb-0">
          <li>Make sure you are using the right token type. Customer endpoints (<code>/_api/customer/*</code>) need an <code>sfc_</code> token; admin endpoints need a JWT or <code>sfa_</code> key</li>
          <li>Tokens are shown in plaintext only once. If you lost it, mint a new one</li>
          <li>Tokens have expiry. Check the list endpoint to see when yours expires</li>
        </ul>
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6 not-prose">
        <div className="flex items-start">
          <LifeBuoy className="h-5 w-5 text-indigo-700 mr-2 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-indigo-900 mb-1">Still stuck?</h3>
            <p className="text-sm text-indigo-900 mb-0">
              Check the <Link href="/docs/troubleshooting/faq" className="underline">FAQ</Link> or
              grab readiness + recent logs for a support ticket.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
