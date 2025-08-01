import { Terminal, FolderOpen, Rocket } from "lucide-react";

export default function CLIDeployFolderPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">deploy-folder</h1>
      <p className="text-lg text-gray-600 mb-8">
        Deploy a specific folder containing your pre-built application. This command is useful when 
        your build output is in a different directory than your project root.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Basic Usage</h2>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <div className="flex items-center mb-4">
          <Terminal className="h-5 w-5 text-gray-400 mr-2" />
          <span className="text-gray-400 text-sm">Terminal</span>
        </div>
        <pre className="text-gray-100 overflow-x-auto"><code>{`# Deploy a specific folder
spinforge-cli deploy-folder ./dist

# Deploy with custom name
spinforge-cli deploy-folder ./build --name production-app

# Deploy from nested directory
spinforge-cli deploy-folder ./packages/web/dist`}</code></pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">When to Use deploy-folder</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 not-prose">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="font-semibold text-green-900 mb-3">Use deploy-folder when:</h3>
          <ul className="space-y-2 text-green-800">
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-green-600 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
              <span>Your build output is in a specific directory</span>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-green-600 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
              <span>You have multiple apps in a monorepo</span>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-green-600 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
              <span>You want to deploy only part of your project</span>
            </li>
          </ul>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-3">Use regular deploy when:</h3>
          <ul className="space-y-2 text-blue-800">
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-blue-600 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
              <span>Your project structure follows conventions</span>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-blue-600 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
              <span>You want automatic framework detection</span>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-blue-600 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
              <span>You need the build prompt feature</span>
            </li>
          </ul>
        </div>
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
                Example
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                path
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                Path to folder to deploy (required)
              </td>
              <td className="px-6 py-4 text-sm font-mono text-gray-500">
                ./dist
              </td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                --name
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                Custom deployment name
              </td>
              <td className="px-6 py-4 text-sm font-mono text-gray-500">
                --name my-app
              </td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                --env
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                Environment file to use
              </td>
              <td className="px-6 py-4 text-sm font-mono text-gray-500">
                --env .env.prod
              </td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                --region
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                Deployment region
              </td>
              <td className="px-6 py-4 text-sm font-mono text-gray-500">
                --region us-east
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Common Use Cases</h2>

      <div className="space-y-6 not-prose">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-3">Static Site Generators</h3>
          <div className="bg-gray-900 rounded-lg p-4 mb-3">
            <pre className="text-gray-100 overflow-x-auto"><code>{`# Gatsby
spinforge-cli deploy-folder ./public

# Hugo
spinforge-cli deploy-folder ./public

# Jekyll
spinforge-cli deploy-folder ./_site`}</code></pre>
          </div>
          <p className="text-gray-600 text-sm">
            Most static site generators output to a specific folder. Use deploy-folder to deploy just the built files.
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-3">Monorepo Deployments</h3>
          <div className="bg-gray-900 rounded-lg p-4 mb-3">
            <pre className="text-gray-100 overflow-x-auto"><code>{`# Deploy specific app from monorepo
spinforge-cli deploy-folder ./apps/web/dist --name web-app
spinforge-cli deploy-folder ./apps/admin/build --name admin-app

# Deploy from packages
spinforge-cli deploy-folder ./packages/docs/out --name docs-site`}</code></pre>
          </div>
          <p className="text-gray-600 text-sm">
            In monorepos, each app might build to its own directory. Deploy them separately with meaningful names.
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-3">Custom Build Outputs</h3>
          <div className="bg-gray-900 rounded-lg p-4 mb-3">
            <pre className="text-gray-100 overflow-x-auto"><code>{`# Webpack custom output
spinforge-cli deploy-folder ./webpack-dist

# Rollup bundles
spinforge-cli deploy-folder ./bundles

# Custom build script output
spinforge-cli deploy-folder ./output/production`}</code></pre>
          </div>
          <p className="text-gray-600 text-sm">
            If you have custom build tools that output to non-standard directories, deploy-folder gives you full control.
          </p>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4 mt-12">What Gets Deployed</h2>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-8 not-prose">
        <h3 className="font-semibold text-amber-900 mb-3">The deploy-folder command uploads:</h3>
        <ul className="space-y-2 text-amber-800">
          <li className="flex items-start">
            <FolderOpen className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            <span>All files and subdirectories in the specified folder</span>
          </li>
          <li className="flex items-start">
            <FolderOpen className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            <span>Respects .spinignore patterns if present in the folder</span>
          </li>
          <li className="flex items-start">
            <FolderOpen className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            <span>Maintains directory structure within the folder</span>
          </li>
        </ul>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Best Practices</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 not-prose mb-8">
        <div className="bg-gray-50 rounded-lg p-6">
          <h4 className="font-semibold text-gray-900 mb-2">✅ Do</h4>
          <ul className="space-y-1 text-sm text-gray-600">
            <li>• Deploy only built, production-ready files</li>
            <li>• Use meaningful deployment names</li>
            <li>• Verify the folder contents before deploying</li>
            <li>• Use .spinignore for large files</li>
          </ul>
        </div>
        <div className="bg-gray-50 rounded-lg p-6">
          <h4 className="font-semibold text-gray-900 mb-2">❌ Don't</h4>
          <ul className="space-y-1 text-sm text-gray-600">
            <li>• Deploy source code or unbuilt files</li>
            <li>• Include node_modules or build caches</li>
            <li>• Deploy sensitive files (.env, keys)</li>
            <li>• Use relative paths outside project</li>
          </ul>
        </div>
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6 not-prose">
        <h3 className="text-lg font-semibold text-indigo-900 mb-2">Pro Tip</h3>
        <p className="text-indigo-700 mb-3">
          Create a deployment script in your package.json for consistent deployments:
        </p>
        <div className="bg-indigo-900 text-indigo-100 p-4 rounded">
          <pre className="text-sm"><code>{`{
  "scripts": {
    "deploy": "npm run build && spinforge-cli deploy-folder ./dist --name my-app-prod"
  }
}`}</code></pre>
        </div>
      </div>
    </div>
  );
}