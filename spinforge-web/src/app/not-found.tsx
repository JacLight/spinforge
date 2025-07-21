import Link from "next/link";
import { Home, ArrowLeft, Search, FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center">
        {/* 404 Icon */}
        <div className="mb-8">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-indigo-200 rounded-full blur-3xl opacity-30"></div>
            <FileQuestion className="h-32 w-32 text-indigo-600 relative" />
          </div>
        </div>

        {/* Error Message */}
        <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Page not found</h2>
        <p className="text-gray-600 mb-8 max-w-md mx-auto">
          Sorry, we couldn't find the page you're looking for. It might have been moved, 
          deleted, or maybe it never existed.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Home className="h-5 w-5 mr-2" />
            Go to Homepage
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center px-6 py-3 bg-white text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <Search className="h-5 w-5 mr-2" />
            Browse Documentation
          </Link>
        </div>

        {/* Quick Links */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-600 mb-4">Popular pages</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <Link href="/dashboard" className="text-indigo-600 hover:text-indigo-700">
              Dashboard
            </Link>
            <Link href="/pricing" className="text-indigo-600 hover:text-indigo-700">
              Pricing
            </Link>
            <Link href="/docs/quick-start" className="text-indigo-600 hover:text-indigo-700">
              Quick Start
            </Link>
            <Link href="/docs/cli/overview" className="text-indigo-600 hover:text-indigo-700">
              CLI Reference
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}