/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Shield, AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function SSLGuidePage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">SSL &amp; HTTPS</h1>
      <p className="text-lg text-gray-600 mb-8">
        SpinForge provisions and renews Let&apos;s Encrypt certificates automatically for every custom domain.
        This page explains how it works, how to bring your own certificate, and how to debug when something goes
        wrong.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Automatic certificates</h2>
      <p className="mb-4">
        The moment a domain points at SpinForge and resolves correctly, a certificate is requested. SpinForge
        uses the <strong>HTTP-01</strong> challenge: it serves a challenge token from the domain, Let&apos;s
        Encrypt fetches it, and if they match, a certificate is issued.
      </p>

      <div className="bg-gray-50 rounded-lg p-6 mb-8 not-prose">
        <h4 className="font-semibold text-gray-900 mb-3">The full lifecycle</h4>
        <ol className="space-y-2 text-sm text-gray-600 list-decimal list-inside">
          <li>You add a custom domain</li>
          <li>SpinForge waits until DNS resolves to an edge IP</li>
          <li>A challenge is placed at <code className="bg-gray-200 px-1 rounded">/.well-known/acme-challenge/...</code></li>
          <li>Let&apos;s Encrypt fetches the challenge and issues a cert</li>
          <li>SpinForge installs the cert at the edge</li>
          <li>30 days before expiry, the cert is renewed automatically</li>
        </ol>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Wildcard certificates</h2>
      <p className="mb-4">
        Wildcard certs (e.g. <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">*.example.com</code>)
        require a DNS-01 challenge, which means SpinForge needs API access to your DNS provider. Configure this
        from <Link href="/dashboard/settings" className="text-indigo-600 hover:underline">Dashboard → Settings → DNS Providers</Link>.
        Currently supported: Cloudflare, Route 53, DigitalOcean, Linode.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Bringing your own certificate</h2>
      <p className="mb-4">
        If you have an EV certificate or a cert from an internal CA, you can upload it instead of relying on
        Let&apos;s Encrypt:
      </p>
      <ol className="list-decimal list-inside mb-8 space-y-2 text-gray-700">
        <li>Open <Link href="/dashboard/applications" className="text-indigo-600 hover:underline">Dashboard → Applications</Link> → your site → <strong>SSL</strong></li>
        <li>Choose <strong>Custom certificate</strong></li>
        <li>Paste the full chain in PEM format and the private key</li>
        <li>Click <strong>Install</strong></li>
      </ol>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-8 not-prose">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-amber-900 mb-1">Renewals are your responsibility</h4>
            <p className="text-amber-800 text-sm">
              Custom certificates are not renewed automatically. SpinForge emails the account owner 30 days
              before expiry. If you miss the renewal, traffic will fail with TLS errors until you upload a new
              cert.
            </p>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">HTTP to HTTPS redirect</h2>
      <p className="mb-8">
        Every site with SSL enabled gets an automatic 308 redirect from HTTP to HTTPS. HSTS is sent with{" "}
        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">max-age=31536000</code>. If you need to
        disable the redirect (for ACME clients or legacy integrations), toggle it off in the site&apos;s SSL
        settings.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Debugging SSL issues</h2>

      <div className="space-y-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">Symptom: &quot;Unable to issue certificate&quot;</h4>
          <p className="text-sm text-gray-600 mb-2">Most common cause: DNS does not yet resolve to SpinForge.</p>
          <pre className="bg-gray-900 text-gray-100 text-xs p-3 rounded overflow-x-auto"><code>dig +short your-domain.com</code></pre>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">Symptom: Let&apos;s Encrypt rate limit hit</h4>
          <p className="text-sm text-gray-600">
            LE limits issuance to 50 certs per registered domain per week. If you are iterating, request test
            certificates from the staging environment by enabling{" "}
            <em>Use Let&apos;s Encrypt staging</em> in the site&apos;s SSL settings. Staging certs are not
            trusted by browsers but count against a much looser limit.
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">Symptom: Mixed content warnings</h4>
          <p className="text-sm text-gray-600">
            Your HTML is served over HTTPS but references assets over plain HTTP. Update your build to use
            protocol-relative or HTTPS URLs.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 not-prose mb-8">
        <Link href="/docs/deployment/custom-domains" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
            <Shield className="h-5 w-5 mr-2" /> Custom domains
          </h3>
          <p className="text-gray-600 text-sm">DNS records, aliases, and verification.</p>
        </Link>
        <Link href="/docs/api/certificates" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
            Certificates API <ArrowRight className="h-4 w-4 ml-2" />
          </h3>
          <p className="text-gray-600 text-sm">Manage certs programmatically.</p>
        </Link>
      </div>
    </div>
  );
}
