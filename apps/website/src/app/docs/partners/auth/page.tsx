/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Plug, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function PartnerAuthPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <div className="flex items-center mb-6">
        <Plug className="h-8 w-8 text-indigo-600 mr-3" />
        <h1 className="text-3xl font-bold text-gray-900 mb-0">Auth Exchange</h1>
      </div>

      <p className="text-lg text-gray-600 mb-8">
        One call that verifies your user&apos;s opaque token, creates or updates a SpinForge customer
        for them, optionally upserts a site, and returns a <code>sfc_</code> session scoped to that
        customer.
      </p>

      <hr className="my-8 border-gray-200" />

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Endpoint</h2>
      <p className="mb-2"><code>POST /_partners/auth</code></p>
      <p className="mb-4 text-sm text-gray-600">
        <strong>Auth:</strong> <code>X-Partner-Key: sfpk_...</code>
      </p>

      <h3 className="text-lg font-semibold text-gray-900 mb-2">Request body</h3>
      <div className="bg-gray-900 rounded-lg p-6 mb-6 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`{
  "token": "<opaque token your user presented to you>",
  "projectName": "appbuild",
  "headers":  { "orgid": "demo" },
  "payload":  { },
  "params":   { },
  "site": {
    "type": "static",
    "aliases": ["custom.example.com"]
  }
}`}</code></pre>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-8 not-prose">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3 font-semibold">Field</th>
              <th className="p-3 font-semibold">Required</th>
              <th className="p-3 font-semibold">Purpose</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            <tr><td className="p-3"><code>token</code></td><td className="p-3">yes</td><td className="p-3">Sent to your validation URL as <code>Authorization: Bearer</code></td></tr>
            <tr><td className="p-3"><code>projectName</code></td><td className="p-3">if upserting a site</td><td className="p-3">Used to build the auto-generated domain</td></tr>
            <tr><td className="p-3"><code>headers</code></td><td className="p-3">no</td><td className="p-3">Additional headers forwarded to validation URL</td></tr>
            <tr><td className="p-3"><code>payload</code></td><td className="p-3">no</td><td className="p-3">Body sent to validation URL (for <code>POST</code>)</td></tr>
            <tr><td className="p-3"><code>params</code></td><td className="p-3">no</td><td className="p-3">Fill <code>:paramName</code> placeholders in the stored URL</td></tr>
            <tr><td className="p-3"><code>site</code></td><td className="p-3">no</td><td className="p-3">If present, upsert this site for the customer in the same call</td></tr>
          </tbody>
        </table>
      </div>

      <hr className="my-8 border-gray-200" />

      <h2 className="text-2xl font-bold text-gray-900 mb-4">What SpinForge does</h2>
      <ol className="list-decimal list-inside space-y-3 mb-8">
        <li>
          <strong>Substitutes URL parameters.</strong> Your stored <code>validationUrl</code> can
          contain <code>:paramName</code> placeholders. Values come from top-level scalars in the
          request body <em>and</em> from the <code>params</code> object. Example: stored URL
          <code>https://api.partner.com/verify/:projectName</code> with
          <code>&quot;projectName&quot;: &quot;appbuild&quot;</code> becomes
          <code>https://api.partner.com/verify/appbuild</code>.
        </li>
        <li>
          <strong>Calls your validation URL.</strong> Using the configured method
          (<code>GET</code> or <code>POST</code>), with <code>Authorization: Bearer &lt;token&gt;</code>,
          plus <code>headers</code>, plus (for POST) <code>payload</code> as the body.
        </li>
        <li>
          <strong>Parses your response.</strong> A 2xx means the token is valid and you return an
          identity: <code>{`{ orgId, email?, name? }`}</code>. You can also respond
          <code>{`{ allow: false, reason: "..." }`}</code> to deny with a 2xx.
        </li>
        <li>
          <strong>Falls back to JWT inspection.</strong> If your response does not include
          <code>orgId</code>, SpinForge inspects the original <code>token</code> as a JWT and reads
          the <code>pk</code> claim (shape <code>&quot;orgid|datatype&quot;</code>) to derive it.
        </li>
        <li>
          <strong>Upserts the customer</strong> keyed by
          <code>partner_&lt;partnerId&gt;_&lt;orgId&gt;</code>. Users within the same org share this
          customer.
        </li>
        <li>
          <strong>Upserts the site (if present).</strong> Primary domain is auto-generated as
          <code>&lt;orgId&gt;-&lt;projectName&gt;.spinforge.dev</code>. Aliases in{" "}
          <code>site.aliases</code> are reconciled.
        </li>
        <li>
          <strong>Issues an <code>sfc_</code> session</strong> valid for the configured TTL (default
          1 hour).
        </li>
      </ol>

      <hr className="my-8 border-gray-200" />

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Response</h2>
      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <span className="text-gray-400 text-sm">200</span>
        <pre className="text-gray-100 overflow-x-auto text-sm mt-2"><code>{`{
  "success": true,
  "token": "sfc_01HABC...",
  "customerId": "cus_01H...",
  "expiresAt": "2026-04-15T13:00:00Z",
  "site": {
    "domain": "demo-appbuild.spinforge.dev",
    "type": "static",
    "aliases": ["custom.example.com"],
    "ssl_enabled": true,
    "createdAt": "2026-04-15T12:00:00Z"
  }
}`}</code></pre>
      </div>

      <p className="mb-8 text-sm text-gray-600">
        Cache the <code>token</code> on your side until <code>expiresAt</code> and use it as
        <code>Authorization: Bearer sfc_...</code> for all <code>/_api/customer/*</code> calls.
      </p>

      <hr className="my-8 border-gray-200" />

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Errors</h2>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-8 not-prose">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr><th className="p-3 font-semibold">Status</th><th className="p-3 font-semibold">Cause</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            <tr>
              <td className="p-3">400</td>
              <td className="p-3">
                Missing URL params. Response includes <code>missingParams</code> array listing the
                placeholder names that could not be filled.
              </td>
            </tr>
            <tr><td className="p-3">401</td><td className="p-3">Invalid or missing <code>sfpk_</code> key</td></tr>
            <tr>
              <td className="p-3">403</td>
              <td className="p-3">
                Your validation URL denied. Response includes <code>partnerStatus</code> and
                <code>partnerBody</code> so you can see exactly what your endpoint returned.
              </td>
            </tr>
            <tr><td className="p-3">502</td><td className="p-3">Your validation URL was unreachable or timed out</td></tr>
          </tbody>
        </table>
      </div>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <span className="text-gray-400 text-sm">Example 400</span>
        <pre className="text-gray-100 overflow-x-auto text-sm mt-2"><code>{`{
  "error": "Missing required URL params",
  "missingParams": ["projectName"]
}`}</code></pre>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8 not-prose">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-amber-700 mr-2 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-800 mb-0">
            Your <code>validationMethod</code> is <code>GET</code> or <code>POST</code> only. SpinForge
            never issues <code>PUT</code> or <code>PATCH</code> to a partner validation URL.
          </p>
        </div>
      </div>

      <hr className="my-8 border-gray-200" />

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Full curl example</h2>
      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`curl -X POST https://api.spinforge.dev/_partners/auth \\
  -H "X-Partner-Key: sfpk_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "token": "eyJhbGciOi...your-users-token",
    "projectName": "appbuild",
    "headers": { "orgid": "demo" },
    "site": {
      "type": "static",
      "aliases": ["demo.custom.com"]
    }
  }'`}</code></pre>
      </div>

      <Link href="/docs/partners" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 not-prose inline-block">
        <h3 className="font-semibold text-gray-900 mb-2">Back to Partner overview</h3>
        <p className="text-sm text-gray-600 mb-0">Architecture and registration flow.</p>
      </Link>
    </div>
  );
}
