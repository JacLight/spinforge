/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Terminal, FileCode, CheckCircle, AlertCircle, GitBranch } from "lucide-react";
import Link from "next/link";

export default function DeploymentManifestPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Deploy from a Git repo</h1>
      <p className="text-lg text-gray-600 mb-8">
        Describe your project once in a <code>spinforge.yaml</code>, POST it, and SpinForge clones
        your repo, builds it, and puts it on a domain. Re-run it on every push — applying the same
        manifest updates the deployment rather than creating a second one.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Add a manifest</h2>
      <p className="mb-4">
        Only <code>name</code> and <code>repo.url</code> are required. Everything else has a
        default.
      </p>

      <div className="bg-gray-900 rounded-lg p-6 mb-6 not-prose">
        <div className="flex items-center mb-3">
          <FileCode className="h-5 w-5 text-gray-400 mr-2" />
          <span className="text-gray-400 text-sm">spinforge.yaml</span>
        </div>
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`name: my-app
repo:
  url: https://github.com/me/my-app`}</code></pre>
      </div>

      <p className="mb-4">
        JSON works identically — the same parser reads both, so the fields and validation are the
        same either way.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Apply it</h2>

      <div className="bg-gray-900 rounded-lg p-6 mb-6 not-prose">
        <div className="flex items-center mb-3">
          <Terminal className="h-5 w-5 text-gray-400 mr-2" />
          <span className="text-gray-400 text-sm">Request</span>
        </div>
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`curl -X POST https://build.spinforge.dev/_api/customer/manifest \\
  -H "Authorization: Bearer sfc_..." \\
  -H "Content-Type: application/yaml" \\
  --data-binary @spinforge.yaml`}</code></pre>
      </div>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <span className="text-gray-400 text-sm">Response 201</span>
        <pre className="text-gray-100 overflow-x-auto text-sm mt-2"><code>{`{
  "created": true,
  "domain": "my-app.spinforge.dev",
  "pipeline": { "id": "pl_01J...", "name": "my-app" },
  "build": { "id": "bld_01J...", "status": "queued" },
  "warnings": []
}`}</code></pre>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8 not-prose">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-amber-600 mr-3 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold mb-1">Use --data-binary for YAML</p>
            <p>
              Plain <code>--data</code> strips newlines and the document will not parse. JSON is
              fine with either.
            </p>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Your domain</h2>
      <p className="mb-4">
        Leave <code>domain</code> out and SpinForge assigns{" "}
        <code>&lt;name&gt;.spinforge.dev</code>, checking it is not already taken and adding a
        numeric suffix if it is. Once assigned it never changes — re-applying will not move a live
        site to a new address.
      </p>
      <p className="mb-8">
        Set <code>domain</code> explicitly to use your own. See{" "}
        <Link href="/docs/deployment/custom-domains" className="text-blue-600 hover:text-blue-700">
          Custom Domains
        </Link>{" "}
        for DNS setup.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Fields</h2>

      <div className="overflow-x-auto mb-8 not-prose">
        <table className="min-w-full text-sm border border-gray-200 rounded-lg">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-gray-700">Field</th>
              <th className="text-left px-4 py-2 font-semibold text-gray-700">Default</th>
              <th className="text-left px-4 py-2 font-semibold text-gray-700">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            <tr>
              <td className="px-4 py-2 font-mono text-blue-700">name</td>
              <td className="px-4 py-2 text-gray-500">required</td>
              <td className="px-4 py-2 text-gray-600">1–100 chars. Re-applying with the same name updates that deployment.</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-blue-700">repo.url</td>
              <td className="px-4 py-2 text-gray-500">required</td>
              <td className="px-4 py-2 text-gray-600">Git clone URL, HTTPS or SSH.</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-blue-700">repo.ref</td>
              <td className="px-4 py-2 text-gray-500">default branch</td>
              <td className="px-4 py-2 text-gray-600">Branch, tag, or SHA.</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-blue-700">repo.token</td>
              <td className="px-4 py-2 text-gray-500">—</td>
              <td className="px-4 py-2 text-gray-600">For private repos. Never returned in a response.</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-blue-700">domain</td>
              <td className="px-4 py-2 text-gray-500">&lt;name&gt;.spinforge.dev</td>
              <td className="px-4 py-2 text-gray-600">Auto-assigned if omitted.</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-blue-700">type</td>
              <td className="px-4 py-2 text-gray-500">static</td>
              <td className="px-4 py-2 text-gray-600"><code>static</code>, <code>node</code>, or <code>container</code>.</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-blue-700">rootDir</td>
              <td className="px-4 py-2 text-gray-500">.</td>
              <td className="px-4 py-2 text-gray-600">Subdirectory holding the project, for monorepos.</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-blue-700">aliases</td>
              <td className="px-4 py-2 text-gray-500">[]</td>
              <td className="px-4 py-2 text-gray-600">Extra domains for the same site.</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-blue-700">owner.email</td>
              <td className="px-4 py-2 text-gray-500">—</td>
              <td className="px-4 py-2 text-gray-600">Verified against your account; a mismatch is rejected.</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-blue-700">autoDeploy</td>
              <td className="px-4 py-2 text-gray-500">true</td>
              <td className="px-4 py-2 text-gray-600">Set false to save config without building.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Monorepos</h2>
      <p className="mb-4">
        Point <code>rootDir</code> at the subdirectory. The repo is cloned whole; the build runs
        from there and output paths resolve against it.
      </p>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <div className="flex items-center mb-3">
          <GitBranch className="h-5 w-5 text-gray-400 mr-2" />
          <span className="text-gray-400 text-sm">spinforge.yaml</span>
        </div>
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`name: web
rootDir: apps/web
repo:
  url: https://github.com/me/monorepo`}</code></pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Editor autocomplete</h2>
      <p className="mb-4">
        The schema is public, so your editor can complete fields and flag mistakes as you type.
      </p>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <span className="text-gray-400 text-sm">VS Code settings.json</span>
        <pre className="text-gray-100 overflow-x-auto text-sm mt-2"><code>{`"yaml.schemas": {
  "https://build.spinforge.dev/_api/customer/manifest/schema": "spinforge.yaml"
}`}</code></pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">What is supported</h2>

      <div className="space-y-3 mb-8 not-prose">
        <div className="flex items-start">
          <CheckCircle className="h-5 w-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-700">
            <span className="font-semibold">Static sites</span> — Vite, Next export, Astro, plain
            HTML. Built with <code>npm ci &amp;&amp; npm run build</code>, served from{" "}
            <code>dist</code>.
          </p>
        </div>
        <div className="flex items-start">
          <CheckCircle className="h-5 w-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-700">
            <span className="font-semibold">Node projects</span> — set <code>type: node</code>.
          </p>
        </div>
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-amber-600 mr-3 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-700">
            <span className="font-semibold">Containers are not deployed yet.</span> A{" "}
            <code>type: container</code> manifest validates and saves, but the build and deploy
            steps have no runner — the apply response returns a warning saying so, and nothing is
            deployed. Use{" "}
            <Link href="/docs/deployment/containers" className="text-blue-600 hover:text-blue-700">
              the containers guide
            </Link>{" "}
            in the meantime.
          </p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8 not-prose">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">Build commands are fixed for now</p>
            <p>
              There is no way to override the build command, output directory, or package manager.
              Projects using yarn or pnpm, or writing to <code>build/</code> instead of{" "}
              <code>dist/</code>, cannot deploy through a manifest yet.
            </p>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Checking before you apply</h2>
      <p className="mb-4">
        <code>POST /_api/customer/manifest/validate</code> takes the same body, has no side effects,
        and returns the domain it would land on plus the steps that would run. Useful as a CI
        pre-check.
      </p>
    </div>
  );
}
