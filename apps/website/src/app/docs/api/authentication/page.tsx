/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Shield, Lock, Key, UserPlus } from "lucide-react";

export default function AuthenticationAPIPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <div className="flex items-center mb-6">
        <Shield className="h-8 w-8 text-indigo-600 mr-3" />
        <h1 className="text-3xl font-bold text-gray-900 mb-0">Authentication</h1>
      </div>

      <p className="text-lg text-gray-600 mb-8">
        SpinForge has three token types in parallel. Pick the one that matches what you are doing.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Token types</h2>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-8 not-prose">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3 font-semibold">Prefix</th>
              <th className="p-3 font-semibold">Header</th>
              <th className="p-3 font-semibold">Scope</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            <tr>
              <td className="p-3"><code>JWT</code></td>
              <td className="p-3"><code>Authorization: Bearer &lt;jwt&gt;</code></td>
              <td className="p-3">Admin UI session</td>
            </tr>
            <tr>
              <td className="p-3"><code>sfa_</code></td>
              <td className="p-3"><code>X-API-Key: sfa_...</code></td>
              <td className="p-3">Admin machine access</td>
            </tr>
            <tr>
              <td className="p-3"><code>sfc_</code></td>
              <td className="p-3"><code>Authorization: Bearer sfc_...</code></td>
              <td className="p-3">Customer site operations</td>
            </tr>
            <tr>
              <td className="p-3"><code>sfpk_</code></td>
              <td className="p-3"><code>X-Partner-Key: sfpk_...</code></td>
              <td className="p-3">Partner auth exchange</td>
            </tr>
          </tbody>
        </table>
      </div>

      <hr className="my-8 border-gray-200" />

      <h2 className="text-2xl font-bold text-gray-900 mb-4" id="admin-login">
        <Lock className="inline h-5 w-5 mr-2" />
        Admin login
      </h2>
      <p className="mb-2"><code>POST /_admin/login</code></p>
      <p className="mb-4 text-sm text-gray-600">Exchanges username/password for a JWT.</p>
      <div className="bg-gray-900 rounded-lg p-6 mb-4 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`curl -X POST https://api.spinforge.dev/_admin/login \\
  -H "Content-Type: application/json" \\
  -d '{ "username": "admin", "password": "..." }'`}</code></pre>
      </div>
      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <span className="text-gray-400 text-sm">Response 200</span>
        <pre className="text-gray-100 overflow-x-auto text-sm mt-2"><code>{`{
  "token": "eyJhbGciOi...",
  "admin": { "id": "adm_...", "username": "admin", "email": "ops@company.com" }
}`}</code></pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4" id="setup">
        <UserPlus className="inline h-5 w-5 mr-2" />
        First-run setup
      </h2>
      <p className="mb-4 text-sm text-gray-600">
        On first boot, the API auto-generates <code>/data/admin/secret.key</code> (the JWT signing
        key) and writes a one-time setup token to <code>/data/admin/first-run-token.txt</code>. The
        operator uses it to create the first admin. No admin credentials live in env files.
      </p>
      <p className="mb-2"><code>GET /_admin/setup/status</code></p>
      <div className="bg-gray-900 rounded-lg p-6 mb-4 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`{ "setupRequired": true }`}</code></pre>
      </div>
      <p className="mb-2"><code>POST /_admin/setup</code></p>
      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`curl -X POST https://api.spinforge.dev/_admin/setup \\
  -H "Content-Type: application/json" \\
  -d '{
    "setupToken": "<first-run-token.txt contents>",
    "username": "admin",
    "password": "a-long-password",
    "email": "ops@company.com"
  }'`}</code></pre>
      </div>

      <hr className="my-8 border-gray-200" />

      <h2 className="text-2xl font-bold text-gray-900 mb-4" id="admin-api-keys">
        <Key className="inline h-5 w-5 mr-2" />
        Admin API keys (sfa_)
      </h2>
      <p className="mb-4 text-sm text-gray-600">
        Machine access for operators. Minted from the admin UI&apos;s Tokens tab, which calls
        <code>POST /_admin/tokens</code>. Plaintext is returned once — store it.
      </p>
      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`curl https://api.spinforge.dev/_admin/audit \\
  -H "X-API-Key: sfa_..."`}</code></pre>
      </div>

      <hr className="my-8 border-gray-200" />

      <h2 className="text-2xl font-bold text-gray-900 mb-4" id="customer-tokens">
        <Key className="inline h-5 w-5 mr-2" />
        Customer tokens (sfc_)
      </h2>
      <p className="mb-4 text-sm text-gray-600">
        Required for every <code>/_api/customer/*</code> call. Created from the customer admin UI or
        via the tokens endpoint below. Shown in plaintext only on creation.
      </p>

      <h3 className="text-xl font-semibold text-gray-900 mb-3">List tokens</h3>
      <p className="mb-2"><code>GET /_api/customer/tokens</code></p>
      <div className="bg-gray-900 rounded-lg p-6 mb-6 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`[
  { "id": "tok_01H...", "name": "CI", "expiresAt": "2026-07-01T00:00:00Z", "createdAt": "2026-04-01T..." }
]`}</code></pre>
      </div>

      <h3 className="text-xl font-semibold text-gray-900 mb-3">Create token</h3>
      <p className="mb-2"><code>POST /_api/customer/tokens</code></p>
      <div className="bg-gray-900 rounded-lg p-6 mb-4 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`curl -X POST https://api.spinforge.dev/_api/customer/tokens \\
  -H "Authorization: Bearer sfc_..." \\
  -H "Content-Type: application/json" \\
  -d '{ "name": "CI", "expiry": "2026-07-01T00:00:00Z" }'`}</code></pre>
      </div>
      <div className="bg-gray-900 rounded-lg p-6 mb-6 not-prose">
        <span className="text-gray-400 text-sm">Response 201</span>
        <pre className="text-gray-100 overflow-x-auto text-sm mt-2"><code>{`{
  "id": "tok_01H...",
  "name": "CI",
  "token": "sfc_01HABC...shown_once",
  "expiresAt": "2026-07-01T00:00:00Z",
  "createdAt": "2026-04-15T12:00:00Z"
}`}</code></pre>
      </div>

      <h3 className="text-xl font-semibold text-gray-900 mb-3">Revoke token</h3>
      <p className="mb-2"><code>DELETE /_api/customer/tokens/:id</code></p>
      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`curl -X DELETE https://api.spinforge.dev/_api/customer/tokens/tok_01H... \\
  -H "Authorization: Bearer sfc_..."`}</code></pre>
      </div>

      <hr className="my-8 border-gray-200" />

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Common errors</h2>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden not-prose mb-8">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr><th className="p-3 font-semibold">Status</th><th className="p-3 font-semibold">Meaning</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            <tr><td className="p-3">401</td><td className="p-3">Missing or invalid token</td></tr>
            <tr><td className="p-3">403</td><td className="p-3">Token is valid but not authorized for this resource</td></tr>
            <tr><td className="p-3">404</td><td className="p-3">Token ID not found (on revoke)</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
