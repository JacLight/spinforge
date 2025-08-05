/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Terminal, Rocket, Package, Settings, AlertCircle } from "lucide-react";

export default function CLIDeployPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">deploy</h1>
      <p className="text-lg text-gray-600 mb-8">
        Deploy your pre-built application to SpinForge. The deploy command analyzes your project, 
        optionally builds it using your local build tools, and deploys it to our global network.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Basic Usage</h2>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <div className="flex items-center mb-4">
          <Terminal className="h-5 w-5 text-gray-400 mr-2" />
          <span className="text-gray-400 text-sm">Terminal</span>
        </div>
        <pre className="text-gray-100 overflow-x-auto"><code>{`# Deploy from current directory
spinforge-cli deploy

# Deploy without building first
spinforge-cli deploy --no-build

# Deploy with a custom name
spinforge-cli deploy --name my-awesome-app`}</code></pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">How It Works</h2>

      <div className="bg-gray-50 rounded-lg p-6 mb-8 not-prose">
        <ol className="space-y-4">
          <li className="flex items-start">
            <span className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">1</span>
            <div className="ml-4">
              <h4 className="font-semibold text-gray-900">Project Analysis</h4>
              <p className="text-gray-600 mt-1">Detects your framework and build configuration</p>
            </div>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">2</span>
            <div className="ml-4">
              <h4 className="font-semibold text-gray-900">Build Check</h4>
              <p className="text-gray-600 mt-1">If package.json has a build script, prompts to run it (unless --no-build)</p>
            </div>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">3</span>
            <div className="ml-4">
              <h4 className="font-semibold text-gray-900">Upload</h4>
              <p className="text-gray-600 mt-1">Packages and uploads your built application</p>
            </div>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">4</span>
            <div className="ml-4">
              <h4 className="font-semibold text-gray-900">Deploy</h4>
              <p className="text-gray-600 mt-1">Creates deployment and returns your live URL</p>
            </div>
          </li>
        </ol>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Options</h2>

      <div className="overflow-x-auto mb-8">
        <table className="min-w-full divide-y divide-gray-200 not-prose">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Option
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Default
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                --name &lt;name&gt;
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                Custom deployment name
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                Directory name
              </td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                --no-build
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                Skip the build step
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                false
              </td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                --env &lt;file&gt;
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                Path to .env file
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                .env.production
              </td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                --region &lt;region&gt;
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                Deployment region
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                auto
              </td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                --prod
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                Deploy to production
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                false
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Examples</h2>

      <div className="space-y-6 not-prose">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-3">Deploy a Next.js App</h3>
          <div className="bg-gray-900 rounded-lg p-4 mb-3">
            <pre className="text-gray-100 overflow-x-auto"><code>{`# Build and deploy
spinforge-cli deploy

# If already built
spinforge-cli deploy --no-build`}</code></pre>
          </div>
          <p className="text-gray-600 text-sm">
            The CLI detects Next.js and uploads the .next directory along with public assets.
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-3">Deploy with Environment Variables</h3>
          <div className="bg-gray-900 rounded-lg p-4 mb-3">
            <pre className="text-gray-100 overflow-x-auto"><code>{`# Use specific env file
spinforge-cli deploy --env .env.staging

# Or set directly in dashboard after deployment`}</code></pre>
          </div>
          <p className="text-gray-600 text-sm">
            Runtime environment variables can be configured in the dashboard after deployment.
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-3">CI/CD Deployment</h3>
          <div className="bg-gray-900 rounded-lg p-4 mb-3">
            <pre className="text-gray-100 overflow-x-auto"><code>{`# In your CI pipeline, after building
export SPINFORGE_TOKEN=your-api-token
spinforge-cli deploy --no-build --prod`}</code></pre>
          </div>
          <p className="text-gray-600 text-sm">
            Use API tokens for automated deployments. Always use --no-build in CI after building.
          </p>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4 mt-12">Framework Detection</h2>

      <p className="mb-4">The CLI automatically detects these frameworks:</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 not-prose mb-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">Next.js</h4>
          <p className="text-blue-800 text-sm">Looks for .next directory and next.config.js</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h4 className="font-semibold text-purple-900 mb-2">Remix</h4>
          <p className="text-purple-800 text-sm">Looks for remix.config.js and build directory</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-semibold text-green-900 mb-2">Express/Node.js</h4>
          <p className="text-green-800 text-sm">Looks for server.js or app.js with Express imports</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h4 className="font-semibold text-amber-900 mb-2">Static Sites</h4>
          <p className="text-amber-800 text-sm">HTML files in public, dist, or build directories</p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 not-prose">
        <h3 className="text-lg font-semibold text-amber-900 mb-2 flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          Important: Pre-built Applications Only
        </h3>
        <p className="text-amber-800">
          SpinForge only deploys pre-built applications. If your project needs building, the CLI 
          can help by running your build script locally, but SpinForge itself never builds your code.
        </p>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4 mt-12">Troubleshooting</h2>

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Deployment fails with "No built output found"</h3>
          <p className="text-gray-600 mb-2">
            Make sure you've built your application first. Run your build command (e.g., <code className="bg-gray-100 px-2 py-1 rounded">npm run build</code>) 
            before deploying, or let the CLI do it for you by not using <code className="bg-gray-100 px-2 py-1 rounded">--no-build</code>.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Large deployment size</h3>
          <p className="text-gray-600 mb-2">
            Exclude unnecessary files by creating a <code className="bg-gray-100 px-2 py-1 rounded">.spinignore</code> file:
          </p>
          <div className="bg-gray-900 rounded-lg p-4 not-prose">
            <pre className="text-gray-100 text-sm"><code>{`# .spinignore
node_modules
.git
*.log
.env*
coverage
.next/cache`}</code></pre>
          </div>
        </div>
      </div>
    </div>
  );
}