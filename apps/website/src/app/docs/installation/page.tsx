/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Terminal, CheckCircle, Monitor, Package, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function InstallationPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Installation</h1>
      <p className="text-lg text-gray-600 mb-8">
        SpinForge can be used in three ways: through the web dashboard (nothing to install), through the
        REST API (any HTTP client), or through the optional SpinForge CLI. This page covers all three.
      </p>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8 not-prose">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">Prerequisites</h3>
        <ul className="space-y-2 text-blue-800">
          <li className="flex items-start">
            <CheckCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            <span>A SpinForge account (<Link href="/signup" className="underline">sign up here</Link>)</span>
          </li>
          <li className="flex items-start">
            <CheckCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            <span>A modern browser for the dashboard, or Node.js 18+ if you want the CLI</span>
          </li>
          <li className="flex items-start">
            <CheckCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            <span>A pre-built application (built output, ZIP, or Docker image)</span>
          </li>
        </ul>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Option 1: Web Dashboard (no install)</h2>
      <p className="mb-4">
        The fastest way to deploy. Log in, upload your build or point at a container image, and you are live.
      </p>

      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8 not-prose">
        <div className="flex items-start">
          <Monitor className="h-6 w-6 text-indigo-600 mr-3 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-gray-900 mb-1">Open the dashboard</h4>
            <p className="text-gray-600 text-sm mb-3">
              Sign in and navigate to <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">/dashboard/deploy</code>
              {" "}to create your first site.
            </p>
            <Link
              href="/dashboard/deploy"
              className="inline-flex items-center text-indigo-600 hover:text-indigo-700 text-sm font-medium"
            >
              Go to dashboard <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Option 2: Install the SpinForge CLI</h2>
      <p className="mb-4">
        The CLI is useful for scripted deployments, CI/CD pipelines, and working from your terminal.
      </p>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <div className="flex items-center mb-4">
          <Terminal className="h-5 w-5 text-gray-400 mr-2" />
          <span className="text-gray-400 text-sm">Terminal</span>
        </div>
        <pre className="text-gray-100 overflow-x-auto"><code className="language-bash"># Using npm
npm install -g @spinforge/cli

# Using yarn
yarn global add @spinforge/cli

# Using pnpm
pnpm add -g @spinforge/cli</code></pre>
      </div>

      <p className="mb-4">Verify the install:</p>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto"><code className="language-bash">spinforge-cli --version</code></pre>
      </div>

      <p className="mb-4">Authenticate against your account. The CLI opens your browser and stores a token locally:</p>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto"><code className="language-bash">spinforge-cli auth login</code></pre>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-8 not-prose">
        <h4 className="font-semibold text-amber-900 mb-2">Using an API token instead</h4>
        <p className="text-amber-800 text-sm mb-3">
          For CI/CD, generate a token from <Link href="/dashboard/api-tokens" className="underline">Dashboard → API Tokens</Link>
          {" "}and expose it as an environment variable:
        </p>
        <pre className="bg-amber-100 text-amber-900 text-xs p-3 rounded overflow-x-auto"><code>{`export SPINFORGE_TOKEN=sf_live_...
export SPINFORGE_CUSTOMER_ID=cust_abc123`}</code></pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Option 3: Use the REST API directly</h2>
      <p className="mb-4">
        Every dashboard action is backed by the same REST API. You can call it from any HTTP client.
      </p>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <div className="flex items-center mb-4">
          <Package className="h-5 w-5 text-gray-400 mr-2" />
          <span className="text-gray-400 text-sm">curl</span>
        </div>
        <pre className="text-gray-100 overflow-x-auto"><code className="language-bash">{`curl -X POST https://api.spinforge.com/_api/customer/sites \\
  -H "Authorization: Bearer $SPINFORGE_TOKEN" \\
  -H "X-Customer-ID: $SPINFORGE_CUSTOMER_ID" \\
  -H "Content-Type: application/json" \\
  -d '{
    "domain": "my-app.example.com",
    "type": "container",
    "enabled": true,
    "containerConfig": {
      "image": "nginx:latest",
      "port": 80
    }
  }'`}</code></pre>
      </div>

      <p className="mb-8">
        The full endpoint reference is available in the <Link href="/docs/api" className="text-indigo-600 hover:underline">API documentation</Link>.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Self-hosting SpinForge</h2>
      <p className="mb-4">
        SpinForge is open source and can run on your own infrastructure. Clone the repository, bring up the
        stack with Docker Compose, and you have a full hosting control plane.
      </p>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto"><code className="language-bash">{`git clone https://github.com/spinforge/spinforge.git
cd spinforge
./setup.sh
./start.sh`}</code></pre>
      </div>

      <p className="mb-8 text-sm text-gray-600">
        <code className="bg-gray-100 px-1.5 py-0.5 rounded">./manage.sh</code> provides helpers for health checks,
        log tailing, and service restarts once the stack is running.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-6">Next Steps</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 not-prose mb-8">
        <Link href="/docs/quick-start" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
            Quick Start
            <ArrowRight className="h-4 w-4 ml-2" />
          </h3>
          <p className="text-gray-600 text-sm">
            Deploy your first app in under 5 minutes.
          </p>
        </Link>

        <Link href="/docs/cli/overview" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
            CLI Overview
            <ArrowRight className="h-4 w-4 ml-2" />
          </h3>
          <p className="text-gray-600 text-sm">
            Every CLI command, with examples.
          </p>
        </Link>
      </div>
    </div>
  );
}
