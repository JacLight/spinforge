/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Shield, AlertCircle, ArrowRight, CheckCircle } from "lucide-react";
import Link from "next/link";

export default function SSLPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">SSL & HTTPS</h1>
      <p className="text-lg text-gray-600 mb-8">
        Every site on SpinForge is HTTPS. Let&apos;s Encrypt issues the certificate the first time
        someone hits your hostname over TLS. You don&apos;t configure it, you don&apos;t renew it, you
        don&apos;t opt out.
      </p>

      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6 mb-8 not-prose">
        <div className="flex items-start">
          <Shield className="h-5 w-5 text-indigo-700 mr-2 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-indigo-900 mb-1">No opt-out</h3>
            <p className="text-indigo-900 text-sm mb-0">
              <code>ssl_enabled</code> appears on the site record but is always <code>true</code>. The
              API ignores attempts to set it to <code>false</code>.
            </p>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">How issuance works</h2>
      <ol className="list-decimal list-inside space-y-3 mb-8">
        <li>A browser or client sends the first <code>https://</code> request for a hostname.</li>
        <li>The edge checks Redis for a cached certificate — if it exists, TLS completes and the request is served normally.</li>
        <li>If no cert is cached, the edge runs a DNS preflight. Does <code>example.com</code> resolve to our edge IP? If not, issuance is aborted. (This is what keeps a misconfigured domain from burning through ACME rate limits.)</li>
        <li>On preflight success, an HTTP-01 challenge is issued to Let&apos;s Encrypt. This usually completes in 5 to 10 seconds. The cert is written to Redis.</li>
        <li>Subsequent TLS handshakes are immediate.</li>
      </ol>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Renewals</h2>
      <p className="mb-8">
        Certificates auto-renew in the background well before their 90-day expiry. No action required.
        If a renewal fails (for example, DNS changed in a way that breaks the challenge), the old cert
        remains valid until it expires, and renewal is retried periodically.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Subdomains on spinforge.dev</h2>
      <p className="mb-4">
        Any <code>*.spinforge.dev</code> hostname already resolves to our edge. SSL is instant — no DNS
        delay, no preflight surprises.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Custom domains</h2>
      <p className="mb-4">Before your first HTTPS request:</p>
      <div className="bg-white p-6 rounded-lg border border-gray-200 not-prose mb-8">
        <ul className="space-y-2 text-sm">
          <li className="flex items-start"><CheckCircle className="h-4 w-4 text-green-600 mr-2 mt-0.5" /><code>A</code> record (and <code>AAAA</code>, if you have IPv6) points at our edge IP</li>
          <li className="flex items-start"><CheckCircle className="h-4 w-4 text-green-600 mr-2 mt-0.5" /> DNS has propagated (confirm with <code>dig +short yourdomain.com</code>)</li>
          <li className="flex items-start"><CheckCircle className="h-4 w-4 text-green-600 mr-2 mt-0.5" /><code>CAA</code> records, if set, allow <code>letsencrypt.org</code></li>
          <li className="flex items-start"><CheckCircle className="h-4 w-4 text-green-600 mr-2 mt-0.5" /> The hostname is the site&apos;s <code>domain</code> or one of its <code>aliases</code></li>
        </ul>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">HTTP to HTTPS</h2>
      <p className="mb-8">
        Requests on port 80 are redirected to the <code>https://</code> equivalent at the edge. You
        cannot disable the redirect. If you proxy to an upstream that sends mixed-content responses,
        that is a backend concern — the edge always presents HTTPS to the browser.
      </p>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8 not-prose">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-amber-700 mr-2 mt-0.5 flex-shrink-0" />
          <div className="text-amber-800 text-sm">
            <p className="mb-1"><strong>Seeing a certificate error?</strong></p>
            <p className="mb-0">
              Usually DNS hasn&apos;t propagated or points at a different IP. <code>dig</code> your
              domain, confirm the A record, then retry. See{" "}
              <Link href="/docs/troubleshooting" className="underline">Troubleshooting</Link>.
            </p>
          </div>
        </div>
      </div>

      <Link href="/docs/deployment/custom-domains" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 not-prose inline-block">
        <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
          Custom domain setup <ArrowRight className="h-4 w-4 ml-2" />
        </h3>
        <p className="text-sm text-gray-600 mb-0">DNS records and alias configuration.</p>
      </Link>
    </div>
  );
}
