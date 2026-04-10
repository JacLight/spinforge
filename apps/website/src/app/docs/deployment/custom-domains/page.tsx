/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Globe, AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function CustomDomainsGuidePage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Custom Domains</h1>
      <p className="text-lg text-gray-600 mb-8">
        Every SpinForge site runs on a domain you choose. This guide walks through connecting your own domain,
        adding aliases, and verifying DNS.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Point your DNS at SpinForge</h2>
      <p className="mb-4">
        Log in to your DNS provider (Cloudflare, Route 53, Namecheap, etc.) and add a record for your domain:
      </p>

      <div className="overflow-x-auto mb-8 not-prose">
        <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-gray-700">Record type</th>
              <th className="text-left px-4 py-2 font-semibold text-gray-700">Name</th>
              <th className="text-left px-4 py-2 font-semibold text-gray-700">Value</th>
              <th className="text-left px-4 py-2 font-semibold text-gray-700">When to use</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            <tr>
              <td className="px-4 py-2 font-mono text-xs">CNAME</td>
              <td className="px-4 py-2 font-mono text-xs">app</td>
              <td className="px-4 py-2 font-mono text-xs">edge.spinforge.com</td>
              <td className="px-4 py-2 text-gray-600">Subdomains (app.example.com)</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">A</td>
              <td className="px-4 py-2 font-mono text-xs">@</td>
              <td className="px-4 py-2 font-mono text-xs">203.0.113.10</td>
              <td className="px-4 py-2 text-gray-600">Root domain (example.com)</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">AAAA</td>
              <td className="px-4 py-2 font-mono text-xs">@</td>
              <td className="px-4 py-2 font-mono text-xs">2001:db8::10</td>
              <td className="px-4 py-2 text-gray-600">IPv6 for root domain (optional)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-8 not-prose">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-amber-900 mb-1">Your actual edge IPs may differ</h4>
            <p className="text-amber-800 text-sm">
              The exact IPs and CNAME target for your account are shown in{" "}
              <Link href="/dashboard/domains" className="underline">Dashboard → Domains</Link>. Do not use the
              example values above in production — copy them from the dashboard.
            </p>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Add the domain in SpinForge</h2>
      <ol className="list-decimal list-inside mb-8 space-y-2 text-gray-700">
        <li>Open the site from <Link href="/dashboard/applications" className="text-indigo-600 hover:underline">Dashboard → Applications</Link></li>
        <li>Click <strong>Domains</strong></li>
        <li>Enter your domain and click <strong>Add</strong></li>
        <li>SpinForge will check DNS resolution and mark the domain as <em>pending</em> until it resolves</li>
      </ol>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Wait for SSL</h2>
      <p className="mb-4">
        Once DNS resolves to SpinForge, a Let&apos;s Encrypt certificate is requested automatically. This usually
        completes in under a minute. The domain will flip from <em>pending</em> to <em>active</em> when the
        certificate is installed.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Aliases (multiple domains on one site)</h2>
      <p className="mb-4">
        A site can respond to multiple domains. Add aliases from the deploy form or from the site&apos;s settings
        later. Typical use cases:
      </p>
      <ul className="list-disc list-inside mb-8 space-y-1 text-gray-700">
        <li>Serving both <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">example.com</code> and <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">www.example.com</code></li>
        <li>Serving a rebranding domain alongside the old one</li>
        <li>Regional domains (<code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">.co.uk</code>, <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">.de</code>, etc.) backed by the same app</li>
      </ul>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Redirect www to apex (or vice-versa)</h2>
      <p className="mb-4">
        SpinForge does not redirect between aliases automatically — all aliases are treated as equal. If you want
        one to be canonical, handle the redirect in your app or use a lightweight{" "}
        <strong>Reverse Proxy</strong> site that 301s to the canonical host.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Troubleshooting DNS</h2>
      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto"><code className="language-bash">{`# Check what your domain currently resolves to
dig +short app.example.com
dig +short app.example.com AAAA

# Check from a specific resolver (avoids cached results)
dig @1.1.1.1 app.example.com

# Check the certificate chain once it is live
curl -vI https://app.example.com 2>&1 | grep -i "ssl\\|issuer"`}</code></pre>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 not-prose mb-8">
        <Link href="/docs/deployment/ssl" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
            <Globe className="h-5 w-5 mr-2" /> SSL / HTTPS
          </h3>
          <p className="text-gray-600 text-sm">How Let&apos;s Encrypt certs are provisioned and renewed.</p>
        </Link>
        <Link href="/docs/troubleshooting" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
            Troubleshooting <ArrowRight className="h-4 w-4 ml-2" />
          </h3>
          <p className="text-gray-600 text-sm">DNS, SSL, and domain verification errors.</p>
        </Link>
      </div>
    </div>
  );
}
