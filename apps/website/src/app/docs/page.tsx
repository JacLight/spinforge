/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Rocket, Zap, Shield, Cloud, Code, Package } from "lucide-react";
import Link from "next/link";

export default function DocsPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">Welcome to SpinForge</h1>
      <p className="text-xl text-gray-600 mb-8">
        SpinForge is a modern deployment platform that runs your pre-built applications with zero configuration. 
        Deploy and scale web applications instantly without managing infrastructure.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12 not-prose">
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-6 rounded-lg border border-indigo-200">
          <div className="flex items-center mb-3">
            <Zap className="h-6 w-6 text-indigo-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Quick Start</h3>
          </div>
          <p className="text-gray-600 mb-4">Get your first app deployed in under 5 minutes</p>
          <Link href="/docs/quick-start" className="text-indigo-600 hover:text-indigo-700 font-medium">
            Start deploying →
          </Link>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-lg border border-purple-200">
          <div className="flex items-center mb-3">
            <Code className="h-6 w-6 text-purple-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">CLI Reference</h3>
          </div>
          <p className="text-gray-600 mb-4">Learn all the SpinForge CLI commands</p>
          <Link href="/docs/cli/overview" className="text-purple-600 hover:text-purple-700 font-medium">
            View commands →
          </Link>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-6">Core Principles</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 not-prose">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <Package className="h-8 w-8 text-indigo-600 mb-3" />
          <h3 className="text-lg font-semibold mb-2">Pre-built Apps Only</h3>
          <p className="text-gray-600 text-sm">
            SpinForge runs your pre-built applications. Build locally with your own tools, 
            deploy the output to SpinForge.
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <Cloud className="h-8 w-8 text-indigo-600 mb-3" />
          <h3 className="text-lg font-semibold mb-2">Instant Deployment</h3>
          <p className="text-gray-600 text-sm">
            Deploy in seconds, not minutes. Your app goes live instantly with automatic 
            SSL and global CDN.
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <Shield className="h-8 w-8 text-indigo-600 mb-3" />
          <h3 className="text-lg font-semibold mb-2">Secure by Default</h3>
          <p className="text-gray-600 text-sm">
            Every deployment runs in isolation with automatic HTTPS, DDoS protection, 
            and security headers.
          </p>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-6">How It Works</h2>

      <div className="bg-gray-50 rounded-lg p-8 mb-12 not-prose">
        <ol className="space-y-4">
          <li className="flex items-start">
            <span className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">1</span>
            <div className="ml-4">
              <h4 className="font-semibold text-gray-900">Build Your Application</h4>
              <p className="text-gray-600 mt-1">Use your existing build tools (npm, yarn, pnpm) to build your application locally</p>
            </div>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">2</span>
            <div className="ml-4">
              <h4 className="font-semibold text-gray-900">Deploy with CLI</h4>
              <p className="text-gray-600 mt-1">Run <code className="bg-gray-200 px-2 py-1 rounded text-sm">spinforge-cli deploy</code> from your project directory</p>
            </div>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">3</span>
            <div className="ml-4">
              <h4 className="font-semibold text-gray-900">Go Live Instantly</h4>
              <p className="text-gray-600 mt-1">Your app is deployed to our global edge network and accessible immediately</p>
            </div>
          </li>
        </ol>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-6">Popular Frameworks</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12 not-prose">
        <Link href="/docs/frameworks/nextjs" className="bg-white p-4 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all text-center">
          <div className="text-2xl mb-2">⚛️</div>
          <h4 className="font-semibold text-gray-900">Next.js</h4>
        </Link>
        <Link href="/docs/frameworks/remix" className="bg-white p-4 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all text-center">
          <div className="text-2xl mb-2">💿</div>
          <h4 className="font-semibold text-gray-900">Remix</h4>
        </Link>
        <Link href="/docs/frameworks/express" className="bg-white p-4 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all text-center">
          <div className="text-2xl mb-2">🚂</div>
          <h4 className="font-semibold text-gray-900">Express</h4>
        </Link>
        <Link href="/docs/frameworks/static" className="bg-white p-4 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all text-center">
          <div className="text-2xl mb-2">📄</div>
          <h4 className="font-semibold text-gray-900">Static</h4>
        </Link>
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6 not-prose">
        <h3 className="text-lg font-semibold text-indigo-900 mb-2">Ready to deploy?</h3>
        <p className="text-indigo-700 mb-4">
          Install the SpinForge CLI and deploy your first application in minutes.
        </p>
        <div className="flex gap-4">
          <Link href="/docs/installation" className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700">
            Get Started
          </Link>
          <Link href="/docs/quick-start" className="inline-flex items-center px-4 py-2 bg-white text-indigo-600 font-medium rounded-md border border-indigo-300 hover:bg-indigo-50">
            View Quick Start
          </Link>
        </div>
      </div>
    </div>
  );
}