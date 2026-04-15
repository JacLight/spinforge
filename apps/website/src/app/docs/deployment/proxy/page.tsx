/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Globe, Server, ArrowRight, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function ProxyPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Proxy & Load Balancer</h1>
      <p className="text-lg text-gray-600 mb-8">
        Use a <strong>proxy</strong> site to reverse-proxy to an external URL. Use a{" "}
        <strong>loadbalancer</strong> site to spread traffic across a weighted pool of backends. Both
        give you HTTPS at the edge with no infrastructure on your side.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Proxy: single target</h2>
      <p className="mb-4">
        A proxy site forwards every request to a single upstream URL. The edge terminates TLS,
        preserves the <code>Host</code>, <code>X-Forwarded-For</code>, and <code>X-Forwarded-Proto</code>{" "}
        headers, and streams the response back.
      </p>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`curl -X POST https://api.spinforge.dev/_api/customer/sites \\
  -H "Authorization: Bearer sfc_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "domain": "app.example.com",
    "type": "proxy",
    "target": "https://my-origin.internal.mycompany.com"
  }'`}</code></pre>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200 mb-8 not-prose">
        <div className="flex items-start">
          <Globe className="h-5 w-5 text-indigo-600 mr-2 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-gray-900 mb-1">When to use it</h3>
            <p className="text-sm text-gray-600 mb-0">
              You have an origin running somewhere else (Fly, your own VPS, a Kubernetes cluster) and
              you want a SpinForge-managed hostname and certificate in front of it. Or you want to
              stage a cutover — point the SpinForge hostname at one origin, then flip to another by
              updating <code>target</code>.
            </p>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Load balancer: weighted backends</h2>
      <p className="mb-4">
        A loadbalancer site distributes requests across multiple backends. Each backend has a
        <code>url</code>, a <code>weight</code>, and an <code>enabled</code> flag. Requests are routed
        by weighted round-robin over enabled backends.
      </p>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`curl -X POST https://api.spinforge.dev/_api/customer/sites \\
  -H "Authorization: Bearer sfc_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "domain": "lb.example.com",
    "type": "loadbalancer",
    "backends": [
      { "url": "https://origin-a.example.com", "weight": 3, "enabled": true },
      { "url": "https://origin-b.example.com", "weight": 1, "enabled": true },
      { "url": "https://canary.example.com",   "weight": 1, "enabled": false }
    ]
  }'`}</code></pre>
      </div>

      <p className="mb-4">In the example, 75 % of traffic goes to origin A, 25 % to origin B. The canary is registered but not receiving traffic — flip <code>enabled</code> to roll it in.</p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Updating backends</h2>
      <p className="mb-4">
        <code>backends</code> is replaced wholesale on <code>PUT</code>. Send the complete list you
        want active. To pause a backend without losing its configuration, flip its <code>enabled</code>{" "}
        to <code>false</code> rather than removing it.
      </p>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`curl -X PUT https://api.spinforge.dev/_api/customer/sites/lb.example.com \\
  -H "Authorization: Bearer sfc_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "backends": [
      { "url": "https://origin-a.example.com", "weight": 2, "enabled": true },
      { "url": "https://origin-b.example.com", "weight": 2, "enabled": true },
      { "url": "https://canary.example.com",   "weight": 1, "enabled": true }
    ]
  }'`}</code></pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Proxy vs. loadbalancer vs. container</h2>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-8 not-prose">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3 font-semibold">Type</th>
              <th className="p-3 font-semibold">Backend lives</th>
              <th className="p-3 font-semibold">Use when</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            <tr>
              <td className="p-3"><code>proxy</code></td>
              <td className="p-3">Somewhere else</td>
              <td className="p-3">You run the app elsewhere and want SpinForge&apos;s edge + TLS</td>
            </tr>
            <tr>
              <td className="p-3"><code>loadbalancer</code></td>
              <td className="p-3">Somewhere else (multiple)</td>
              <td className="p-3">You need weighted traffic across multiple origins</td>
            </tr>
            <tr>
              <td className="p-3"><code>container</code></td>
              <td className="p-3">On SpinForge</td>
              <td className="p-3">You want SpinForge to schedule the workload for you</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8 not-prose">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-amber-700 mr-2 mt-0.5 flex-shrink-0" />
          <p className="text-amber-800 text-sm mb-0">
            The <code>target</code> (and every backend <code>url</code>) must be publicly reachable
            from our edge. Private origins need a tunnel, allowlist, or VPC peering on your side.
          </p>
        </div>
      </div>

      <Link href="/docs/api/sites" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 not-prose inline-block">
        <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
          Full Sites API <ArrowRight className="h-4 w-4 ml-2" />
        </h3>
        <p className="text-sm text-gray-600 mb-0">All create/update/delete endpoints with schemas.</p>
      </Link>
    </div>
  );
}
