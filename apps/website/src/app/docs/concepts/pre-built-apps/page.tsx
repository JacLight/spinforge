/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Package, CheckCircle, XCircle, AlertCircle } from "lucide-react";

export default function PreBuiltAppsPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Pre-built Apps</h1>
      <p className="text-lg text-gray-600 mb-8">
        SpinForge serves artifacts, not source. You bring the finished product — a zipped build or a
        Docker image — and we handle routing, TLS, and scheduling. Here is why.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">The split</h2>
      <p className="mb-4">
        Most platforms fuse two responsibilities together: building your code and running it. That
        coupling is the source of most painful deploy incidents — mysterious Node.js version shifts,
        native-module recompiles, surprise dependency upgrades.
      </p>
      <p className="mb-8">
        SpinForge keeps them separate. Build wherever you want — your CI, your laptop, a dedicated
        build server. Hand us the output. What we run matches what you tested, byte for byte.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">What counts as pre-built</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 not-prose mb-8">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center mb-2">
            <Package className="h-5 w-5 text-indigo-600 mr-2" />
            <h3 className="font-semibold text-gray-900 mb-0">Static sites</h3>
          </div>
          <p className="text-sm text-gray-600 mb-0">
            The output of <code>vite build</code>, <code>next export</code>, <code>astro build</code>,
            <code>hugo</code>, or any tool that emits HTML/CSS/JS. Zip the directory, upload.
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center mb-2">
            <Package className="h-5 w-5 text-indigo-600 mr-2" />
            <h3 className="font-semibold text-gray-900 mb-0">Container images</h3>
          </div>
          <p className="text-sm text-gray-600 mb-0">
            Any image in a registry Nomad can pull — Docker Hub, GHCR, ECR, a private registry with
            credentials. Point the site at <code>image:tag</code> and we schedule it.
          </p>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">What we do and don&apos;t do</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 not-prose mb-8">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center mb-3">
            <CheckCircle className="h-5 w-5 text-green-700 mr-2" />
            <h3 className="font-semibold text-green-900 mb-0">We do</h3>
          </div>
          <ul className="space-y-2 text-sm text-green-900">
            <li>Route HTTPS traffic to your site</li>
            <li>Extract and serve uploaded zips</li>
            <li>Schedule containers on Nomad</li>
            <li>Restart crashed containers per your <code>restartPolicy</code></li>
            <li>Issue and renew Let&apos;s Encrypt certs</li>
            <li>Stream stdout/stderr back over the logs endpoint</li>
          </ul>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center mb-3">
            <XCircle className="h-5 w-5 text-red-700 mr-2" />
            <h3 className="font-semibold text-red-900 mb-0">We don&apos;t</h3>
          </div>
          <ul className="space-y-2 text-sm text-red-900">
            <li>Run <code>npm install</code> or <code>pip install</code></li>
            <li>Execute build scripts</li>
            <li>Build images from a Dockerfile on your behalf</li>
            <li>Clone a git repo</li>
            <li>Detect a framework and pick a preset</li>
          </ul>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Why this works out better</h2>

      <ul className="list-disc list-inside space-y-3 mb-8">
        <li>
          <strong>Deterministic deploys.</strong> The bytes you tested are the bytes that ship.
        </li>
        <li>
          <strong>Faster rollouts.</strong> No cold compile on the server. Upload finishes, traffic flips.
        </li>
        <li>
          <strong>Smaller blast radius.</strong> A broken build fails in your CI, not after traffic
          starts draining to a half-deployed instance.
        </li>
        <li>
          <strong>Flexibility.</strong> Any language, any framework, any toolchain — we don&apos;t care
          how you got to the artifact.
        </li>
      </ul>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 not-prose">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-amber-700 mr-2 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-amber-900 mb-1">Need CI?</h4>
            <p className="text-amber-800 text-sm mb-0">
              Run GitHub Actions, GitLab CI, or any runner that can produce your artifact, then call
              our HTTP API at the end of the pipeline. The upload endpoint is a single multipart POST.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
