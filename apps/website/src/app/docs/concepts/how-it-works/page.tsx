/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Server, Globe, Shield, Zap, Cloud } from "lucide-react";

export default function HowItWorksPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">How SpinForge Works</h1>
      <p className="text-lg text-gray-600 mb-8">
        A mental model for what happens between <code>curl</code> and the browser tab. Three moving
        pieces: OpenResty at the edge, Redis as the routing index, and Nomad as the container scheduler.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">The request lifecycle</h2>
      <p className="mb-4">When a browser hits <code>example.com</code>:</p>

      <ol className="list-decimal list-inside space-y-3 mb-8">
        <li>
          <strong>Edge termination.</strong> OpenResty on our edge accepts the TLS handshake. If a cert
          for this host already exists in Redis, the handshake completes immediately; otherwise
          Let&apos;s Encrypt is triggered inline (after a DNS preflight) and the cert is written back
          to Redis for next time.
        </li>
        <li>
          <strong>Routing lookup.</strong> The edge looks up <code>site:example.com</code> in Redis. If
          there is no primary match, it checks <code>alias:example.com</code> and follows it to the
          primary domain. A miss at both ends returns 404.
        </li>
        <li>
          <strong>Type dispatch.</strong> The site record carries a <code>type</code>. The edge
          branches on it:
          <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
            <li><code>static</code> — serve files directly off disk from the site&apos;s content root.</li>
            <li><code>proxy</code> — reverse-proxy to the configured <code>target</code> URL.</li>
            <li><code>container</code> / <code>node</code> — ask Consul for a healthy allocation of the Nomad job, then proxy to that host:port.</li>
            <li><code>loadbalancer</code> — pick a backend by weighted round-robin over the configured pool.</li>
          </ul>
        </li>
      </ol>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">The three subsystems</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 not-prose mb-8">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center mb-2">
            <Globe className="h-5 w-5 text-indigo-600 mr-2" />
            <h3 className="font-semibold text-gray-900 mb-0">OpenResty edge</h3>
          </div>
          <p className="text-sm text-gray-600 mb-0">
            Nginx + Lua. Terminates TLS, serves static files, proxies everything else. One process
            handles all sites. Configuration is data in Redis, not files on disk.
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center mb-2">
            <Zap className="h-5 w-5 text-indigo-600 mr-2" />
            <h3 className="font-semibold text-gray-900 mb-0">Redis control plane</h3>
          </div>
          <p className="text-sm text-gray-600 mb-0">
            Stores every site record, alias pointer, certificate, and session. Routing is a single
            <code>HGETALL</code>. There is no reload step.
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center mb-2">
            <Server className="h-5 w-5 text-indigo-600 mr-2" />
            <h3 className="font-semibold text-gray-900 mb-0">Nomad scheduler</h3>
          </div>
          <p className="text-sm text-gray-600 mb-0">
            Runs container and node-type workloads across the cluster. Each site with a container
            becomes a Nomad job. Consul tracks allocation health and service discovery.
          </p>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">What the API does</h2>
      <p className="mb-4">
        The public API (<code>api.spinforge.dev</code>) is a thin write-through layer over the control
        plane. When you <code>POST /_api/customer/sites</code> with a container config, the API:
      </p>
      <ol className="list-decimal list-inside space-y-2 mb-8">
        <li>Validates the payload and checks the domain is not taken (409 if it is).</li>
        <li>Writes the site record to Redis.</li>
        <li>Registers aliases (each alias gets its own Redis key pointing to the primary).</li>
        <li>For container/node types, builds a Nomad jobspec and submits it. The returned <code>nomadJobId</code> is stored on the site record.</li>
        <li>Returns the full site document.</li>
      </ol>

      <p className="mb-8">
        Reads hit Redis. Writes go to Redis and, for container workloads, to Nomad. The edge doesn&apos;t
        need to be told anything — it reads Redis on every request.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Certificates</h2>
      <div className="bg-white p-6 rounded-lg border border-gray-200 mb-8 not-prose">
        <div className="flex items-start">
          <Shield className="h-5 w-5 text-indigo-600 mr-2 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-gray-600 mb-2">
              Every site is HTTPS. <code>ssl_enabled</code> is a stored field for consistency but
              customers cannot opt out.
            </p>
            <p className="text-sm text-gray-600 mb-0">
              First HTTPS request for a hostname triggers a DNS preflight — if the domain does not
              resolve to our edge IP, issuance is skipped so we never burn a Let&apos;s Encrypt rate-limit
              slot. Once DNS is correct, the cert issues in ~5 to 10 seconds and is cached thereafter.
              Renewal is automatic.
            </p>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Why pre-built artifacts?</h2>
      <p className="mb-4">
        SpinForge does not build your code. You upload a zip of built assets, or you push an image to
        a registry and point a site at it. This is a deliberate design choice — see{" "}
        <a href="/docs/concepts/pre-built-apps" className="text-indigo-600 underline">Pre-built Apps</a>{" "}
        for the reasoning.
      </p>

      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6 not-prose">
        <div className="flex items-center mb-2">
          <Cloud className="h-5 w-5 text-indigo-700 mr-2" />
          <h3 className="font-semibold text-indigo-900 mb-0">In one sentence</h3>
        </div>
        <p className="text-sm text-indigo-900 mb-0">
          The API writes to Redis (and sometimes Nomad); the edge reads from Redis on every request;
          containers run on Nomad and are discovered via Consul.
        </p>
      </div>
    </div>
  );
}
