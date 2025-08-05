/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Terminal, Package, CheckCircle, AlertCircle } from "lucide-react";

export default function InstallationPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Installation</h1>
      <p className="text-lg text-gray-600 mb-8">
        Install the SpinForge CLI to deploy applications from your terminal. The CLI is available 
        for macOS, Linux, and Windows.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">System Requirements</h2>

      <div className="bg-gray-50 rounded-lg p-6 mb-8 not-prose">
        <ul className="space-y-3">
          <li className="flex items-start">
            <CheckCircle className="h-5 w-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
            <div>
              <strong className="text-gray-900">Node.js 18.0 or higher</strong>
              <p className="text-gray-600 text-sm mt-1">Required for running the CLI</p>
            </div>
          </li>
          <li className="flex items-start">
            <CheckCircle className="h-5 w-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
            <div>
              <strong className="text-gray-900">npm, yarn, or pnpm</strong>
              <p className="text-gray-600 text-sm mt-1">Package manager for installation</p>
            </div>
          </li>
          <li className="flex items-start">
            <CheckCircle className="h-5 w-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
            <div>
              <strong className="text-gray-900">macOS, Linux, or Windows</strong>
              <p className="text-gray-600 text-sm mt-1">Supported operating systems</p>
            </div>
          </li>
        </ul>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Install via npm</h2>

      <p className="mb-4">The recommended way to install the SpinForge CLI is via npm:</p>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <div className="flex items-center mb-4">
          <Terminal className="h-5 w-5 text-gray-400 mr-2" />
          <span className="text-gray-400 text-sm">Terminal</span>
        </div>
        <pre className="text-gray-100 overflow-x-auto"><code>npm install -g @spinforge/cli</code></pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Install via yarn</h2>

      <p className="mb-4">If you prefer yarn:</p>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto"><code>yarn global add @spinforge/cli</code></pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Install via pnpm</h2>

      <p className="mb-4">For pnpm users:</p>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto"><code>pnpm add -g @spinforge/cli</code></pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Verify Installation</h2>

      <p className="mb-4">After installation, verify that the CLI is installed correctly:</p>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto"><code>spinforge-cli --version</code></pre>
      </div>

      <p className="mb-8">You should see the version number of the installed CLI.</p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Update the CLI</h2>

      <p className="mb-4">To update to the latest version:</p>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto"><code># Using npm
npm update -g @spinforge/cli

# Using yarn
yarn global upgrade @spinforge/cli

# Using pnpm
pnpm update -g @spinforge/cli</code></pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Troubleshooting</h2>

      <div className="space-y-6 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6 not-prose">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
            <AlertCircle className="h-5 w-5 text-amber-500 mr-2" />
            Permission Errors
          </h3>
          <p className="text-gray-600 mb-3">
            If you encounter permission errors during installation, you may need to use sudo (not recommended) 
            or configure npm to use a different directory.
          </p>
          <div className="bg-gray-50 rounded p-4">
            <p className="text-sm text-gray-700 mb-2">Configure npm to use a different directory:</p>
            <pre className="text-sm bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto"><code>{`mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc`}</code></pre>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 not-prose">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
            <AlertCircle className="h-5 w-5 text-amber-500 mr-2" />
            Command Not Found
          </h3>
          <p className="text-gray-600 mb-3">
            If you get a "command not found" error after installation, make sure your PATH includes 
            the npm global bin directory.
          </p>
          <div className="bg-gray-50 rounded p-4">
            <p className="text-sm text-gray-700 mb-2">Check your npm bin location:</p>
            <pre className="text-sm bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto"><code>npm bin -g</code></pre>
            <p className="text-sm text-gray-700 mt-3">
              Add this directory to your PATH in your shell configuration file (~/.bashrc, ~/.zshrc, etc.)
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 not-prose">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
            <AlertCircle className="h-5 w-5 text-amber-500 mr-2" />
            Node.js Version Too Old
          </h3>
          <p className="text-gray-600 mb-3">
            SpinForge CLI requires Node.js 18 or higher. Check your Node.js version:
          </p>
          <div className="bg-gray-50 rounded p-4">
            <pre className="text-sm bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto"><code>node --version</code></pre>
            <p className="text-sm text-gray-700 mt-3">
              If you need to update Node.js, we recommend using <a href="https://github.com/nvm-sh/nvm" className="text-indigo-600 underline">nvm</a> or 
              downloading from <a href="https://nodejs.org" className="text-indigo-600 underline">nodejs.org</a>.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-6 not-prose">
        <h3 className="text-lg font-semibold text-green-900 mb-2">Installation Complete!</h3>
        <p className="text-green-800 mb-4">
          Now that you have the CLI installed, you're ready to deploy your first application.
        </p>
        <a href="/docs/quick-start" className="inline-flex items-center px-4 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700">
          Continue to Quick Start →
        </a>
      </div>
    </div>
  );
}