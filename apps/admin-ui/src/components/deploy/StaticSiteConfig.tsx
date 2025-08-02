import React from 'react';
import { FolderOpen } from 'lucide-react';

interface StaticSiteConfigProps {
  indexFile: string;
  errorFile: string;
  domain: string;
  onIndexFileChange: (value: string) => void;
  onErrorFileChange: (value: string) => void;
}

export default function StaticSiteConfig({
  indexFile,
  errorFile,
  domain,
  onIndexFileChange,
  onErrorFileChange,
}: StaticSiteConfigProps) {
  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="indexFile" className="block text-sm font-medium text-gray-700 mb-2">
          Index File
        </label>
        <input
          type="text"
          id="indexFile"
          value={indexFile}
          onChange={(e) => onIndexFileChange(e.target.value)}
          className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm"
          placeholder="index.html"
        />
        <p className="mt-1 text-xs text-gray-500">
          The default file to serve when accessing a directory
        </p>
      </div>

      <div>
        <label htmlFor="errorFile" className="block text-sm font-medium text-gray-700 mb-2">
          Error File
        </label>
        <input
          type="text"
          id="errorFile"
          value={errorFile}
          onChange={(e) => onErrorFileChange(e.target.value)}
          className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm"
          placeholder="404.html"
        />
        <p className="mt-1 text-xs text-gray-500">
          The file to serve for 404 errors
        </p>
      </div>

      {/* Static Site Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <FolderOpen className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="ml-3">
            <h4 className="text-sm font-medium text-blue-900">Static File Hosting</h4>
            <p className="text-sm text-blue-700 mt-1">
              Upload your static files (HTML, CSS, JS, images) and they'll be served directly.
              Perfect for SPAs, documentation sites, and landing pages.
            </p>
            <div className="mt-2 text-xs text-blue-600">
              <p>• Automatic HTTPS with SSL certificates</p>
              <p>• Global CDN for fast delivery</p>
              <p>• Custom error pages support</p>
            </div>
            {domain && (
              <>
                <p className="text-xs text-blue-700 mt-3">
                  Files will be stored at:
                </p>
                <code className="block mt-2 text-xs bg-blue-100 px-2 py-1 rounded">
                  /hosting/data/static/{domain.replace(/[^a-z0-9.-]/g, '-')}/
                </code>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}