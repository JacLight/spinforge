/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import React from 'react';
import { Server, ExternalLink } from 'lucide-react';

interface ProxySiteConfigProps {
  target: string;
  preserveHost: boolean;
  websocketSupport: boolean;
  onTargetChange: (value: string) => void;
  onPreserveHostChange: (value: boolean) => void;
  onWebsocketSupportChange: (value: boolean) => void;
}

export default function ProxySiteConfig({
  target,
  preserveHost,
  websocketSupport,
  onTargetChange,
  onPreserveHostChange,
  onWebsocketSupportChange,
}: ProxySiteConfigProps) {
  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="proxyTarget" className="block text-sm font-medium text-gray-700 mb-2">
          Target URL <span className="text-red-500">*</span>
        </label>
        <input
          type="url"
          id="proxyTarget"
          value={target}
          onChange={(e) => onTargetChange(e.target.value)}
          className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm"
          placeholder="https://example.com"
          required
        />
        <p className="mt-1 text-xs text-gray-500">
          The upstream server to forward requests to
        </p>
      </div>

      {/* Proxy Options */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-900">Proxy Options</h4>
        
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={preserveHost}
            onChange={(e) => onPreserveHostChange(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <span className="ml-2 text-sm text-gray-700">
            Preserve Host Header
          </span>
        </label>
        
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={websocketSupport}
            onChange={(e) => onWebsocketSupportChange(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <span className="ml-2 text-sm text-gray-700">
            WebSocket Support
          </span>
        </label>
      </div>

      {/* Proxy Info */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start">
          <Server className="h-5 w-5 text-green-600 mt-0.5" />
          <div className="ml-3">
            <h4 className="text-sm font-medium text-green-900">Reverse Proxy</h4>
            <p className="text-sm text-green-700 mt-1">
              Forward requests to an external server while keeping your domain.
              Perfect for APIs, microservices, or legacy applications.
            </p>
            <div className="mt-2 text-xs text-green-600">
              <p>• SSL termination at edge</p>
              <p>• Request/response header manipulation</p>
              <p>• Load balancing and failover support</p>
              {websocketSupport && <p>• WebSocket connection upgrade</p>}
            </div>
            {target && (
              <div className="mt-3 flex items-center gap-1 text-xs text-green-700">
                <span>Proxying to:</span>
                <ExternalLink className="h-3 w-3" />
                <code className="bg-green-100 px-1 py-0.5 rounded">{target}</code>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}