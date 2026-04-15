/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import Link from "next/link";
import { Rocket, Globe, Container, Shield, Plug, LifeBuoy, ArrowRight, Upload, Code } from "lucide-react";

export default function DocsHomePage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">SpinForge Documentation</h1>
      <p className="text-lg text-gray-600 mb-8">
        SpinForge hosts static sites, reverse proxies, Docker containers, and load balancers behind a
        single HTTP API and an admin UI. There is no CLI, no build step on our side, and no opt-in for
        HTTPS. You ship an artifact or an image, we route traffic to it.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 not-prose mb-10">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center mb-2">
            <Globe className="h-5 w-5 text-indigo-600 mr-2" />
            <h3 className="font-semibold text-gray-900 mb-0">Public API</h3>
          </div>
          <p className="text-sm text-gray-600 mb-0">
            <code className="bg-gray-100 px-2 py-0.5 rounded">https://api.spinforge.dev</code>
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center mb-2">
            <Shield className="h-5 w-5 text-indigo-600 mr-2" />
            <h3 className="font-semibold text-gray-900 mb-0">Admin UI</h3>
          </div>
          <p className="text-sm text-gray-600 mb-0">
            <code className="bg-gray-100 px-2 py-0.5 rounded">https://admin.spinforge.dev</code>
          </p>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Start here</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 not-prose mb-10">
        <Link href="/docs/quick-start" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
          <div className="flex items-center mb-2">
            <Rocket className="h-5 w-5 text-indigo-600 mr-2" />
            <h3 className="font-semibold text-gray-900 mb-0">Quick Start</h3>
          </div>
          <p className="text-sm text-gray-600 mb-0">Deploy a hello-world static site in under 5 minutes.</p>
        </Link>
        <Link href="/docs/concepts/how-it-works" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
          <div className="flex items-center mb-2">
            <Code className="h-5 w-5 text-indigo-600 mr-2" />
            <h3 className="font-semibold text-gray-900 mb-0">How it works</h3>
          </div>
          <p className="text-sm text-gray-600 mb-0">OpenResty at the edge, Redis for routing, Nomad for containers.</p>
        </Link>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Deployment guides</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 not-prose mb-10">
        <Link href="/docs/deployment/static-sites" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
          <div className="flex items-center mb-2">
            <Upload className="h-5 w-5 text-indigo-600 mr-2" />
            <h3 className="font-semibold text-gray-900 mb-0">Static Sites</h3>
          </div>
          <p className="text-sm text-gray-600 mb-0">Upload a zip of pre-built assets.</p>
        </Link>
        <Link href="/docs/deployment/containers" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
          <div className="flex items-center mb-2">
            <Container className="h-5 w-5 text-indigo-600 mr-2" />
            <h3 className="font-semibold text-gray-900 mb-0">Containers</h3>
          </div>
          <p className="text-sm text-gray-600 mb-0">Run a Docker image on our Nomad cluster.</p>
        </Link>
        <Link href="/docs/deployment/proxy" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
          <div className="flex items-center mb-2">
            <Globe className="h-5 w-5 text-indigo-600 mr-2" />
            <h3 className="font-semibold text-gray-900 mb-0">Proxy & Load Balancer</h3>
          </div>
          <p className="text-sm text-gray-600 mb-0">Route to external origins or weighted backend pools.</p>
        </Link>
        <Link href="/docs/deployment/custom-domains" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
          <div className="flex items-center mb-2">
            <Shield className="h-5 w-5 text-indigo-600 mr-2" />
            <h3 className="font-semibold text-gray-900 mb-0">Custom Domains & SSL</h3>
          </div>
          <p className="text-sm text-gray-600 mb-0">Bring your own domain. Let&apos;s Encrypt is automatic.</p>
        </Link>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">For platform partners</h2>
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6 mb-10 not-prose">
        <div className="flex items-center mb-2">
          <Plug className="h-5 w-5 text-indigo-600 mr-2" />
          <h3 className="font-semibold text-indigo-900 mb-0">Resell SpinForge to your users</h3>
        </div>
        <p className="text-sm text-indigo-900 mb-3">
          One exchange call turns an opaque token from your product into a SpinForge customer session,
          and optionally upserts a site in the same request.
        </p>
        <Link href="/docs/partners" className="text-indigo-700 underline text-sm">
          Read the partner integration guide
        </Link>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">API reference</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 not-prose mb-10">
        <Link href="/docs/api" className="text-indigo-600 hover:text-indigo-800 flex items-center">
          API Overview <ArrowRight className="h-3 w-3 ml-1" />
        </Link>
        <Link href="/docs/api/authentication" className="text-indigo-600 hover:text-indigo-800 flex items-center">
          Authentication <ArrowRight className="h-3 w-3 ml-1" />
        </Link>
        <Link href="/docs/api/sites" className="text-indigo-600 hover:text-indigo-800 flex items-center">
          Sites <ArrowRight className="h-3 w-3 ml-1" />
        </Link>
        <Link href="/docs/api/containers" className="text-indigo-600 hover:text-indigo-800 flex items-center">
          Containers <ArrowRight className="h-3 w-3 ml-1" />
        </Link>
        <Link href="/docs/api/certificates" className="text-indigo-600 hover:text-indigo-800 flex items-center">
          Certificates <ArrowRight className="h-3 w-3 ml-1" />
        </Link>
        <Link href="/docs/api/health" className="text-indigo-600 hover:text-indigo-800 flex items-center">
          Health <ArrowRight className="h-3 w-3 ml-1" />
        </Link>
        <Link href="/docs/api/metrics" className="text-indigo-600 hover:text-indigo-800 flex items-center">
          Metrics <ArrowRight className="h-3 w-3 ml-1" />
        </Link>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 not-prose">
        <div className="flex items-center mb-2">
          <LifeBuoy className="h-5 w-5 text-gray-600 mr-2" />
          <h3 className="font-semibold text-gray-900 mb-0">Stuck?</h3>
        </div>
        <p className="text-sm text-gray-600 mb-2">
          Most deploy problems fall into a handful of patterns. Our troubleshooting guide covers them.
        </p>
        <Link href="/docs/troubleshooting" className="text-indigo-600 underline text-sm">
          Troubleshooting
        </Link>
      </div>
    </div>
  );
}
