/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Terminal, AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function FlutterWebGuidePage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Deploying Flutter Web</h1>
      <p className="text-lg text-gray-600 mb-8">
        Flutter web builds produce a self-contained static bundle that you can host on SpinForge like any other
        SPA. This guide walks through building the bundle, packaging it, and deploying it with correct routing.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Build for the web</h2>

      <div className="bg-gray-900 rounded-lg p-6 mb-6 not-prose">
        <div className="flex items-center mb-3">
          <Terminal className="h-5 w-5 text-gray-400 mr-2" />
          <span className="text-gray-400 text-sm">Terminal</span>
        </div>
        <pre className="text-gray-100 overflow-x-auto"><code className="language-bash">{`# Make sure web support is enabled
flutter config --enable-web

# Build for release
flutter build web --release`}</code></pre>
      </div>

      <p className="mb-4">
        Output lands in <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">build/web/</code>. That
        directory contains <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">index.html</code>,{" "}
        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">main.dart.js</code>, the CanvasKit/Skwasm
        wasm files, and your assets.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Choose a renderer</h2>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8 not-prose">
        <h4 className="font-semibold text-blue-900 mb-2">HTML vs CanvasKit</h4>
        <p className="text-blue-800 text-sm mb-2">
          Flutter web can render with an HTML backend (smaller download, worse graphics) or CanvasKit (larger
          download, pixel-perfect with your mobile app). Pick explicitly:
        </p>
        <pre className="bg-blue-100 text-blue-900 text-xs p-3 rounded overflow-x-auto"><code>{`flutter build web --web-renderer canvaskit --release
# or
flutter build web --web-renderer html --release`}</code></pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Set the base href (optional)</h2>
      <p className="mb-4">
        If you are deploying to a subpath (e.g. <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">example.com/app</code>),
        pass <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">--base-href</code>:
      </p>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto"><code className="language-bash">flutter build web --release --base-href=/app/</code></pre>
      </div>

      <p className="mb-8 text-sm text-gray-600">
        For a dedicated domain (e.g. <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">app.example.com</code>),
        leave the default <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">/</code>.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Package the build</h2>
      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto"><code className="language-bash">{`cd build/web
zip -r ../../flutter-web.zip .
cd ../..`}</code></pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Deploy as a static site</h2>
      <ol className="list-decimal list-inside mb-4 space-y-2 text-gray-700">
        <li>Open <Link href="/dashboard/deploy" className="text-indigo-600 hover:underline">Dashboard → Deploy</Link></li>
        <li>Choose <strong>Static Site</strong></li>
        <li>Set <strong>Index file</strong> to <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">index.html</code></li>
        <li>Set <strong>Error file</strong> to <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">index.html</code> (Flutter uses client-side routing)</li>
        <li>Upload <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">flutter-web.zip</code> and click <strong>Deploy</strong></li>
      </ol>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-8 not-prose">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-amber-900 mb-1">Error file must be index.html</h4>
            <p className="text-amber-800 text-sm">
              Flutter web apps use the Navigator&apos;s history routing. If you serve a 404 page for unknown
              paths, deep links like <code className="bg-amber-100 px-1 rounded">/profile/42</code> will break on
              hard refresh. Always set the error file to <code className="bg-amber-100 px-1 rounded">index.html</code>.
            </p>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">MIME types and CORS</h2>
      <p className="mb-4">
        SpinForge serves <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">.wasm</code> files with the
        correct <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">application/wasm</code> MIME type out
        of the box, which CanvasKit needs. If you are loading assets from another origin, configure CORS on that
        origin — not on SpinForge.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Progressive Web App</h2>
      <p className="mb-8">
        Flutter generates a service worker and manifest. They work without any extra setup on SpinForge because
        HTML responses are served with{" "}
        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">Cache-Control: no-cache</code>, so clients
        always discover the latest service worker version.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 not-prose mb-8">
        <Link href="/docs/deployment/static-sites" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
            Static sites deep-dive <ArrowRight className="h-4 w-4 ml-2" />
          </h3>
          <p className="text-gray-600 text-sm">Cache headers, upload limits, and API deploys.</p>
        </Link>
        <Link href="/docs/deployment/custom-domains" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
            Custom domains <ArrowRight className="h-4 w-4 ml-2" />
          </h3>
          <p className="text-gray-600 text-sm">Connect your Flutter app to your own domain.</p>
        </Link>
      </div>
    </div>
  );
}
