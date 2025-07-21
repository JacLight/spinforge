import { Package, GitBranch, Wrench, CheckCircle, XCircle, AlertCircle } from "lucide-react";

export default function PreBuiltAppsPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Pre-built Applications</h1>
      <p className="text-lg text-gray-600 mb-8">
        SpinForge deploys pre-built applications. This fundamental design decision enables faster deployments, 
        gives you complete control over your build process, and allows us to focus on running applications efficiently.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Why Pre-built?</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 not-prose">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="font-semibold text-green-900 mb-3 flex items-center">
            <CheckCircle className="h-5 w-5 mr-2" />
            Your Build, Your Rules
          </h3>
          <p className="text-green-800 text-sm">
            Use any build tool, any version, any configuration. No need to adapt to platform-specific 
            build requirements or limitations.
          </p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="font-semibold text-green-900 mb-3 flex items-center">
            <CheckCircle className="h-5 w-5 mr-2" />
            Instant Deployments
          </h3>
          <p className="text-green-800 text-sm">
            Skip the build step during deployment. Your app goes live in seconds, not minutes.
          </p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="font-semibold text-green-900 mb-3 flex items-center">
            <CheckCircle className="h-5 w-5 mr-2" />
            Predictable Results
          </h3>
          <p className="text-green-800 text-sm">
            What you build locally is exactly what runs in production. No surprises from 
            platform-specific build environments.
          </p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="font-semibold text-green-900 mb-3 flex items-center">
            <CheckCircle className="h-5 w-5 mr-2" />
            Cost Efficient
          </h3>
          <p className="text-green-800 text-sm">
            You're not paying for build minutes. Use your own machines or CI/CD infrastructure 
            to build applications.
          </p>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">How It Works</h2>

      <div className="bg-gray-50 rounded-lg p-8 mb-8 not-prose">
        <h3 className="font-semibold text-gray-900 mb-4">Traditional Platform</h3>
        <div className="flex items-center space-x-4 mb-6">
          <div className="bg-white p-3 rounded border border-gray-300 text-center flex-1">
            <GitBranch className="h-6 w-6 mx-auto mb-1 text-gray-600" />
            <p className="text-sm">Source Code</p>
          </div>
          <div className="text-gray-400">→</div>
          <div className="bg-red-100 p-3 rounded border border-red-300 text-center flex-1">
            <Wrench className="h-6 w-6 mx-auto mb-1 text-red-600" />
            <p className="text-sm text-red-700">Platform Builds</p>
          </div>
          <div className="text-gray-400">→</div>
          <div className="bg-white p-3 rounded border border-gray-300 text-center flex-1">
            <Package className="h-6 w-6 mx-auto mb-1 text-gray-600" />
            <p className="text-sm">Deploy</p>
          </div>
        </div>

        <h3 className="font-semibold text-gray-900 mb-4">SpinForge</h3>
        <div className="flex items-center space-x-4">
          <div className="bg-white p-3 rounded border border-gray-300 text-center flex-1">
            <GitBranch className="h-6 w-6 mx-auto mb-1 text-gray-600" />
            <p className="text-sm">Source Code</p>
          </div>
          <div className="text-gray-400">→</div>
          <div className="bg-green-100 p-3 rounded border border-green-300 text-center flex-1">
            <Wrench className="h-6 w-6 mx-auto mb-1 text-green-600" />
            <p className="text-sm text-green-700">You Build</p>
          </div>
          <div className="text-gray-400">→</div>
          <div className="bg-indigo-100 p-3 rounded border border-indigo-300 text-center flex-1">
            <Package className="h-6 w-6 mx-auto mb-1 text-indigo-600" />
            <p className="text-sm text-indigo-700">SpinForge Deploys</p>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">What Counts as "Pre-built"?</h2>

      <p className="mb-4">A pre-built application is one that's ready to run without additional compilation or building:</p>

      <div className="space-y-4 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-4 not-prose">
          <h4 className="font-semibold text-gray-900 mb-2">Next.js</h4>
          <p className="text-gray-600 text-sm mb-2">After running <code className="bg-gray-100 px-2 py-1 rounded">npm run build</code>:</p>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>✓ The <code className="bg-gray-100 px-1 rounded">.next</code> directory</li>
            <li>✓ The <code className="bg-gray-100 px-1 rounded">public</code> directory</li>
            <li>✓ Your <code className="bg-gray-100 px-1 rounded">package.json</code></li>
          </ul>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 not-prose">
          <h4 className="font-semibold text-gray-900 mb-2">Static Sites</h4>
          <p className="text-gray-600 text-sm mb-2">After your build process:</p>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>✓ HTML, CSS, and JavaScript files</li>
            <li>✓ Images and other assets</li>
            <li>✓ No server-side rendering needed</li>
          </ul>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 not-prose">
          <h4 className="font-semibold text-gray-900 mb-2">Node.js Applications</h4>
          <p className="text-gray-600 text-sm mb-2">After building/transpiling:</p>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>✓ Compiled JavaScript files</li>
            <li>✓ <code className="bg-gray-100 px-1 rounded">node_modules</code> (or bundled dependencies)</li>
            <li>✓ Ready to run with <code className="bg-gray-100 px-1 rounded">node</code></li>
          </ul>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Build Locally, Deploy Globally</h2>

      <p className="mb-4">Here's a typical workflow with SpinForge:</p>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <div className="flex items-center mb-4">
          <div className="text-gray-400 text-sm">Terminal</div>
        </div>
        <pre className="text-gray-100 overflow-x-auto"><code>{`# 1. Build your application locally
npm run build

# 2. Test the production build
npm run start

# 3. Deploy to SpinForge
spinforge-cli deploy

# That's it! Your app is live`}</code></pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">CI/CD Integration</h2>

      <p className="mb-4">
        SpinForge works seamlessly with your existing CI/CD pipeline. Build in your CI environment, 
        then deploy to SpinForge:
      </p>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <div className="flex items-center mb-4">
          <div className="text-gray-400 text-sm">GitHub Actions Example</div>
        </div>
        <pre className="text-gray-100 overflow-x-auto"><code>{`name: Deploy to SpinForge

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build application
        run: npm run build
        
      - name: Deploy to SpinForge
        run: |
          npm install -g @spinforge/cli
          spinforge-cli deploy --no-build
        env:
          SPINFORGE_TOKEN: \${{ secrets.SPINFORGE_TOKEN }}`}</code></pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Common Questions</h2>

      <div className="space-y-6 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6 not-prose">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
            <AlertCircle className="h-5 w-5 text-amber-500 mr-2" />
            What if my app needs environment variables at build time?
          </h3>
          <p className="text-gray-600">
            Build your app locally with the environment variables you need. SpinForge handles 
            runtime environment variables separately for security.
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 not-prose">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
            <AlertCircle className="h-5 w-5 text-amber-500 mr-2" />
            Can I use private npm packages?
          </h3>
          <p className="text-gray-600">
            Yes! Build your app with private packages locally, then deploy the built result. 
            SpinForge never needs access to your private registries.
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 not-prose">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
            <AlertCircle className="h-5 w-5 text-amber-500 mr-2" />
            What about serverless functions?
          </h3>
          <p className="text-gray-600">
            SpinForge runs full applications, not individual functions. Package your functions 
            as part of your application (like Next.js API routes).
          </p>
        </div>
      </div>

      <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8 not-prose">
        <h3 className="text-lg font-semibold text-red-900 mb-2">What SpinForge Won't Deploy</h3>
        <ul className="space-y-2 text-red-800">
          <li className="flex items-start">
            <XCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            <span>Source code that needs compilation (TypeScript, JSX, etc.)</span>
          </li>
          <li className="flex items-start">
            <XCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            <span>Applications that require build-time code generation</span>
          </li>
          <li className="flex items-start">
            <XCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            <span>Projects without a build step that need one</span>
          </li>
        </ul>
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6 not-prose">
        <h3 className="text-lg font-semibold text-indigo-900 mb-2">Ready to deploy?</h3>
        <p className="text-indigo-700 mb-4">
          Now that you understand pre-built applications, let's deploy your first app.
        </p>
        <a href="/docs/quick-start" className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700">
          Quick Start Guide →
        </a>
      </div>
    </div>
  );
}