/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { LifeBuoy, AlertCircle, Terminal, ArrowRight } from "lucide-react";
import Link from "next/link";

interface Issue {
  symptom: string;
  causes: string[];
  fixes: { label: string; code?: string; body?: string }[];
}

const issues: { category: string; items: Issue[] }[] = [
  {
    category: "Deployment failures",
    items: [
      {
        symptom: "Upload fails with \"File too large\"",
        causes: [
          "Your ZIP is larger than the 100 MB upload cap.",
          "You included node_modules or source maps in the archive.",
        ],
        fixes: [
          { label: "Strip node_modules before zipping", code: "rm -rf node_modules\ncd dist && zip -r ../site.zip ." },
          { label: "Disable source maps in your build", body: "For Vite: set build.sourcemap: false. For CRA: GENERATE_SOURCEMAP=false npm run build." },
          { label: "Split large assets out to object storage", body: "Host videos, high-res images, or datasets on S3/R2 and load them by URL from your app." },
        ],
      },
      {
        symptom: "Container fails to start",
        causes: [
          "The image cannot be pulled (wrong name, missing registry credentials).",
          "Your app crashed on startup (missing env var, bad config).",
          "The health check is failing.",
        ],
        fixes: [
          { label: "Inspect the container logs", code: "spinforge-cli logs my-site.example.com --lines 200" },
          { label: "Verify the image locally", code: "docker run --rm -p 3000:3000 your-reg/my-app:latest" },
          { label: "Check registry credentials", body: "If using a private registry, add credentials in Dashboard → Settings → Registry Credentials." },
        ],
      },
      {
        symptom: "Deploy hangs on \"Waiting for health check\"",
        causes: [
          "Your app is not listening on process.env.PORT.",
          "Your /healthz endpoint does not respond with 200.",
          "Your app takes longer than 60 seconds to become ready.",
        ],
        fixes: [
          { label: "Use the injected PORT", code: "const port = process.env.PORT || 3000;\napp.listen(port);" },
          { label: "Add a fast /healthz", body: "Return 200 as soon as your process is alive. Don't wait for DB connections or cache warm-up." },
          { label: "Increase the startup grace period", body: "Set a SPINFORGE_START_GRACE env var (in seconds) on the site to extend the health check deadline." },
        ],
      },
    ],
  },
  {
    category: "Runtime errors",
    items: [
      {
        symptom: "502 Bad Gateway",
        causes: [
          "The container crashed after a successful start.",
          "Your app is listening on the wrong interface (127.0.0.1 instead of 0.0.0.0).",
          "The configured port does not match the port your app is actually listening on.",
        ],
        fixes: [
          { label: "Bind to 0.0.0.0", code: "app.listen(port, '0.0.0.0');" },
          { label: "Match the container port to the site config", body: "The port you set in the dashboard must equal the port your app listens on inside the container." },
          { label: "Check for crash loops in the logs", code: "spinforge-cli logs my-site.example.com --follow" },
        ],
      },
      {
        symptom: "Crash loop restarts",
        causes: [
          "Unhandled promise rejection or uncaught exception.",
          "Missing required environment variable.",
          "Out of memory (OOM kill).",
        ],
        fixes: [
          { label: "Add global error handlers", code: "process.on('unhandledRejection', console.error);\nprocess.on('uncaughtException', console.error);" },
          { label: "Check OOM events", body: "If the exit code is 137, the kernel OOM-killed the container. Raise the memory limit on the site or reduce your app's footprint." },
          { label: "Validate env vars on boot", body: "Use a schema validator (zod, envalid) to fail fast with a clear error message instead of crashing deep in the code." },
        ],
      },
      {
        symptom: "\"Cannot find module\" in Node app",
        causes: [
          "You ran npm ci --omit=dev in a stage that still needs dev dependencies.",
          "Your build output references a package that was not copied to the runtime stage.",
        ],
        fixes: [
          { label: "Audit your Dockerfile stages", body: "Make sure everything your runtime CMD needs is either copied from the builder stage or installed in the runtime stage." },
          { label: "Use npm ls to trace the import", code: "docker run --rm -it your-reg/my-app:latest sh -c 'npm ls missing-package'" },
        ],
      },
    ],
  },
  {
    category: "Domains & SSL",
    items: [
      {
        symptom: "SSL certificate stuck at \"pending\"",
        causes: [
          "DNS does not yet resolve to SpinForge.",
          "A previous failed cert attempt is still in cool-down.",
          "You are rate-limited by Let's Encrypt.",
        ],
        fixes: [
          { label: "Verify DNS first", code: "dig +short your-domain.com" },
          { label: "Wait for DNS propagation", body: "CNAME and A record changes can take up to 48 hours to propagate globally." },
          { label: "Use LE staging while iterating", body: "Enable \"Use Let's Encrypt staging\" in the site's SSL settings to avoid burning through the production rate limit." },
        ],
      },
      {
        symptom: "\"Your connection is not private\" in browser",
        causes: [
          "SSL has not finished provisioning yet.",
          "You are hitting the site on a hostname not listed as a domain or alias.",
          "A custom certificate has expired.",
        ],
        fixes: [
          { label: "Check the certificate chain", code: "curl -vI https://your-domain.com 2>&1 | grep -i issuer" },
          { label: "Add the hostname as an alias", body: "Every hostname you want to serve must be listed on the site. See the custom domains guide." },
        ],
      },
    ],
  },
  {
    category: "Performance",
    items: [
      {
        symptom: "Site is slow on first request",
        causes: [
          "Container is cold-starting (idle scale-down).",
          "Your app loads heavy resources on boot.",
          "Build output is un-minified.",
        ],
        fixes: [
          { label: "Enable always-on for production sites", body: "On the site settings, disable idle scale-down so the container stays warm." },
          { label: "Lazy-load heavy resources", body: "Defer DB connection pools, cache warming, and ML model loading until first request if possible." },
          { label: "Check your build flags", body: "Ensure you are running the production build (NODE_ENV=production, --release, etc.) not a development build." },
        ],
      },
    ],
  },
];

