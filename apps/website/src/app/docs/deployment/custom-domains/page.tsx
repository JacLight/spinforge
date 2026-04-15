/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Globe, AlertCircle, ArrowRight, CheckCircle } from "lucide-react";
import Link from "next/link";

export default function CustomDomainsPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Custom Domains</h1>
      <p className="text-lg text-gray-600 mb-8">
        A site has exactly one primary <code>domain</code> and zero or more <code>aliases</code>.
        Aliases route transparently to the primary. Every hostname gets HTTPS automatically.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Primary domain vs. aliases</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 not-prose mb-8">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center mb-2">
            <Globe className="h-5 w-5 text-indigo-600 mr-2" />
            <h3 className="font-semibold text-gray-900 mb-0">Primary</h3>
          </div>
          <p className="text-sm text-gray-600 mb-0">
            The <code>domain</code> field on the site. Cannot be changed after creation (to change it,
            delete and recreate). It is the canonical name in logs and internal routing.
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center mb-2">
            <Globe className="h-5 w-5 text-indigo-600 mr-2" />
            <h3 className="font-semibold text-gray-900 mb-0">Aliases</h3>
          </div>
          <p className="text-sm text-gray-600 mb-0">
            Any number of additional hostnames on the <code>aliases</code> array. Each resolves to the
            same backend. Useful for <code>www.</code>, legacy names, or bulk bundling.
          </p>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Free subdomains on spinforge.dev</h2>
      <p className="mb-4">
        Any subdomain under <code>spinforge.dev</code> is available with no DNS setup. DNS and SSL are
        fully managed.
      </p>
      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`curl -X POST https://api.spinforge.dev/_api/customer/sites \\
  -H "Authorization: Bearer sfc_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "domain": "myapp.spinforge.dev",
    "type": "static"
  }'`}</code></pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Bringing your own domain</h2>
      <p className="mb-4">
        Point an <code>A</code> record (and optionally <code>AAAA</code>) at our edge IP. Contact
        support or check the admin UI for the current edge address.
      </p>

      <div className="bg-white p-6 rounded-lg border border-gray-200 mb-6 not-prose">
        <h3 className="font-semibold text-gray-900 mb-2">Example DNS</h3>
        <pre className="text-sm bg-gray-50 p-3 rounded overflow-x-auto"><code>{`example.com.         A     <edge-ip>
www.example.com.     A     <edge-ip>`}</code></pre>
      </div>

      <p className="mb-4">Then create the site with both hostnames:</p>
      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`curl -X POST https://api.spinforge.dev/_api/customer/sites \\
  -H "Authorization: Bearer sfc_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "domain": "example.com",
    "type": "static",
    "aliases": ["www.example.com"]
  }'`}</code></pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Updating aliases</h2>
      <p className="mb-4">
        <code>PUT /_api/customer/sites/:domain</code> with a new <code>aliases</code> array
        reconciles — sending the full desired list each time. Aliases in the new list that were not
        present are added; aliases that were present and are no longer in the list are removed.
      </p>
      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`curl -X PUT https://api.spinforge.dev/_api/customer/sites/example.com \\
  -H "Authorization: Bearer sfc_..." \\
  -H "Content-Type: application/json" \\
  -d '{ "aliases": ["www.example.com", "old.example.com"] }'`}</code></pre>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8 not-prose">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-amber-700 mr-2 mt-0.5 flex-shrink-0" />
          <p className="text-amber-800 text-sm mb-0">
            The <code>domain</code> field is locked after creation. To move a site to a different
            primary name, delete it and create a new one with the desired domain.
          </p>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">DNS preflight</h2>
      <p className="mb-4">
        Before issuing a Let&apos;s Encrypt certificate, the edge verifies the hostname resolves to us.
        If DNS has not propagated yet, certificate issuance is skipped and tried again on the next
        request — so a misconfigured domain never burns LE rate-limit slots.
      </p>

      <div className="bg-white p-6 rounded-lg border border-gray-200 not-prose mb-8">
        <h3 className="font-semibold text-gray-900 mb-3">Pre-deploy checklist</h3>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start"><CheckCircle className="h-4 w-4 text-green-600 mr-2 mt-0.5" /><code>dig +short example.com</code> returns our edge IP</li>
          <li className="flex items-start"><CheckCircle className="h-4 w-4 text-green-600 mr-2 mt-0.5" /><code>www</code> subdomain (if used) is listed under aliases</li>
          <li className="flex items-start"><CheckCircle className="h-4 w-4 text-green-600 mr-2 mt-0.5" /> CAA records, if any, allow <code>letsencrypt.org</code></li>
        </ul>
      </div>

      <Link href="/docs/deployment/ssl" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 not-prose inline-block">
        <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
          Next: SSL & HTTPS <ArrowRight className="h-4 w-4 ml-2" />
        </h3>
        <p className="text-sm text-gray-600 mb-0">How automatic Let&apos;s Encrypt works in detail.</p>
      </Link>
    </div>
  );
}
