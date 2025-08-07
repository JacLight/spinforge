import React, { useState, useEffect } from 'react';
import { Shield, Key, Globe, ChevronRight, Trash2, Plus, Lock, Unlock, Copy, Check, AlertCircle, X, Info, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface ProtectedRoutesTabProps {
  vhost: any;
  isEditing: boolean;
}

export default function ProtectedRoutesTab({ vhost, isEditing }: ProtectedRoutesTabProps) {
  const [activeSection, setActiveSection] = useState<'routes' | 'oauth' | 'custom' | 'keys'>('routes');
  const [isProtectionEnabled, setIsProtectionEnabled] = useState(false);
  const [pathRules, setPathRules] = useState<any[]>([]);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddRouteForm, setShowAddRouteForm] = useState(false);
  const [showAddKeyForm, setShowAddKeyForm] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [showKeys, setShowKeys] = useState<Set<string>>(new Set());
  
  const [newRoute, setNewRoute] = useState({
    pattern: '/*',
    authType: 'apiKey',
    requiredKey: '',
    rateLimit: { enabled: false, requests: 100, window: 60 },
    unauthorizedAction: 'redirect',
    unauthorizedRedirect: '/login'
  });

  const [newApiKey, setNewApiKey] = useState({
    name: '',
    key: '',
    autoGenerate: true
  });

  const [oauthConfig, setOauthConfig] = useState({
    enabled: false,
    authUrl: '',
    tokenUrl: '',
    clientId: '',
    clientSecret: '',
    redirectUri: `https://${vhost.domain}/_oauth/callback`,
    scope: 'openid email profile',
    unauthorizedRedirect: '/login',
    cookieSettings: {
      setAuthToken: true,
      tokenCookieName: 'auth_token',
      additionalClaims: [] as string[], // Claims from auth payload to store in cookies
      cookieExpiry: 3600 // seconds
    }
  });

  const [customAuthConfig, setCustomAuthConfig] = useState({
    enabled: false,
    authUrl: '',
    method: 'POST',
    headers: {} as Record<string, string>,
    bodyParams: {} as Record<string, string>,
    responseMapping: {
      tokenField: 'token',
      userIdField: 'userId',
      additionalFields: [] as { responseField: string; cookieName: string }[]
    },
    unauthorizedRedirect: '/login',
    cookieExpiry: 3600
  });

  // Load auth configuration
  useEffect(() => {
    loadAuthConfig();
  }, [vhost.domain]);

  const loadAuthConfig = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/api/sites/${vhost.domain}/auth`);
      if (response.ok) {
        const data = await response.json();
        setIsProtectionEnabled(data.enabled || false);
        setPathRules(data.authRules?.paths || []);
        setApiKeys(data.authRules?.apiKeys || []);
      }
    } catch (error) {
      console.error('Failed to load auth config:', error);
    }
  };

  const toggleProtection = async () => {
    const newState = !isProtectionEnabled;
    setIsProtectionEnabled(newState);
    
    if (!newState) {
      setIsLoading(true);
      try {
        for (const rule of pathRules) {
          await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/api/sites/${vhost.domain}/auth/paths/${rule.id}`, {
            method: 'DELETE'
          });
        }
        
        for (const key of apiKeys) {
          await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/api/sites/${vhost.domain}/auth/keys/${key.id}`, {
            method: 'DELETE'
          });
        }
        
        setPathRules([]);
        setApiKeys([]);
        toast.success('Protection disabled');
      } catch (error) {
        toast.error('Failed to disable protection');
        setIsProtectionEnabled(true);
      } finally {
        setIsLoading(false);
      }
    } else {
      toast.success('Protection enabled - add routes to protect');
    }
  };

  const generateApiKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = 'sk_';
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  };

  const addRoute = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/api/sites/${vhost.domain}/auth/paths`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRoute)
      });
      
      if (response.ok) {
        const data = await response.json();
        setPathRules([...pathRules, data.rule]);
        setShowAddRouteForm(false);
        toast.success('Route added');
      }
    } catch (error) {
      toast.error('Failed to add route');
    } finally {
      setIsLoading(false);
    }
  };

  const deletePathRule = async (ruleId: string) => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/api/sites/${vhost.domain}/auth/paths/${ruleId}`, {
        method: 'DELETE'
      });
      setPathRules(pathRules.filter(r => r.id !== ruleId));
      toast.success('Route removed');
    } catch (error) {
      toast.error('Failed to remove route');
    }
  };

  const addApiKey = async () => {
    setIsLoading(true);
    try {
      const keyValue = newApiKey.autoGenerate ? generateApiKey() : newApiKey.key;
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/api/sites/${vhost.domain}/auth/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newApiKey.name, key: keyValue })
      });
      
      if (response.ok) {
        const data = await response.json();
        setApiKeys([...apiKeys, { ...data.keyInfo, key: keyValue }]);
        setGeneratedKey(keyValue);
        setNewApiKey({ name: '', key: '', autoGenerate: true });
        toast.success('API key created - Save it now!');
      }
    } catch (error) {
      toast.error('Failed to create API key');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteApiKey = async (keyId: string) => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/api/sites/${vhost.domain}/auth/keys/${keyId}`, {
        method: 'DELETE'
      });
      setApiKeys(apiKeys.filter(k => k.id !== keyId));
      toast.success('API key deleted');
    } catch (error) {
      toast.error('Failed to delete API key');
    }
  };

  const copyApiKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Protection Toggle */}
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-900 flex items-center">
              <Lock className="w-4 h-4 mr-2" />
              Enable Route Protection
            </h3>
            <p className="text-xs text-gray-600 mt-1">
              Require authentication for specific routes
            </p>
          </div>
          <button
            onClick={toggleProtection}
            disabled={isLoading}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              isProtectionEnabled ? 'bg-green-600' : 'bg-gray-300'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isProtectionEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {isProtectionEnabled && (
        <>
          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveSection('routes')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeSection === 'routes'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Protected Routes
              </button>
              <button
                onClick={() => setActiveSection('oauth')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeSection === 'oauth'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                OAuth
              </button>
              <button
                onClick={() => setActiveSection('custom')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeSection === 'custom'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Custom Auth
              </button>
              <button
                onClick={() => setActiveSection('keys')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeSection === 'keys'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                API Keys ({apiKeys.length})
              </button>
            </nav>
          </div>

          {/* Protected Routes Section */}
          {activeSection === 'routes' && (
            <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-white/20 shadow p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-gray-900">Routes</h4>
                {!showAddRouteForm && (
                  <button
                    onClick={() => setShowAddRouteForm(true)}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    Add Route
                  </button>
                )}
              </div>

              {pathRules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between p-2 bg-gray-50 rounded mb-2">
                  <div className="flex items-center gap-2">
                    <code className="text-sm">{rule.pattern}</code>
                    <span className={`px-2 py-0.5 text-xs rounded ${
                      rule.authType === 'apiKey' ? 'bg-blue-100 text-blue-700' : 
                      rule.authType === 'custom' ? 'bg-green-100 text-green-700' :
                      'bg-purple-100 text-purple-700'
                    }`}>
                      {rule.authType}
                    </span>
                    {rule.unauthorizedRedirect && (
                      <span className="text-xs text-gray-500">→ {rule.unauthorizedRedirect}</span>
                    )}
                  </div>
                  <button
                    onClick={() => deletePathRule(rule.id)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}

              {showAddRouteForm && (
                <div className="border-t pt-3 mt-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={newRoute.pattern}
                      onChange={(e) => setNewRoute({ ...newRoute, pattern: e.target.value })}
                      placeholder="Path pattern"
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    <select
                      value={newRoute.authType}
                      onChange={(e) => setNewRoute({ ...newRoute, authType: e.target.value })}
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    >
                      <option value="apiKey">API Key</option>
                      <option value="oauth">OAuth</option>
                      <option value="custom">Custom Auth</option>
                    </select>
                  </div>
                  <input
                    type="text"
                    value={newRoute.unauthorizedRedirect}
                    onChange={(e) => setNewRoute({ ...newRoute, unauthorizedRedirect: e.target.value })}
                    placeholder="Unauthorized redirect URL (e.g., /login)"
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowAddRouteForm(false)}
                      className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={addRoute}
                      disabled={isLoading}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* OAuth Configuration Section */}
          {activeSection === 'oauth' && (
            <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-white/20 shadow p-4">
              <h4 className="font-medium text-gray-900 mb-4">OAuth Configuration</h4>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span className="text-sm">Enable OAuth</span>
                  <button
                    onClick={() => setOauthConfig({ ...oauthConfig, enabled: !oauthConfig.enabled })}
                    className={`relative inline-flex h-5 w-10 items-center rounded-full ${
                      oauthConfig.enabled ? 'bg-green-600' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white ${
                      oauthConfig.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                {oauthConfig.enabled && (
                  <>
                    <input
                      type="url"
                      value={oauthConfig.authUrl}
                      onChange={(e) => setOauthConfig({ ...oauthConfig, authUrl: e.target.value })}
                      placeholder="Authorization URL"
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                    <input
                      type="url"
                      value={oauthConfig.tokenUrl}
                      onChange={(e) => setOauthConfig({ ...oauthConfig, tokenUrl: e.target.value })}
                      placeholder="Token URL"
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={oauthConfig.clientId}
                        onChange={(e) => setOauthConfig({ ...oauthConfig, clientId: e.target.value })}
                        placeholder="Client ID"
                        className="px-3 py-2 border border-gray-300 rounded text-sm"
                      />
                      <input
                        type="password"
                        value={oauthConfig.clientSecret}
                        onChange={(e) => setOauthConfig({ ...oauthConfig, clientSecret: e.target.value })}
                        placeholder="Client Secret"
                        className="px-3 py-2 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    
                    <input
                      type="text"
                      value={oauthConfig.unauthorizedRedirect}
                      onChange={(e) => setOauthConfig({ ...oauthConfig, unauthorizedRedirect: e.target.value })}
                      placeholder="Unauthorized redirect URL (e.g., /login)"
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    />

                    {/* Cookie Settings */}
                    <div className="border-t pt-3">
                      <p className="text-sm font-medium text-gray-700 mb-2">Cookie Settings</p>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="text-xs">Set Auth Token in Cookie</span>
                          <button
                            onClick={() => setOauthConfig({
                              ...oauthConfig, 
                              cookieSettings: {
                                ...oauthConfig.cookieSettings,
                                setAuthToken: !oauthConfig.cookieSettings.setAuthToken
                              }
                            })}
                            className={`relative inline-flex h-4 w-8 items-center rounded-full ${
                              oauthConfig.cookieSettings.setAuthToken ? 'bg-blue-600' : 'bg-gray-300'
                            }`}
                          >
                            <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white ${
                              oauthConfig.cookieSettings.setAuthToken ? 'translate-x-4' : 'translate-x-1'
                            }`} />
                          </button>
                        </div>

                        {oauthConfig.cookieSettings.setAuthToken && (
                          <>
                            <input
                              type="text"
                              value={oauthConfig.cookieSettings.tokenCookieName}
                              onChange={(e) => setOauthConfig({
                                ...oauthConfig,
                                cookieSettings: {
                                  ...oauthConfig.cookieSettings,
                                  tokenCookieName: e.target.value
                                }
                              })}
                              placeholder="Token cookie name"
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                            
                            <input
                              type="number"
                              value={oauthConfig.cookieSettings.cookieExpiry}
                              onChange={(e) => setOauthConfig({
                                ...oauthConfig,
                                cookieSettings: {
                                  ...oauthConfig.cookieSettings,
                                  cookieExpiry: parseInt(e.target.value)
                                }
                              })}
                              placeholder="Cookie expiry (seconds)"
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            />

                            <div>
                              <p className="text-xs text-gray-600 mb-1">Additional Claims to Store in Cookies:</p>
                              <input
                                type="text"
                                value={oauthConfig.cookieSettings.additionalClaims.join(', ')}
                                onChange={(e) => setOauthConfig({
                                  ...oauthConfig,
                                  cookieSettings: {
                                    ...oauthConfig.cookieSettings,
                                    additionalClaims: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                                  }
                                })}
                                placeholder="e.g., email, name, user_id (comma-separated)"
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <button className="px-4 py-2 bg-blue-600 text-white rounded text-sm">
                      Save OAuth Config
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Custom Auth Section */}
          {activeSection === 'custom' && (
            <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-white/20 shadow p-4">
              <h4 className="font-medium text-gray-900 mb-4">Custom Authentication</h4>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span className="text-sm">Enable Custom Auth</span>
                  <button
                    onClick={() => setCustomAuthConfig({ ...customAuthConfig, enabled: !customAuthConfig.enabled })}
                    className={`relative inline-flex h-5 w-10 items-center rounded-full ${
                      customAuthConfig.enabled ? 'bg-green-600' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white ${
                      customAuthConfig.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                {customAuthConfig.enabled && (
                  <>
                    <div>
                      <label className="text-xs font-medium text-gray-700">Authentication Endpoint</label>
                      <input
                        type="url"
                        value={customAuthConfig.authUrl}
                        onChange={(e) => setCustomAuthConfig({ ...customAuthConfig, authUrl: e.target.value })}
                        placeholder="https://api.example.com/auth/verify"
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm mt-1"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-medium text-gray-700">HTTP Method</label>
                        <select
                          value={customAuthConfig.method}
                          onChange={(e) => setCustomAuthConfig({ ...customAuthConfig, method: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm mt-1"
                        >
                          <option value="POST">POST</option>
                          <option value="GET">GET</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-700">Cookie Expiry (seconds)</label>
                        <input
                          type="number"
                          value={customAuthConfig.cookieExpiry}
                          onChange={(e) => setCustomAuthConfig({ ...customAuthConfig, cookieExpiry: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm mt-1"
                        />
                      </div>
                    </div>

                    <input
                      type="text"
                      value={customAuthConfig.unauthorizedRedirect}
                      onChange={(e) => setCustomAuthConfig({ ...customAuthConfig, unauthorizedRedirect: e.target.value })}
                      placeholder="Unauthorized redirect URL (e.g., /login)"
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    />

                    {/* Response Mapping */}
                    <div className="border-t pt-3">
                      <p className="text-sm font-medium text-gray-700 mb-2">Response Field Mapping</p>
                      
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={customAuthConfig.responseMapping.tokenField}
                            onChange={(e) => setCustomAuthConfig({
                              ...customAuthConfig,
                              responseMapping: {
                                ...customAuthConfig.responseMapping,
                                tokenField: e.target.value
                              }
                            })}
                            placeholder="Token field name (e.g., token)"
                            className="px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                          <input
                            type="text"
                            value={customAuthConfig.responseMapping.userIdField}
                            onChange={(e) => setCustomAuthConfig({
                              ...customAuthConfig,
                              responseMapping: {
                                ...customAuthConfig.responseMapping,
                                userIdField: e.target.value
                              }
                            })}
                            placeholder="User ID field (e.g., userId)"
                            className="px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </div>

                        <div>
                          <p className="text-xs text-gray-600 mb-1">Additional Fields to Store in Cookies:</p>
                          <div className="space-y-1">
                            {customAuthConfig.responseMapping.additionalFields.map((field, idx) => (
                              <div key={idx} className="flex gap-2">
                                <input
                                  type="text"
                                  value={field.responseField}
                                  onChange={(e) => {
                                    const fields = [...customAuthConfig.responseMapping.additionalFields];
                                    fields[idx] = { ...fields[idx], responseField: e.target.value };
                                    setCustomAuthConfig({
                                      ...customAuthConfig,
                                      responseMapping: {
                                        ...customAuthConfig.responseMapping,
                                        additionalFields: fields
                                      }
                                    });
                                  }}
                                  placeholder="Response field"
                                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                                <input
                                  type="text"
                                  value={field.cookieName}
                                  onChange={(e) => {
                                    const fields = [...customAuthConfig.responseMapping.additionalFields];
                                    fields[idx] = { ...fields[idx], cookieName: e.target.value };
                                    setCustomAuthConfig({
                                      ...customAuthConfig,
                                      responseMapping: {
                                        ...customAuthConfig.responseMapping,
                                        additionalFields: fields
                                      }
                                    });
                                  }}
                                  placeholder="Cookie name"
                                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                                <button
                                  onClick={() => {
                                    const fields = customAuthConfig.responseMapping.additionalFields.filter((_, i) => i !== idx);
                                    setCustomAuthConfig({
                                      ...customAuthConfig,
                                      responseMapping: {
                                        ...customAuthConfig.responseMapping,
                                        additionalFields: fields
                                      }
                                    });
                                  }}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => {
                                setCustomAuthConfig({
                                  ...customAuthConfig,
                                  responseMapping: {
                                    ...customAuthConfig.responseMapping,
                                    additionalFields: [
                                      ...customAuthConfig.responseMapping.additionalFields,
                                      { responseField: '', cookieName: '' }
                                    ]
                                  }
                                });
                              }}
                              className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
                            >
                              <Plus className="h-3 w-3 inline mr-1" />
                              Add Field Mapping
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <button className="px-4 py-2 bg-blue-600 text-white rounded text-sm">
                      Save Custom Auth Config
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* API Keys Section */}
          {activeSection === 'keys' && (
            <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-white/20 shadow p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-gray-900">API Keys</h4>
                {!showAddKeyForm && (
                  <button
                    onClick={() => {
                      setShowAddKeyForm(true);
                      setGeneratedKey(null);
                    }}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    Generate Key
                  </button>
                )}
              </div>

              {apiKeys.map((key) => (
                <div key={key.id} className="flex items-center justify-between p-2 bg-gray-50 rounded mb-2">
                  <div>
                    <p className="text-sm font-medium">{key.name}</p>
                    <div className="flex items-center gap-2">
                      {showKeys.has(key.id) && key.key ? (
                        <>
                          <code className="text-xs">{key.key}</code>
                          <button
                            onClick={() => {
                              const newShowKeys = new Set(showKeys);
                              newShowKeys.delete(key.id);
                              setShowKeys(newShowKeys);
                            }}
                            className="p-0.5 hover:bg-gray-200 rounded"
                          >
                            <EyeOff className="h-3 w-3" />
                          </button>
                        </>
                      ) : (
                        <>
                          <code className="text-xs text-gray-500">sk_••••••••</code>
                          {key.key && (
                            <button
                              onClick={() => {
                                const newShowKeys = new Set(showKeys);
                                newShowKeys.add(key.id);
                                setShowKeys(newShowKeys);
                              }}
                              className="p-0.5 hover:bg-gray-200 rounded"
                            >
                              <Eye className="h-3 w-3" />
                            </button>
                          )}
                        </>
                      )}
                      {key.key && (
                        <button
                          onClick={() => copyApiKey(key.key)}
                          className="p-0.5 hover:bg-gray-200 rounded"
                        >
                          {copiedKey ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                        </button>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteApiKey(key.id)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}

              {showAddKeyForm && (
                <div className="border-t pt-3 mt-3 space-y-2">
                  <input
                    type="text"
                    value={newApiKey.name}
                    onChange={(e) => setNewApiKey({ ...newApiKey, name: e.target.value })}
                    placeholder="Key name"
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                  
                  {!newApiKey.autoGenerate && (
                    <input
                      type="text"
                      value={newApiKey.key}
                      onChange={(e) => setNewApiKey({ ...newApiKey, key: e.target.value })}
                      placeholder="Custom API key"
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono"
                    />
                  )}

                  {generatedKey && (
                    <div className="p-2 bg-green-50 border border-green-200 rounded">
                      <p className="text-xs font-medium text-green-900 mb-1">Generated Key - Save it!</p>
                      <code className="text-xs font-mono break-all">{generatedKey}</code>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setShowAddKeyForm(false);
                        setGeneratedKey(null);
                      }}
                      className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm"
                    >
                      {generatedKey ? 'Done' : 'Cancel'}
                    </button>
                    {!generatedKey && (
                      <button
                        onClick={addApiKey}
                        disabled={isLoading}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                      >
                        Generate
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}