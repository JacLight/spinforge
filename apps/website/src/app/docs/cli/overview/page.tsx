/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Terminal, ArrowRight } from "lucide-react";
import Link from "next/link";

interface Command {
  cmd: string;
  desc: string;
  example?: string;
}

const commands: { group: string; items: Command[] }[] = [
  {
    group: "Authentication",
    items: [
      { cmd: "spinforge-cli auth login", desc: "Open your browser and authenticate against your SpinForge account." },
      { cmd: "spinforge-cli auth logout", desc: "Clear the local credentials for the current machine." },
      { cmd: "spinforge-cli auth whoami", desc: "Print the currently authenticated account and customer ID." },
    ],
  },
  {
    group: "Deployment",
    items: [
      { cmd: "spinforge-cli deploy", desc: "Deploy the current directory. Detects static/Node apps automatically.", example: "spinforge-cli deploy --domain my-app.example.com" },
      { cmd: "spinforge-cli deploy-folder <path>", desc: "Deploy a specific folder (build output) as a static site.", example: "spinforge-cli deploy-folder ./dist" },
      { cmd: "spinforge-cli deploy --no-build", desc: "Skip the build step if your project is already built." },
      { cmd: "spinforge-cli rollback <domain>", desc: "Roll back to the previous successful deployment for a site." },
    ],
  },
  {
    group: "Sites",
    items: [
      { cmd: "spinforge-cli list", desc: "List all sites owned by the current account." },
      { cmd: "spinforge-cli info <domain>", desc: "Show status, type, SSL state, and aliases for a single site." },
      { cmd: "spinforge-cli delete <domain>", desc: "Delete a site and all of its resources. This action is irreversible." },
      { cmd: "spinforge-cli enable <domain>", desc: "Enable a site that is currently disabled." },
      { cmd: "spinforge-cli disable <domain>", desc: "Disable a site without deleting it." },
    ],
  },
  {
    group: "Containers",
    items: [
      { cmd: "spinforge-cli container start <domain>", desc: "Start the container backing a site." },
      { cmd: "spinforge-cli container stop <domain>", desc: "Stop the container without deleting the site." },
      { cmd: "spinforge-cli container restart <domain>", desc: "Restart the container (useful after env var changes)." },
      { cmd: "spinforge-cli container stats <domain>", desc: "Print CPU, memory, and network stats for the container." },
    ],
  },
  {
    group: "Logs",
    items: [
      { cmd: "spinforge-cli logs <domain>", desc: "Print the most recent logs for a site." },
      { cmd: "spinforge-cli logs <domain> --follow", desc: "Stream logs in real time (Ctrl+C to stop)." },
      { cmd: "spinforge-cli logs <domain> --lines 500", desc: "Fetch a specific number of historical log lines." },
    ],
  },
  {
    group: "Domains & SSL",
    items: [
      { cmd: "spinforge-cli domain add <domain> <alias>", desc: "Add a domain alias that points to an existing site." },
      { cmd: "spinforge-cli domain remove <domain> <alias>", desc: "Remove an alias from a site." },
      { cmd: "spinforge-cli ssl enable <domain>", desc: "Request a Let's Encrypt certificate for the site." },
      { cmd: "spinforge-cli ssl status <domain>", desc: "Show certificate status, expiry, and issuer." },
    ],
  },
];

export default function CliOverviewPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">CLI Overview</h1>
      <p className="text-lg text-gray-600 mb-8">
        The SpinForge CLI is a thin wrapper around the REST API. Anything you can do from the dashboard you can do
        from your terminal, which makes it ideal for CI/CD pipelines and local scripting.
      </p>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8 not-prose">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">Installation</h3>
        <p className="text-blue-800 mb-3">If you have not installed the CLI yet:</p>
        <pre className="bg-blue-100 text-blue-900 text-xs p-3 rounded overflow-x-auto"><code>npm install -g @spinforge/cli</code></pre>
        <Link href="/docs/installation" className="inline-flex items-center text-blue-700 hover:text-blue-900 text-sm font-medium mt-3">
          Full installation guide <ArrowRight className="h-4 w-4 ml-1" />
        </Link>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Global Flags</h2>
      <p className="mb-4">These flags work on any command:</p>

      <div className="overflow-x-auto mb-8 not-prose">
        <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-gray-700">Flag</th>
              <th className="text-left px-4 py-2 font-semibold text-gray-700">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            <tr>
              <td className="px-4 py-2 font-mono text-xs"><code>--token &lt;token&gt;</code></td>
              <td className="px-4 py-2 text-gray-600">Override the stored API token (or use <code>$SPINFORGE_TOKEN</code>).</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs"><code>--customer &lt;id&gt;</code></td>
              <td className="px-4 py-2 text-gray-600">Override the stored customer ID (or use <code>$SPINFORGE_CUSTOMER_ID</code>).</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs"><code>--api-url &lt;url&gt;</code></td>
              <td className="px-4 py-2 text-gray-600">Target a self-hosted SpinForge instance instead of the public API.</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs"><code>--json</code></td>
              <td className="px-4 py-2 text-gray-600">Output raw JSON instead of human-readable text. Useful for piping.</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs"><code>--help</code></td>
              <td className="px-4 py-2 text-gray-600">Show command-specific help.</td>
            </tr>
          </tbody>
        </table>
      </div>

      {commands.map((group) => (
        <section key={group.group} className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{group.group}</h2>
          <div className="space-y-4 not-prose">
            {group.items.map((c) => (
              <div key={c.cmd} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <Terminal className="h-4 w-4 text-gray-400 mr-2" />
                  <code className="text-sm font-mono text-indigo-700">{c.cmd}</code>
                </div>
                <p className="text-sm text-gray-600">{c.desc}</p>
                {c.example && (
                  <pre className="mt-3 bg-gray-900 text-gray-100 text-xs p-3 rounded overflow-x-auto"><code>{c.example}</code></pre>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Using the CLI in CI/CD</h2>
      <p className="mb-4">
        Generate a non-interactive token from{" "}
        <Link href="/dashboard/api-tokens" className="text-indigo-600 hover:underline">Dashboard → API Tokens</Link>,
        store it as a secret in your CI system, then run deploy steps like this:
      </p>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto"><code className="language-yaml">{`# .github/workflows/deploy.yml
name: Deploy
on: { push: { branches: [main] } }
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: npm ci && npm run build
      - run: npm install -g @spinforge/cli
      - run: spinforge-cli deploy-folder ./dist --domain my-app.example.com
        env:
          SPINFORGE_TOKEN: \${{ secrets.SPINFORGE_TOKEN }}
          SPINFORGE_CUSTOMER_ID: \${{ secrets.SPINFORGE_CUSTOMER_ID }}`}</code></pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Exit Codes</h2>
      <div className="overflow-x-auto mb-8 not-prose">
        <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-gray-700">Code</th>
              <th className="text-left px-4 py-2 font-semibold text-gray-700">Meaning</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            <tr><td className="px-4 py-2 font-mono">0</td><td className="px-4 py-2 text-gray-600">Success</td></tr>
            <tr><td className="px-4 py-2 font-mono">1</td><td className="px-4 py-2 text-gray-600">Generic error (see message)</td></tr>
            <tr><td className="px-4 py-2 font-mono">2</td><td className="px-4 py-2 text-gray-600">Authentication failure</td></tr>
            <tr><td className="px-4 py-2 font-mono">3</td><td className="px-4 py-2 text-gray-600">Validation error (bad arguments or payload)</td></tr>
            <tr><td className="px-4 py-2 font-mono">4</td><td className="px-4 py-2 text-gray-600">Network or API unreachable</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
