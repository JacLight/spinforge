/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Shield } from "lucide-react";

export default function CertificatesAPIPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <div className="flex items-center mb-6">
        <Shield className="h-8 w-8 text-green-600 mr-3" />
        <h1 className="text-3xl font-bold text-gray-900 mb-0">SSL Certificates API</h1>
      </div>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Overview</h2>
        <p className="text-gray-600 mb-4">
          Manage SSL/TLS certificates with Let's Encrypt integration for automatic certificate generation and renewal.
        </p>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Get Certificate Information</h2>
        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">GET /api/certificates/:domain</code></h3>
        <p className="text-gray-600 mb-4">Retrieve SSL certificate information for a domain.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`{
  "domain": "example.com",
  "type": "letsencrypt",
  "status": "active",
  "expiresAt": "2025-04-15T00:00:00Z",
  "issuer": "Let's Encrypt",
  "autoRenew": true
}`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Generate Let's Encrypt Certificate</h2>
        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">POST /api/certificates/letsencrypt</code></h3>
        <p className="text-gray-600 mb-4">Generate a new Let's Encrypt SSL certificate for a domain.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Request Body</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`{
  "domain": "example.com",
  "email": "admin@example.com",
  "staging": false
}`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`{
  "message": "Certificate generation started",
  "domain": "example.com",
  "status": "pending"
}`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Upload Manual Certificate</h2>
        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">POST /api/certificates/:domain/manual</code></h3>
        <p className="text-gray-600 mb-4">Upload a manually obtained SSL certificate.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Request Body</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`{
  "certificate": "-----BEGIN CERTIFICATE-----\\n...",
  "privateKey": "-----BEGIN PRIVATE KEY-----\\n...",
  "chain": "-----BEGIN CERTIFICATE-----\\n..."
}`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Renew Certificate</h2>
        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">POST /api/certificates/:domain/renew</code></h3>
        <p className="text-gray-600 mb-4">Manually trigger certificate renewal (Let's Encrypt only).</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`{
  "message": "Certificate renewal started",
  "domain": "example.com",
  "status": "pending"
}`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Delete Certificate</h2>
        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">DELETE /api/certificates/:domain</code></h3>
        <p className="text-gray-600 mb-4">Delete an SSL certificate.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`{
  "message": "Certificate deleted successfully"
}`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Test ACME Challenge</h2>
        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">GET /api/certificates/:domain/test-acme</code></h3>
        <p className="text-gray-600 mb-4">Test if ACME challenge path is properly configured (for Let's Encrypt verification).</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto text-xs"><code>{`{
  "success": true,
  "testUrl": "http://example.com/.well-known/acme-challenge/test-123.txt",
  "message": "Test file created. Visit the URL to verify ACME challenge is working.",
  "note": "The test file will be automatically deleted in 30 seconds."
}`}</code></pre>
        </div>
      </section>
    </div>
  );
}
