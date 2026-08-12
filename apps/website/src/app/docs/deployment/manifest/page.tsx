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
        Create an app in your dashboard, download its <code>spinforge.yaml</code>, and commit it to
        your repo. POST it on every push and SpinForge clones, builds, and deploys to that app.
        Applying the same manifest updates the deployment rather than creating a second one.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Get your manifest</h2>
      <p className="mb-4">
        In the dashboard, open your app and go to the <span className="font-semibold">Deploy</span>{" "}
        tab. Enter your repository URL, pick YAML or JSON, and download. The file already carries
        your app&apos;s <code>appId</code> — commit it to your repository root.
      </p>
      <p className="mb-4">
        A manifest points at an app you already own. It can never create one or claim a domain, and
        it holds no secret, so it is safe in a public repo.
      </p>

      <div className="bg-gray-900 rounded-lg p-6 mb-6 not-prose">
        <div className="flex items-center mb-3">
          <FileCode className="h-5 w-5 text-gray-400 mr-2" />
          <span className="text-gray-400 text-sm">spinforge.yaml</span>
        </div>
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`appId: app_b5354edd-e287-480f-b750-72b28a39a255
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
  "appId": "app_b5354edd-e287-480f-b750-72b28a39a255",
  "domain": "my-app.spinforge.dev",
  "url": "https://my-app.spinforge.dev",
  "pipeline": { "id": "pl_01J..." },
  "build": { "id": "b_01J...", "status": "queued" },
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
        The domain belongs to the app, not the manifest — you choose it in the dashboard when you
        create the app. That is also where quotas are enforced.
      </p>
      <p className="mb-4">
        Because the manifest references the app by <code>appId</code>, renaming the app&apos;s
        domain does not invalidate the committed file. The id resolves to whatever domain the app
        currently serves on, so nothing in your repo needs editing after a move.
      </p>
      <p className="mb-8">
        To use your own domain, see{" "}
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
              <td className="px-4 py-2 font-mono text-blue-700">appId</td>
              <td className="px-4 py-2 text-gray-500">required</td>
              <td className="px-4 py-2 text-gray-600">From your app&apos;s Deploy tab. Stable across domain changes.</td>
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
              <td className="px-4 py-2 font-mono text-blue-700">rootDir</td>
              <td className="px-4 py-2 text-gray-500">.</td>
              <td className="px-4 py-2 text-gray-600">Subdirectory holding the project, for monorepos.</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-blue-700">autoDeploy</td>
              <td className="px-4 py-2 text-gray-500">true</td>
              <td className="px-4 py-2 text-gray-600">Set false to save config without building.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mb-8 text-sm text-gray-600">
        There is no <code>domain</code>, <code>name</code>, <code>type</code>, or{" "}
        <code>owner</code> field. Domain and project type come from the app record, so the manifest
        and the dashboard can never disagree.
      </p>

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
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`appId: app_b5354edd-e287-480f-b750-72b28a39a255
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
            <span className="font-semibold">Node projects</span> — create the app as type{" "}
            <code>node</code> in the dashboard.
          </p>
        </div>
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-amber-600 mr-3 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-700">
            <span className="font-semibold">Containers are not deployed yet.</span> A manifest for
            a <code>container</code> app validates and saves, but the build and deploy steps have
            no runner — the apply response returns a warning saying so, and nothing is
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
              Every build runs <code>npm ci &amp;&amp; npm run build</code> and publishes{" "}
              <code>dist</code>. There is no way to override the command, output directory, or
              package manager, and <code>npm ci</code> requires a committed lockfile. Projects using
              yarn or pnpm, or writing to <code>build/</code>, cannot deploy through a manifest yet.
            </p>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Checking before you apply</h2>
      <p className="mb-4">
        <code>POST /_api/customer/manifest/validate</code> takes the same body and has no side
        effects. It runs the same resolution a real apply does — same ownership check, same app
        type, same steps — stopping short of the first write, then returns the domain it would land
        on and the stages that would run. Useful as a CI pre-check.
      </p>
    </div>
  );
}
