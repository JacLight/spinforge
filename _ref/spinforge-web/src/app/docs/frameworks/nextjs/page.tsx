import { Terminal, FileCode, Settings, Zap, AlertCircle } from "lucide-react";

export default function NextJSFrameworkPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Deploy Next.js Apps</h1>
      <p className="text-lg text-gray-600 mb-8">
        SpinForge provides first-class support for Next.js applications. Deploy your Next.js 
        app with zero configuration, whether you're using App Router, Pages Router, or Static Export.
      </p>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8 not-prose">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">Quick Deploy</h3>
        <p className="text-blue-800 mb-4">
          Deploy a Next.js app in under a minute:
        </p>
        <div className="bg-blue-900 text-blue-100 p-4 rounded">
          <pre className="text-sm"><code>{`npm run build
spinforge-cli deploy`}</code></pre>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Supported Features</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 not-prose">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">✅ Fully Supported</h3>
          <ul className="space-y-2 text-gray-700 text-sm">
            <li>• App Router & Pages Router</li>
            <li>• Server Components</li>
            <li>• API Routes</li>
            <li>• Static Generation (SSG)</li>
            <li>• Server-Side Rendering (SSR)</li>
            <li>• Incremental Static Regeneration (ISR)</li>
            <li>• Image Optimization</li>
            <li>• Middleware</li>
            <li>• Static Exports</li>
          </ul>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">⚡ Optimizations</h3>
          <ul className="space-y-2 text-gray-700 text-sm">
            <li>• Automatic caching headers</li>
            <li>• Global CDN distribution</li>
            <li>• Brotli compression</li>
            <li>• HTTP/2 & HTTP/3</li>
            <li>• Optimized asset serving</li>
            <li>• Smart bundling</li>
            <li>• Edge routing</li>
            <li>• WebP image conversion</li>
          </ul>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Project Structure</h2>

      <p className="mb-4">SpinForge automatically detects Next.js projects by looking for:</p>

      <div className="bg-gray-50 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-sm text-gray-700"><code>{`my-nextjs-app/
├── .next/              # Build output (created by npm run build)
├── public/             # Static assets
├── package.json        # Dependencies and scripts
├── next.config.js      # Next.js configuration
└── node_modules/       # Dependencies (if not bundled)`}</code></pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Build & Deploy</h2>

      <div className="space-y-6 not-prose">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-3">1. Build Your Application</h3>
          <div className="bg-gray-900 rounded-lg p-4 mb-3">
            <pre className="text-gray-100 overflow-x-auto"><code>{`# Install dependencies
npm install

# Build for production
npm run build`}</code></pre>
          </div>
          <p className="text-gray-600 text-sm">
            This creates the <code className="bg-gray-100 px-2 py-1 rounded">.next</code> directory with your optimized application.
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-3">2. Deploy to SpinForge</h3>
          <div className="bg-gray-900 rounded-lg p-4 mb-3">
            <pre className="text-gray-100 overflow-x-auto"><code>{`# Deploy (will prompt to build if needed)
spinforge-cli deploy

# Or if already built
spinforge-cli deploy --no-build`}</code></pre>
          </div>
          <p className="text-gray-600 text-sm">
            Your Next.js app will be live in seconds at your-app.spinforge.app
          </p>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4 mt-12">Configuration</h2>

      <h3 className="text-xl font-semibold text-gray-900 mb-4">next.config.js</h3>

      <p className="mb-4">SpinForge respects your Next.js configuration:</p>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`/** @type {import('next').NextConfig} */
const nextConfig = {
  // Output standalone for smaller deployments
  output: 'standalone',
  
  // Image optimization works out of the box
  images: {
    domains: ['example.com'],
  },
  
  // Environment variables
  env: {
    API_URL: process.env.API_URL,
  },
  
  // Redirects and rewrites work as expected
  async redirects() {
    return [
      {
        source: '/old-path',
        destination: '/new-path',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;`}</code></pre>
      </div>

      <h3 className="text-xl font-semibold text-gray-900 mb-4">Environment Variables</h3>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-8 not-prose">
        <h4 className="font-semibold text-amber-900 mb-3 flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          Build vs Runtime Variables
        </h4>
        <p className="text-amber-800 mb-3">
          Next.js uses environment variables at both build time and runtime:
        </p>
        <ul className="space-y-2 text-amber-800">
          <li>• <code className="bg-amber-100 px-2 py-1 rounded text-sm">NEXT_PUBLIC_*</code> - Embedded at build time</li>
          <li>• Server-only variables - Available at runtime</li>
        </ul>
        <p className="text-amber-800 mt-3">
          Build your app with the appropriate <code className="bg-amber-100 px-2 py-1 rounded text-sm">NEXT_PUBLIC_*</code> variables, 
          then set runtime variables in the SpinForge dashboard.
        </p>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Deployment Modes</h2>

      <div className="space-y-6 not-prose">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-3">Standard Deployment</h3>
          <p className="text-gray-600 mb-3">
            The default mode that supports all Next.js features including SSR, API routes, and ISR.
          </p>
          <div className="bg-gray-50 rounded p-4">
            <p className="text-sm font-mono text-gray-700">npm run build && spinforge-cli deploy</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-3">Standalone Output</h3>
          <p className="text-gray-600 mb-3">
            For smaller deployments, use Next.js standalone output:
          </p>
          <div className="bg-gray-900 rounded p-4">
            <pre className="text-sm text-gray-100"><code>{`// next.config.js
module.exports = {
  output: 'standalone',
}`}</code></pre>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-3">Static Export</h3>
          <p className="text-gray-600 mb-3">
            For fully static sites without server features:
          </p>
          <div className="bg-gray-900 rounded p-4">
            <pre className="text-sm text-gray-100"><code>{`// next.config.js
module.exports = {
  output: 'export',
}

// Then deploy the 'out' directory
spinforge-cli deploy-folder ./out`}</code></pre>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4 mt-12">Common Patterns</h2>

      <div className="space-y-6 not-prose">
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="font-semibold text-gray-900 mb-3">API Routes with Database</h3>
          <div className="bg-gray-900 rounded p-4">
            <pre className="text-sm text-gray-100"><code>{`// app/api/users/route.js
import { db } from '@/lib/db';

export async function GET() {
  // Database URL from runtime environment
  const users = await db.query('SELECT * FROM users');
  return Response.json(users);
}`}</code></pre>
          </div>
          <p className="text-gray-600 text-sm mt-3">
            Set DATABASE_URL in SpinForge dashboard after deployment.
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="font-semibold text-gray-900 mb-3">Image Optimization</h3>
          <div className="bg-gray-900 rounded p-4">
            <pre className="text-sm text-gray-100"><code>{`import Image from 'next/image';

export default function Hero() {
  return (
    <Image
      src="/hero.jpg"
      alt="Hero"
      width={1200}
      height={600}
      priority
      // Optimization happens automatically
    />
  );
}`}</code></pre>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4 mt-12">Troubleshooting</h2>

      <div className="space-y-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6 not-prose">
          <h3 className="font-semibold text-gray-900 mb-2">Module not found errors</h3>
          <p className="text-gray-600 mb-3">
            Ensure all dependencies are in <code className="bg-gray-100 px-2 py-1 rounded text-sm">package.json</code> and 
            not in <code className="bg-gray-100 px-2 py-1 rounded text-sm">devDependencies</code> if needed at runtime.
          </p>
          <div className="bg-gray-50 rounded p-3">
            <code className="text-sm">npm install missing-package</code>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 not-prose">
          <h3 className="font-semibold text-gray-900 mb-2">Environment variables not working</h3>
          <p className="text-gray-600">
            Remember: <code className="bg-gray-100 px-2 py-1 rounded text-sm">NEXT_PUBLIC_*</code> variables must be 
            present at build time. Server-only variables can be set in the dashboard.
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 not-prose">
          <h3 className="font-semibold text-gray-900 mb-2">Large deployment size</h3>
          <p className="text-gray-600">
            Use standalone output mode and ensure you're not including unnecessary files. 
            Check your <code className="bg-gray-100 px-2 py-1 rounded text-sm">.spinignore</code> file.
          </p>
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-6 not-prose mt-8">
        <h3 className="text-lg font-semibold text-green-900 mb-2">Pro Tips</h3>
        <ul className="space-y-2 text-green-800">
          <li className="flex items-start">
            <Zap className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            <span>Use <code className="bg-green-100 px-2 py-1 rounded text-sm">output: 'standalone'</code> for 90% smaller deployments</span>
          </li>
          <li className="flex items-start">
            <Zap className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            <span>Enable experimental features safely - SpinForge supports the latest Next.js</span>
          </li>
          <li className="flex items-start">
            <Zap className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            <span>Use ISR for the best balance of performance and freshness</span>
          </li>
        </ul>
      </div>
    </div>
  );
}