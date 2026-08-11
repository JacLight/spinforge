import React, { useState } from 'react';
import { Settings, Zap, Database, Shield, Globe, Server, Package, Plus, Trash2 } from 'lucide-react';

interface SettingsTabProps {
  vhost: any;
  isEditing: boolean;
  formData: any;
  setFormData: (data: any) => void;
}

export default function SettingsTab({ vhost, isEditing, formData, setFormData }: SettingsTabProps) {
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvValue, setNewEnvValue] = useState('');

  // Environment variables for containers
  const addEnvVar = () => {
    if (newEnvKey && newEnvValue) {
      // Ensure env is always an object, not an array
      const currentEnv = formData.containerConfig?.env || {};
      const cleanEnv = Array.isArray(currentEnv) ? {} : currentEnv;
      
      setFormData({
        ...formData,
        containerConfig: {
          ...formData.containerConfig,
          env: {
            ...cleanEnv,
            [newEnvKey]: newEnvValue
          }
        }
      });
      setNewEnvKey('');
      setNewEnvValue('');
    }
  };

  const removeEnvVar = (key: string) => {
    const currentEnv = formData.containerConfig?.env || {};
    const cleanEnv = Array.isArray(currentEnv) ? {} : currentEnv;
    const { [key]: _, ...restEnv } = cleanEnv;
    
    setFormData({
      ...formData,
      containerConfig: {
        ...formData.containerConfig,
        env: restEnv
      }
    });
  };

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

            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-700">Transparent Proxy</label>
                <p className="text-xs text-gray-500 mt-1">Remove proxy identification headers (stealth mode)</p>
              </div>
              {isEditing ? (
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.transparentProxy || false}
                    onChange={(e) => setFormData({ ...formData, transparentProxy: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              ) : (
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  formData.transparentProxy ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {formData.transparentProxy ? 'Enabled' : 'Disabled'}
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
            <Package className="h-5 w-5 text-purple-500" />
            Container Configuration
          </h3>
          
          <div className="space-y-4">
            {/* Basic Container Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Docker Image</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.containerConfig?.image || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      containerConfig: { ...formData.containerConfig, image: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="nginx:alpine"
                  />
                ) : (
                  <code className="block px-3 py-2 bg-gray-100 rounded-lg text-sm">
                    {formData.containerConfig?.image || 'Not set'}
                  </code>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
                {isEditing ? (
                  <input
                    type="number"
                    value={formData.containerConfig?.port || 3000}
                    onChange={(e) => setFormData({
                      ...formData,
                      containerConfig: { ...formData.containerConfig, port: parseInt(e.target.value) }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                ) : (
                  <code className="block px-3 py-2 bg-gray-100 rounded-lg text-sm">
                    {formData.containerConfig?.port || 3000}
                  </code>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Container Name</label>
              <code className="block px-3 py-2 bg-gray-100 rounded-lg text-sm">
                {vhost.containerName || vhost.domain.replace(/\./g, '-')}
              </code>
            </div>

            {/* Environment Variables */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Environment Variables</label>
              <div className="space-y-2">
                {(() => {
                  const env = formData.containerConfig?.env || {};
                  // Filter out any numeric keys or invalid entries
                  const validEntries = Object.entries(env).filter(([key, value]) => {
                    // Skip numeric keys (from array corruption) and object values
                    return isNaN(Number(key)) && typeof value !== 'object';
                  });
                  
                  if (validEntries.length === 0 && !isEditing) {
                    return (
                      <div className="text-sm text-gray-500 p-2">
                        No environment variables configured
                      </div>
                    );
                  }
                  
                  return validEntries.map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                      {isEditing ? (
                        <>
                          <input
                            type="text"
                            value={key}
                            onChange={(e) => {
                              const newEnv = { ...env };
                              delete newEnv[key];
                              newEnv[e.target.value] = value;
                              setFormData({
                                ...formData,
                                containerConfig: { ...formData.containerConfig, env: newEnv }
                              });
                            }}
                            className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm font-mono"
                            placeholder="KEY"
                          />
                          <span className="text-gray-500">=</span>
                          <input
                            type="text"
                            value={String(value)}
                            onChange={(e) => {
                              setFormData({
                                ...formData,
                                containerConfig: {
                                  ...formData.containerConfig,
                                  env: { ...env, [key]: e.target.value }
                                }
                              });
                            }}
                            className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                            placeholder="value"
                          />
                          <button
                            onClick={() => removeEnvVar(key)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <code className="flex-1 text-sm">
                          <span className="text-blue-600">{key}</span>
                          <span className="text-gray-500">=</span>
                          <span className="text-green-600">"{String(value)}"</span>
                        </code>
                      )}
                    </div>
                  ));
                })()}
                
                {isEditing && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newEnvKey}
                      onChange={(e) => setNewEnvKey(e.target.value)}
                      placeholder="KEY"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                    />
                    <input
                      type="text"
                      value={newEnvValue}
                      onChange={(e) => setNewEnvValue(e.target.value)}
                      placeholder="value"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <button
                      onClick={addEnvVar}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
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