export default function TroubleshootingPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Troubleshooting</h1>
      <p className="text-lg text-gray-600 mb-8">
        The most common problems our users hit, grouped by category. If your issue is not listed, check the{" "}
        <Link href="/docs/troubleshooting/faq" className="text-indigo-600 hover:underline">FAQ</Link>, or open a
        ticket from the dashboard.
      </p>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-10 not-prose">
        <div className="flex items-start">
          <LifeBuoy className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-blue-900 mb-1">Before anything else, check the logs</h4>
            <p className="text-blue-800 text-sm mb-3">
              Most deployment problems surface clearly in the container logs. Stream them while you reproduce the
              issue:
            </p>
            <pre className="bg-blue-100 text-blue-900 text-xs p-3 rounded overflow-x-auto"><code>spinforge-cli logs your-site.example.com --follow</code></pre>
          </div>
        </div>
      </div>

      {issues.map((group) => (
        <section key={group.category} className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">{group.category}</h2>
          <div className="space-y-6 not-prose">
            {group.items.map((issue) => (
              <div key={issue.symptom} className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-start mb-4">
                  <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
                  <h3 className="font-semibold text-gray-900">{issue.symptom}</h3>
                </div>

                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Likely causes</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                    {issue.causes.map((c) => <li key={c}>{c}</li>)}
                  </ul>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Fixes to try</h4>
                  <div className="space-y-3">
                    {issue.fixes.map((f) => (
                      <div key={f.label}>
                        <p className="text-sm font-medium text-gray-900 mb-1">{f.label}</p>
                        {f.body && <p className="text-sm text-gray-600">{f.body}</p>}
                        {f.code && (
                          <pre className="mt-1 bg-gray-900 text-gray-100 text-xs p-3 rounded overflow-x-auto"><code>{f.code}</code></pre>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Still stuck?</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 not-prose mb-8">
        <Link href="/docs/troubleshooting/faq" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
            FAQ <ArrowRight className="h-4 w-4 ml-2" />
          </h3>
          <p className="text-gray-600 text-sm">Answers to the questions people ask most.</p>
        </Link>
        <Link href="/dashboard/settings" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
            <Terminal className="h-5 w-5 mr-2" /> Contact support
          </h3>
          <p className="text-gray-600 text-sm">Open a ticket from your dashboard — we will include logs automatically.</p>
        </Link>
      </div>
    </div>
  );
}
