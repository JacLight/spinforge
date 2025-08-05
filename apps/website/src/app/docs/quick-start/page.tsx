/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Terminal, CheckCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function QuickStartPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Quick Start</h1>
      <p className="text-lg text-gray-600 mb-8">
        Deploy your first application to SpinForge in under 5 minutes. This guide will walk you through 
        installing the CLI, building your app, and deploying it.
      </p>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8 not-prose">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">Prerequisites</h3>
        <ul className="space-y-2 text-blue-800">
          <li className="flex items-start">
            <CheckCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            <span>Node.js 18+ installed on your machine</span>
          </li>
          <li className="flex items-start">
            <CheckCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            <span>A SpinForge account (sign up at <Link href="/signup" className="underline">spinforge.com/signup</Link>)</span>
          </li>
          <li className="flex items-start">
            <CheckCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            <span>A pre-built application ready to deploy</span>
          </li>
        </ul>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Step 1: Install the SpinForge CLI</h2>

      <p className="mb-4">Install the SpinForge CLI globally using npm, yarn, or pnpm:</p>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <div className="flex items-center mb-4">
          <Terminal className="h-5 w-5 text-gray-400 mr-2" />
          <span className="text-gray-400 text-sm">Terminal</span>
        </div>
        <pre className="text-gray-100 overflow-x-auto"><code className="language-bash"># Using npm
npm install -g @spinforge/cli

# Using yarn
yarn global add @spinforge/cli

# Using pnpm
pnpm add -g @spinforge/cli</code></pre>
      </div>

      <p className="mb-8">Verify the installation:</p>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto"><code className="language-bash">spinforge-cli --version</code></pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Step 2: Login to SpinForge</h2>

      <p className="mb-4">Authenticate with your SpinForge account:</p>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto"><code className="language-bash">spinforge-cli auth login</code></pre>
      </div>

      <p className="mb-8">This will open your browser for authentication. Once logged in, you can close the browser and return to the terminal.</p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Step 3: Build Your Application</h2>

      <p className="mb-4">SpinForge deploys pre-built applications. Build your app using your project's build command:</p>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto"><code className="language-bash"># For Next.js
npm run build

# For Remix
npm run build

# For other frameworks
npm run build  # or your custom build command</code></pre>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-8 not-prose">
        <h4 className="font-semibold text-amber-900 mb-2">Important: Pre-built Apps Only</h4>
        <p className="text-amber-800">
          SpinForge does not build your application. You must build it locally using your own build tools. 
          SpinForge only deploys the pre-built output.
        </p>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Step 4: Deploy Your Application</h2>

      <p className="mb-4">From your project directory, run the deploy command:</p>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto"><code className="language-bash"># Deploy the current directory
spinforge-cli deploy

# Or deploy a specific folder
spinforge-cli deploy-folder ./dist

# Deploy without prompting to build (if already built)
spinforge-cli deploy --no-build</code></pre>
      </div>

      <p className="mb-8">The CLI will:</p>

      <ol className="list-decimal list-inside space-y-2 mb-8">
        <li>Check if your app needs building (if package.json has a build script)</li>
        <li>Upload your built application to SpinForge</li>
        <li>Create a deployment and assign a unique URL</li>
        <li>Return your deployment URL</li>
      </ol>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Step 5: View Your Deployment</h2>

      <p className="mb-4">After deployment, you'll see output like this:</p>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto"><code className="language-bash">✅ Deployment successful!

🚀 Your app is live at: https://my-app-abc123.spinforge.app

View logs: spinforge-cli logs my-app-abc123
Manage deployment: https://spinforge.com/dashboard/deployments</code></pre>
      </div>

      <p className="mb-8">Your application is now live! Visit the URL to see your deployed app.</p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">What's Next?</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 not-prose mb-8">
        <Link href="/docs/deployment/custom-domains" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
            Custom Domains
            <ArrowRight className="h-4 w-4 ml-2" />
          </h3>
          <p className="text-gray-600 text-sm">
            Learn how to connect your own domain to your deployment
          </p>
        </Link>

        <Link href="/docs/deployment/env-vars" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
            Environment Variables
            <ArrowRight className="h-4 w-4 ml-2" />
          </h3>
          <p className="text-gray-600 text-sm">
            Configure environment variables for your deployments
          </p>
        </Link>

        <Link href="/docs/cli/logs" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
            View Logs
            <ArrowRight className="h-4 w-4 ml-2" />
          </h3>
          <p className="text-gray-600 text-sm">
            Monitor your application with real-time logs
          </p>
        </Link>

        <Link href="/docs/deployment/scaling" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
            Scaling
            <ArrowRight className="h-4 w-4 ml-2" />
          </h3>
          <p className="text-gray-600 text-sm">
            Scale your application to handle more traffic
          </p>
        </Link>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-6 not-prose">
        <h3 className="text-lg font-semibold text-green-900 mb-2">Need Help?</h3>
        <p className="text-green-800 mb-4">
          If you run into any issues, check out our troubleshooting guide or join our community.
        </p>
        <div className="flex gap-4">
          <Link href="/docs/troubleshooting" className="text-green-700 underline hover:text-green-800">
            Troubleshooting Guide
          </Link>
          <a href="https://discord.gg/spinforge" className="text-green-700 underline hover:text-green-800">
            Join Discord
          </a>
        </div>
      </div>
    </div>
  );
}