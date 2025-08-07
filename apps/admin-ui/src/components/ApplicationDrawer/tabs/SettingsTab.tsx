import React from 'react';
import { Settings, Zap, Database, Shield, Globe, Server } from 'lucide-react';

interface SettingsTabProps {
  vhost: any;
  isEditing: boolean;
  formData: any;
  setFormData: (data: any) => void;
}

export default function SettingsTab({ vhost, isEditing, formData, setFormData }: SettingsTabProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Settings & Configuration</h2>
      
      {/* General Settings */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
        <h3 className="text-md font-semibold text-gray-900 mb-4">General Settings</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700">Application Status</label>
              <p className="text-xs text-gray-500 mt-1">Enable or disable this application</p>
            </div>
            {isEditing ? (
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            ) : (
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                formData.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {formData.enabled ? 'Enabled' : 'Disabled'}
              </span>
            )}
          </div>

          {/* Customer ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer ID</label>
            {isEditing ? (
              <input
                type="text"
                value={formData.customerId || ''}
                onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                placeholder="Optional customer identifier"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <code className="text-sm bg-gray-100 px-3 py-1 rounded">
                {formData.customerId || 'Not set'}
              </code>
            )}
          </div>
        </div>
      </div>

      {/* Proxy Settings (for proxy type) */}
      {vhost.type === 'proxy' && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
          <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Server className="h-4 w-4 text-blue-500" />
            Proxy Settings
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-700">Preserve Host Header</label>
                <p className="text-xs text-gray-500 mt-1">Keep original host header when forwarding requests</p>
              </div>
              {isEditing ? (
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.preserveHost}
                    onChange={(e) => setFormData({ ...formData, preserveHost: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              ) : (
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  formData.preserveHost ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {formData.preserveHost ? 'Enabled' : 'Disabled'}
                </span>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Proxy Timeout</label>
              <code className="text-sm bg-gray-100 px-3 py-1 rounded">60 seconds</code>
            </div>
          </div>
        </div>
      )}

      {/* Container Settings (for container type) */}
      {vhost.type === 'container' && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
          <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Database className="h-4 w-4 text-purple-500" />
            Container Configuration
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Container Port</label>
              {isEditing ? (
                <input
                  type="number"
                  value={formData.containerConfig?.port || 3000}
                  onChange={(e) => setFormData({
                    ...formData,
                    containerConfig: { ...formData.containerConfig, port: parseInt(e.target.value) }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <code className="text-sm bg-gray-100 px-3 py-1 rounded">
                  {formData.containerConfig?.port || 3000}
                </code>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Environment Variables</label>
              <div className="bg-gray-50 rounded-lg p-4 font-mono text-xs">
                {Object.entries(formData.containerConfig?.env || {}).map(([key, value]) => (
                  <div key={key} className="py-1">
                    <span className="text-blue-600">{key}</span>=<span className="text-gray-700">{String(value)}</span>
                  </div>
                ))}
                {Object.keys(formData.containerConfig?.env || {}).length === 0 && (
                  <span className="text-gray-500">No environment variables configured</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Load Balancer Settings (for loadbalancer type) */}
      {vhost.type === 'loadbalancer' && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
          <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Zap className="h-4 w-4 text-green-500" />
            Load Balancer Settings
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Load Balancing Method</label>
              <code className="text-sm bg-gray-100 px-3 py-1 rounded">Round Robin</code>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Health Check</label>
              <div className="flex items-center gap-2">
                <code className="text-sm bg-gray-100 px-3 py-1 rounded">Enabled</code>
                <span className="text-xs text-gray-500">Interval: 30s</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Backend Servers</label>
              <div className="space-y-2 mt-2">
                {(formData.backends || []).map((backend: any, index: number) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                    <code className="text-sm bg-gray-100 px-3 py-1 rounded flex-1">
                      {typeof backend === 'string' ? backend : backend.url}
                    </code>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Settings */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
        <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Shield className="h-4 w-4 text-orange-500" />
          Advanced Settings
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">HTTP Headers</label>
            <div className="bg-gray-50 rounded-lg p-4 font-mono text-xs space-y-1">
              <div><span className="text-gray-500">X-Real-IP:</span> <span className="text-gray-700">$remote_addr</span></div>
              <div><span className="text-gray-500">X-Forwarded-For:</span> <span className="text-gray-700">$proxy_add_x_forwarded_for</span></div>
              <div><span className="text-gray-500">X-Forwarded-Proto:</span> <span className="text-gray-700">$scheme</span></div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rate Limiting</label>
            <code className="text-sm bg-gray-100 px-3 py-1 rounded">
              {vhost.rateLimit || '100 requests/minute'}
            </code>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Access Logs</label>
            <code className="text-sm bg-gray-100 px-3 py-1 rounded">
              /var/log/nginx/{vhost.domain}.access.log
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}