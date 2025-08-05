/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import Link from "next/link";
import { 
  Rocket, 
  Zap, 
  Shield, 
  Globe, 
  Terminal,
  ArrowRight,
  CheckCircle
} from "lucide-react";

export default function HomePage() {
  const features = [
    {
      icon: Zap,
      title: "Lightning Fast Deployments",
      description: "Deploy your applications in seconds with our optimized build pipeline"
    },
    {
      icon: Shield,
      title: "Enterprise Security",
      description: "Isolated containers and secure networking for each deployment"
    },
    {
      icon: Globe,
      title: "Global CDN",
      description: "Serve your applications from edge locations worldwide"
    },
    {
      icon: Terminal,
      title: "Developer Friendly",
      description: "CLI tools and APIs for seamless integration with your workflow"
    }
  ];

  const frameworks = [
    { name: "Next.js", logo: "⚛️" },
    { name: "Remix", logo: "💿" },
    { name: "Express", logo: "🚂" },
    { name: "Static Sites", logo: "📄" },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Rocket className="h-8 w-8 text-indigo-600" />
              <span className="ml-2 text-xl font-semibold">SpinForge</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/docs" className="text-gray-700 hover:text-gray-900">
                Documentation
              </Link>
              <Link href="/pricing" className="text-gray-700 hover:text-gray-900">
                Pricing
              </Link>
              <Link
                href="/login"
                className="text-gray-700 hover:text-gray-900"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-6xl font-bold text-gray-900 mb-6">
            Deploy Applications
            <br />
            <span className="text-indigo-600">In Seconds</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            SpinForge is a modern application hosting platform that makes deployment simple, 
            fast, and scalable. Deploy from Git, CLI, or drag & drop.
          </p>
          <div className="flex justify-center space-x-4">
            <Link
              href="/signup"
              className="bg-indigo-600 text-white px-6 py-3 rounded-md hover:bg-indigo-700 flex items-center"
            >
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <Link
              href="/demo"
              className="border border-gray-300 text-gray-700 px-6 py-3 rounded-md hover:bg-gray-50"
            >
              View Demo
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            Everything you need to ship faster
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="bg-white p-6 rounded-lg shadow">
                <feature.icon className="h-10 w-10 text-indigo-600 mb-4" />
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Frameworks */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Works with your favorite frameworks
          </h2>
          <p className="text-gray-600 mb-12">
            Automatic detection and optimization for popular frameworks
          </p>
          <div className="flex justify-center space-x-8">
            {frameworks.map((framework, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl mb-2">{framework.logo}</div>
                <p className="text-sm font-medium">{framework.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CLI Example */}
      <section className="py-20 bg-gray-900 text-white">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            Deploy with a single command
          </h2>
          <div className="bg-gray-800 rounded-lg p-6 font-mono text-sm">
            <div className="mb-4">
              <span className="text-gray-400"># Install SpinForge CLI</span>
              <br />
              <span className="text-green-400">$</span> npm install -g @spinforge/cli
            </div>
            <div className="mb-4">
              <span className="text-gray-400"># Login to your account</span>
              <br />
              <span className="text-green-400">$</span> spinforge login
            </div>
            <div>
              <span className="text-gray-400"># Deploy your application</span>
              <br />
              <span className="text-green-400">$</span> spinforge deploy-folder ./my-app
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to deploy your first app?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Join thousands of developers who deploy with SpinForge
          </p>
          <Link
            href="/signup"
            className="bg-indigo-600 text-white px-8 py-4 rounded-md text-lg hover:bg-indigo-700 inline-flex items-center"
          >
            Get Started for Free
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
          <p className="mt-4 text-sm text-gray-500">
            No credit card required • Free tier available
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Rocket className="h-6 w-6 text-indigo-600" />
              <span className="ml-2 font-semibold">SpinForge</span>
            </div>
            <div className="flex space-x-6 text-sm text-gray-600">
              <Link href="/docs" className="hover:text-gray-900">Documentation</Link>
              <Link href="/pricing" className="hover:text-gray-900">Pricing</Link>
              <Link href="/privacy" className="hover:text-gray-900">Privacy</Link>
              <Link href="/terms" className="hover:text-gray-900">Terms</Link>
            </div>
          </div>
          <div className="mt-8 text-center text-sm text-gray-500">
            © 2024 SpinForge. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
